# Changelog

## [0.5.0](https://github.com/redtidev1918/graf/compare/grafctl-v0.4.2...grafctl-v0.5.0) (2026-09-07)


### Features

* **go:** grafctl 跨平台部署器(API 直连) + 单文件 bundle + 分平台发版 + Docker ([cb07206](https://github.com/redtidev1918/graf/commit/cb07206082c7821c56da90c53456772ffeb50a41))
* **grafctl:** auth 持久化 Token + 一键安装脚本 — 零依赖傻瓜式部署 ([a4d355c](https://github.com/redtidev1918/graf/commit/a4d355c8b793d14a5eebc6d69c0dd12ecf010be1))
* **grafctl:** deploy 自动开启 worker.dev(subdomain enabled) + doctor 显示状态 ([bbf648c](https://github.com/redtidev1918/graf/commit/bbf648c6da40096c68191b78a42ef6921f8826fc))
* **grafctl:** Windows irm|iex 一键安装 + 彩色日志(doctor 自检, --no-color) ([546519d](https://github.com/redtidev1918/graf/commit/546519d27dc6273f71442d5314ad949775ee768b))
* **grafctl:** 内嵌 D1 迁移 + Worker bundle，真正单文件零依赖 (v0.4.0) ([fed0fca](https://github.com/redtidev1918/graf/commit/fed0fcaba721984ac3e505808f33f55774f255e1))


### Bug Fixes

* **grafctl:** --help/--version 不再误触发部署 (v0.4.1) ([1cf7588](https://github.com/redtidev1918/graf/commit/1cf75881da95ad69851eb8b691deaecd3350d5c2))
* **grafctl:** API 直传实测修正 — vars 用 plain_text、D1 绑定用 type d1+database_id、模块 part 加 application/javascript+module、metadata workers_dev ([4151bd7](https://github.com/redtidev1918/graf/commit/4151bd748c26e74d3780245158bacddbff4d3994))
* **grafctl:** worker.dev 开启改用 POST(修复 405) + 自检不再误报网络失败 (v0.4.2) ([9859b27](https://github.com/redtidev1918/graf/commit/9859b27353a391e20f6a5547a9f5e2c23e6ec95c))
