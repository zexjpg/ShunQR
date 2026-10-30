'use strict';

const HISTORY_KEY = 'qr_history';
const DEFAULT_STATUS = '全部数据只存在本机，不上传。';

const listEl = document.getElementById('list');
const totalEl = document.getElementById('total');
const statusEl = document.getElementById('status');
const searchEl = document.getElementById('q');
const scanBtn = document.getElementById('scan-now');
const scanKeyEl = document.getElementById('scan-key');
const settingsBtn = document.getElementById('settings-btn');
const settingsEl = document.getElementById('settings');
const scKeyEl = document.getElementById('sc-key');
const editKeysBtn = document.getElementById('edit-keys');
const grantBtn = document.getElementById('grant-site');
const grantStateEl = document.getElementById('grant-state');
const grantNudgeEl = document.getElementById('grant-nudge');
const grantNowBtn = document.getElementById('grant-now');

let all = [];
let filtered = [];

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => {
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

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatTime(ts) {
  const date = new Date(Number(ts) || Date.now());
  const now = new Date();
  const hm = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  if (date.toDateString() === now.toDateString()) return hm;
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${hm}`;
}

function isoTime(ts) {
  const date = new Date(Number(ts) || Date.now());
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function sourceLabel(item) {
  const title = String(item.pageTitle || '').trim();
  if (title) return title;
  const url = String(item.pageUrl || '').trim();
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch (err) {
    return url;
  }
}

function safeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!/^(https?|file|ftp):\/\//i.test(raw)) return '';
  try {
    return new URL(raw).href;
  } catch (err) {
    return '';
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname || '';
  } catch (err) {
    return '';
  }
}

function fillSource(node, item) {
  node.textContent = '';
  node.appendChild(document.createTextNode('来源：'));

  const url = safeUrl(item.pageUrl);
  const title = String(item.pageTitle || '').trim();
  if (!url) {
    node.appendChild(document.createTextNode(title || '未知页面'));
    return;
  }

  const host = hostOf(url);
  const link = document.createElement('a');
  link.href = url;
  link.dataset.href = url;
  link.title = url;
  link.textContent = title || host || url;
  node.appendChild(link);

  if (title && host && title !== host) {
    const span = document.createElement('span');
    span.className = 'host';
    span.textContent = host;
    node.appendChild(span);
  }
}

function flashStatus(message, warn) {
  statusEl.textContent = message;
  statusEl.classList.toggle('warn', Boolean(warn));
  clearTimeout(flashStatus.timer);
  flashStatus.timer = setTimeout(() => {
    statusEl.textContent = DEFAULT_STATUS;
    statusEl.classList.remove('warn');
  }, 2600);
}

async function load() {
  try {
    const stored = await chrome.storage.local.get(HISTORY_KEY);
    all = Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
  } catch (err) {
    all = [];
  }
  render();
}

function render() {
  const query = searchEl.value.trim().toLowerCase();
  filtered = query
    ? all.filter((item) => {
        const text = String(item.text || '').toLowerCase();
        const title = String(item.pageTitle || '').toLowerCase();
        const url = String(item.pageUrl || '').toLowerCase();
        return text.includes(query) || title.includes(query) || url.includes(query);
      })
    : all;

  totalEl.textContent = all.length ? `共 ${all.length} 条` : '';

  if (filtered.length === 0) {
    listEl.innerHTML = all.length
      ? '<div class="empty">没有匹配的记录</div>'
      : '<div class="empty">还没有扫描记录<br><span>点上面的「截图扫码」，在页面上拖出二维码所在区域<br>网页上的图片也可以直接右键「扫描这张图片里的二维码」<br>还能直接按 Ctrl+V 粘贴或拖入二维码图片</span></div>';
    listEl.onclick = null;
    return;
  }

  listEl.innerHTML = filtered
    .map((item) => {
      const dup = (item.count || 1) > 1 ? `<span class="dup">×${item.count}</span>` : '';
      const hasSrc = Boolean(sourceLabel(item));
      const isUrl = /^https?:\/\//i.test(String(item.text || '').trim());
      return `<article class="row">
        <div class="row-hd">
          <span class="badge">${esc(item.format || 'QR_CODE')}</span>
          <time>${esc(formatTime(item.ts))}</time>
          ${dup}
          <span class="spacer"></span>
          <button data-act="del" data-id="${esc(item.id)}">删除</button>
        </div>
        <div class="row-text"></div>
        ${hasSrc ? '<div class="row-src"></div>' : ''}
        <div class="row-ft">
          <button class="primary" data-act="copy" data-id="${esc(item.id)}">复制</button>
          ${isUrl ? `<button data-act="open" data-id="${esc(item.id)}">打开</button>` : ''}
        </div>
      </article>`;
    })
    .join('');

  const textNodes = listEl.querySelectorAll('.row-text');
  const srcNodes = listEl.querySelectorAll('.row-src');
  filtered.forEach((item, index) => {
    if (textNodes[index]) textNodes[index].textContent = String(item.text || '');
    if (srcNodes[index]) fillSource(srcNodes[index], item);
  });

  listEl.onclick = onListClick;
}

async function onListClick(event) {
  const link = event.target.closest('a[data-href]');
  if (link) {
    event.preventDefault();
    chrome.tabs.create({ url: link.dataset.href });
    return;
  }

  const button = event.target.closest('button[data-act]');
  if (!button) return;
  const id = button.getAttribute('data-id');
  const item = all.find((entry) => entry.id === id);
  if (!item) return;

  const act = button.getAttribute('data-act');

  if (act === 'copy') {
    const ok = await writeClipboard(String(item.text || ''));
    button.textContent = ok ? '已复制' : '复制失败';
    setTimeout(() => {
      button.textContent = '复制';
    }, 1300);
    return;
  }

  if (act === 'open') {
    chrome.tabs.create({ url: String(item.text).trim() });
    return;
  }

  if (act === 'del') {
    const next = all.filter((entry) => entry.id !== id);
    all = next;
    render();
    await chrome.storage.local.set({ [HISTORY_KEY]: next });
    flashStatus('已删除 1 条');
  }
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch (err2) {
      return false;
    }
  }
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function csvCell(value) {
  const text = String(value == null ? '' : value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function tsvCell(value) {
  return String(value == null ? '' : value)
    .replace(/\t/g, ' ')
    .replace(/\r?\n/g, ' / ');
}

function exportAs(kind) {
  const query = searchEl.value.trim();
  const rows = query ? filtered : all;
  if (rows.length === 0) {
    flashStatus(query ? '当前筛选没有记录' : '没有可导出的记录');
    return;
  }

  const now = new Date();
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(
    now.getHours()
  )}${pad2(now.getMinutes())}`;
  const base = `二维码扫描-${stamp}`;

  if (kind === 'json') {
    const payload = rows.map((item) => ({
      time: isoTime(item.ts),
      text: item.text,
      format: item.format || '',
      count: item.count || 1,
      sourceTitle: item.pageTitle || '',
      sourceUrl: item.pageUrl || ''
    }));
    download(`${base}.json`, JSON.stringify(payload, null, 2), 'application/json');
  } else {
    const header = ['时间', '内容', '格式', '重复次数', '来源标题', '来源地址'];
    const body = rows.map((item) => [
      isoTime(item.ts),
      item.text,
      item.format || '',
      item.count || 1,
      item.pageTitle || '',
      item.pageUrl || ''
    ]);
    const lines = [header, ...body];

    if (kind === 'csv') {
      const content = lines.map((line) => line.map(csvCell).join(',')).join('\r\n');
      download(`${base}.csv`, `\ufeff${content}`, 'text/csv');
    } else {
      const content = lines.map((line) => line.map(tsvCell).join('\t')).join('\r\n');
      download(`${base}.tsv`, content, 'text/tab-separated-values');
    }
  }

  flashStatus(`已导出 ${rows.length} 条`);
}

document.getElementById('export-csv').addEventListener('click', () => exportAs('csv'));
document.getElementById('export-tsv').addEventListener('click', () => exportAs('tsv'));
document.getElementById('export-json').addEventListener('click', () => exportAs('json'));

document.getElementById('clear').addEventListener('click', async () => {
  if (all.length === 0) {
    flashStatus('已经是空的了');
    return;
  }
  if (!window.confirm(`确定清空全部 ${all.length} 条记录吗？此操作不可撤销。`)) return;
  all = [];
  render();
  await chrome.storage.local.set({ [HISTORY_KEY]: [] });
  flashStatus('已清空');
});

searchEl.addEventListener('input', render);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[HISTORY_KEY]) return;
  const next = changes[HISTORY_KEY].newValue;
  all = Array.isArray(next) ? next : [];
  render();
});

