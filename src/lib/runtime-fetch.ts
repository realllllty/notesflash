import { invoke } from '@tauri-apps/api/core';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import {
  getDesktopNetworkSnapshot,
  type DesktopNetworkSnapshot
} from './network-settings';

type FetchImplementation = (
  input: URL | Request | string,
  init?: RequestInit
) => Promise<Response>;

interface NativeClientOptions {
  maxRedirections?: number;
  connectTimeout?: number;
  proxy?: NonNullable<DesktopNetworkSnapshot['nativeProxy']>;
}

type NativeFetchImplementation = (
  input: URL | Request | string,
  init?: RequestInit & NativeClientOptions
) => Promise<Response>;

export interface RuntimeFetchAdapters {
  isTauri: boolean;
  browserFetch: FetchImplementation;
  loadNativeFetch: () => Promise<NativeFetchImplementation>;
  getNetworkSnapshot?: () => DesktopNetworkSnapshot;
  diagnoseNativeNetwork?: (
    endpoint: string,
    proxyUrl?: string
  ) => Promise<NativeNetworkDiagnostic>;
}

export type RuntimeTransport = 'browser' | 'native';

export interface NativeNetworkDiagnostic {
  networkOk: boolean;
  healthOk: boolean;
  targetHost?: string | null;
  proxyMode: string;
  phase: string;
  category: string;
  status?: number | null;
  elapsedMs: number;
  topError?: string | null;
  sourceChain: string[];
  isTimeout: boolean;
  isConnect: boolean;
  isRequest: boolean;
  isBuilder: boolean;
  isStatus: boolean;
  isRedirect: boolean;
  isBody: boolean;
  isDecode: boolean;
}

const NATIVE_CONNECT_TIMEOUT_MS = 15_000;
const BROWSER_PROBE_TIMEOUT_MS = 10_000;
const NATIVE_PROBE_TIMEOUT_MS = 15_000;
const TRANSPORT_FALLBACK_DELAY_MS = 300;
const TRANSPORT_PROBE_BEARER = 'notesflash-transport-probe';
const PROBE_CANCELLED = Symbol('notesflash-probe-cancelled');

const transportSelections = new Map<string, TransportSelectionEntry>();
const resolvedTransports = new Map<string, SelectedTransport>();
const failedTransports = new Map<string, FailedTransport>();
let responseTransports = new WeakMap<Response, ResponseTransportOwnership>();
let transportGeneration = 0;

export class NativeHttpError extends Error {
  constructor(public readonly nativeCause: unknown) {
    super(`Tauri native HTTP failed: ${runtimeCauseSummary(nativeCause)}`);
    this.name = 'NativeHttpError';
  }
}

export class TransportProbeError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly browserCause: unknown,
    public readonly nativeCause: unknown
  ) {
    super(
      `Both desktop transports failed for ${endpoint}; browser: ${runtimeCauseSummary(browserCause)}; ` +
      `native: ${runtimeCauseSummary(nativeCause)}`
    );
    this.name = 'TransportProbeError';
  }
}

export class TransportProbeTimeoutError extends Error {
  constructor(
    public readonly transport: RuntimeTransport,
    public readonly timeoutMs: number
  ) {
    super(`${transport} health probe timed out after ${timeoutMs} ms`);
    this.name = 'TransportProbeTimeoutError';
  }
}

export class ManualProxyProbeError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly nativeCause: unknown
  ) {
    super(
      `Desktop native transport failed through the configured proxy for ${endpoint}: ` +
      runtimeCauseSummary(nativeCause)
    );
    this.name = 'ManualProxyProbeError';
  }
}

export class NativeNetworkDiagnosticError extends Error {
  constructor(
    public readonly nativeCause: unknown,
    public readonly diagnostic: NativeNetworkDiagnostic
  ) {
    const details = [diagnostic.topError, ...diagnostic.sourceChain]
      .filter((value): value is string => Boolean(value))
      .join(' -> ');
    const diagnosticSummary = diagnostic.networkOk
      ? `native diagnostic reached the Worker${diagnostic.status ? ` (HTTP ${diagnostic.status})` : ''}`
      : `native diagnostic ${diagnostic.category}${details ? `: ${details}` : ''}`;
    super(`${runtimeCauseSummary(nativeCause)}; ${diagnosticSummary}`);
    this.name = 'NativeNetworkDiagnosticError';
  }
}

