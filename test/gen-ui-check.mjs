/**
 * 生成面板 UI 冒烟测试：用极简 DOM 桩跑 gen/ui.js，验证初始化、输入、类型切换、导出按钮状态。
 * 用法：node test/gen-ui-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

class El {
  constructor(id, tag = 'div') {
    this.id = id;
    this.tagName = tag;
    this.listeners = {};
    this.hidden = false;
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.textContent = '';
    this.style = {};
    this._qs = {};
    const set = new Set();
    this.classList = {
      add: (c) => set.add(c),
      remove: (c) => set.delete(c),
      contains: (c) => set.has(c),
      toggle: (c, on) => {
        const next = on === undefined ? !set.has(c) : Boolean(on);
        if (next) set.add(c);
        else set.delete(c);
        return next;
      },
      _set: set
    };
  }
  addEventListener(type, fn) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
  }
  dispatch(type, event) {
    (this.listeners[type] || []).forEach((fn) => fn(event || { target: this }));
  }
  querySelectorAll(sel) {
    return this._qs[sel] || [];
  }
  getAttribute(name) {
    return this[name] || null;
  }
  setAttribute() {}
  click() {
    this.dispatch('click');
  }
}

function makeCanvas() {
  const canvas = new El('gen-canvas', 'canvas');
  canvas.width = 0;
  canvas.height = 0;
  canvas.draws = [];
  canvas.getContext = () => ({
    set fillStyle(v) {
      canvas._fill = v;
    },
    fillRect(x, y, w, h) {
      canvas.draws.push([x, y, w, h]);
    }
  });
  canvas.toBlob = (cb) => setTimeout(() => cb({ size: 1024, type: 'image/png' }), 0);
  return canvas;
}

const ids = {};
function reg(id, tag) {
  ids[id] = new El(id, tag);
  return ids[id];
}

const canvas = makeCanvas();
ids['gen-canvas'] = canvas;

['view-gen', 'gen-types', 'gen-fields', 'gen-hint', 'gen-empty', 'gen-meta', 'gen-status',
 'st-size', 'st-ecc', 'st-fg', 'st-bg', 'st-reset', 'gen-png', 'gen-svg', 'gen-copy-img',
 'gen-copy-text', 'f-text', 'f-url', 'f-vc-name', 'f-vc-org', 'f-vc-tel', 'f-vc-email',
 'f-vc-url', 'f-vc-addr', 'f-wf-ssid', 'f-wf-pass', 'f-wf-sec', 'f-wf-hidden'
].forEach((id) => ids[id] || reg(id));

ids['st-size'].value = '512';
ids['st-ecc'].value = 'M';
ids['st-fg'].value = '#111111';
ids['st-bg'].value = '#ffffff';
ids['f-wf-sec'].value = 'WPA';

const chips = ['text', 'url', 'vcard', 'wifi'].map((type) => {
  const chip = new El('chip-' + type, 'button');
  chip['data-type'] = type;
  return chip;
});
chips[0].classList.add('on');
ids['gen-types']._qs['.chip'] = chips;

const panels = ['text', 'url', 'vcard', 'wifi'].map((type) => {
  const panel = new El('panel-' + type);
  panel['data-panel'] = type;
  panel.hidden = type !== 'text';
  return panel;
});
ids['gen-fields']._qs['[data-panel]'] = panels;

const document = {
  readyState: 'complete',
  getElementById: (id) => ids[id] || null,
  addEventListener: () => {},
  createElement: (tag) => new El('created-' + tag, tag),
  body: { appendChild: () => {} }
};

const sandbox = {
  console,
  document,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  Uint8ClampedArray,
  setTimeout,
  clearTimeout,
  navigator: { clipboard: { writeText: async () => {} } },
  URL,
  Blob,
  ClipboardItem: class {},
  Promise
};
sandbox.window = sandbox;
vm.createContext(sandbox);

for (const rel of ['vendor/qrcode/qrcode.js', 'gen/render.js', 'gen/payload.js', 'gen/ui.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
}

let failed = 0;
function check(name, ok, extra) {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

check('QRGenUI 已挂载', typeof sandbox.QRGenUI === 'object');

check('初始状态：导出按钮禁用', ids['gen-png'].disabled && ids['gen-svg'].disabled);
check('初始状态：显示占位文案', ids['gen-empty'].hidden === false && /输入内容/.test(ids['gen-empty'].textContent));
check('初始状态：画布隐藏', canvas.hidden === true);

ids['f-text'].value = '你好，二维码';
ids['gen-fields'].dispatch('input');
await wait(260);
check('输入文本后出码', canvas.width > 0 && canvas.draws.length > 0, `画布 ${canvas.width}px / ${canvas.draws.length} 个矩形`);
check('输入文本后按钮可用', !ids['gen-png'].disabled && !ids['gen-copy-img'].disabled);
check('元信息包含版本与容错', /版本 \d+ · \d+×\d+ 模块 · 容错 M · \d+px · \d+ 字节/.test(ids['gen-meta'].textContent), ids['gen-meta'].textContent);

ids['gen-types'].dispatch('click', { target: { closest: () => chips[1] } });
check('切到网址类型', panels[1].hidden === false && panels[0].hidden === true);
check('网址为空时按钮回到禁用', ids['gen-png'].disabled === true);

ids['f-url'].value = 'example.com/abc';
ids['gen-fields'].dispatch('input');
await wait(260);
check('网址自动补协议并出码', canvas.width > 0);
check('网址补全有提示', /https:\/\//.test(ids['gen-hint'].textContent), ids['gen-hint'].textContent);

ids['f-url'].value = 'a b.com';
ids['gen-fields'].dispatch('input');
await wait(260);
check('网址含空格报错', ids['gen-png'].disabled === true && /空格/.test(ids['gen-hint'].textContent));

ids['gen-types'].dispatch('click', { target: { closest: () => chips[3] } });
ids['f-wf-ssid'].value = '办公 WiFi';
ids['f-wf-pass'].value = 'pass;123';
ids['f-wf-sec'].value = 'WPA';
ids['gen-fields'].dispatch('change');
await wait(260);
check('WiFi 类型可出码', canvas.width > 0 && !ids['gen-png'].disabled);

ids['st-size'].value = '1024';
ids['st-size'].dispatch('change');
check('改尺寸后画布重绘', canvas.width > 512, `${canvas.width}px`);

ids['st-ecc'].value = 'H';
ids['st-ecc'].dispatch('change');
check('改容错级别后元信息更新', /容错 H/.test(ids['gen-meta'].textContent), ids['gen-meta'].textContent);

ids['st-size'].value = '512';
ids['st-ecc'].value = 'M';
ids['st-reset'].dispatch('click');
check('还原样式', ids['st-fg'].value === '#111111' && ids['st-size'].value === '512');

ids['f-wf-ssid'].value = '';
ids['gen-fields'].dispatch('change');
await wait(260);
check('清空内容后回到占位态', canvas.hidden === true && ids['gen-png'].disabled === true);

console.log(`\n${failed === 0 ? '全部通过' : failed + ' 项失败'}`);
process.exit(failed === 0 ? 0 : 1);
