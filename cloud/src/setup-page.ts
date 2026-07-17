export function setupPage(): Response {
  const html = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>连接 NotesFlash Cloud</title>
  <style>
    :root { font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f5f2; color: #20201e; padding: 24px; }
    main { width: min(100%, 460px); background: rgba(255,255,255,.94); border: 1px solid #deddd8; border-radius: 20px; padding: 28px; box-shadow: 0 16px 48px rgba(20,20,18,.08); }
    h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: -.02em; }
    p { color: #676661; line-height: 1.6; }
    button, .link { min-height: 44px; border-radius: 11px; font: inherit; font-weight: 700; cursor: pointer; }
    button { width: 100%; border: 0; margin-top: 18px; background: #20201e; color: #fff; padding: 10px 14px; }
    button.secondary { width: auto; min-height: 36px; margin: 10px 0 0; padding: 7px 12px; background: transparent; color: inherit; border: 1px solid #cfcec8; font-size: 13px; }
    button:disabled { opacity: .5; cursor: wait; }
    .notice { margin-top: 18px; border: 1px solid #e8c870; border-radius: 13px; padding: 12px 14px; background: #fff8db; color: #6a5010; font-size: 13px; line-height: 1.55; }
    .muted { font-size: 13px; }
    #action, #result { display: none; }
    #result { margin-top: 22px; border-top: 1px solid #e5e4df; padding-top: 20px; }
    .code { display: block; padding: 18px 10px; border-radius: 13px; background: #f0efe9; text-align: center; font: 700 22px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; user-select: all; overflow-wrap: anywhere; }
    .meta { font-size: 12px; overflow-wrap: anywhere; }
    .error { color: #b42318; font-size: 13px; min-height: 20px; margin-top: 12px; }
    .link { display: inline-flex; align-items: center; justify-content: center; width: 100%; margin-top: 12px; border: 1px solid #cfcec8; color: inherit; text-decoration: none; }
    @media (prefers-color-scheme: dark) {
      body { background: #111210; color: #edede9; }
      main { background: #1a1b18; border-color: #30312d; box-shadow: none; }
      p { color: #aaa9a2; }
      button { background: #edede9; color: #171714; }
      button.secondary, .link { border-color: #41423d; color: #edede9; }
      .notice { border-color: #715d25; background: #2c2717; color: #ead58d; }
      #result { border-color: #30312d; }
      .code { background: #252622; }
    }
  </style>
</head>
<body>
  <main>
    <h1>连接 NotesFlash Cloud</h1>
    <p id="intro">正在检查实例状态……</p>

    <section id="action">
      <div id="notice" class="notice"></div>
      <button id="generate" type="button"></button>
      <div id="error" class="error" role="alert"></div>
    </section>

    <section id="result" aria-live="polite">
      <p>这是一个 10 分钟有效、只能使用一次的配对码：</p>
      <output id="code" class="code"></output>
      <button id="copy" class="secondary" type="button">复制配对码</button>
      <p id="expiry" class="meta"></p>
      <p class="muted">请现在把它输入要连接的 NotesFlash。刷新或关闭本页后，服务器不会再次显示这个明文配对码。</p>
      <a class="link" href="/">打开 NotesFlash</a>
    </section>
  </main>
  <script>
    const action = document.querySelector('#action');
    const intro = document.querySelector('#intro');
    const notice = document.querySelector('#notice');
    const generate = document.querySelector('#generate');
    const errorBox = document.querySelector('#error');
    const result = document.querySelector('#result');
    const codeOutput = document.querySelector('#code');
    const expiry = document.querySelector('#expiry');
    let mode = 'unavailable';
    let deviceToken = '';

    async function api(path, options) {
      const response = await fetch(path, { cache: 'no-store', ...(options || {}) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload && payload.error && payload.error.message || '请求失败');
        error.status = response.status;
        throw error;
      }
      return payload;
    }

    function localDeviceToken() {
      try {
        const profile = JSON.parse(localStorage.getItem('notesflash.connection.v1') || 'null');
        if (!profile || typeof profile.token !== 'string' || typeof profile.endpoint !== 'string') return '';
        const endpoint = profile.endpoint.replace(/\/+$/, '');
        return endpoint === location.origin ? profile.token : '';
      } catch {
        return '';
      }
    }

    function showCode(pairing) {
      codeOutput.textContent = pairing.code;
      expiry.textContent = '有效期至：' + new Date(pairing.expiresAt).toLocaleString();
      result.style.display = 'block';
      codeOutput.scrollIntoView({ block: 'nearest' });
    }

    async function loadStatus() {
      try {
        const status = await api('/api/setup/status');
        action.style.display = 'block';
        generate.style.display = '';
        if (!status.initialized) {
          mode = 'initial';
          intro.textContent = '实例尚未初始化。无需填写任何环境变量或部署密钥。';
          notice.textContent = '只在你刚完成 Cloudflare 部署时点击。因为这里没有中心账号或 OAuth，第一位领取配对码的人会成为首台受信任设备。';
          generate.textContent = '初始化并显示一次性配对码';
          return;
        }

        if (status.canResumeSetup) {
          mode = 'resume';
          intro.textContent = '首次设备还没有完成配对。这个浏览器可以继续初始化流程。';
          notice.textContent = '重新生成会立即让此前尚未使用的首次配对码失效，并显示一个新的单次配对码。';
          generate.textContent = '重新生成首次配对码';
        } else {
          deviceToken = localDeviceToken();
          if (deviceToken) {
            mode = 'connected';
            intro.textContent = '实例已经初始化，这个浏览器也是已连接设备。';
            notice.textContent = '你可以为另一台设备生成一个新的单次配对码。';
            generate.textContent = '为新设备生成配对码';
          } else {
            mode = 'unavailable';
            intro.textContent = '实例已经初始化。匿名网页不能再次生成配对码。';
            notice.textContent = '请在任意已连接的 NotesFlash 中打开“设置 → 连接新设备”，再生成新的配对码。这样知道 Worker 地址的陌生人无法读取你的笔记。';
            generate.style.display = 'none';
          }
        }
      } catch (error) {
        intro.textContent = error instanceof Error ? error.message : '无法读取实例状态。';
      }
    }

    generate.addEventListener('click', async () => {
      if (mode === 'unavailable') return;
      generate.disabled = true;
      errorBox.textContent = '';
      result.style.display = 'none';
      try {
        const pairing = mode === 'initial' || mode === 'resume'
          ? await api('/api/setup', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: '{}'
            })
          : await api('/api/pairing-codes', {
              method: 'POST',
              headers: { authorization: 'Bearer ' + deviceToken }
            });
        showCode(pairing);
        if (mode === 'initial' || mode === 'resume') {
          mode = 'unavailable';
          generate.style.display = 'none';
          intro.textContent = '实例已经完成初始化。下面的首次配对码只显示这一次。';
          notice.textContent = '完成首台设备配对后，请从已连接设备的设置中生成后续配对码。';
        }
      } catch (error) {
        errorBox.textContent = error instanceof Error ? error.message : '请求失败';
        if (error && error.status === 401) {
          mode = 'unavailable';
          deviceToken = '';
          generate.style.display = 'none';
          intro.textContent = '实例已经初始化，但这个浏览器保存的设备连接已经失效。';
          notice.textContent = '请从另一台仍然已连接的设备进入“设置 → 连接新设备”生成配对码。';
        } else if (error && error.status === 409) {
          await loadStatus();
        }
      } finally {
        generate.disabled = false;
      }
    });

    document.querySelector('#copy').addEventListener('click', async () => {
      const code = codeOutput.textContent || '';
      try {
        await navigator.clipboard.writeText(code);
        document.querySelector('#copy').textContent = '已复制';
      } catch {
        const selection = window.getSelection();
        if (selection) selection.selectAllChildren(codeOutput);
      }
    });

    void loadStatus();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, private",
      "pragma": "no-cache",
      "content-security-policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
