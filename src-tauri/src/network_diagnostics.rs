use std::{
    error::Error as StdError,
    net::IpAddr,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri_plugin_http::reqwest::{
    redirect::Policy, Client, Error as ReqwestError, Proxy, Url,
};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const TOTAL_TIMEOUT: Duration = Duration::from_secs(20);
const HEALTH_PATH: &str = "/api/health";
const MAX_ERROR_CHAIN_LENGTH: usize = 8;
const MAX_ERROR_MESSAGE_LENGTH: usize = 500;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkDiagnostic {
    network_ok: bool,
    health_ok: bool,
    target_host: Option<String>,
    proxy_mode: &'static str,
    phase: &'static str,
    category: &'static str,
    status: Option<u16>,
    elapsed_ms: u64,
    top_error: Option<String>,
    source_chain: Vec<String>,
    is_timeout: bool,
    is_connect: bool,
    is_request: bool,
    is_builder: bool,
    is_status: bool,
    is_redirect: bool,
    is_body: bool,
    is_decode: bool,
}

#[derive(Clone, Copy, Debug, Default)]
struct ErrorFlags {
    is_timeout: bool,
    is_connect: bool,
    is_request: bool,
    is_builder: bool,
    is_status: bool,
    is_redirect: bool,
    is_body: bool,
    is_decode: bool,
}

impl NetworkDiagnostic {
    fn invalid_input(
        target_host: Option<String>,
        proxy_mode: &'static str,
        phase: &'static str,
        category: &'static str,
        message: &str,
        elapsed_ms: u64,
    ) -> Self {
        Self {
            network_ok: false,
            health_ok: false,
            target_host,
            proxy_mode,
            phase,
            category,
            status: None,
            elapsed_ms,
            top_error: Some(sanitize_error_message(message)),
            source_chain: Vec::new(),
            is_timeout: false,
            is_connect: false,
            is_request: false,
            is_builder: false,
            is_status: false,
            is_redirect: false,
            is_body: false,
            is_decode: false,
        }
    }

    fn response(
        target_host: String,
        proxy_mode: &'static str,
        status: u16,
        elapsed_ms: u64,
    ) -> Self {
        let health_ok = (200..300).contains(&status);
        Self {
            network_ok: true,
            health_ok,
            target_host: Some(target_host),
            proxy_mode,
            phase: "response_headers",
            category: if health_ok { "success" } else { "http_status" },
            status: Some(status),
            elapsed_ms,
            top_error: None,
            source_chain: Vec::new(),
            is_timeout: false,
            is_connect: false,
            is_request: false,
            is_builder: false,
            is_status: false,
            is_redirect: false,
            is_body: false,
            is_decode: false,
        }
    }

    fn reqwest_failure(
        target_host: String,
        proxy_mode: &'static str,
        phase: &'static str,
        error: ReqwestError,
        elapsed_ms: u64,
    ) -> Self {
        // Reqwest's top-level Display includes the request URL. The health
        // probe never carries credentials, but stripping it here keeps the
        // diagnostic safe even if this command is reused in the future.
        let error = error.without_url();
        let flags = ErrorFlags {
            is_timeout: error.is_timeout(),
            is_connect: error.is_connect(),
            is_request: error.is_request(),
            is_builder: error.is_builder(),
            is_status: error.is_status(),
            is_redirect: error.is_redirect(),
            is_body: error.is_body(),
            is_decode: error.is_decode(),
        };
        let top_error = sanitize_error_message(&error.to_string());
        let source_chain = collect_error_chain(&error);
        let category = classify_failure(flags, &top_error, &source_chain);

        Self {
            network_ok: false,
            health_ok: false,
            target_host: Some(target_host),
            proxy_mode,
            phase,
            category,
            status: error.status().map(|status| status.as_u16()),
            elapsed_ms,
            top_error: Some(top_error),
            source_chain,
            is_timeout: flags.is_timeout,
            is_connect: flags.is_connect,
            is_request: flags.is_request,
            is_builder: flags.is_builder,
            is_status: flags.is_status,
            is_redirect: flags.is_redirect,
            is_body: flags.is_body,
            is_decode: flags.is_decode,
        }
    }
}

/// Performs an unauthenticated native connectivity probe constrained to GET.
///
/// The caller supplies the Worker endpoint and may optionally supply an HTTP,
/// HTTPS, SOCKS5, or SOCKS5H proxy URL. This command discards all
/// caller-controlled target URL components, makes one unauthenticated GET
/// request to the fixed `/api/health` path, and refuses every target outside
/// workers.dev. Only loopback proxies are allowed; proxy credentials, paths,
/// query strings, and fragments are rejected.
#[tauri::command]
pub async fn diagnose_worker_network(
    endpoint: String,
    proxy_url: Option<String>,
) -> NetworkDiagnostic {
    let started_at = Instant::now();
    let (health_url, target_host) = match build_health_target(&endpoint) {
        Ok(target) => target,
        Err(message) => {
            return NetworkDiagnostic::invalid_input(
                None,
                "not_attempted",
                "endpoint_validation",
                "invalid_endpoint",
                message,
                elapsed_millis(started_at.elapsed()),
            );
        }
    };

    let explicit_proxy = match proxy_url.as_deref().map(str::trim) {
        Some("") | None => None,
        Some(proxy_url) => match build_proxy_target(proxy_url) {
            Ok(proxy) => Some(proxy),
            Err(message) => {
                return NetworkDiagnostic::invalid_input(
                    Some(target_host),
                    "explicit",
                    "proxy_validation",
                    "invalid_proxy",
                    message,
                    elapsed_millis(started_at.elapsed()),
                );
            }
        },
    };
    let proxy_mode = if explicit_proxy.is_some() {
        "explicit"
    } else {
        "system"
    };

    let mut client_builder = Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(TOTAL_TIMEOUT)
        .redirect(Policy::none());
    if let Some(proxy_url) = explicit_proxy {
        let proxy = match Proxy::all(proxy_url) {
            Ok(proxy) => proxy,
            Err(error) => {
                return NetworkDiagnostic::reqwest_failure(
                    target_host,
                    proxy_mode,
                    "proxy_config",
                    error,
                    elapsed_millis(started_at.elapsed()),
                );
            }
        };
        // Reqwest intentionally disables automatic system proxy discovery as
        // soon as an explicit proxy is added. proxy_mode reports that choice
        // without exposing the proxy address.
        client_builder = client_builder.proxy(proxy);
    }

    let client = match client_builder.build() {
        Ok(client) => client,
        Err(error) => {
            return NetworkDiagnostic::reqwest_failure(
                target_host,
                proxy_mode,
                "client_build",
                error,
                elapsed_millis(started_at.elapsed()),
            );
        }
    };

    match client.get(health_url).send().await {
        Ok(response) => NetworkDiagnostic::response(
            target_host,
            proxy_mode,
            response.status().as_u16(),
            elapsed_millis(started_at.elapsed()),
        ),
        Err(error) => NetworkDiagnostic::reqwest_failure(
            target_host,
            proxy_mode,
            "request",
            error,
            elapsed_millis(started_at.elapsed()),
        ),
    }
}

fn build_proxy_target(proxy_url: &str) -> Result<Url, &'static str> {
    let url = Url::parse(proxy_url).map_err(|_| "Proxy is not a valid URL")?;

    if !matches!(url.scheme(), "http" | "https" | "socks5" | "socks5h") {
        return Err("Network diagnostics only allow HTTP, HTTPS, SOCKS5, or SOCKS5H proxies");
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Proxy URL must not contain credentials");
    }
    let proxy_host = url.host_str().ok_or("Proxy URL must contain a hostname")?;
    if !is_loopback_proxy_host(proxy_host) {
        return Err("Network diagnostics only allow loopback proxy hosts");
    }
    if !matches!(url.path(), "" | "/") || url.query().is_some() || url.fragment().is_some() {
        return Err("Proxy URL must not contain a path, query, or fragment");
    }

    Ok(url)
}