type ProbeOutcome =
  | { transport: RuntimeTransport; ok: true }
  | { transport: RuntimeTransport; ok: false; cause: unknown; cancelled: boolean };

interface ActiveProbe {
  transport: RuntimeTransport;
  outcome: Promise<ProbeOutcome>;
  cancelAsLoser: () => void;
}

interface SelectedTransport {
  transport: RuntimeTransport;
  revision: number;
  generation: number;
}

interface TransportSelectionEntry {
  revision: number;
  generation: number;
  promise: Promise<SelectedTransport>;
}

interface FailedTransport {
  transport: RuntimeTransport;
  revision: number;
}

type ResponseTransportOwnership = SelectedTransport;

export function isTauriRuntime(scope: typeof globalThis = globalThis): boolean {
  return '__TAURI_INTERNALS__' in scope;
}

/**
 * Web/PWA traffic uses the platform Fetch API directly. On desktop, NotesFlash
 * first probes a harmless health endpoint and chooses one transport for the
 * endpoint before any pairing or mutation is sent. A failed business request
 * is never replayed through the other transport.
 */
export async function runtimeFetch(
  input: URL | Request | string,
  init?: RequestInit,
  adapters: RuntimeFetchAdapters = defaultAdapters()
): Promise<Response> {
  if (!adapters.isTauri) return adapters.browserFetch(input, init);

  const endpoint = runtimeEndpointForRequest(input);
  throwIfAborted(init?.signal);

  let network: DesktopNetworkSnapshot;
  let selected: SelectedTransport;
  // Network settings can change while the harmless probe is in flight. Never
  // send a pairing or mutation through a selection made for an older proxy
  // revision; simply repeat the harmless selection for the latest revision.
  while (true) {
    network = runtimeNetworkSnapshot(adapters);
    selected = await waitForSelection(
      selectDesktopTransport(endpoint, adapters, network),
      init?.signal
    );
    throwIfAborted(init?.signal);
    if (runtimeNetworkSnapshot(adapters).revision === selected.revision) break;
  }

  try {
    const response = selected.transport === 'browser'
      ? await adapters.browserFetch(input, init)
      : await nativeRequest(input, init, adapters, network.nativeProxy);
    responseTransports.set(response, selected);
    return response;
  } catch (error) {
    // The explicit Retry action should run a fresh harmless probe. Do not
    // replay this request automatically: it may be a pairing or write request.
    // A caller-requested abort says nothing about transport health.
    if (init?.signal?.aborted) throw abortReason(init.signal);
    markSelectedTransportFailed(endpoint, selected);
    if (selected.transport === 'native') throw new NativeHttpError(error);
    throw error;
  }
}

export function runtimeTransportForEndpoint(endpoint: string): RuntimeTransport | undefined {
  return resolvedTransports.get(normalizeTransportEndpoint(endpoint))?.transport;
}

export function runtimeTransportForResponse(response: Response): RuntimeTransport | undefined {
  return responseTransports.get(response)?.transport;
}

export function markRuntimeResponseFailed(endpoint: string, response: Response): void {
  const ownership = responseTransports.get(response);
  if (ownership) markSelectedTransportFailed(endpoint, ownership);
}

export function invalidateRuntimeTransport(endpoint?: string): void {
  if (!endpoint) {
    transportSelections.clear();
    resolvedTransports.clear();
    failedTransports.clear();
    responseTransports = new WeakMap<Response, ResponseTransportOwnership>();
    return;
  }
  const key = normalizeTransportEndpoint(endpoint);
  transportSelections.delete(key);
  resolvedTransports.delete(key);
  failedTransports.delete(key);
}

