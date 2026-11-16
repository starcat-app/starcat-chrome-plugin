# Starcat Chrome Plugin

<!-- starcat-promo:start -->
<div align="center">
<a href="https://starcat.ink"><img src="https://raw.githubusercontent.com/starcat-app/starcat-site/main/assets/banner.webp" width="100%" alt="Starcat" /></a>

<p><strong>这是 Starcat 的 Chrome/Chromium companion extension，把 Starcat 的仓库上下文带到 GitHub 页面。</strong></p>
<p>Starcat 是一款原生 macOS 应用，可以把 GitHub Stars 变成可搜索、可整理、可用 AI 追问的本地知识库，并通过桌面客户端、插件、CLI 与可自部署服务组成完整生态。</p>

<a href="https://github.com/starcat-app/homebrew-starcat"><img src="https://img.shields.io/badge/Install%20with-Homebrew-FBBF24?style=for-the-badge&logo=homebrew&logoColor=white" width="220" alt="Install with Homebrew"/></a>
<br/>
<sub><a href="./README.md">English</a></sub>
</div>

<div align="center">
<a href="https://starcat.ink"><img src="https://img.shields.io/badge/website-starcat.ink-38BDF8?style=flat&color=blue" alt="website"/></a>
<a href="https://github.com/starcat-app/Starcat/issues"><img src="https://img.shields.io/github/issues/starcat-app/Starcat?style=flat&color=blue" alt="issues"/></a>
<a href="https://github.com/starcat-app/homebrew-starcat"><img src="https://img.shields.io/badge/install-homebrew-lightgrey.svg?style=flat&color=blue" alt="homebrew"/></a>
<a href="https://github.com/starcat-app/starcat-localization"><img src="https://img.shields.io/badge/localization-open-lightgrey.svg?style=flat&color=blue" alt="localization"/></a>
</div>

<div align="center">
<img width="900" src="https://raw.githubusercontent.com/starcat-app/starcat-site/main/assets/main.webp" alt="Starcat main window"/>
</div>

**首选 Homebrew 安装：**

```bash
brew tap starcat-app/starcat
brew trust starcat-app/starcat
brew install --cask starcat
```

**相关链接：**

