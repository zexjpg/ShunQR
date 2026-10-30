# Partner Center「隐私」页填写内容

> 这一段审核员按英文读，所以**直接粘英文**。中文只是给你看的说明。
> 位置：Partner Center → 你的扩展 → 提交 → Privacy。

## 1. State the extension's purpose（单一用途说明）

```
QR Snap is a local QR code toolkit: it decodes QR/barcode content from what the user selects
on screen, and generates QR codes from text the user types. Both directions run entirely on
the user's device. The extension has no server component and makes no network requests.
```

中文：单一用途是「本地的二维码工具」——扫和生成是同一个用途的两个方向，不要在这里顺带描述其他功能。
生成功能不新增任何权限：编码用打包进来的纯 JavaScript 库，下载走 `<a download>`，复制图片走剪贴板 API。

## 2. Justify permissions（逐项理由）

```
activeTab
Temporary access to the current tab, granted only after the user explicitly invokes the
extension (toolbar icon, keyboard shortcut, or context menu). Used to inject the selection
overlay and to capture the visible tab so the user's selected area can be decoded. Access
ends when the user navigates away or closes the tab.

scripting
Injects the single content script (content/scan.js) that draws the dimming overlay and
handles the drag-to-select interaction on the page the user is looking at.

storage
Stores the scan history locally (decoded text, timestamp, format, source URL). Nothing is
synchronised or transmitted; the user can clear it with one click.

offscreen
Manifest V3 service workers cannot compile WebAssembly under the extension's content
security policy. The decoder therefore runs in a single offscreen document. It performs no
network activity and exists only to run the bundled .wasm decoder.

sidePanel
The extension's entire UI is a side panel: scan history, copy/export actions, and settings.

contextMenus
Adds three top-level right-click items (no submenu): "扫描这张图片里的二维码" on images,
"截图扫码" and "查看扫码历史" everywhere. They let the user start a scan, decode an image's
original file, or open the history panel without opening the side panel first.

optional host permission: <all_urls>
Optional and off by default. The core flow works with activeTab alone. This permission is
requested at runtime, from an explicit user click on "Authorize all pages", and only adds
two conveniences: (a) scanning continues to work after the user switches tabs while the
side panel stays open, instead of asking for a fresh activeTab grant; (b) the extension can
fetch the original bytes of an <img> QR code so it decodes the source image rather than a
screen capture. It can be revoked at any time from the same panel.
```

## 3. Remote code（远程代码）

```
No. All JavaScript and the WebAssembly decoder are bundled inside the package. The
extension does not load, evaluate or execute any code from a remote source.
```

中文：这一点必须选「否」。我们的 wasm 是随包分发的，这条经得起查。

## 4. Data usage（数据使用）

```
The extension does not collect, transmit or sell any user data. Decoded content, page URLs
and timestamps are written to chrome.storage.local on the user's device only, are never
sent anywhere, and can be deleted by the user at any time.
```

中文：全部勾「不收集」。不要勾「个人身份信息」「浏览记录」之类。

## 5. Privacy policy（隐私政策链接）

必须是一个公开可访问的 **https** 地址。仓库里 `store/privacy.html` 就是现成的，托管后把链接填进来（见 `store/publish-checklist.md`）。
