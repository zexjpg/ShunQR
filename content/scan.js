(() => {
  'use strict';

  const APP = '__QR_SNAP_APP__';
  if (globalThis[APP]) return;

  const Z_INDEX = 2147483000;
  const MIN_SIZE = 14;
  const ACCENT = '#4169e1';
  const MAX_STACK = 60;

  const SHADES = {
    darken: { shade: 'rgba(15,23,42,.58)', edge: 'rgba(255,255,255,.45)' },
    lighten: { shade: 'rgba(255,255,255,.66)', edge: 'rgba(15,23,42,.38)' }
  };

  const CSS = `
  *,*::before,*::after{box-sizing:border-box}
  .stage{position:absolute;inset:0;cursor:crosshair;touch-action:none;user-select:none;-webkit-user-select:none}
  .sel{position:absolute;display:none;border:1.5px solid var(--qr-frame,${ACCENT});box-shadow:0 0 0 100vmax var(--qr-shade,rgba(15,23,42,.58));pointer-events:none}
  .sel::after{content:'';position:absolute;inset:0;border:1px solid var(--qr-edge,rgba(255,255,255,.45))}
  .sel.is-empty::after{border-color:transparent}
  .sel-size{position:absolute;right:-1px;bottom:-24px;padding:2px 6px;border-radius:4px;background:rgba(15,23,42,.9);color:#fff;font:11px/1.4 ui-monospace,Consolas,monospace;white-space:nowrap}
  .hint{position:absolute;left:50%;top:22px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:9px 16px;border-radius:999px;background:rgba(15,23,42,.9);color:#fff;font-size:13px;line-height:1;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,.3);pointer-events:none}
  .hint em{font-style:normal;color:#9FB6FF}
  .panel-wrap{position:absolute;inset:0;display:none;background:rgba(15,23,42,.3);padding:72px 16px 16px;overflow:auto}
  .panel-wrap.show{display:flex;justify-content:center;align-items:flex-start}
  .panel{width:440px;max-width:100%;max-height:calc(100vh - 120px);display:flex;flex-direction:column;background:#fff;border:1px solid #E4E4E4;border-radius:12px;box-shadow:0 20px 50px rgba(15,23,42,.3);overflow:hidden;color:#1F2937;font-size:13px}
  .hd{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #EEF0F4}
  .hd .ttl{font-size:13px;font-weight:500;flex:1}
  .badge{font:11px/1 ui-monospace,Consolas,monospace;padding:3px 6px;border-radius:4px;background:#EEF2FF;color:${ACCENT};border:1px solid #DCE4FF;white-space:nowrap}
  .x{width:24px;height:24px;border:0;background:transparent;color:#8A8F99;font-size:16px;line-height:1;cursor:pointer;border-radius:6px;font-family:inherit;padding:0}
  .x:hover{background:#F2FAFF}
  .bd{padding:12px 14px;overflow:auto;flex:1;min-height:0}
  .item+.item{margin-top:10px;padding-top:10px;border-top:1px dashed #E4E4E4}
  .item-hd{display:flex;align-items:center;gap:8px;margin-bottom:6px}
  .idx{font-size:11px;color:#8A8F99}
  .txt{font:12px/1.6 ui-monospace,Consolas,monospace;color:#111827;word-break:break-all;white-space:pre-wrap;background:#F7FAFF;border:1px solid #E8EEF7;border-radius:8px;padding:8px 10px;max-height:180px;overflow:auto}
  .note{color:#5F6470;line-height:1.6}
  .ft{display:flex;gap:6px;padding:12px 14px;border-top:1px solid #EEF0F4;background:#FAFCFF}
  .btn{flex:1;height:32px;padding:0 4px;border:1px solid #D8DEE9;background:#fff;color:#374151;border-radius:7px;font-size:12.5px;cursor:pointer;font-family:inherit;white-space:nowrap}
  .btn:hover{background:#F2FAFF;border-color:#C3D3F0}
  .btn.primary{background:${ACCENT};border-color:${ACCENT};color:#fff}
  .btn.primary:hover{background:#3557c4;border-color:#3557c4}
  .stack{position:absolute;right:16px;bottom:16px;width:312px;max-height:56vh;display:none;flex-direction:column;background:rgba(255,255,255,.98);border:1px solid #E4E4E4;border-radius:12px;box-shadow:0 14px 36px rgba(15,23,42,.26);overflow:hidden;color:#1F2937;font-size:13px}
  .stack.show{display:flex}
  .st-hd{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #EEF0F4;background:#F7FAFF}
  .st-title{font-size:13px;font-weight:500}
  .st-count{font-size:11px;color:#5F6470;flex:1}
  .st-body{overflow:auto;padding:6px 0;flex:1;min-height:0}
  .st-item{display:flex;align-items:center;gap:6px;padding:6px 12px}
  .st-item:hover{background:#F7FAFF}
  .st-text{flex:1;font:11.5px/1.5 ui-monospace,Consolas,monospace;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .st-copy{border:1px solid #D8DEE9;background:#fff;color:#374151;border-radius:6px;font-size:11px;padding:3px 7px;cursor:pointer;font-family:inherit;white-space:nowrap}
  .st-copy:hover{background:#F2FAFF;border-color:#C3D3F0}
  .st-ft{display:flex;gap:6px;padding:10px 12px;border-top:1px solid #EEF0F4;background:#FAFCFF}
  .st-ft .btn{height:30px;font-size:12.5px}
  @media (prefers-color-scheme: dark){
    .panel,.stack{background:#1B1F27;border-color:#2D333F;color:#E5E7EB}
    .hd,.ft,.st-hd,.st-ft{border-color:#2D333F}
    .ft,.st-ft{background:#171B22}
    .st-hd{background:#1E2430}
    .txt,.st-text{color:#E5E7EB}
    .txt{background:#141821;border-color:#2A303B}
    .st-item:hover{background:#20252F}
    .btn,.st-copy{background:#20252F;border-color:#333A47;color:#D7DBE3}
    .btn:hover,.st-copy:hover{background:#28303C}
    .badge{background:#1E2740;border-color:#2C3A5E;color:#9FB6FF}
    .note,.st-count{color:#A5ABBA}
  }
  `;

  let host = null;
  let shadow = null;
  let stage = null;
  let selBox = null;
  let sizeLabel = null;
  let hint = null;
  let panelWrap = null;
  let stackEl = null;

  let mode = 'idle';
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let keyBound = false;
  let scanToken = 0;

  let stackMode = false;
  let stack = [];

  function build() {
    if (host && host.isConnected) return;

    host = document.createElement('div');
    host.id = 'qr-snap-root';
    const base = {
      all: 'initial',
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100vw',
      height: '100vh',
      margin: '0',
      padding: '0',
      border: '0',
      display: 'block',
      'z-index': String(Z_INDEX),
      'pointer-events': 'auto',
      'background-color': 'transparent',
      'font-family': 'system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif',
      'font-size': '13px',
      'line-height': '1.5',
      'color-scheme': 'light dark'
    };
    for (const [key, value] of Object.entries(base)) {
      host.style.setProperty(key, value, 'important');
    }

    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${CSS}</style>
      <div class="stage" part="stage">
        <div class="sel"><div class="sel-size"></div></div>
        <div class="hint"></div>
      </div>
      <div class="stack"></div>
      <div class="panel-wrap"></div>`;

    stage = shadow.querySelector('.stage');
    selBox = shadow.querySelector('.sel');
    sizeLabel = shadow.querySelector('.sel-size');
    hint = shadow.querySelector('.hint');
    stackEl = shadow.querySelector('.stack');
    panelWrap = shadow.querySelector('.panel-wrap');

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerCancel);
    stackEl.onclick = onStackClick;

    const parent = document.documentElement || document.body;
    if (!parent) return;
    parent.appendChild(host);
  }

  function setHint(html) {
    hint.innerHTML = html;
  }

  function parseColor(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    const match = /^rgba?\(([^)]+)\)$/i.exec(text);
    if (!match) return null;
    const parts = match[1].split(/[,/]/).map((piece) => parseFloat(piece));
    if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
    const alpha = parts.length >= 4 ? parts[3] : 1;
    if (!Number.isFinite(alpha) || alpha < 0.15) return null;
    return parts.slice(0, 3);
  }

  function pageLuminance() {
    for (const el of [document.body, document.documentElement]) {
      if (!el) continue;
      const rgb = parseColor(getComputedStyle(el).backgroundColor);
      if (!rgb) continue;
      return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
    }
    return null;
  }

  function applyShade() {
    if (!host) return;
    const lum = pageLuminance();
    const prefersDark =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const tone = lum === null ? (prefersDark ? 'lighten' : 'darken') : lum < 0.42 ? 'lighten' : 'darken';
    const { shade, edge } = SHADES[tone];
    host.style.setProperty('--qr-shade', shade);
    host.style.setProperty('--qr-edge', edge);
  }

  function enter() {
    build();
    if (!host || !host.isConnected) return;

    scanToken += 1;
    mode = 'scan';
    dragging = false;
    applyShade();

    host.style.setProperty('display', 'block', 'important');
    stage.style.display = 'block';
    stage.style.pointerEvents = 'auto';
    panelWrap.classList.remove('show');
    panelWrap.innerHTML = '';
    hint.style.display = '';

    selBox.style.display = 'block';
    applySel(0, 0, 0, 0);

    setHint(
      stackMode
        ? '继续框选下一个 &nbsp;·&nbsp; <em>Esc 结束</em>'
        : '拖动框选二维码区域 &nbsp;·&nbsp; <em>Esc 取消</em>'
    );
    syncStack();
    bindKeys();
  }

  function exit() {
    scanToken += 1;
    dragging = false;
    mode = 'idle';
    unbindKeys();
    if (host) host.style.setProperty('display', 'none', 'important');
    panelWrap.classList.remove('show');
    selBox.style.display = 'none';
  }

  function quitStack() {
    const had = stack.length;
    stackMode = false;
    stack = [];
    syncStack();
    exit();
    if (had > 0) {
      chrome.runtime.sendMessage({ type: 'OPEN_HISTORY' }).catch(() => {});
    }
  }

  function bindKeys() {
    if (keyBound) return;
    keyBound = true;
    window.addEventListener('keydown', onKeyDown, true);
  }

  function unbindKeys() {
    if (!keyBound) return;
    keyBound = false;
    window.removeEventListener('keydown', onKeyDown, true);
  }

  function onKeyDown(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    if (stackMode) quitStack();
    else exit();
  }

  function onPointerDown(event) {
    if (mode !== 'scan' || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    try {
      stage.setPointerCapture(event.pointerId);
    } catch (err) {
      /* ignore */
    }
    selBox.style.display = 'block';
    applySel(startX, startY, 0, 0);
  }

  function onPointerMove(event) {
    if (!dragging) return;
    event.preventDefault();
    const x = Math.min(startX, event.clientX);
    const y = Math.min(startY, event.clientY);
    applySel(x, y, Math.abs(event.clientX - startX), Math.abs(event.clientY - startY));
  }

  function applySel(x, y, w, h) {
    const empty = w <= 0 || h <= 0;
    selBox.style.left = `${x}px`;
    selBox.style.top = `${y}px`;
    selBox.style.width = `${w}px`;
    selBox.style.height = `${h}px`;
    selBox.style.borderColor = empty ? 'transparent' : '';
    selBox.classList.toggle('is-empty', empty);
    sizeLabel.textContent = empty ? '' : `${Math.round(w)} × ${Math.round(h)}`;
  }

  function onPointerCancel() {
    dragging = false;
    applySel(0, 0, 0, 0);
  }

  async function onPointerUp(event) {
    if (!dragging) return;
    dragging = false;
    try {
      stage.releasePointerCapture(event.pointerId);
    } catch (err) {
      /* ignore */
    }

    const rect = {
      x: Math.min(startX, event.clientX),
      y: Math.min(startY, event.clientY),
      width: Math.abs(event.clientX - startX),
      height: Math.abs(event.clientY - startY)
    };

    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
      applySel(0, 0, 0, 0);
      setHint('选区太小了，再框一次 &nbsp;·&nbsp; <em>Esc 取消</em>');
      return;
    }

    await runScan(rect);
  }

  async function runScan(rect) {
    const token = scanToken;
    mode = 'busy';
    unbindKeys();
    hint.style.display = 'none';
    selBox.style.display = 'none';
    host.style.setProperty('display', 'none', 'important');
    await settle();

    let response = null;
    try {
      response = await chrome.runtime.sendMessage({
        type: 'QR_SELECTED',
        rect,
        viewportWidth: window.innerWidth
      });
    } catch (err) {
      response = { ok: false, error: String((err && err.message) || err) };
    }

    if (token !== scanToken) return;

    if (!response) {
      revealPanel('扩展没有响应', '扩展后台可能被浏览器回收，请再点一次扩展图标重试。');
      return;
    }
    if (!response.ok) {
      revealPanel('识别失败', translateError(response.error));
      return;
    }

    const results = Array.isArray(response.results) ? response.results : [];
    if (results.length === 0) {
      revealPanel(
        '没识别到二维码',
        '常见原因：选区没框住完整的码、码太小或太模糊。试着把选区放大一点，四角留出白边再扫。'
      );
      return;
    }

    if (stackMode) {
      pushStack(results);
      enter();
      return;
    }

    host.style.setProperty('display', 'block', 'important');
    showResults(results);
  }

  function revealPanel(title, message) {
    host.style.setProperty('display', 'block', 'important');
    showNotice(title, message);
  }

  function settle() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 70);
        });
      });
    });
  }

  function translateError(error) {
    const text = String(error || '');
    if (/empty-capture|bad-data-url|unsupported-data-url/i.test(text)) {
      return '截图数据异常，当前页面可能不允许截图，换个页面再试。';
    }
    if (/empty-image|bitmap-failed|could not be decoded/i.test(text)) {
      return '截图数据处理失败，请再扫一次；如果每次都是这个提示，重新加载一下扩展。';
    }
    if (/capture/i.test(text)) return '当前页面不允许截图，可以试试右键复制图片后到扩展里粘贴识别。';
    if (/bad-rect/i.test(text)) return '选区无效，请重新框选。';
    if (/wasm|WebAssembly/i.test(text)) return '解码引擎未加载成功，重新加载扩展后再试。';
    return `出了点问题：${text || '未知错误'}`;
  }

  function openPanel() {
    panelWrap.classList.add('show');
    stage.style.pointerEvents = 'none';
    selBox.style.display = 'none';
    bindKeys();
  }

  function showResults(results) {
    const single = results.length === 1;
    const itemsHtml = results
      .map((item, index) => {
        const badge = escapeHtml(String(item.format || 'QR_CODE'));
        const idx = single ? '' : `<span class="idx">${index + 1} / ${results.length}</span>`;
        return `<div class="item">
          <div class="item-hd"><span class="badge">${badge}</span>${idx}</div>
          <div class="txt"></div>
        </div>`;
      })
      .join('');

    panelWrap.innerHTML = `<div class="panel">
      <div class="hd">
        <span class="badge">${escapeHtml(String(results[0].format || 'QR_CODE'))}</span>
        <span class="ttl">${single ? '识别成功' : `识别到 ${results.length} 个码`}</span>
        <button class="x" data-act="close" title="关闭">×</button>
      </div>
      <div class="bd">${itemsHtml}</div>
      <div class="ft">
        <button class="btn primary" data-act="copy">${single ? '复制' : '复制全部'}</button>
        <button class="btn" data-act="open">打开链接</button>
        <button class="btn" data-act="stack">连续扫</button>
        <button class="btn" data-act="again">再扫一次</button>
      </div>
    </div>`;

    const textNodes = panelWrap.querySelectorAll('.item .txt');
    results.forEach((item, index) => {
      if (textNodes[index]) textNodes[index].textContent = item.text || '';
    });

    const urlText = results.find((item) => /^https?:\/\//i.test(String(item.text || '').trim()));
    const openBtn = panelWrap.querySelector('[data-act="open"]');
    if (!urlText && openBtn) openBtn.style.display = 'none';

    panelWrap.onclick = async (event) => {
      const button = event.target.closest('[data-act]');
      if (!button) return;
      const act = button.getAttribute('data-act');

      if (act === 'close') {
        exit();
        return;
      }
      if (act === 'again') {
        enter();
        return;
      }
      if (act === 'stack') {
        stackMode = true;
        stack = [];
        pushStack(results);
        enter();
        return;
      }
      if (act === 'copy') {
        const payload = single
          ? String(results[0].text || '')
          : results.map((item) => String(item.text || '')).join('\n');
        const ok = await copyText(payload);
        button.textContent = ok ? '已复制' : '复制失败';
        setTimeout(() => {
          button.textContent = single ? '复制' : '复制全部';
        }, 1400);
        return;
      }
      if (act === 'open' && urlText) {
        window.open(String(urlText.text).trim(), '_blank', 'noopener,noreferrer');
      }
    };

    openPanel();
  }

  function showNotice(title, message) {
    panelWrap.innerHTML = `<div class="panel">
      <div class="hd">
        <span class="ttl">${escapeHtml(title)}</span>
        <button class="x" data-act="close" title="关闭">×</button>
      </div>
      <div class="bd"><div class="note"></div></div>
      <div class="ft">
        <button class="btn primary" data-act="again">再扫一次</button>
        <button class="btn" data-act="close">关闭</button>
      </div>
    </div>`;

    const note = panelWrap.querySelector('.note');
    if (note) note.textContent = message;

    panelWrap.onclick = (event) => {
      const button = event.target.closest('[data-act]');
      if (!button) return;
      if (button.getAttribute('data-act') === 'again') enter();
      else exit();
    };

    openPanel();
  }

  function pushStack(results) {
    const items = results
      .filter((item) => item && String(item.text || '').trim())
      .map((item) => ({
        text: String(item.text).trim(),
        format: String(item.format || 'QR_CODE')
      }));
    if (items.length === 0) return;
    stack = [...items, ...stack].slice(0, MAX_STACK);
    syncStack();
  }

  function syncStack() {
    if (!stackEl) return;
    const visible = stackMode && stack.length > 0;
    if (!visible) {
      stackEl.classList.remove('show');
      stackEl.innerHTML = '';
      return;
    }

    stackEl.classList.add('show');
    const rows = stack
      .map(
        (item, index) => `<div class="st-item">
          <span class="badge">${escapeHtml(item.format)}</span>
          <span class="st-text"></span>
          <button class="st-copy" data-act="copy" data-i="${index}">复制</button>
        </div>`
      )
      .join('');

    stackEl.innerHTML = `<div class="st-hd">
        <span class="st-title">连续扫码</span>
        <span class="st-count">已扫 ${stack.length} 个</span>
        <button class="x" data-act="quit" title="结束">×</button>
      </div>
      <div class="st-body">${rows}</div>
      <div class="st-ft">
        <button class="btn primary" data-act="copyAll">复制全部</button>
        <button class="btn" data-act="quit">完成</button>
      </div>`;

    const textNodes = stackEl.querySelectorAll('.st-text');
    stack.forEach((item, index) => {
      if (textNodes[index]) textNodes[index].textContent = item.text;
    });
  }

  async function onStackClick(event) {
    event.stopPropagation();
    const button = event.target.closest('[data-act]');
    if (!button) return;
    const act = button.getAttribute('data-act');

    if (act === 'quit') {
      quitStack();
      return;
    }
    if (act === 'copyAll') {
      const ok = await copyText(stack.map((item) => item.text).join('\n'));
      button.textContent = ok ? '已复制' : '复制失败';
      setTimeout(() => {
        button.textContent = '复制全部';
      }, 1400);
      return;
    }
    if (act === 'copy') {
      const index = Number(button.getAttribute('data-i'));
      const item = stack[index];
      if (!item) return;
      const ok = await copyText(item.text);
      button.textContent = ok ? '已复制' : '失败';
      setTimeout(() => {
        button.textContent = '复制';
      }, 1200);
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => {
      switch (ch) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        default:
          return '&#39;';
      }
    });
  }

  async function copyText(text) {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      /* 非安全上下文会失败，走兜底 */
    }
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', 'readonly');
      area.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(area);
      area.select();
      area.setSelectionRange(0, area.value.length);
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch (err) {
      return false;
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;

    if (msg.type === 'QR_ENTER') {
      stackMode = false;
      stack = [];
      syncStack();
      enter();
      return;
    }

    if (msg.type === 'QR_SHOW_RESULTS') {
      build();
      if (!host || !host.isConnected) return;
      applyShade();
      host.style.setProperty('display', 'block', 'important');
      stage.style.display = 'block';
      const results = Array.isArray(msg.results) ? msg.results : [];
      if (results.length === 0) {
        revealPanel('没识别到二维码', '这张图片里没找到二维码。');
        return;
      }
      stackMode = false;
      syncStack();
      showResults(results);
      return;
    }

    if (msg.type === 'QR_SHOW_NOTICE') {
      build();
      if (!host || !host.isConnected) return;
      applyShade();
      stage.style.display = 'block';
      revealPanel(String(msg.title || '提示'), String(msg.message || ''));
    }
  });

  globalThis[APP] = { enter, exit };
})();