function bytesToBase64(bytes) {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function ingestFile(file) {
  if (!file) return;
  if (!/^image\//i.test(file.type || '')) {
    flashStatus('这个文件不是图片');
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    flashStatus('图片太大，换一张小于 12MB 的');
    return;
  }

  flashStatus('正在识别…');
  try {
    const buffer = await file.arrayBuffer();
    const image = bytesToBase64(new Uint8Array(buffer));
    const res = await chrome.runtime.sendMessage({ type: 'DECODE_IMAGE', image });
    if (!res || !res.ok) {
      flashStatus('识别失败，请重试');
      return;
    }
    const results = Array.isArray(res.results) ? res.results : [];
    if (results.length === 0) {
      flashStatus('这张图里没找到二维码');
      return;
    }
    flashStatus(`识别到 ${results.length} 个码，已存入历史`);
  } catch (err) {
    flashStatus(`识别失败：${(err && err.message) || err}`);
  }
}

document.addEventListener('paste', (event) => {
  const items = event.clipboardData && event.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.kind === 'file' && /^image\//i.test(item.type || '')) {
      const file = item.getAsFile();
      if (file) {
        event.preventDefault();
        ingestFile(file);
        return;
      }
    }
  }
});

document.addEventListener('dragover', (event) => {
  event.preventDefault();
});

