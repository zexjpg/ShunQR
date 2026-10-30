'use strict';

const OFFSCREEN_PATH = 'offscreen.html';
const HISTORY_KEY = 'qr_history';
const HISTORY_LIMIT = 500;
const DEDUPE_WINDOW = 12;
const PAD_RATIO = 0.08;
const PAD_MIN = 10;
const CAPTURE_THROTTLE_MS = 550;

let offscreenCreating = null;
let lastCaptureAt = 0;

function setupMenus() {
  chrome.contextMenus.removeAll(() => {
    // 三条都直接挂在一级菜单：右键图片时不用再钻进「顺手码」子菜单找
    chrome.contextMenus.create({
      id: 'qr-image',
      title: '扫描这张图片里的二维码',
      contexts: ['image']
    });
    chrome.contextMenus.create({
      id: 'qr-scan',
      title: '截图扫码',
      contexts: ['all']
    });
    chrome.contextMenus.create({
      id: 'qr-history',
      title: '查看扫码历史',
      contexts: ['all']
    });
  });
}

function setupPanelBehavior() {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) => console.warn('[qr-snap] setPanelBehavior failed:', err && err.message));
  }
}

chrome.runtime.onInstalled.addListener(() => {
  setupMenus();
  setupPanelBehavior();
});
chrome.runtime.onStartup.addListener(() => {
  setupMenus();
  setupPanelBehavior();
});
setupPanelBehavior();

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const id = info && info.menuItemId;
  if (id === 'qr-scan') {
    startScan(tab).catch((err) => console.warn('[qr-snap] menu scan failed:', err));
  } else if (id === 'qr-image') {
    scanImageUrl(info.srcUrl, tab, info.frameId).catch((err) =>
      console.warn('[qr-snap] menu image failed:', err)
    );
  } else if (id === 'qr-history') {
    openHistory(tab).catch((err) => console.warn('[qr-snap] menu history failed:', err));
  }
});

// 正常情况下点击图标由 openPanelOnActionClick 接管；这里作为兜底（老版本浏览器）
chrome.action.onClicked.addListener((tab) => {
  openHistory(tab).catch((err) => console.warn('[qr-snap] open panel failed:', err));
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'start-scan') return;
  resolveTab(tab)
    .then((t) => startScan(t))
    .catch((err) => console.warn('[qr-snap] start failed:', err));
});

async function resolveTab(tab, windowId) {
  if (tab && typeof tab.id === 'number') return tab;
  if (typeof windowId === 'number') {
    const [inWindow] = await chrome.tabs.query({ active: true, windowId });
    if (inWindow) return inWindow;
  }
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return active || null;
}

async function startScan(tab, windowId) {
  const target = await resolveTab(tab, windowId);
  if (!target || typeof target.id !== 'number') return { ok: false, error: 'no-tab' };

  // 没有 host 权限时 tab.url 可能为空，此时不做预判，交给注入失败来兜底
  if (target.url && !/^(https?|file|ftp):/i.test(target.url)) {
    await flashBadge(target.id, '!');
    return { ok: false, error: 'restricted' };
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: target.id, allFrames: false },
      files: ['content/scan.js']
    });
  } catch (err) {
    const message = String((err && err.message) || err);
    console.warn('[qr-snap] inject failed:', message);
    await flashBadge(target.id, '!');
    return { ok: false, error: /permission|Cannot access|host permission/i.test(message) ? 'need-grant' : 'inject-failed' };
  }

  try {
    await chrome.tabs.sendMessage(target.id, { type: 'QR_ENTER' });
    return { ok: true };
  } catch (err) {
    console.warn('[qr-snap] enter message failed:', (err && err.message) || err);
    await flashBadge(target.id, '!');
    return { ok: false, error: 'enter-failed' };
  }
}

