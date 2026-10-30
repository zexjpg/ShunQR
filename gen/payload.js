/* 把表单字段拼成二维码能承载的标准化字符串。纯函数，无副作用。 */
(function (global) {
  'use strict';

  var TYPES = ['text', 'url', 'vcard', 'wifi'];

  function str(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizeUrl(input) {
    var value = str(input);
    if (!value) return { ok: false, error: 'empty' };
    if (/\s/.test(value)) return { ok: false, error: 'url-space' };
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return { ok: true, text: value };
    if (value.indexOf('//') === 0) return { ok: true, text: 'https:' + value, hint: '已补全为 https:' };
    return { ok: true, text: 'https://' + value, hint: '已自动补上 https://' };
  }

  // vCard 3.0 文本值转义
  function vcardValue(value) {
    return str(value)
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  function buildVcard(fields) {
    var name = vcardValue(fields.name);
    var org = vcardValue(fields.org);
    var tel = vcardValue(fields.tel);
    var email = vcardValue(fields.email);
    var website = vcardValue(fields.url);
    var address = vcardValue(fields.address);

    if (!name && !org && !tel && !email && !website && !address) return { ok: false, error: 'empty' };

    var lines = ['BEGIN:VCARD', 'VERSION:3.0'];
    if (name) {
      lines.push('N:' + name + ';;;;');
      lines.push('FN:' + name);
    }
    if (org) lines.push('ORG:' + org);
    if (tel) lines.push('TEL;TYPE=CELL:' + tel);
    if (email) lines.push('EMAIL:' + email);
    if (website) lines.push('URL:' + website);
    if (address) lines.push('ADR;TYPE=WORK:;;' + address + ';;;;');
    lines.push('END:VCARD');

    return { ok: true, text: lines.join('\r\n') };
  }

  // WiFi 规范：\ ; , : " 需要反斜杠转义
  function wifiValue(value) {
    return str(value).replace(/([\\;,:"])/g, '\\$1');
  }

  function buildWifi(fields) {
    var ssid = wifiValue(fields.ssid);
    if (!ssid) return { ok: false, error: 'empty' };

    var security = str(fields.security) || 'WPA';
    if (security !== 'WPA' && security !== 'WEP' && security !== 'nopass') security = 'WPA';

    var parts = ['WIFI:T:' + security + ';', 'S:' + ssid + ';'];
    if (security !== 'nopass') parts.push('P:' + wifiValue(fields.password) + ';');
    if (fields.hidden) parts.push('H:true;');
    parts.push(';');

    return { ok: true, text: parts.join('') };
  }

  function build(type, fields) {
    var data = fields || {};
    switch (type) {
      case 'url':
        return normalizeUrl(data.url);
      case 'vcard':
        return buildVcard(data);
      case 'wifi':
        return buildWifi(data);
      case 'text':
      default: {
        var text = String(data.text == null ? '' : data.text).trim();
        return text ? { ok: true, text: text } : { ok: false, error: 'empty' };
      }
    }
  }

  global.QRPayload = {
    TYPES: TYPES,
    build: build,
    normalizeUrl: normalizeUrl
  };
})(typeof window !== 'undefined' ? window : globalThis);
