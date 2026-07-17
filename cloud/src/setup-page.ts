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
    main { width: min(100%, 440px); background: rgba(255,255,255,.92); border: 1px solid #deddd8; border-radius: 20px; padding: 28px; box-shadow: 0 16px 48px rgba(20,20,18,.08); }
    h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: -.02em; }
    p { color: #676661; line-height: 1.55; }
    label { display: block; font-size: 13px; font-weight: 650; margin: 20px 0 7px; }
    input { width: 100%; height: 44px; border: 1px solid #cfcec8; border-radius: 11px; padding: 0 13px; background: transparent; color: inherit; font: inherit; }
    input:focus { outline: 3px solid rgba(67,104,214,.18); border-color: #4368d6; }
    button { width: 100%; height: 44px; border: 0; border-radius: 11px; margin-top: 18px; background: #20201e; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .5; cursor: wait; }
    #result { display: none; margin-top: 22px; border-top: 1px solid #e5e4df; padding-top: 20px; }
    .code { display: block; padding: 18px; border-radius: 13px; background: #f0efe9; text-align: center; font: 700 22px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; user-select: all; }
    .meta { font-size: 12px; overflow-wrap: anywhere; }
    .error { color: #b42318; font-size: 13px; min-height: 20px; }
    @media (prefers-color-scheme: dark) {
      body { background: #111210; color: #edede9; }
      main { background: #1a1b18; border-color: #30312d; box-shadow: none; }
      p { color: #aaa9a2; }
      input { border-color: #41423d; }
      button { background: #edede9; color: #171714; }
      #result { border-color: #30312d; }
      .code { background: #252622; }
    }
  </style>
</head>
<body>
  <main>
    <h1>连接 NotesFlash Cloud</h1>
    <p id="intro">正在检查实例状态……</p>
    <form id="form">
      <label for="secret">Owner Setup Secret</label>
      <input id="secret" name="secret" type="password" autocomplete="current-password" required minlength="12" placeholder="部署时设置的高权限秘密">
      <label for="name">这台 Mac 的名称</label>
      <input id="name" name="name" value="NotesFlash for Mac" maxlength="100" required>
      <button id="submit" type="submit">生成配对码</button>
      <div id="error" class="error" role="alert"></div>
    </form>
    <section id="result" aria-live="polite">
      <p>在 macOS 客户端中输入下面的一次性配对码：</p>
      <output id="code" class="code"></output>
      <p id="expiry" class="meta"></p>
      <p id="instance" class="meta"></p>
    </section>
  </main>
  <script>
    const form = document.querySelector('#form');
    const intro = document.querySelector('#intro');
    const submit = document.querySelector('#submit');
    const errorBox = document.querySelector('#error');
    const result = document.querySelector('#result');
    let initialized = true;

    async function api(path, options = {}) {
      const response = await fetch(path, { cache: 'no-store', ...options });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message || '请求失败');
      return payload;
    }

    api('/api/setup/status').then((status) => {
      initialized = status.initialized;
      intro.textContent = initialized
        ? '实例已经初始化。输入部署时设置的 Secret，生成一个 10 分钟有效的恢复配对码。'
        : '输入部署时设置的 Secret。页面将初始化实例，并生成一个 10 分钟有效的配对码。';
      submit.textContent = initialized ? '生成配对码' : '初始化并生成配对码';
    }).catch((error) => { intro.textContent = error.message; });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      errorBox.textContent = '';
      result.style.display = 'none';
      const setupSecret = document.querySelector('#secret').value;
      const deviceName = document.querySelector('#name').value;
      try {
        let pairing;
        let instanceId;
        if (!initialized) {
          const setup = await api('/api/setup', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ setupSecret, deviceName: 'Setup browser', platform: 'setup-web' })
          });
          instanceId = setup.instanceId;
          pairing = await api('/api/pairing-codes', {
            method: 'POST',
            headers: { authorization: 'Bearer ' + setup.token }
          });
          initialized = true;
        } else {
          pairing = await api('/api/setup/pairing-code', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ setupSecret, deviceName })
          });
          instanceId = pairing.instanceId;
        }
        document.querySelector('#code').textContent = pairing.code;
        document.querySelector('#expiry').textContent = '有效期至：' + new Date(pairing.expiresAt).toLocaleString();
        document.querySelector('#instance').textContent = '实例：' + (instanceId || '已初始化');
        result.style.display = 'block';
        document.querySelector('#secret').value = '';
      } catch (error) {
        errorBox.textContent = error instanceof Error ? error.message : '请求失败';
      } finally {
        submit.disabled = false;
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, private",
      "content-security-policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