async function flashBadge(tabId, text) {
  try {
    await chrome.action.setBadgeBackgroundColor({ color: '#A32D2D', tabId });
    await chrome.action.setBadgeText({ text, tabId });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId }).catch(() => {});
    }, 1800);
  } catch (err) {
    /* badge 在部分页面不可用，忽略 */
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string') return;

  if (msg.type === 'START_SCAN') {
    startScan(sender.tab, msg.windowId)
      .then(sendResponse)
      .catch((err) => {
        console.warn('[qr-snap] panel scan failed:', err);
        sendResponse({ ok: false, error: String((err && err.message) || err) });
      });
    return true;
  }

  if (msg.type === 'OPEN_HISTORY') {
    openHistory(sender.tab)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.warn('[qr-snap] openHistory failed:', err);
        sendResponse({ ok: false, error: String((err && err.message) || err) });
      });
    return true;
  }

  if (msg.type === 'DECODE_IMAGE') {
    decodeImagePayload(msg.image, sender.tab)
      .then(sendResponse)
      .catch((err) => {
        console.warn('[qr-snap] decode image failed:', err);
        sendResponse({ ok: false, error: String((err && err.message) || err) });
      });
    return true;
  }

  if (msg.type !== 'QR_SELECTED') return;

  const tab = sender.tab;
  if (!tab) {
    sendResponse({ ok: false, error: 'no-tab' });
    return;
  }
  handleSelection(tab, msg)
    .then(sendResponse)
    .catch((err) => {
      console.warn('[qr-snap] handleSelection failed:', err);
      sendResponse({ ok: false, error: String((err && err.message) || err) });
    });
  return true;
});

async function decodeImagePayload(image, tab) {
  const results = await decodeWithOffscreen(image);
  if (results.length > 0) {
    await saveHistory(results, tab && tab.url ? tab : { url: '', title: '本地图片' });
  }
  return { ok: true, results };
}

async function openHistory(tab) {
  const tabId = tab && typeof tab.id === 'number' ? tab.id : null;

  if (chrome.sidePanel && chrome.sidePanel.open) {
    try {
      if (tabId !== null) {
        await chrome.sidePanel.open({ tabId });
      } else {
        const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (active && typeof active.id === 'number') await chrome.sidePanel.open({ tabId: active.id });
        else return;
      }
      return;
    } catch (err) {
      console.warn('[qr-snap] sidePanel.open unavailable:', (err && err.message) || err);
    }
  }

  await chrome.tabs.create({ url: chrome.runtime.getURL('panel.html') });
}

async function scanImageUrl(srcUrl, tab, frameId) {
  if (!tab || typeof tab.id !== 'number') return;

  const url = String(srcUrl || '').trim();
  if (!url) {
    await showInPage(tab.id, {
      type: 'QR_SHOW_NOTICE',
      title: '无法识别',
      message: '没拿到这张图片的地址。可以改用「截图扫码」框一下这个码。'
    });
    return;
  }

  let results = [];
  let decoded = false;

  // 路线一：直接取原图解码，清晰度最好
  try {
    const image = await imageToBase64(url);
    results = await decodeWithOffscreen(image);
    decoded = true;
  } catch (err) {
    console.warn('[qr-snap] fetch image failed:', (err && err.message) || err);
  }

  // 路线二：取不到原图（跨域、防盗链、blob 地址）就按图片在页面上的位置截屏裁切
  if (results.length === 0) {
    try {
      const image = await captureImageElement(tab, url, frameId);
      results = mergeResults(results, await decodeWithOffscreen(image));
      decoded = true;
    } catch (err) {
      console.warn('[qr-snap] image capture fallback failed:', (err && err.message) || err);
    }
  }

  if (results.length > 0) {
    await saveHistory(results, tab);
    await showInPage(tab.id, { type: 'QR_SHOW_RESULTS', results });
    return;
  }

  await showInPage(tab.id, {
    type: 'QR_SHOW_NOTICE',
    title: decoded ? '没找到二维码' : '识别失败',
    message: decoded
      ? '这张图片里没识别到二维码。如果码很小、很模糊或者只露出半张，可以改用「截图扫码」自己框一下。'
      : '这张图既取不到原始数据，也没法在页面上定位到它（可能在子框架里或已被隐藏）。改用「截图扫码」框一下这个码更稳。'
  });
}

async function imageToBase64(url) {
  if (/^data:/i.test(url)) return dataUrlToBase64(url);
  if (!/^https?:/i.test(url)) throw new Error('unsupported-url');

  const bytes = await fetchImageBytes(url);
  if (bytes.length === 0) throw new Error('empty-image');
  return bytesToBase64(bytes);
}

function dataUrlToBase64(url) {
  const comma = url.indexOf(',');
  if (comma < 0) throw new Error('bad-data-url');
  const meta = url.slice(0, comma);
  const payload = url.slice(comma + 1);
  if (/;base64/i.test(meta)) return payload;
  return bytesToBase64(new TextEncoder().encode(decodeURIComponent(payload)));
}

