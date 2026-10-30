/* 生成面板的交互层：所有状态只存在内存里，不写 storage / localStorage / IndexedDB。 */
(function (global) {
  'use strict';

  var DEBOUNCE_MS = 140;

  var state = {
    type: 'text',
    style: Object.assign({}, global.QRGen.DEFAULT_STYLE),
    fields: {
      text: { text: '' },
      url: { url: '' },
      vcard: { name: '', org: '', tel: '', email: '', url: '', address: '' },
      wifi: { ssid: '', password: '', security: 'WPA', hidden: false }
    },
    model: null,
    payload: ''
  };

  var el = {};
  var timer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function stamp() {
    var now = new Date();
    return (
      now.getFullYear() +
      pad2(now.getMonth() + 1) +
      pad2(now.getDate()) +
      '-' +
      pad2(now.getHours()) +
      pad2(now.getMinutes())
    );
  }

  function flash(message, warn) {
    if (!el.status) return;
    el.status.textContent = message;
    el.status.classList.toggle('warn', Boolean(warn));
    clearTimeout(flash.timer);
    flash.timer = setTimeout(function () {
      el.status.textContent = '生成内容只在本页内存，关闭面板即清除。';
      el.status.classList.remove('warn');
    }, 2600);
  }

  function setHint(text, warn) {
    if (!el.hint) return;
    el.hint.textContent = text || '';
    el.hint.classList.toggle('warn', Boolean(warn));
  }

  function syncFields() {
    var data = state.fields[state.type];
    switch (state.type) {
      case 'url':
        data.url = el.url.value;
        break;
      case 'vcard':
        data.name = el.vcName.value;
        data.org = el.vcOrg.value;
        data.tel = el.vcTel.value;
        data.email = el.vcEmail.value;
        data.url = el.vcUrl.value;
        data.address = el.vcAddr.value;
        break;
      case 'wifi':
        data.ssid = el.wfSsid.value;
        data.password = el.wfPass.value;
        data.security = el.wfSec.value;
        data.hidden = el.wfHidden.checked;
        break;
      case 'text':
      default:
        data.text = el.text.value;
        break;
    }
  }

  function setEnabled(on) {
    [el.png, el.svg, el.copyImg, el.copyText].forEach(function (btn) {
      if (btn) btn.disabled = !on;
    });
  }

  function showPlaceholder(message) {
    state.model = null;
    state.payload = '';
    setEnabled(false);
    if (el.canvas) el.canvas.hidden = true;
    if (el.empty) {
      el.empty.hidden = false;
      el.empty.textContent = message;
    }
    if (el.meta) el.meta.textContent = '';
  }

  function errorText(result) {
    if (!result) return '生成失败，请重试';
    switch (result.error) {
      case 'empty':
        return '输入内容后自动生成';
      case 'url-space':
        return '网址里不要带空格';
      case 'too-long':
        return '内容太长：' + result.bytes + ' 字节，容错 ' + result.ecc + ' 上限 ' + result.limit + ' 字节';
      case 'no-encoder':
        return '编码器未加载';
      case 'encode-failed':
        return '生成失败：' + (result.message || '未知错误');
      default:
        return '生成失败，请重试';
    }
  }

  function refresh() {
    if (!el.canvas) return;
    syncFields();

    var built = global.QRPayload.build(state.type, state.fields[state.type]);
    if (!built.ok) {
      showPlaceholder(errorText(built));
      setHint(built.error === 'empty' ? '' : errorText(built), built.error !== 'empty');
      return;
    }

    var model = global.QRGen.build(built.text, state.style);
    if (!model.ok) {
      showPlaceholder(errorText(model));
      setHint(errorText(model), true);
      return;
    }

    state.model = model;
    state.payload = built.text;

    if (el.empty) el.empty.hidden = true;
    el.canvas.hidden = false;
    var geo = global.QRGen.draw(el.canvas, model, state.style);

    if (el.meta) {
      el.meta.textContent =
        '版本 ' + model.version +
        ' · ' + model.moduleCount + '×' + model.moduleCount + ' 模块' +
        ' · 容错 ' + model.ecc +
        ' · ' + geo.width + 'px' +
        ' · ' + model.bytes + ' 字节';
    }

    var left = global.QRGen.BYTE_CAPACITY[model.ecc] - model.bytes;
    if (left < 60) {
      setHint(built.hint ? built.hint : '接近容量上限，再长就放不下了', true);
    } else {
      setHint(built.hint || '', false);
    }

    setEnabled(true);
  }

  function scheduleRefresh() {
    clearTimeout(timer);
    timer = setTimeout(refresh, DEBOUNCE_MS);
  }

  function selectType(type) {
    if (!state.fields[type]) return;
    state.type = type;
    Array.prototype.forEach.call(el.types.querySelectorAll('.chip'), function (chip) {
      chip.classList.toggle('on', chip.getAttribute('data-type') === type);
    });
    Array.prototype.forEach.call(el.fields.querySelectorAll('[data-panel]'), function (panel) {
      panel.hidden = panel.getAttribute('data-panel') !== type;
    });
    refresh();
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);
  }

  function canvasBlob() {
    return new Promise(function (resolve, reject) {
      if (!el.canvas) {
        reject(new Error('no-canvas'));
        return;
      }
      el.canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('toBlob-failed'));
      }, 'image/png');
    });
  }

  async function exportPNG() {
    if (!state.model) return;
    try {
      var blob = await canvasBlob();
      download(blob, '二维码-' + stamp() + '.png');
      flash('已保存 PNG');
    } catch (err) {
      flash('保存失败：' + ((err && err.message) || err), true);
    }
  }

  function exportSVG() {
    if (!state.model) return;
    try {
      var svg = global.QRGen.toSVG(state.model, state.style);
      download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), '二维码-' + stamp() + '.svg');
      flash('已保存 SVG（矢量，可无损放大）');
    } catch (err) {
      flash('保存失败：' + ((err && err.message) || err), true);
    }
  }

  async function copyImage() {
    if (!state.model) return;
    try {
      var blob = await canvasBlob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      flash('二维码图片已复制');
    } catch (err) {
      flash('复制图片失败：' + ((err && err.message) || err), true);
    }
  }

  async function copyText() {
    if (!state.payload) return;
    try {
      await navigator.clipboard.writeText(state.payload);
      flash('内容已复制');
    } catch (err) {
      flash('复制失败：' + ((err && err.message) || err), true);
    }
  }

  function resetStyle() {
    state.style = Object.assign({}, global.QRGen.DEFAULT_STYLE);
    el.size.value = String(state.style.size);
    el.ecc.value = state.style.ecc;
    el.fg.value = state.style.fg;
    el.bg.value = state.style.bg;
    refresh();
    flash('样式已还原');
  }

  function readStyle() {
    state.style.size = Number(el.size.value) || global.QRGen.DEFAULT_STYLE.size;
    state.style.ecc = el.ecc.value;
    state.style.fg = el.fg.value;
    state.style.bg = el.bg.value;
    refresh();
  }

  function bind() {
    el.types.addEventListener('click', function (event) {
      var chip = event.target.closest('.chip');
      if (chip) selectType(chip.getAttribute('data-type'));
    });

    el.fields.addEventListener('input', scheduleRefresh);
    el.fields.addEventListener('change', scheduleRefresh);

    el.size.addEventListener('change', readStyle);
    el.ecc.addEventListener('change', readStyle);
    el.fg.addEventListener('input', readStyle);
    el.bg.addEventListener('input', readStyle);
    el.reset.addEventListener('click', resetStyle);

    el.png.addEventListener('click', exportPNG);
    el.svg.addEventListener('click', exportSVG);
    el.copyImg.addEventListener('click', copyImage);
    el.copyText.addEventListener('click', copyText);
  }

  function init() {
    if (!document.getElementById('view-gen')) return false;

    el.types = $('gen-types');
    el.fields = $('gen-fields');
    el.hint = $('gen-hint');
    el.canvas = $('gen-canvas');
    el.empty = $('gen-empty');
    el.meta = $('gen-meta');
    el.status = $('gen-status');
    el.size = $('st-size');
    el.ecc = $('st-ecc');
    el.fg = $('st-fg');
    el.bg = $('st-bg');
    el.reset = $('st-reset');
    el.png = $('gen-png');
    el.svg = $('gen-svg');
    el.copyImg = $('gen-copy-img');
    el.copyText = $('gen-copy-text');

    el.text = $('f-text');
    el.url = $('f-url');
    el.vcName = $('f-vc-name');
    el.vcOrg = $('f-vc-org');
    el.vcTel = $('f-vc-tel');
    el.vcEmail = $('f-vc-email');
    el.vcUrl = $('f-vc-url');
    el.vcAddr = $('f-vc-addr');
    el.wfSsid = $('f-wf-ssid');
    el.wfPass = $('f-wf-pass');
    el.wfSec = $('f-wf-sec');
    el.wfHidden = $('f-wf-hidden');

    if (!el.types || !el.fields || !el.canvas) return false;

    bind();
    refresh();
    return true;
  }

  global.QRGenUI = {
    init: init,
    // 切回生成页时调用，保证画布在当前尺寸下是最新的
    activate: function () {
      if (state.model) refresh();
    }
  };

  // 脚本放在 body 末尾，此时 DOM 已就绪
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