export function markRuntimeTransportFailed(
  endpoint: string,
  transport: RuntimeTransport
): void {
  const key = normalizeTransportEndpoint(endpoint);
  const selected = resolvedTransports.get(key);
  if (selected?.transport === transport) markSelectedTransportFailed(key, selected);
}

function markSelectedTransportFailed(
  endpoint: string,
  selected: SelectedTransport
): void {
  const key = normalizeTransportEndpoint(endpoint);
  const active = transportSelections.get(key);
  const resolved = resolvedTransports.get(key);
  if (
    active?.generation !== selected.generation &&
    resolved?.generation !== selected.generation
  ) {
    return;
  }

  if (active?.generation === selected.generation) transportSelections.delete(key);
  if (resolved?.generation === selected.generation) resolvedTransports.delete(key);
  failedTransports.set(key, {
    transport: selected.transport,
    revision: selected.revision
  });
}

export function runtimeEndpointForRequest(input: URL | Request | string): string {
  const rawUrl = input instanceof Request ? input.url : String(input);
  const base = typeof globalThis.location?.href === 'string'
    ? globalThis.location.href
    : 'http://localhost/';
  const url = new URL(rawUrl, base);
  const apiMarker = url.pathname.indexOf('/api/');
  const endpointPath = apiMarker >= 0 ? url.pathname.slice(0, apiMarker) : '';
  url.pathname = endpointPath || '/';
  url.search = '';
  url.hash = '';
  return url.pathname === '/' ? url.origin : `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

async function selectDesktopTransport(
  endpoint: string,
  adapters: RuntimeFetchAdapters,
  network: DesktopNetworkSnapshot
): Promise<SelectedTransport> {
  const key = normalizeTransportEndpoint(endpoint);
  const existing = transportSelections.get(key);
  if (existing?.revision === network.revision) return existing.promise;

  if (existing) {
    transportSelections.delete(key);
    resolvedTransports.delete(key);
  }
  if (failedTransports.get(key)?.revision !== network.revision) {
    failedTransports.delete(key);
  }

  const generation = ++transportGeneration;
  const entry = {} as TransportSelectionEntry;
  const selection = probeDesktopTransport(key, adapters, network)
    .then((transport) => {
      const selected = { transport, revision: network.revision, generation };
      if (transportSelections.get(key) === entry) {
        resolvedTransports.set(key, selected);
      }
      return selected;
    })
    .catch((error) => {
      if (transportSelections.get(key) === entry) {
        transportSelections.delete(key);
        resolvedTransports.delete(key);
      }
      throw error;
    });
  Object.assign(entry, { revision: network.revision, generation, promise: selection });
  transportSelections.set(key, entry);
  return selection;
}

async function probeDesktopTransport(
  endpoint: string,
  adapters: RuntimeFetchAdapters,
  network: DesktopNetworkSnapshot
): Promise<RuntimeTransport> {
  const healthUrl = `${endpoint}/api/health?transportProbe=${probeNonce()}`;
  if (network.mode === 'manual') {
    const manualProbe = startTransportProbe('native', healthUrl, adapters, network);
    const outcome = await manualProbe.outcome;
    if (outcome.ok) return outcome.transport;
    throw new ManualProxyProbeError(
      endpoint,
      await enhanceNativeProbeCause(endpoint, network, outcome.cause, adapters)
    );
  }

  const previousFailure = failedTransports.get(endpoint);
  const order: RuntimeTransport[] = previousFailure?.transport === 'browser'
    ? ['native', 'browser']
    : ['browser', 'native'];
  const causes = new Map<RuntimeTransport, unknown>();
  let enhancedNativeCause: Promise<unknown> | undefined;
  const rememberFailure = (outcome: Exclude<ProbeOutcome, { ok: true }>) => {
    if (outcome.cancelled) return;
    causes.set(outcome.transport, outcome.cause);
    if (outcome.transport === 'native') {
      enhancedNativeCause = enhanceNativeProbeCause(
        endpoint,
        network,
        outcome.cause,
        adapters
      );
    }
  };
  const primary = startTransportProbe(order[0], healthUrl, adapters, network);

  let fallbackTimer: number | undefined;
  const fallbackDelay = new Promise<'fallback'>((resolve) => {
    fallbackTimer = globalThis.setTimeout(
      () => resolve('fallback'),
      TRANSPORT_FALLBACK_DELAY_MS
    );
  });
  const initial = await Promise.race([
    primary.outcome.then((outcome) => ({ kind: 'primary' as const, outcome })),
    fallbackDelay.then(() => ({ kind: 'fallback' as const }))
  ]);

  if (initial.kind === 'primary') {
    if (fallbackTimer !== undefined) globalThis.clearTimeout(fallbackTimer);
    if (initial.outcome.ok) return initial.outcome.transport;
    rememberFailure(initial.outcome);

    const fallback = startTransportProbe(order[1], healthUrl, adapters, network);
    const outcome = await fallback.outcome;
    if (outcome.ok) return outcome.transport;
    rememberFailure(outcome);
  } else {
    const fallback = startTransportProbe(order[1], healthUrl, adapters, network);
    const winner = await Promise.race([
      primary.outcome.then((outcome) => ({ probe: primary, other: fallback, outcome })),
      fallback.outcome.then((outcome) => ({ probe: fallback, other: primary, outcome }))
    ]);

    if (winner.outcome.ok) {
      winner.other.cancelAsLoser();
      return winner.outcome.transport;
    }
    rememberFailure(winner.outcome);

    const remaining = await winner.other.outcome;
    if (remaining.ok) return remaining.transport;
    rememberFailure(remaining);
  }

  throw new TransportProbeError(
    endpoint,
    causes.get('browser'),
    enhancedNativeCause ? await enhancedNativeCause : causes.get('native')
  );
}

function startTransportProbe(
  transport: RuntimeTransport,
  healthUrl: string,
  adapters: RuntimeFetchAdapters,
  network: DesktopNetworkSnapshot
): ActiveProbe {
  const controller = new AbortController();
  const timeoutMs = transport === 'browser'
    ? BROWSER_PROBE_TIMEOUT_MS
    : NATIVE_PROBE_TIMEOUT_MS;
  let timeout: number | undefined;
  let cancelProbe: ((reason: typeof PROBE_CANCELLED) => void) | undefined;
  let settled = false;

  const request = performTransportProbe(
    transport,
    healthUrl,
    controller.signal,
    adapters,
    network.nativeProxy
  );
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = globalThis.setTimeout(() => {
      const timeoutError = new TransportProbeTimeoutError(transport, timeoutMs);
      // Reject our own deadline first so an implementation-specific AbortError
      // cannot hide the actionable timeout message.
      reject(timeoutError);
      controller.abort(timeoutError);
    }, timeoutMs);
  });
  const cancellationPromise = new Promise<never>((_resolve, reject) => {
    cancelProbe = reject;
  });

  const outcome: Promise<ProbeOutcome> = Promise.race([
    request,
    timeoutPromise,
    cancellationPromise
  ])
    .then((): ProbeOutcome => ({ transport, ok: true }))
    .catch((cause): ProbeOutcome => ({
      transport,
      ok: false,
      cause,
      cancelled: cause === PROBE_CANCELLED
    }))
    .finally(() => {
      settled = true;
      if (timeout !== undefined) globalThis.clearTimeout(timeout);
    });

  return {
    transport,
    outcome,
    cancelAsLoser: () => {
      if (settled) return;
      // Resolving the selection is normal control flow. Consume the losing
      // probe locally so it never becomes a failed transport or an unhandled
      // rejection after its fetch is aborted.
      cancelProbe?.(PROBE_CANCELLED);
      controller.abort();
    }
  };
}

async function performTransportProbe(
  transport: RuntimeTransport,
  healthUrl: string,
  signal: AbortSignal,
  adapters: RuntimeFetchAdapters,
  nativeProxy?: NonNullable<DesktopNetworkSnapshot['nativeProxy']>
): Promise<void> {
  const response = transport === 'browser'
    ? await adapters.browserFetch(healthUrl, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${TRANSPORT_PROBE_BEARER}`,
          'content-type': 'application/json'
        },
        signal
      })
    : await nativeRequest(healthUrl, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal
      }, adapters, nativeProxy);

  // Any HTTP response proves that the network transport is usable. Reading
  // the tiny body also validates the plugin response-stream IPC path.
  await response.arrayBuffer();
}

