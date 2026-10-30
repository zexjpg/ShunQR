# 顺手码 (ShunQR)

![顺手码](store/assets/logo-300.png)

> 看到网页上的二维码，顺手一框就地识别；结果一键复制、连续扫、可导出。侧边栏还能本地生成二维码。**全程不联网、不落盘、不收集任何数据。**

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Version](https://img.shields.io/badge/version-1.2.1-green.svg)
[![Releases](https://img.shields.io/badge/download-releases-blue)](https://github.com/zexjpg/ShunQR/releases)

---

## 这是什么

顺手码是一个**只在本地运行**的二维码 / 条码识别与生成浏览器扩展（Manifest V3，支持 Chrome / Edge 116+）。

- **想扫**：在任意网页上拖框选中二维码，立即解码，无需截图工具、不上传图片、不开第三方网站。
- **想生成**：在侧边栏输入文本 / 网址 / 名片 / WiFi，实时出码，可导出 PNG/SVG 或复制图片，内容只存于内存、关掉即清。

解码引擎是 ZXing（编译成 WebAssembly，随扩展打包，**不下载任何远程代码**）；生成端是打包进来的纯 JavaScript 编码器。所有计算都在你的设备上完成。

## 功能特性

- **框选即识别**：页面上任意位置的二维码，拖框选中即解码；一次框住多个码一起输出。
- **连续扫模式**：扫完一个立即回到框选，结果在同一列表累积，适合批量整理票据 / 物料标签 / 名片。
- **历史记录**：每条带时间、码制、来源页面（可点击回到原页面），支持搜索、单条复制、删除；重复内容只累加次数不刷屏。
- **一键导出**：CSV（带 BOM，Excel 不乱码）/ TSV / JSON。
- **右键直接扫图**：在网页图片上右键，一级菜单「扫描这张图片里的二维码」，解码原图（成功率高于截图）；取不到原图时自动按页面位置截屏识别。
- **粘贴 / 拖入图片**：在扩展商店、浏览器内部页等无法注入脚本的页面，也可把二维码图片粘贴或拖入侧栏识别。
- **可选快捷键**：默认不占用任何按键，避免与输入法或其他扩展冲突；可在浏览器快捷键页给「截图扫码」指定组合（如 `Alt+Shift+Q`）。
- **本地生成二维码**：文本 / 网址 / 名片(vCard) / WiFi，可调尺寸、容错级别与前景/背景色，导出 PNG/SVG 或复制图片。

## 安装

### 方式一：开发者加载（推荐先这样验证）

1. 下载本仓库（或从 [Releases](https://github.com/zexjpg/ShunQR/releases) 下载打包好的 zip）。
2. 打开浏览器扩展管理页：
   - Chrome：`chrome://extensions`
   - Edge：`edge://extensions`
3. 右上角打开「**开发者模式**」。
4. 点击「**加载已解压的扩展程序**」，选择本仓库根目录。
5. 点击工具栏里的顺手码图标 → 右侧打开侧边栏 → 点「截图扫码」即可使用。

> 点图标没有弹窗是正常的：本扩展的界面就是右侧边栏，这是刻意设计。

### 方式二：打包后上传商店

```bash
python tools/build-package.py
```

产物在 `dist/顺手码-<version>.zip`，可直接上传 Chrome Web Store / Edge Add-ons（上架流程见 `store/publish-checklist.md`）。

## 使用

1. 打开含二维码的网页（需要一个样例？可用 <https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=hello-shunqr>）。
2. 点工具栏图标打开侧边栏，点蓝色「截图扫码」。页面变暗并出现顶部提示条。
3. 拖一个矩形框住二维码 → 解码结果即时出现在侧栏，带「复制」「打开」「连续扫」按钮，并写入下方历史。
4. 切到「生成」页，输入文本 / 网址 / 名片 / WiFi 即出码，可下载 PNG/SVG 或复制图片。
5. 在图片上右键选「扫描这张图片里的二维码」可直接解码原图。

> 首次扫描约需 1 秒（创建 offscreen 文档并编译 WASM），之后很快。
> `edge://`、`chrome://`、扩展商店、内置 PDF 阅读器等页面无法注入脚本，此时请用「粘贴 / 拖入图片」方式。

## 权限说明

| 权限 | 用途 |
|---|---|
| `activeTab` | 用户点击 / 快捷键 / 右键触发后，临时访问当前标签页以注入选区层并截取可见区域解码；离开或关闭即失效。 |
| `scripting` | 注入唯一的内容脚本 `content/scan.js`，绘制暗色遮罩并处理拖框交互。 |
| `storage` | 本地保存扫码历史（解码文本、时间、码制、来源 URL），可一键清空，不上传、不同步。 |
| `offscreen` | MV3 下 Service Worker 无法按扩展 CSP 编译 WASM，解码在单个 offscreen 文档中进行，无任何网络行为。 |
| `sidePanel` | 整个 UI 就是侧边栏。 |
| `contextMenus` | 添加三条一级右键菜单（扫图、截图扫码、查看历史）。 |
| `<all_urls>`（可选，默认关闭） | 仅当用户在设置里点「授权任意页面」时请求；用于跨标签页连续扫、以及取 `<img>` 原图解码。可随时撤销。 |

## 隐私

- 解码与生成**全部在本地完成**，扩展不发起任何网络请求、不上传任何内容、不统计使用情况（可用 DevTools 验证）。
- 历史记录仅存于浏览器本地扩展存储，可一键清空。
- 生成的二维码内容只存在于侧栏内存，不写历史、不落盘，关掉侧栏即消失。
- 详细的隐私说明见 `store/privacy.html`，可直接托管为隐私政策页。

## 技术栈

- **Manifest V3** 扩展（Chrome / Edge 116+）。
- **ZXing**（[zxing-cpp](https://github.com/zxing-cpp/zxing-cpp)）编译为 WebAssembly 做解码，随包分发，支持 QR Code、Data Matrix、Aztec、PDF417 及常见一维条码。
- 纯 JavaScript QR 编码器（`vendor/qrcode`，MIT）做生成，UTF-8 编码，中文 / emoji 不乱码，输出保留 4 模块静默区。
- offscreen document 承载 WASM；side panel 承载 UI。

## 目录结构

```
.
├── manifest.json          # 扩展清单（名称/版本/权限）
├── background.js           # Service Worker：菜单、消息路由、截图裁切、解码调度、历史
├── offscreen.html/js       # offscreen 文档：加载 WASM 解码器
├── panel.html/js           # 侧边栏 UI：历史、复制/导出、生成、设置
├── content/scan.js        # 内容脚本：暗色遮罩 + 拖框选区
├── gen/                   # 生成面板的 UI/渲染/交互逻辑
├── vendor/                # 第三方解码/编码库（ZXing WASM、qrcode）
├── icons/                 # 16/32/48/128 png
├── tools/                 # 打包与素材脚本
├── test/                  # 自检页面与脚本
└── store/                 # 上架物料（见下，非运行所需）
```

## 仓库里的 `store/` 是什么

`store/` 不是运行所需文件，而是**上架商店用的物料**：

- `listing-zh.md` / `listing-en.md`：商店详情页中英文文案，可直接粘贴。
- `permissions.md`：隐私页逐项权限理由（英文）。
- `reviewer-notes.md`：给审核员的测试说明（英文）。
- `privacy.html`：现成的隐私政策页，托管后填入商店表单。
- `publish-checklist.md`：上架 Edge Add-ons 的待办清单。
- `assets/`：logo 与推广图。

打包脚本（`tools/build-package.py`）会自动排除 `store/`、`test/`、`tools/`，只产出运行时文件。

## 开发

```bash
# 重新打包到 dist/
python tools/build-package.py

# 截图缩放/补边（上架截图需 1280x800 或 640x480）
python tools/fit-screenshot.py 截图1.png

# 自检页面：浏览器打开 test/self-test.html
```

## 许可证

[MIT](LICENSE) © 2026 zexjpg

---

## English

**ShunQR (顺手码)** is a fully local QR / barcode scanner & generator browser extension (Manifest V3, Chrome / Edge). Frame any on-screen QR code to decode it instantly; batch-scan with history and CSV/TSV/JSON export; generate QR codes from text, URLs, vCards or WiFi in the side panel. **No network, no telemetry, nothing written to disk.** The decoder is ZXing compiled to WebAssembly and bundled inside the package — no remote code is ever fetched. Licensed under MIT.