async function fetchImageBytes(url) {
  let lastError = null;
  // 先不带 cookie 取，被防盗链挡了再带上 cookie 试一次
  for (const credentials of ['omit', 'include']) {
    try {
      const response = await fetch(url, { credentials, cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('fetch-failed');
}

// 在页面里找到这张 <img>，把它滚到可见区域，并算成顶层窗口坐标
function locateImage(srcUrl) {
  const images = Array.from(document.images || []);
  const img = images.find((item) => item.currentSrc === srcUrl || item.src === srcUrl) || null;
  if (!img) return null;

  // 图片在跨域子框架里时，框架内的坐标换不到顶层坐标，只能放弃让上层走截图扫码
  try {
    void window.top.document;
  } catch (err) {
    return null;
  }

  const before = img.getBoundingClientRect();
  let scrolled = false;
  const fullyVisible =
    before.top >= 0 && before.left >= 0 && before.bottom <= innerHeight && before.right <= innerWidth;
  const fitsViewport = before.width < innerWidth && before.height < innerHeight;
  if (!fullyVisible && fitsViewport) {
    try {
      img.scrollIntoView({ block: 'center', inline: 'center' });
      scrolled = true;
    } catch (err) {
      /* ignore */
    }
  }

  const box = img.getBoundingClientRect();
  if (box.width < 4 || box.height < 4) return null;

  // 子框架里的坐标要加上各层 frameElement 的偏移
  let offsetX = 0;
  let offsetY = 0;
  let win = window;
  while (win !== window.top && win.frameElement) {
    const frame = win.frameElement;
    const frameBox = frame.getBoundingClientRect();
    offsetX += frameBox.left + (frame.clientLeft || 0);
    offsetY += frameBox.top + (frame.clientTop || 0);
    win = win.parent;
  }

  return {
    rect: { x: box.left + offsetX, y: box.top + offsetY, width: box.width, height: box.height },
    viewportWidth: window.top.innerWidth,
    viewportHeight: window.top.innerHeight,
    scrolled
  };
}

async function captureImageElement(tab, srcUrl, frameId) {
  const frameIds = [Number.isInteger(frameId) && frameId >= 0 ? frameId : 0];

  const [probe] = await chrome.scripting.executeScript({
    target: { tabId: tab.id, frameIds },
    func: locateImage,
    args: [srcUrl]
  });

  const info = probe && probe.result;
  if (!info) throw new Error('image-not-found');
  if (info.scrolled) await sleep(180);

  const rect = clipToViewport(info);
  if (!rect) throw new Error('image-offscreen');

  const dataUrl = await captureWithThrottle(tab.windowId);
  return cropToBase64(dataUrl, rect, info.viewportWidth);
}

function clipToViewport(info) {
  const rect = (info && info.rect) || {};
  const vw = Number(info && info.viewportWidth) || 0;
  const vh = Number(info && info.viewportHeight) || 0;
  if (!(vw > 0) || !(vh > 0)) return null;

  const x0 = Number(rect.x);
  const y0 = Number(rect.y);
  const w0 = Number(rect.width);
  const h0 = Number(rect.height);
  if (![x0, y0, w0, h0].every(Number.isFinite)) return null;

  const pad = Math.max(8, Math.round(0.06 * Math.min(w0, h0)));
  const x = Math.max(0, Math.floor(x0 - pad));
  const y = Math.max(0, Math.floor(y0 - pad));
  const right = Math.min(vw, Math.ceil(x0 + w0 + pad));
  const bottom = Math.min(vh, Math.ceil(y0 + h0 + pad));

  const width = right - x;
  const height = bottom - y;
  if (width < 8 || height < 8) return null;
  return { x, y, width, height };
}

function mergeResults(first, second) {
  const out = [];
  const seen = new Set();
  for (const item of [...(first || []), ...(second || [])]) {
    const text = String((item && item.text) || '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(item);
  }
  return out;
}

async function showInPage(tabId, payload) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ['content/scan.js']
    });
  } catch (err) {
    console.warn('[qr-snap] inject for result failed:', err);
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, payload);
  } catch (err) {
    console.warn('[qr-snap] send result failed:', err);
  }
}

async function handleSelection(tab, msg) {
  const rect = normalizeRect(msg.rect);
  if (!rect) return { ok: false, error: 'bad-rect' };

  const viewportWidth = Number(msg.viewportWidth) || 0;
  const dataUrl = await captureWithThrottle(tab.windowId);
  const image = await cropToBase64(dataUrl, rect, viewportWidth);
  const results = await decodeWithOffscreen(image);

  if (results.length > 0) {
    await saveHistory(results, tab);
  }

  return { ok: true, results };
}