document.addEventListener('drop', (event) => {
  event.preventDefault();
  const files = event.dataTransfer && event.dataTransfer.files;
  if (files && files.length > 0) ingestFile(files[0]);
});

/* ---------- 顶部扫描按钮 ---------- */

function scanErrorText(code) {
  switch (String(code || '')) {
    case 'no-tab':
      return '没找到可扫描的标签页';
    case 'restricted':
      return '浏览器内部页 / 扩展商店不允许扫码，可改用 Ctrl+V 粘贴图片';
    case 'need-grant':
      return '这个标签页还没拿到权限：先点一次工具栏图标再扫，或在设置里授权任意页面';
    case 'inject-failed':
      return '无法在这个页面注入扫描脚本';
    case 'enter-failed':
      return '页面没有响应，刷新后重试';
    default:
      return '启动扫描失败，请重试';
  }
}

async function startScanFromPanel() {
  scanBtn.disabled = true;
  try {
    let windowId = null;
    try {
      const win = await chrome.windows.getCurrent();
      if (win && typeof win.id === 'number') windowId = win.id;
    } catch (err) {
      windowId = null;
    }

    const res = await chrome.runtime.sendMessage({ type: 'START_SCAN', windowId });
    const code = res && res.error;
    if (res && res.ok) {
      hideGrantNudge();
      flashStatus('已进入框选状态，在页面上拖出二维码所在区域');
    } else if (code === 'need-grant') {
      // 侧栏按钮点击不算浏览器手势，拿不到 activeTab，只能就地申请可选权限
      showGrantNudge();
      flashStatus('这个页面还没拿到权限，点上面的「授权后继续」', true);
    } else {
      hideGrantNudge();
      flashStatus(scanErrorText(code), true);
    }
  } catch (err) {
    flashStatus(`启动失败：${(err && err.message) || err}`, true);
  } finally {
    scanBtn.disabled = false;
  }
}

/* ---------- 设置：快捷键 ---------- */

async function refreshShortcut() {
  let shortcut = '';
  try {
    const commands = await chrome.commands.getAll();
    const item = (commands || []).find((entry) => entry.name === 'start-scan');
    shortcut = String((item && item.shortcut) || '');
  } catch (err) {
    shortcut = '';
  }

  scanKeyEl.textContent = shortcut;
  scanKeyEl.hidden = !shortcut;
  scKeyEl.textContent = shortcut || '未设置';

  return shortcut;
}

function shortcutsPageUrl() {
  const isEdge = /Edg\//.test(navigator.userAgent);
  return isEdge ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts';
}

async function openShortcutsPage() {
  const url = shortcutsPageUrl();
  try {
    await chrome.tabs.create({ url });
    flashStatus('在新标签页里改快捷键，回到这里会自动显示新组合');
  } catch (err) {
    flashStatus(`打不开快捷键页面，请手动访问 ${url}`, true);
  }
}

/* ---------- 设置：可选全站权限 ---------- */