fn is_loopback_proxy_host(host: &str) -> bool {
    if host.eq_ignore_ascii_case("localhost") {
        return true;
    }

    host.trim_start_matches('[')
        .trim_end_matches(']')
        .parse::<IpAddr>()
        .is_ok_and(|address| address.is_loopback())
}

fn build_health_target(endpoint: &str) -> Result<(Url, String), &'static str> {
    let mut url = Url::parse(endpoint.trim()).map_err(|_| "Worker endpoint is not a valid URL")?;

    if url.scheme() != "https" {
        return Err("Network diagnostics only allow HTTPS Worker endpoints");
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Worker endpoint must not contain credentials");
    }
    if let Some(port) = url.port() {
        if port != 443 {
            return Err("Network diagnostics only allow the default HTTPS port");
        }
    }

    let target_host = url
        .host_str()
        .map(str::to_ascii_lowercase)
        .ok_or("Worker endpoint must contain a hostname")?;
    if target_host == "workers.dev" || !target_host.ends_with(".workers.dev") {
        return Err("Network diagnostics only allow workers.dev subdomains");
    }

    // The validated hostname is retained, but all caller-controlled URL
    // components are discarded before the request is constructed.
    url.set_path(HEALTH_PATH);
    url.set_query(None);
    url.set_fragment(None);

    Ok((url, target_host))
}