async function nativeRequest(
  input: URL | Request | string,
  init: RequestInit | undefined,
  adapters: RuntimeFetchAdapters,
  nativeProxy?: NonNullable<DesktopNetworkSnapshot['nativeProxy']>
): Promise<Response> {
  const nativeFetch = await adapters.loadNativeFetch();
  return nativeFetch(input, {
    ...init,
    // NotesFlash API routes never redirect. Refusing redirects prevents an
    // allowed Worker URL from forwarding the native client to another host.
    maxRedirections: 0,
    connectTimeout: NATIVE_CONNECT_TIMEOUT_MS,
    ...(nativeProxy ? { proxy: nativeProxy } : {})
  });
}

function defaultAdapters(): RuntimeFetchAdapters {
  return {
    isTauri: isTauriRuntime(),
    browserFetch: (input, init) => globalThis.fetch(input, init),
    loadNativeFetch: async () => tauriFetch as NativeFetchImplementation,
    getNetworkSnapshot: getDesktopNetworkSnapshot,
    diagnoseNativeNetwork: (endpoint, proxyUrl) => invoke<NativeNetworkDiagnostic>(
      'diagnose_worker_network',
      { endpoint, proxyUrl: proxyUrl || null }
    )
  };
}

function runtimeNetworkSnapshot(adapters: RuntimeFetchAdapters): DesktopNetworkSnapshot {
  return adapters.getNetworkSnapshot?.() ?? {
    mode: 'system',
    proxyUrl: '',
    revision: 0
  };
}

