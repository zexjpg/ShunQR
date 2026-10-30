/**
 * 离线自检：把 gen/ 里生成的二维码栅格化后，用扩展自带的 zxing-wasm 解码回来验证。
 * 用法：node test/gen-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readBarcodes, prepareZXingModule } from '../vendor/zxing/dist/es/reader/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const WASM = path.join(ROOT, 'vendor/zxing/dist/reader/zxing_reader.wasm');

function loadScripts() {
  const sandbox = { console, TextEncoder, TextDecoder, Uint8Array, Uint8ClampedArray };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const rel of ['vendor/qrcode/qrcode.js', 'gen/render.js', 'gen/payload.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  }
  return sandbox;
}

function rasterize(QRGen, model, size) {
  const geo = QRGen.geometry(model, size);
  const n = model.moduleCount;
  const quiet = QRGen.QUIET_MODULES;
  const w = geo.pixels;
  const data = new Uint8ClampedArray(w * w * 4).fill(255);
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!model.grid[r * n + c]) continue;
      const x0 = (c + quiet) * geo.cell;
      const y0 = (r + quiet) * geo.cell;
      for (let y = y0; y < y0 + geo.cell; y += 1) {
        for (let x = x0; x < x0 + geo.cell; x += 1) {
          const i = (y * w + x) * 4;
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 255;
        }
      }
    }
  }
  return { width: w, height: w, data };
}

let failed = 0;
function check(name, ok, extra) {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
}

const sandbox = loadScripts();
const QRGen = sandbox.QRGen;
const QRPayload = sandbox.QRPayload;

await prepareZXingModule({
  overrides: {
    // node 里没有 fetch(file://)，直接把 wasm 二进制喂给 emscripten
    wasmBinary: new Uint8Array(fs.readFileSync(WASM)),
    locateFile: (file, prefix) => (typeof file === 'string' && file.endsWith('.wasm') ? WASM : prefix ? prefix + file : file)
  },
  fireImmediately: true
});

async function decode(image) {
  const hits = await readBarcodes(image, { formats: ['QRCode'], tryHarder: true });
  return (hits || []).filter((h) => h && h.text).map((h) => h.text);
}

const vcardFields = {
  name: '张三',
  org: '大地保险, 理赔部',
  tel: '13800138000',
  email: 'zhangsan@example.com',
  url: 'https://example.com',
  address: '北京市朝阳区建国路 1 号'
};

const wifiFields = { ssid: 'My Wifi;2.4G', password: 'p@ss:word,1', security: 'WPA', hidden: true };
const longText = '中文测试。'.repeat(150);
const overLimit = '中文测试。'.repeat(400);

const cases = [
  { name: '文本 · 网址', text: 'https://example.com/hello?a=1&b=2' },
  { name: '文本 · 中文 + emoji', text: '扫码测试：你好，世界 🌏' },
  { name: '名片 · vCard', text: QRPayload.build('vcard', vcardFields).text, expect: QRPayload.build('vcard', vcardFields).text },
  { name: 'WiFi · 特殊字符转义', text: QRPayload.build('wifi', wifiFields).text }
];

console.log('--- 编码 + 解码回环 ---');
for (const item of cases) {
  const model = QRGen.build(item.text, { ecc: 'M' });
  if (!model.ok) {
    check(item.name + ' 构建', false, JSON.stringify(model));
    continue;
  }
  const image = rasterize(QRGen, model, 512);
  const texts = await decode(image);
  const wanted = item.expect || item.text;
  check(item.name, texts.includes(wanted), `v${model.version} ${model.bytes}B ${model.moduleCount}模块`);
}

console.log('\n--- 尺寸 / 容错 / 长内容 ---');
for (const size of [256, 512, 1024]) {
  const text = '尺寸测试 ' + size;
  const model = QRGen.build(text, { ecc: 'Q', size });
  const geo = QRGen.geometry(model, size);
  const texts = await decode(rasterize(QRGen, model, size));
  check(`尺寸 ${size}px`, texts.includes(text) && geo.pixels <= size + geo.total, `实际 ${geo.pixels}px / cell ${geo.cell}`);
}

for (const ecc of ['L', 'M', 'Q', 'H']) {
  const text = '容错级别 ' + ecc;
  const model = QRGen.build(text, { ecc });
  const texts = await decode(rasterize(QRGen, model, 384));
  check(`容错 ${ecc}`, texts.includes(text) && model.ecc === ecc, `v${model.version}`);
}

const longModel = QRGen.build(longText, { ecc: 'M' });
check('长中文 2250B 可编码', longModel.ok, longModel.ok ? `v${longModel.version} ${longModel.bytes}B` : JSON.stringify(longModel));
if (longModel.ok) {
  const texts = await decode(rasterize(QRGen, longModel, 700));
  check('长中文可解码', texts.includes(longText));
}

const over = QRGen.build(overLimit, { ecc: 'M' });
check('超容量给出明确错误', !over.ok && over.error === 'too-long', JSON.stringify(over));
check('空内容给出 empty', QRGen.build('', { ecc: 'M' }).error === 'empty');
check('纯空白文本被判空', QRPayload.build('text', { text: '   ' }).error === 'empty');
check('1.0 之前不存在 no-encoder 兜底', QRGen.build('x', {}).ok === true);

console.log('\n--- 工具函数 ---');
check('默认补 https://', QRPayload.build('url', { url: 'example.com/a' }).text === 'https://example.com/a');
check('保留已有协议', QRPayload.build('url', { url: 'http://a.cn' }).text === 'http://a.cn');
check('网址含空格报错', QRPayload.build('url', { url: 'a b.com' }).error === 'url-space');
check('空 WiFi 名称报错', QRPayload.build('wifi', { ssid: '  ' }).error === 'empty');
check('无密码 WiFi 省略 P 字段', !/;P:/.test(QRPayload.build('wifi', { ssid: 'x', security: 'nopass' }).text));
check('vCard 逗号分号转义', QRPayload.build('vcard', { org: 'A,B;C' }).text.includes('ORG:A\\,B\\;C'));

const svg = QRGen.toSVG(QRGen.build('svg 检查', { ecc: 'M' }), { size: 512 });
check('SVG 结构完整', svg.startsWith('<svg') && svg.includes('shape-rendering="crispEdges"') && /<path d="M/.test(svg));
check('SVG 带静默区 viewBox', /viewBox="0 0 \d+ \d+"/.test(svg));
check('SVG 尺寸为整数模块倍', Number(/width="(\d+)"/.exec(svg)[1]) % (Number(/viewBox="0 0 (\d+)/.exec(svg)[1])) === 0);

console.log(`\n${failed === 0 ? '全部通过' : failed + ' 项失败'}`);
process.exit(failed === 0 ? 0 : 1);