fn collect_error_chain(error: &(dyn StdError + 'static)) -> Vec<String> {
    let mut chain = Vec::new();
    let mut current = error.source();

    while let Some(source) = current {
        let message = sanitize_error_message(&source.to_string());
        if !message.is_empty() && chain.last() != Some(&message) {
            chain.push(message);
        }
        if chain.len() >= MAX_ERROR_CHAIN_LENGTH {
            break;
        }
        current = source.source();
    }

    chain
}

fn classify_failure(
    flags: ErrorFlags,
    top_error: &str,
    source_chain: &[String],
) -> &'static str {
    let details = std::iter::once(top_error)
        .chain(source_chain.iter().map(String::as_str))
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase();

    if contains_any(
        &details,
        &[
            "certificate",
            "unknownissuer",
            "unknown issuer",
            "invalid peer certificate",
            "rustls",
            "native-tls",
            "native_tls",
            "tls",
            "ssl",
            "tls handshake",
            "ssl handshake",
        ],
    ) {
        "tls"
    } else if contains_any(
        &details,
        &[
            "proxy",
            "socks",
            "tunnel error",
            "tunnel failed",
            "unsuccessful tunnel",
        ],
    ) {
        "proxy"
    } else if contains_any(
        &details,
        &[
            "dns error",
            "failed to lookup",
            "name or service not known",
            "nodename nor servname",
            "no such host",
            "temporary failure in name resolution",
        ],
    ) {
        "dns"
    } else if details.contains("connection refused") {
        "connection_refused"
    } else if contains_any(
        &details,
        &["network is unreachable", "network unreachable", "no route to host"],
    ) {
        "network_unreachable"
    } else if flags.is_timeout || details.contains("timed out") {
        "timeout"
    } else if flags.is_connect {
        "connect"
    } else if flags.is_builder {
        "client_build"
    } else if flags.is_redirect {
        "redirect"
    } else if flags.is_status {
        "http_status"
    } else if flags.is_body {
        "body"
    } else if flags.is_decode {
        "decode"
    } else if flags.is_request {
        "request"
    } else {
        "unknown"
    }
}

fn contains_any(value: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| value.contains(needle))
}

fn sanitize_error_message(message: &str) -> String {
    let without_urls = redact_urls(message);
    let without_secrets = redact_marker_value(
        redact_marker_value(
            redact_marker_value(
                redact_marker_value(without_urls, "bearer "),
                "token=",
            ),
            "password=",
        ),
        "secret=",
    );
    truncate_message(without_secrets.trim(), MAX_ERROR_MESSAGE_LENGTH)
}

fn redact_urls(value: &str) -> String {
    const SCHEMES: [&str; 4] = ["https://", "http://", "socks5h://", "socks5://"];

    let lowercase = value.to_ascii_lowercase();
    let mut output = String::with_capacity(value.len());
    let mut cursor = 0;

    while cursor < value.len() {
        let next_match = SCHEMES
            .iter()
            .filter_map(|scheme| lowercase[cursor..].find(scheme).map(|offset| cursor + offset))
            .min();
        let Some(start) = next_match else {
            output.push_str(&value[cursor..]);
            break;
        };

        output.push_str(&value[cursor..start]);
        output.push_str("<redacted-url>");

        let mut end = value.len();
        for (offset, character) in value[start..].char_indices() {
            if offset > 0
                && (character.is_whitespace()
                    || matches!(character, ')' | ']' | '}' | '>' | '"' | '\'' | ',' | ';'))
            {
                end = start + offset;
                break;
            }
        }
        cursor = end;
    }

    output
}

