// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, normalizeEndpoint, pairDevice, RemoteNotesClient, safeNetworkReason } from './api';

describe('API endpoint and network errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('normalizes a Worker endpoint without keeping query, hash or trailing slashes', () => {
    expect(
      normalizeEndpoint('  https://NotesFlash-Cloud.example.workers.dev/base///?source=setup#pair  ')
    ).toBe('https://notesflash-cloud.example.workers.dev/base');
  });

  it('rejects endpoints with unsupported protocols or embedded credentials', () => {
    expect(() => normalizeEndpoint('file:///tmp/worker')).toThrowError(
      expect.objectContaining({ status: 400, code: 'INVALID_ENDPOINT' })
    );
    expect(() => normalizeEndpoint('https://user:secret@example.com')).toThrowError(
      expect.objectContaining({ status: 400, code: 'INVALID_ENDPOINT' })
    );
  });

  it('turns a pairing fetch TypeError into a Chinese NETWORK_ERROR with the Worker host', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Load failed')));
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false })
    });

    const error = await rejectedApiError(
      pairDevice('https://notesflash-cloud.example.workers.dev/', 'NF-ABCDE-23456', 'Mac')
    );

    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect(error.message).toContain('无法连接到 Cloudflare Worker');
    expect(error.message).toContain('notesflash-cloud.example.workers.dev');
    expect(error.message).toContain('Load failed');
  });

  it('turns a Load failed rejection from a remote notes request into NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Load failed')));
    const client = new RemoteNotesClient({
      endpoint: 'https://notesflash-cloud.example.workers.dev/',
      token: 'device-token'
    });

    const error = await rejectedApiError(client.listNotes('updated_desc'));

    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect(error.message).toContain('notesflash-cloud.example.workers.dev');
    expect(error.payload).toEqual({
      endpoint: 'https://notesflash-cloud.example.workers.dev',
      reason: 'Load failed',
      transport: 'browser'
    });
  });

  it('also maps a response body stream failure to NETWORK_ERROR', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        text: vi.fn().mockRejectedValue(new TypeError('Load failed'))
      } as unknown as Response)
    );
    const client = new RemoteNotesClient({
      endpoint: 'https://notesflash-cloud.example.workers.dev',
      token: 'device-token'
    });

    const error = await rejectedApiError(client.listNotes('updated_desc'));

    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect(error.message).toContain('notesflash-cloud.example.workers.dev');
  });

  it('sends authenticated requests without WebKit cache-control request options', async () => {
    const browserFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ notes: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', browserFetch);
    const client = new RemoteNotesClient({
      endpoint: 'https://notesflash-cloud.example.workers.dev',
      token: 'device-token'
    });

    await client.listNotes('updated_desc');

    const [, init] = browserFetch.mock.calls[0] as [string, RequestInit];
    expect(init).not.toHaveProperty('cache');
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer device-token');
  });

  it('redacts credentials and pairing codes from network diagnostics', () => {
    expect(safeNetworkReason(
      'failed Bearer secret-token at https://example.com/?token=abc123 using NF-ABCDE-23456'
    )).toBe(
      'failed Bearer [REDACTED] at https://example.com/ using [PAIRING_CODE_REDACTED]'
    );
  });

  it('extracts a useful native reason from an invoke error object', () => {
    expect(safeNetworkReason({
      error: { message: 'invalid peer certificate: UnknownIssuer' }
    })).toBe('invalid peer certificate: UnknownIssuer');
  });

  it('removes URL queries, fragments, credentials and key-like values from diagnostics', () => {
    const reason = safeNetworkReason(
      'request https://alice:pw@example.com/api/search/lexical?q=private-note#section ' +
      'Authorization: Basic YWxpY2U6cHc= api_key=top-secret password=hunter2'
    );

    expect(reason).toContain('https://example.com/api/search/lexical');
    expect(reason).toContain('Authorization: [REDACTED]');
    expect(reason).not.toMatch(/private-note|alice|hunter2|top-secret|YWxpY2U6cHc=|#section|\?q=/);
  });
});

async function rejectedApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('Expected the request to reject.');
}
