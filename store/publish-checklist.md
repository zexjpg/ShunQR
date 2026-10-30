# 发布到 Microsoft Edge Add-ons：待办清单

## A. 已经做好的（可以直接用）

| 产物 | 路径 | 用途 |
|---|---|---|
| 上传包 | `dist/顺手码-1.2.1.zip`（451 KB，18 个文件） | Partner Center 上传用，已剔除 test/、tools/、store/ |
| 商店 logo | `store/assets/logo-300.png` | 列表页图标，300×300，1:1 |
| 推广图 | `store/assets/promo-440x280.png` | 可选的小推广磁贴 |
| 中文文案 | `store/listing-zh.md` | 直接粘贴 |
| 英文文案 | `store/listing-en.md` | 直接粘贴 |
| 权限理由 | `store/permissions.md` | Privacy 页每一栏的英文答案 |
| 审核员测试说明 | `store/reviewer-notes.md` | 最后一步 Notes for certification |
| 隐私政策页 | `store/privacy.html` | 托管后拿 URL 填进表单 |

版本号已提到 **1.2.1**：在 1.1.0 基础上取消了默认快捷键（不再占用 Alt+Q），并把右键菜单拍平成一级（「扫描这张图片里的二维码」「截图扫码」「查看扫码历史」）。已上架过的包必须升版本号才能提交更新，只想改动时改 `manifest.json` 一行后重新打包即可。

打包命令：`python tools/build-package.py`

## B. 只有你能做的四件事

### 1. 注册开发者账号（免费，约 10 分钟）

- 打开 <https://partner.microsoft.com>，登录后进入 **Edge** 工作区
- 需要**个人 Microsoft 账号**（@outlook.com / @live.com / @hotmail.com 这类）。用公司或学校账号注册经常在自动审核那一步失败
- 注册时填的国家/地区**之后不能改**，按真实所在地填
- Edge 扩展计划不收费（对比 Chrome 商店是 5 美元一次性）

### 2. 准备截图（至少 1 张，最多 10 张）

尺寸只能是 **1280×800** 或 **640×480**，其它尺寸上传会被拒。

建议截 4 张，按这个顺序：

1. 框选中的状态（页面变暗 + 选区 + 尺寸提示）
2. 结果面板（内容 + 复制/打开/连续扫按钮）
3. 历史列表（含来源链接、重复次数）
4. 连续扫的结果堆叠

流程：把 Edge 窗口拖到 1280 宽左右 → 打开一个带二维码的页面 → 点扩展图标打开侧栏，点「截图扫码」框选 → 用 Win+Shift+S 截整个窗口。然后统一处理尺寸：

```
python tools/fit-screenshot.py 截图1.png 截图2.png
```

会输出 `截图1-1280x800.png`，等比缩放后居中补浅蓝底，边缘不会变形。

注意：截图里**不要出现个人隐私内容**（邮箱、内网地址、真实客户数据），审核会看。

### 3. 托管隐私政策（约 5 分钟）

表单要求一个公开可访问的 **https** 链接。

1. 先把 `store/privacy.html` 第八节里的「请替换为你的邮箱」改成你的真实邮箱（发布出去就改不了了）
2. 任选一种托管：
   - **GitHub Pages**（最省事）：新建 public 仓库 → 上传 privacy.html → Settings → Pages → 分支选 main → 得到 `https://用户名.github.io/仓库名/privacy.html`
   - **Gitee Pages**：同上，国内访问更快
   - **Netlify / Cloudflare Pages**：拖文件夹上传即可
   - 已有服务器的话直接丢到任意 https 站点
3. 打开链接确认能正常显示，再填进表单

### 4. 在 Partner Center 走完提交流程

| 步骤 | 填什么 |
|---|---|
| 1. Create new extension | 上传 `dist/顺手码-1.2.1.zip`，等校验通过 |
| 2. Availability | 可见性选 **Public**；市场默认全部，想先小范围可只勾中国 + 英语市场 |
| 3. Properties | 类别选**效率 / Productivity** |
| 4. Privacy | 逐栏粘 `store/permissions.md` 里的英文段落；远程代码选**否**；数据收集选**不收集**；填隐私政策 URL |
| 5. Store listing | 中文先填（`listing-zh.md`），再加一门英文（`listing-en.md`）；上传 logo；上传截图；填 7 个搜索词 |
| 6. Notes for certification | 粘 `store/reviewer-notes.md` 里那段英文 |
| 7. Submit | 提交后进入审核 |

## C. 审核期要知道的

- 官方说法是**最多 7 个工作日**，实际常见 1–3 天
- 审完会发邮件到注册账号的邮箱，通过后几小时内出现在搜索结果里
- **更新必须升版本号**，否则上传直接失败；审核进行中再提交新版本会重新排队
- 商店分配的扩展 ID 和你本地加载的那个不同，`edge://extensions` 里看到的是本地 ID，不要用本地 ID 填进任何地方

### 最容易被退回的三种情况，以及我们的对策

| 风险 | 现状 | 对策 |
|---|---|---|
| 全站权限被质疑 | `optional_host_permissions` 默认关闭，核心流程只靠 activeTab | 审核说明里已明确写"默认关闭、测试不需要它" |
| "点击图标没有 popup"被误判为不工作 | 是刻意设计，点图标弹侧栏 | 测试说明第一句就交代了，并给出按钮的准确文案 |
| 功能与已有扩展重复（junk 判定） | QRSnip 等已有同类 | 文案里强调了差异化：连扫、历史带来源链接、批量导出、原图解码、粘贴识别 |

## D. 顺手可以做的（非必需）

- **英文名**：现在 `manifest.name` 是「顺手码」，英文列表页会显示中文名。想双语可改成「顺手码 QR Snap」再重新打包——名字在提交后是只读的，要改必须重传包，所以现在定下来最省事
- **Chrome 商店**：同一份 zip 可以直接传 Chrome Web Store，只需注册时交一次性 5 美元
- **后续迭代**：改完代码跑 `python tools/build-package.py`，把新 zip 传上去、版本号 +1 就是一次更新