function normalizeRect(rect) {
  if (!rect) return null;
  const x = Number(rect.x);
  const y = Number(rect.y);
  const w = Number(rect.width);
  const h = Number(rect.height);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  if (w < 2 || h < 2) return null;
  return {
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    width: Math.round(w),
    height: Math.round(h)
  };
}

async function captureWithThrottle(windowId) {
  const wait = CAPTURE_THROTTLE_MS - (Date.now() - lastCaptureAt);
  if (wait > 0) await sleep(wait);
  lastCaptureAt = Date.now();
  return chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
}

async function cropToBase64(dataUrl, rect, viewportWidth) {
  const sourceBytes = decodeDataUrl(dataUrl);
  if (sourceBytes.length === 0) throw new Error('empty-capture');

  const blob = new Blob([sourceBytes], { type: 'image/png' });
  const bitmap = await createImageBitmap(blob);

  try {
    const scale = viewportWidth > 0 ? bitmap.width / viewportWidth : 1;

    const pad = Math.max(PAD_MIN, Math.round(PAD_RATIO * Math.min(rect.width, rect.height)));
    const sx = clamp(Math.round((rect.x - pad) * scale), 0, bitmap.width - 1);
    const sy = clamp(Math.round((rect.y - pad) * scale), 0, bitmap.height - 1);
    const ex = clamp(Math.round((rect.x + rect.width + pad) * scale), sx + 1, bitmap.width);
    const ey = clamp(Math.round((rect.y + rect.height + pad) * scale), sy + 1, bitmap.height);

    const sw = Math.max(1, ex - sx);
    const sh = Math.max(1, ey - sy);

    const canvas = new OffscreenCanvas(sw, sh);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);

    const out = await canvas.convertToBlob({ type: 'image/png' });
    const buf = await out.arrayBuffer();
    return bytesToBase64(new Uint8Array(buf));
  } finally {
    bitmap.close();
  }
}

function decodeDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') throw new Error('bad-data-url');
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('bad-data-url');
  const meta = dataUrl.slice(0, comma);
  if (!/;base64/i.test(meta)) throw new Error('unsupported-data-url');

  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes) {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureOffscreen() {
  if (chrome.offscreen && chrome.offscreen.hasDocument) {
    const has = await chrome.offscreen.hasDocument();
    if (has) return;
  }
  if (offscreenCreating) {
    await offscreenCreating;
    return;
  }

  offscreenCreating = (async () => {
    try {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_PATH,
        reasons: ['BLOBS'],
        justification: '在本地用 WebAssembly 解码截图中的二维码'
      });
    } catch (err) {
      const message = String((err && err.message) || err);
      if (!/single offscreen|already exists|Only a single/i.test(message)) throw err;
    }
  })();

  try {
    await offscreenCreating;
  } finally {
    offscreenCreating = null;
  }
}

async function decodeWithOffscreen(image) {
  await ensureOffscreen();

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await chrome.runtime.sendMessage({
        target: 'qr-offscreen',
        type: 'DECODE_QR',
        image
      });
      if (!res) {
        lastError = new Error('解码器无响应');
      } else if (res.ok) {
        return res.results || [];
      } else {
        lastError = new Error(res.error || '解码失败');
      }
    } catch (err) {
      lastError = err;
    }
    if (attempt < 2) await sleep(150);
  }

  throw lastError || new Error('解码失败');
}

async function saveHistory(results, tab) {
  let list = [];
  try {
    const stored = await chrome.storage.local.get(HISTORY_KEY);
    list = Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
  } catch (err) {
    list = [];
  }

  const now = Date.now();
  const fresh = [];

  for (const item of results) {
    const text = String(item.text || '').trim();
    if (!text) continue;

    const hitIndex = list.findIndex((x) => x.text === text);
    if (hitIndex >= 0 && hitIndex < DEDUPE_WINDOW) {
      list[hitIndex] = {
        ...list[hitIndex],
        ts: now,
        count: (list[hitIndex].count || 1) + 1
      };
      continue;
    }

    fresh.unshift({
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      format: item.format || 'UNKNOWN',
      contentType: item.contentType || '',
      ts: now,
      count: 1,
      pageUrl: tab.url || '',
      pageTitle: tab.title || ''
    });
  }

  if (fresh.length === 0 && list.length === 0) return;

  const next = [...fresh, ...list].slice(0, HISTORY_LIMIT);
  await chrome.storage.local.set({ [HISTORY_KEY]: next });
}