const OPTIONAL_ORIGINS = { origins: ['<all_urls>'] };
let hasAllSites = false;

async function refreshGrant() {
  try {
    hasAllSites = await chrome.permissions.contains(OPTIONAL_ORIGINS);
  } catch (err) {
    hasAllSites = false;
  }
  grantStateEl.textContent = hasAllSites ? '已授权' : '未授权';
  grantStateEl.classList.toggle('on', hasAllSites);
  grantBtn.textContent = hasAllSites ? '取消授权' : '授权任意页面';
}

async function toggleGrant() {
  try {
    if (!hasAllSites) {
      const ok = await chrome.permissions.request(OPTIONAL_ORIGINS);
      if (!ok) {
        flashStatus('未授权。扫码仍可用，只是换标签页时要先点一次工具栏图标', true);
        await refreshGrant();
        return;
      }
    } else {
      await chrome.permissions.remove(OPTIONAL_ORIGINS);
    }
    await refreshGrant();
    if (hasAllSites) hideGrantNudge();
    flashStatus(hasAllSites ? '已授权任意页面，切换标签页也能直接扫' : '已取消全站授权');
  } catch (err) {
    flashStatus(`权限操作失败：${(err && err.message) || err}`, true);
    await refreshGrant();
  }
}

/* ---------- 缺权限时就地授权 ---------- */

function showGrantNudge() {
  grantNudgeEl.hidden = false;
}

function hideGrantNudge() {
  grantNudgeEl.hidden = true;
}

// 关键：本回调第一行就是 permissions.request，前面不能有任何 await。
// 浏览器要求该 API 在用户手势的同一个任务里调用，先 await 拿数据手势就没了。
grantNowBtn.addEventListener('click', async () => {
  let granted = false;
  try {
    granted = await chrome.permissions.request(OPTIONAL_ORIGINS);
  } catch (err) {
    flashStatus(`授权失败：${(err && err.message) || err}`, true);
    return;
  }

  if (!granted) {
    flashStatus('没有授权。也可以先点一次工具栏图标或按快捷键，再回来扫', true);
    return;
  }

  hasAllSites = true;
  grantStateEl.textContent = '已授权';
  grantStateEl.classList.add('on');
  grantBtn.textContent = '取消授权';
  hideGrantNudge();
  flashStatus('已授权，正在启动扫描…');
  startScanFromPanel();
});

/* ---------- 设置区开合 ---------- */

let settingsOpen = false;

function toggleSettings(force) {
  settingsOpen = typeof force === 'boolean' ? force : !settingsOpen;
  settingsEl.hidden = !settingsOpen;
  settingsBtn.setAttribute('aria-expanded', String(settingsOpen));
  settingsBtn.textContent = settingsOpen ? '收起设置' : '设置';
  if (settingsOpen) {
    refreshShortcut();
    refreshGrant();
  }
}

scanBtn.addEventListener('click', startScanFromPanel);
settingsBtn.addEventListener('click', () => toggleSettings());
editKeysBtn.addEventListener('click', openShortcutsPage);
grantBtn.addEventListener('click', toggleGrant);

window.addEventListener('focus', () => {
  refreshShortcut();
  if (settingsOpen) refreshGrant();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshShortcut();
});

// 从浏览器的快捷键页面改完回来后，点一下面板就会刷新显示
document.addEventListener('pointerdown', () => refreshShortcut(), true);

/* ---------- 顶部 Tab：扫码 / 生成 ---------- */

const tabScan = document.getElementById('tab-scan');
const tabGen = document.getElementById('tab-gen');
const viewScan = document.getElementById('view-scan');
const viewGen = document.getElementById('view-gen');

function switchView(name) {
  if (!viewScan || !viewGen) return;
  const isGen = name === 'gen';
  viewScan.hidden = isGen;
  viewGen.hidden = !isGen;
  tabScan.classList.toggle('on', !isGen);
  tabGen.classList.toggle('on', isGen);
  tabScan.setAttribute('aria-selected', String(!isGen));
  tabGen.setAttribute('aria-selected', String(isGen));
  if (isGen && window.QRGenUI) window.QRGenUI.activate();
}

if (tabScan && tabGen) {
  tabScan.addEventListener('click', () => switchView('scan'));
  tabGen.addEventListener('click', () => switchView('gen'));
}

refreshShortcut();
load();