async function waitForSelection(
  selection: Promise<SelectedTransport>,
  signal?: AbortSignal | null
): Promise<SelectedTransport> {
  if (!signal) return selection;
  throwIfAborted(signal);

  let handleAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    handleAbort = () => reject(abortReason(signal));
    signal.addEventListener('abort', handleAbort, { once: true });
  });

  try {
    return await Promise.race([selection, aborted]);
  } finally {
    if (handleAbort) signal.removeEventListener('abort', handleAbort);
  }
}

function throwIfAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) throw abortReason(signal);
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}

async function enhanceNativeProbeCause(
  endpoint: string,
  network: DesktopNetworkSnapshot,
  cause: unknown,
  adapters: RuntimeFetchAdapters
): Promise<unknown> {
  if (
    cause instanceof TransportProbeTimeoutError ||
    !adapters.diagnoseNativeNetwork ||
    !canRunNativeDiagnostic(endpoint)
  ) {
    return cause;
  }

  try {
    const diagnostic = await adapters.diagnoseNativeNetwork(
      endpoint,
      network.mode === 'manual' ? network.proxyUrl : undefined
    );
    return new NativeNetworkDiagnosticError(cause, diagnostic);
  } catch {
    // Diagnostics must never replace the original network failure with an IPC
    // or command-registration error. The original plugin cause remains useful.
    return cause;
  }
}

function canRunNativeDiagnostic(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && host !== 'workers.dev' && host.endsWith('.workers.dev');
  } catch {
    return false;
  }
}

function normalizeTransportEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, '');
}

function probeNonce(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function runtimeCauseSummary(cause: unknown): string {
  if (cause instanceof Error) return cause.message || cause.name;
  if (typeof cause === 'string') return cause;
  if (cause && typeof cause === 'object') {
    const record = cause as Record<string, unknown>;
    const nested = record.message ?? record.error ?? record.cause;
    if (typeof nested === 'string') return nested;
    try {
      return JSON.stringify(cause);
    } catch {
      return Object.prototype.toString.call(cause);
    }
  }
  return String(cause);
}
