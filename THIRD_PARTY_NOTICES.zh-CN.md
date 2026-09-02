# 第三方声明（中文版）

Graf 以 MIT 许可发布，但构建并分发使用了以下作品，在此声明致谢；完整许可文本见各来源。

## 1. vorniches/tapnote（原始项目，MIT）

- 作者：Sérgio Vorniches（© 2025 Sergei Vorniches）。
- 角色：本项目行为上源自的原始 Django 发布平台；其完整提交历史保留于本仓库
  tag/branch `legacy-django`。
- 许可：MIT（见 LICENSE）。

## 2. TeleNote fork（MIT）

- 作者：redtidev1918。
- 角色：新增 Telegraph API 面、ParaNote 评论整合、编辑器与社交功能；其行为契约
  移植进 Graf 的 TypeScript 实现。
- 许可：MIT。

## 3. ParaNote 客户端 —— assets/js/paranote.js（MIT）

- 来源：[kkty/paranote](https://github.com/kkty/paranote) 家族；本仓库所带副本来自
  TeleNote 时期使用的 ParaNote fork（redtidev1918）。
- 角色：段落级评论 UI，以静态资源原样分发。
- 许可：MIT。若再分发请保留 ParaNote 出处。

## 4. markdown-it（MIT）

- https://github.com/markdown-it/markdown-it —— 渲染所用的 CommonMark 兼容解析器。

## 5. markdown-it-footnote（MIT）

- https://github.com/markdown-it/markdown-it-footnote —— 脚注扩展。

## 6. Cloudflare Workers 工具链（Apache-2.0 / BSD）

- wrangler / workerd / miniflare 等仅作为开发与部署工具，不属于线上服务代码。

### 许可一览

```text
MIT —— vorniches/tapnote、TeleNote、ParaNote 客户端、markdown-it、markdown-it-footnote
Apache-2.0 / BSD-3-Clause —— Cloudflare Workers 运行时与 wrangler 工具链
```
