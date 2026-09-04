// Package assets 把 Graf 的部署资产（D1 迁移 SQL + Worker bundle）
// 内嵌进 grafctl 二进制，使其单文件自包含、无需克隆仓库。
package assets

import "embed"

//go:embed migrations/*.sql
var Migrations embed.FS

//go:embed dist/worker.mjs
var WorkerBundle []byte
