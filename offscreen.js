import { readBarcodes, prepareZXingModule } from './vendor/zxing/dist/es/reader/index.js';

const WASM_PATH = 'vendor/zxing/dist/reader/zxing_reader.wasm';
const MAX_PIXELS = 6_000_000;
const MAX_SYMBOLS = 8;

const PASSES = [
  { name: 'normal', scale: 1, binarizer: 'LocalAverage' },
  { name: 'histogram', scale: 1, binarizer: 'GlobalHistogram' },
  { name: 'upscale2', scale: 2, binarizer: 'LocalAverage' },
  { name: 'fixed', scale: 1, binarizer: 'FixedThreshold' },
  { name: 'upscale3', scale: 3, binarizer: 'LocalAverage' }
];

const ready = prepareZXingModule({
  overrides: {
    locateFile: (path, prefix) => {
      if (typeof path === 'string' && path.endsWith('.wasm')) {
        return chrome.runtime.getURL(WASM_PATH);
      }
      return prefix ? prefix + path : path;
    }
  },
  fireImmediately: true
});

ready.catch((err) => {
  console.error('[qr-snap] wasm init failed:', err);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== 'qr-offscreen' || msg.type !== 'DECODE_QR') return;
  decodeBuffer(msg.image)
    .then(sendResponse)
    .catch((err) => {
      console.error('[qr-snap] decode failed:', err);
      sendResponse({ ok: false, error: String((err && err.message) || err) });
    });
  return true;
});

function base64ToBytes(base64) {
  if (typeof base64 !== 'string' || base64.length === 0) return new Uint8Array(0);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function sniffMime(bytes) {
  const b = bytes;
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (
    b.length > 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (b.length > 2 && b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  if (b.length > 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'image/avif';
  return 'image/png';
}

async function decodeBuffer(image) {
  await ready;

  const bytes = base64ToBytes(image);
  if (bytes.length === 0) {
    return { ok: false, error: 'empty-image' };
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes], { type: sniffMime(bytes) }));
  } catch (err) {
    return { ok: false, error: `bitmap-failed: ${(err && err.message) || err}` };
  }

  try {
    for (const pass of PASSES) {
      if (bitmap.width * bitmap.height * pass.scale * pass.scale > MAX_PIXELS) continue;

      let hits = [];
      try {
        hits = await readBarcodes(renderPass(bitmap, pass), {
          formats: ['Any'],
          tryHarder: true,
          tryRotate: true,
          tryInvert: true,
          maxNumberOfSymbols: MAX_SYMBOLS,
          binarizer: pass.binarizer
        });
      } catch (err) {
        hits = [];
      }

      const clean = (hits || []).filter((hit) => hit && hit.text && hit.isValid !== false);
      if (clean.length > 0) {
        return { ok: true, results: clean.map(simplify), pass: pass.name };
      }
    }
    return { ok: true, results: [] };
  } finally {
    bitmap.close();
  }
}

function renderPass(bitmap, pass) {
  const width = Math.max(1, Math.round(bitmap.width * pass.scale));
  const height = Math.max(1, Math.round(bitmap.height * pass.scale));

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (pass.scale !== 1) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }
  ctx.drawImage(bitmap, 0, 0, width, height);

  return ctx.getImageData(0, 0, width, height);
}

function simplify(hit) {
  const pos = hit.position || null;
  return {
    text: String(hit.text || ''),
    format: String(hit.format || ''),
    contentType: String(hit.contentType || ''),
    eccLevel: String(hit.eccLevel || ''),
    position: pos
      ? {
          topLeft: pos.topLeft,
          topRight: pos.topRight,
          bottomRight: pos.bottomRight,
          bottomLeft: pos.bottomLeft
        }
      : null
  };
}
