// grafctl — Graf cross-platform deployer (Go, direct Cloudflare API, no Node)
package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

const version = "0.4.1"

func main() {
	args := os.Args[1:]
	cmd := "deploy"
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		cmd = args[0]
		args = args[1:]
	}
	cfg := loadCfg(args)
	ColorEnabled = isTerminal() && !cfg.NoColor && os.Getenv("NO_COLOR") == ""

	// 顶层帮助/版本标志优先，避免 --help 误触发部署
	for _, a := range args {
		switch a {
		case "-h", "--help":
			printHelp()
			return
		case "-v", "--version":
			fmt.Println("grafctl v" + version)
			return
		}
	}

	switch cmd {
	case "help":
		printHelp()
	case "version":
		fmt.Println("grafctl v" + version)
	case "doctor":
		if err := runDoctor(cfg); err != nil {
			fatal(err)
		}
	case "migrate":
		if err := runMigrate(cfg); err != nil {
			fatal(err)
		}
	case "auth":
		if err := runAuth(cfg); err != nil {
			fatal(err)
		}
	case "deploy":
		if err := runDeploy(cfg); err != nil {
			fatal(err)
		}
	default:
		fmt.Fprintln(os.Stderr, "未知命令: "+cmd)
		printHelp()
		os.Exit(2)
	}
}

func printHelp() {
	fmt.Println("grafctl v" + version + " — Graf 一键部署器 (Cloudflare API 直连, 无需 Node)")
	fmt.Println()
	fmt.Println("用法:")
	fmt.Println("  grafctl doctor                检查登录/账号/D1/迁移状态")
	fmt.Println("  grafctl migrate               只执行 D1 迁移")
	fmt.Println("  grafctl deploy                完整部署 (默认)")
	fmt.Println("  grafctl deploy --dry-run      演练")
	fmt.Println("  grafctl auth                  粘贴一次 API Token 并保存(之后无需环境变量)")
	fmt.Println("  grafctl --help")
	fmt.Println("  grafctl --version")
	fmt.Println()
	fmt.Println("必填环境变量:")
	fmt.Println("  CLOUDFLARE_API_TOKEN   Cloudflare API Token(Workers + D1 Edit); 也可用 grafctl auth 保存")
	fmt.Println("可选环境变量:")
	fmt.Println("  GRAF_ACCOUNT_ID        账号 ID (缺省取第一个账号)")
	fmt.Println("  GRAF_WORKER            Worker 名 (默认 graf)")
	fmt.Println("  GRAF_DB_NAME / GRAF_DB_ID  D1 名称/id")
	fmt.Println("  ADMIN_USERNAME / ADMIN_PASSWORD / SECRET   后台凭据与密钥(--yes 自动生成)")
	fmt.Println("  SITE_NAME / SITE_ID / ENABLE_COMMENTS / BOOKS_ENABLED / CACHE_TTL / MAX_PAGE_LENGTH")
	fmt.Println("  GRAF_BUNDLE            bundle 路径 (默认内嵌 dist/worker.mjs)")
	fmt.Println("  GRAF_LOG               日志文件")
}

type Cfg struct {
	Token, Account, Worker, DbName, DbID string
	Bundle                               string
	AdminUser, AdminPass, Secret         string
	SiteName, SiteID                     string
	EnableComments, Books, CacheTTL      string
	MaxPage                              string
	Yes, DryRun, Debug, NoColor          bool
	LogFile                              string
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func loadCfg(args []string) *Cfg {
	c := &Cfg{}
	for _, a := range args {
		switch {
		case a == "--yes" || a == "-y":
			c.Yes = true
		case a == "--dry-run":
			c.DryRun = true
		case a == "--debug":
			c.Debug = true
		case a == "--no-color":
			c.NoColor = true
		case strings.HasPrefix(a, "--"):
			kv := strings.SplitN(strings.TrimPrefix(a, "--"), "=", 2)
			switch kv[0] {
			case "account":
				c.Account = valOr(kv)
			case "worker":
				c.Worker = valOr(kv)
			case "bundle":
				c.Bundle = valOr(kv)
			case "site-name":
				c.SiteName = valOr(kv)
			case "admin-user":
				c.AdminUser = valOr(kv)
			case "admin-pass":
				c.AdminPass = valOr(kv)
			case "token":
				c.Token = valOr(kv)
			case "secret":
				c.Secret = valOr(kv)
			}
		}
	}
	c.Token = firstNonEmpty(c.Token, os.Getenv("CLOUDFLARE_API_TOKEN"))
	if c.Token == "" {
		c.Token = loadSavedToken()
	}
	c.Account = firstNonEmpty(c.Account, os.Getenv("GRAF_ACCOUNT_ID"))
	c.Worker = envOr("GRAF_WORKER", "graf")
	c.DbName = envOr("GRAF_DB_NAME", "graf")
	c.DbID = os.Getenv("GRAF_DB_ID")
	c.Bundle = firstNonEmpty(c.Bundle, os.Getenv("GRAF_BUNDLE")) // 空 = 内嵌 dist/worker.mjs
	c.AdminUser = firstNonEmpty(c.AdminUser, os.Getenv("ADMIN_USERNAME"))
	c.AdminPass = firstNonEmpty(c.AdminPass, os.Getenv("ADMIN_PASSWORD"))
	c.Secret = firstNonEmpty(c.Secret, os.Getenv("SECRET"))
	c.SiteName = firstNonEmpty(c.SiteName, envOr("SITE_NAME", "Graf"))
	c.SiteID = envOr("SITE_ID", "default")
	c.EnableComments = envOr("ENABLE_COMMENTS", "true")
	c.Books = envOr("BOOKS_ENABLED", "true")
	c.CacheTTL = envOr("CACHE_TTL", "0")
	c.MaxPage = envOr("MAX_PAGE_LENGTH", "200000")
	c.LogFile = envOr("GRAF_LOG", "./graf-deploy.log")
	return c
}

func valOr(kv []string) string {
	if len(kv) == 2 {
		return kv[1]
	}
	return ""
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "✖ "+err.Error())
	os.Exit(1)
}

func hiddenInput(prompt string) (string, error) {
	if _, err := os.Stdout.WriteString(prompt); err != nil {
		return "", err
	}
	if isTerminal() {
		_ = sttyEcho(false)
		defer sttyEcho(true)
	}
	r := bufio.NewReader(os.Stdin)
	line, err := r.ReadString('\n')
	fmt.Println()
	if err != nil && line == "" {
		return "", err
	}
	return strings.TrimRight(line, "\r\n"), nil
}