- 官网与下载: https://starcat.ink
- Mac App Store: 搜索 Starcat for GitHub
- 公开支持: https://github.com/starcat-app/Starcat/issues · 更新日志: https://starcat.ink/changelog.html
- Starcat App Homebrew tap: https://github.com/starcat-app/homebrew-starcat
- CLI / MCP: [starcat-cli](https://github.com/starcat-app/starcat-cli) / [Homebrew tap](https://github.com/starcat-app/homebrew-starcat-cli)
- AI Agent Skill: https://github.com/starcat-app/starcat-skill
- 浏览器插件: [Chrome](https://github.com/starcat-app/starcat-chrome-plugin) / [Safari](https://github.com/starcat-app/starcat-safari-plugin)
- 启动器集成: [Alfred](https://github.com/starcat-app/starcat-alfred-workflow) / [uTools](https://github.com/starcat-app/starcat-utools-plugin) / [Raycast](https://github.com/starcat-app/starcat-raycast-extension)
- 官方文档: https://github.com/starcat-app/starcat-docs
- 官网源码: https://github.com/starcat-app/starcat-site
- 本地化: https://github.com/starcat-app/starcat-localization

**可自部署支撑 API：**

- [starcat-sharing-api](https://github.com/starcat-app/starcat-sharing-api)
- [starcat-trending-api](https://github.com/starcat-app/starcat-trending-api)
- [starcat-weekly-api](https://github.com/starcat-app/starcat-weekly-api)
- [starcat-wiki-api](https://github.com/starcat-app/starcat-wiki-api)
- [starcat-recommend-api](https://github.com/starcat-app/starcat-recommend-api)
- [starcat-discovery-api](https://github.com/starcat-app/starcat-discovery-api)
<!-- starcat-promo:end -->

Starcat Chrome Plugin 是 Starcat 的 GitHub 与 Google 搜索结果增强插件。它在 GitHub repo 页面展示 Starcat 已有上下文，并在 Google 搜索结果中为已 Star 的 GitHub 仓库显示本机 Starcat 入口和 Health 信息；它不直接访问 GitHub API、Starcat 后端、OpenSSF 或 AI provider。

## 功能范围

- 在 GitHub repo 页面展示相似仓库推荐。
- 展示已收录的 Wiki 入口。
- 读取、保存 Starcat 私人笔记。
- 展示 Starcat 已缓存的 Health / OpenSSF 分数。
- 触发 Starcat App 内的 CodeFlow / Codebase 动作。
- 在 Google 搜索结果中为已 Star 的 GitHub 仓库展示 `Open in Starcat` 和 Health 徽标。

## 本地加载

1. 在 Chrome 打开 `chrome://extensions/`。
2. 开启 Developer mode。
3. 点击 Load unpacked。
4. 选择本目录: `supports/extensions/starcat-chrome-plugin`。
5. 打开 Starcat → 设置 → 扩展与连接 → 浏览器扩展，启用浏览器插件服务。
6. 点击插件的“连接 Starcat”打开稳定配对标签页，选择发现的 App 后点击连接。
7. 核对两边六位数字，仅在一致时到 Starcat 批准。

切换到 App 时配对标签页保持打开。发现仅检查保存地址和唯一默认端口 `5051`，自定义端口可在高级设置填写；发现本身不会申请配对。完整设置保留手工 Key 入口。

自动发现总预算为 5 秒，包含 Native Messaging 与 HTTP 回退；每个 HTTP 地址最多探测 1.3 秒，原生发现预留最后 1.5 秒给回退。配对按 App 返回的 120 秒截止时间显示倒计时，到期清除验证码并忽略迟到响应。连接请求 5 秒超时，不自动重放。发现超时、用户拒绝、过期、连接超时和凭据保存失败分别提示。

配对页始终提供“使用 Key 连接”。获取路径为 Starcat → 设置 → 扩展与连接 → 浏览器扩展 → 本地 API Key → 复制；同页可以复制服务地址。已配对的浏览器需先取消配对，再切换为手工 Key。

## 通信边界

background 统一持有配对、凭据、业务请求和事件流。macOS 可用 `starcat browser-host install --extension-id <实际扩展ID>` 安装可选宿主，经 CLI 通信；没有宿主时使用本机 HTTP 服务：

```text
http://127.0.0.1:{port}/plugin/v1
```

所有业务请求都需要:

```text
Authorization: Bearer <browser-device-token-or-manual-key>
```

新配对签发独立可撤销 token，保存在扩展 origin 的 IndexedDB；content script 只获取业务结果，不获取新 token 或配对秘密。Starcat 记录设备名称、配对和访问时间。“取消浏览器配对”撤销服务端授权；“仅清除本地凭据”不撤销授权，离线时还需在 Starcat 撤销。手工 Key 为共享凭据，需在 App 轮换才能失效。

原生宿主按用户及实际扩展 ID 安装，CLI 升级或移动后重新安装。Native 写入失败不切换 HTTP 重放；其发现同样是有限候选地址，不能发现任意自定义端口。

## 文件说明

| 文件 | 说明 |
|---|---|
| `manifest.json` | Chrome MV3 入口声明。 |
| `LICENSE` | 开源许可证。 |
| `PRIVACY.md` | 隐私与数据边界说明。 |
| `SECURITY.md` | 安全边界与漏洞反馈说明。 |
| `CONTRIBUTING.md` | 本地开发与贡献约定。 |
| `CHANGELOG.md` | 版本变更记录。 |
| `src/shared/shared.js` | 配置读写、GitHub repo URL 解析、本机 API client。 |
| `src/background/background.js` | 配对、凭据、Companion 代理与可选 CLI 原生通道。 |
| `src/pairing/` | 稳定六位码配对标签页、有限发现与取消配对。 |
| `src/popup/` | 左键点击插件图标时显示的快速配对弹窗。 |
| `src/options/` | 端口、Local API Key 配置与连接测试页。 |
| `src/content/` | GitHub repo 页面板注入与渲染。 |
| `docs/` | 商店上架资料、隐私披露、审核说明与素材规范。 |

## 发布资料

商店发布前请先阅读 [docs/README.md](docs/README.md)。历史商店材料仍需按新配对、`nativeMessaging` 权限和隐私边界重新审核，并完成真实浏览器验收；本次源码实现不解除发布 No-Go。

## 验证

```bash
python3 -m json.tool supports/extensions/starcat-chrome-plugin/manifest.json >/dev/null
node --check supports/extensions/starcat-chrome-plugin/src/shared/shared.js
node --check supports/extensions/starcat-chrome-plugin/src/popup/popup.js
node --check supports/extensions/starcat-chrome-plugin/src/options/options.js
node --check supports/extensions/starcat-chrome-plugin/src/content/content-script.js
node --check supports/extensions/starcat-chrome-plugin/src/background/background.js
node --check supports/extensions/starcat-chrome-plugin/src/pairing/pairing.js
```