fn redact_marker_value(value: String, marker: &str) -> String {
    let lowercase = value.to_ascii_lowercase();
    let mut output = String::with_capacity(value.len());
    let mut cursor = 0;

    while cursor < value.len() {
        let Some(marker_offset) = lowercase[cursor..].find(marker) else {
            output.push_str(&value[cursor..]);
            break;
        };
        let marker_start = cursor + marker_offset;
        let value_start = marker_start + marker.len();
        let mut value_end = value.len();

        for (offset, character) in value[value_start..].char_indices() {
            if character.is_whitespace()
                || matches!(character, ',' | ';' | ')' | ']' | '}' | '"' | '\'')
            {
                value_end = value_start + offset;
                break;
            }
        }

        output.push_str(&value[cursor..value_start]);
        if value_end == value_start {
            cursor = value_start;
            continue;
        }
        output.push_str("<redacted>");
        cursor = value_end;
    }

    output
}

fn truncate_message(value: &str, max_characters: usize) -> String {
    if value.chars().count() <= max_characters {
        return value.to_string();
    }

    let mut truncated = value.chars().take(max_characters).collect::<String>();
    truncated.push('…');
    truncated
}

fn elapsed_millis(duration: Duration) -> u64 {
    duration.as_millis().min(u64::MAX as u128) as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_nested_workers_dev_host_and_forces_health_path() {
        let (url, host) = build_health_target(
            "https://notesflash-cloud.17828126523l.workers.dev/anything?token=secret#fragment",
        )
        .expect("valid Worker endpoint");

        assert_eq!(host, "notesflash-cloud.17828126523l.workers.dev");
        assert_eq!(
            url.as_str(),
            "https://notesflash-cloud.17828126523l.workers.dev/api/health"
        );
    }

    #[test]
    fn rejects_targets_outside_workers_dev() {
        for endpoint in [
            "http://example.workers.dev",
            "https://workers.dev",
            "https://example.workers.dev.evil.test",
            "https://example.com",
            "https://user:password@example.workers.dev",
            "https://example.workers.dev:8443",
        ] {
            assert!(
                build_health_target(endpoint).is_err(),
                "endpoint should be rejected: {endpoint}"
            );
        }
    }

    #[test]
    fn accepts_supported_proxy_origins_without_credentials_or_paths() {
        assert!(build_proxy_target("http://127.0.0.1:7890").is_ok());
        assert!(build_proxy_target("https://localhost:8443/").is_ok());
        assert!(build_proxy_target("socks5://127.0.0.1:1080").is_ok());
        assert!(build_proxy_target("socks5h://127.0.0.1:1080").is_ok());
        assert!(build_proxy_target("socks5h://127.0.0.1:1080/").is_ok());

        for proxy in [
            "ftp://127.0.0.1:21",
            "http://user:password@127.0.0.1:7890",
            "socks5h://user:password@127.0.0.1:1080",
            "http://127.0.0.1:7890/path",
            "http://127.0.0.1:7890?token=secret",
            "http://127.0.0.1:7890#fragment",
            "http://proxy.example.test:7890",
            "http://192.168.1.10:7890",
        ] {
            assert!(
                build_proxy_target(proxy).is_err(),
                "proxy should be rejected: {proxy}"
            );
        }
    }

    #[test]
    fn redacts_urls_and_common_credentials() {
        let message = "proxy https://user:password@example.test/path token=abc Bearer xyz password=hunter2 secret=value";
        let sanitized = sanitize_error_message(message);

        assert!(!sanitized.contains("example.test"));
        assert!(!sanitized.contains("user:password"));
        assert!(!sanitized.contains("abc"));
        assert!(!sanitized.contains("xyz"));
        assert!(!sanitized.contains("hunter2"));
        assert!(!sanitized.contains("value"));
        assert!(sanitized.contains("<redacted-url>"));
    }

    #[test]
    fn classifies_diagnostic_source_chains() {
        let connect = ErrorFlags {
            is_connect: true,
            is_request: true,
            ..ErrorFlags::default()
        };

        assert_eq!(
            classify_failure(
                connect,
                "error sending request",
                &["client error (Connect)".into(), "dns error: no such host".into()]
            ),
            "dns"
        );
        assert_eq!(
            classify_failure(
                connect,
                "error sending request",
                &["invalid peer certificate: UnknownIssuer".into()]
            ),
            "tls"
        );
        assert_eq!(
            classify_failure(
                connect,
                "error sending request",
                &["proxy tunnel failed".into()]
            ),
            "proxy"
        );
        assert_eq!(
            classify_failure(
                ErrorFlags {
                    is_timeout: true,
                    ..connect
                },
                "error sending request",
                &[]
            ),
            "timeout"
        );
        assert_eq!(
            classify_failure(
                connect,
                "error sending request",
                &["tcp connect error: Connection refused".into()]
            ),
            "connection_refused"
        );
    }
}
