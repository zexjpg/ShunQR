/* 二维码矩阵构建与渲染：纯本地，不产生任何网络请求。
   依赖 vendor/qrcode/qrcode.js（MIT, Kazuhiko Arase）。 */
(function (global) {
  'use strict';

  var QUIET_MODULES = 4;
  var ECC_LEVELS = ['L', 'M', 'Q', 'H'];
  // 字节模式 + 版本 40 的容量上限（UTF-8 字节数）
  var BYTE_CAPACITY = { L: 2953, M: 2331, Q: 1663, H: 1273 };
  var DEFAULT_STYLE = { size: 512, fg: '#111111', bg: '#ffffff', ecc: 'M' };

  // qrcode-generator 默认按 latin1 取字节，中文/emoji 会乱码，这里强制 UTF-8
  if (global.qrcode && global.qrcode.stringToBytesFuncs && global.qrcode.stringToBytesFuncs['UTF-8']) {
    global.qrcode.stringToBytes = global.qrcode.stringToBytesFuncs['UTF-8'];
  }

  function byteLength(text) {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).length;
    try {
      return decodeURIComponent(encodeURIComponent(text)).length;
    } catch (err) {
      return String(text).length;
    }
  }

  function normalizeColor(value, fallback) {
    var raw = String(value == null ? '' : value).trim();
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(raw)) {
      return ('#' + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3]).toLowerCase();
    }
    return fallback;
  }

  function styleOf(options) {
    var opts = options || {};
    var ecc = ECC_LEVELS.indexOf(opts.ecc) >= 0 ? opts.ecc : DEFAULT_STYLE.ecc;
    var size = Number(opts.size);
    if (!Number.isFinite(size) || size < 64) size = DEFAULT_STYLE.size;
    return {
      size: Math.round(size),
      fg: normalizeColor(opts.fg, DEFAULT_STYLE.fg),
      bg: normalizeColor(opts.bg, DEFAULT_STYLE.bg),
      ecc: ecc
    };
  }

  // 返回 { ok, moduleCount, grid, version, ecc, bytes }
  function build(text, options) {
    var style = styleOf(options);
    var raw = String(text == null ? '' : text);
    if (!raw) return { ok: false, error: 'empty' };
    if (!global.qrcode) return { ok: false, error: 'no-encoder' };

    var bytes = byteLength(raw);
    if (bytes > BYTE_CAPACITY[style.ecc]) {
      return { ok: false, error: 'too-long', bytes: bytes, limit: BYTE_CAPACITY[style.ecc], ecc: style.ecc };
    }

    var qr;
    try {
      qr = global.qrcode(0, style.ecc);
      qr.addData(raw, 'Byte');
      qr.make();
    } catch (err) {
      return { ok: false, error: 'encode-failed', message: String((err && err.message) || err), bytes: bytes };
    }

    var count = qr.getModuleCount();
    var grid = new Uint8Array(count * count);
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        grid[r * count + c] = qr.isDark(r, c) ? 1 : 0;
      }
    }

    return {
      ok: true,
      moduleCount: count,
      grid: grid,
      version: (count - 17) / 4,
      ecc: style.ecc,
      bytes: bytes,
      text: raw
    };
  }

  // 整数倍放大，保证模块边缘不出现半像素模糊；取最接近目标尺寸的整数倍
  function geometry(model, size) {
    var total = model.moduleCount + QUIET_MODULES * 2;
    var cell = Math.max(1, Math.round(size / total));
    return { total: total, cell: cell, pixels: total * cell };
  }

  function eachRowRun(model, onRun) {
    var n = model.moduleCount;
    for (var r = 0; r < n; r++) {
      var c = 0;
      while (c < n) {
        if (!model.grid[r * n + c]) {
          c++;
          continue;
        }
        var start = c;
        while (c < n && model.grid[r * n + c]) c++;
        onRun(r, start, c - start);
      }
    }
  }

  function draw(canvas, model, options) {
    var style = styleOf(options);
    var geo = geometry(model, style.size);
    canvas.width = geo.pixels;
    canvas.height = geo.pixels;

    var ctx = canvas.getContext('2d');
    ctx.fillStyle = style.bg;
    ctx.fillRect(0, 0, geo.pixels, geo.pixels);
    ctx.fillStyle = style.fg;

    eachRowRun(model, function (row, start, length) {
      ctx.fillRect((start + QUIET_MODULES) * geo.cell, (row + QUIET_MODULES) * geo.cell, length * geo.cell, geo.cell);
    });

    return { width: geo.pixels, height: geo.pixels, cell: geo.cell };
  }

  function toSVG(model, options) {
    var style = styleOf(options);
    var geo = geometry(model, style.size);
    var parts = [];

    eachRowRun(model, function (row, start, length) {
      parts.push('M' + (start + QUIET_MODULES) + ' ' + (row + QUIET_MODULES) + 'h' + length + 'v1h-' + length + 'z');
    });

    return [
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + geo.pixels + '" height="' + geo.pixels + '"',
      ' viewBox="0 0 ' + geo.total + ' ' + geo.total + '" shape-rendering="crispEdges">',
      '<rect width="' + geo.total + '" height="' + geo.total + '" fill="' + style.bg + '"/>',
      '<path d="' + parts.join('') + '" fill="' + style.fg + '"/>',
      '</svg>'
    ].join('');
  }

  global.QRGen = {
    QUIET_MODULES: QUIET_MODULES,
    ECC_LEVELS: ECC_LEVELS,
    BYTE_CAPACITY: BYTE_CAPACITY,
    DEFAULT_STYLE: DEFAULT_STYLE,
    byteLength: byteLength,
    build: build,
    geometry: geometry,
    draw: draw,
    toSVG: toSVG
  };
})(typeof window !== 'undefined' ? window : globalThis);
