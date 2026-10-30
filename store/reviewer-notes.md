# 认证测试说明（Certification testing notes）

> 这个框是审核员实际动手验证的依据。写清楚能显著减少来回问询，也减少被误判的概率。
> 位置：Partner Center → 提交 → 最后一步「Notes for certification」。**建议用英文填**。

```
QUICK TEST (2 minutes)

1. Install the extension. It has no popup: clicking the toolbar icon opens the side panel
   on the right (this is intentional).
2. Open a web page that contains a QR code. If you need one, this public URL renders a
   plain QR image:
   https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=hello-edge-review
3. In the side panel, click the blue "截图扫码" (Screenshot scan) button. The page dims
   and a hint bar appears at the top.
   If a small blue box appears above the button asking for access, click "授权后继续"
   (Grant and continue). This only happens when the side panel was already open and no
   browser gesture was involved: Chrome/Edge grant the activeTab permission only for
   clicks on the toolbar icon, the context menu or the keyboard shortcut, not for clicks
   inside the extension's own side panel. The button requests the optional
   `<all_urls>` permission and then starts the scan automatically. Decoding still runs
   entirely on the local machine.
4. Drag a rectangle around the QR code. The overlay disappears and the decoded text
   ("hello-edge-review") appears in the panel with a Copy button. The entry is added to
   the history list below, including a clickable source link back to the page.
5. Press Esc, or click outside the panel, to leave scanning mode.
6. Switch the panel to the "生成" (Generate) tab, type or paste any text into the input box,
   and a QR code is rendered immediately. "下载 PNG" / "下载 SVG" save the image, "复制图片"
   copies it. Scanning that output with a phone returns exactly the text you typed.
   The generated content is deliberately NOT saved to history or to any storage: closing and
   reopening the panel starts from an empty form. That is by design, not a data-loss bug.

Keyboard: the scan command ships with NO default shortcut — no key combination is taken
over, so nothing can collide with an IME or another extension. A shortcut can be assigned
on edge://extensions/shortcuts if desired; the panel shows the currently bound combination
(or 未设置 when none is bound) under "设置" (Settings).

HOW IT WORKS (why it needs these permissions)

- Scanning captures the visible viewport (chrome.tabs.captureVisibleTab), crops the
  user-selected rectangle, and decodes it in an offscreen document with a bundled
  WebAssembly build of ZXing. No network requests are made at any point — you can verify
  this with DevTools open on the extension's service worker.
- Generation runs in the side panel itself with a bundled pure-JavaScript encoder. It adds
  no new permissions, makes no network request, and writes nothing to storage.
- activeTab is granted by the user's own click or shortcut. There is no <all_urls> host
  permission active by default.
- The optional "<all_urls>" permission is off unless the user clicks "授权任意页面"
  (Authorize all pages) in Settings. It is not needed for the test above.

NOTES / EDGE CASES

- On browser-internal pages (edge://, the extension store, the built-in PDF viewer) scripts
  cannot be injected, so scanning shows a red "!" badge. In that case the panel supports
  pasting (Ctrl+V) or dropping a QR image instead — please use that path if you want to
  verify it.
- The first scan takes about a second because the offscreen document is created and the
  WebAssembly module is compiled. Subsequent scans are much faster.
- Only content inside the visible viewport can be captured; this is a limitation of the
  captureVisibleTab API, not a bug.
- No shortcut is bound by default, so nothing can conflict with another extension or an
  IME on the review machine. Use the "截图扫码" button in the panel, or right-click an image
  and pick "扫描这张图片里的二维码" — both run the identical code path.

CONTACT
If anything in the test steps does not behave as described, please reject with details and
I will fix it promptly.
```

## 中文对照（自己看，不要贴进表单）

- 测试就是四步：装 → 点图标开侧栏 → 点「截图扫码」→ 框住二维码看结果。审核员最容易被"没有 popup、点图标弹侧栏"这一点绕住，所以第一句就说明是刻意的。
- 主动给出一个能生成二维码的公开 URL，省得审核员自己找图。
- 明确说「可以开 DevTools 验证没有任何网络请求」，这是最有说服力的一句。
- 说明可选权限默认关闭、测试不需要它，避免审核员以为我们偷偷要了全站权限。
- 说明 `edge://` 页面扫不了是浏览器限制，并指出替代路径（粘贴图片），避免被判"功能不可用"。
- 第 6 步专门写生成功能，并明说「关掉面板内容就没了」是设计而非 bug——否则审核员很容易当成缺陷报上来。
