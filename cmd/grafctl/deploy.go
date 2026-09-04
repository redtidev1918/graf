package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

func runDoctor(c *Cfg) error {
	if err := ensureToken(c); err != nil {
		return err
	}
	openLog(c.LogFile)
	cli := newAPI(c.Token, "")
	acct, err := resolveAccount(cli, c.Account)
	if err != nil {
		return fmt.Errorf("账号解析失败: %w", err)
	}
	cli.account = acct
	info("账号 ID: " + acct)
	if sub, err := accountSubdomain(cli); err == nil {
		info("workers.dev 子域: " + sub)
	} else {
		warn("读取子域失败: " + err.Error())
	}
	dbID, err := ensureD1(cli, c)
	if err != nil {
		return fmt.Errorf("D1 定位失败: %w", err)
	}
	info("D1 数据库: " + c.DbName + " (" + short(dbID) + ")")
	rows, err := d1Query(cli, dbID, "SELECT COUNT(*) AS n FROM pages")
	if err == nil && len(rows) > 0 {
		info("pages 行数: " + jsonGet(rows[0], "n"))
	}
	ok("doctor 完成")
	return nil
}

func runMigrate(c *Cfg) error {
	if err := ensureToken(c); err != nil {
		return err
	}
	openLog(c.LogFile)
	cli := newAPI(c.Token, c.Account)
	acct, err := resolveAccount(cli, c.Account)
	if err != nil {
		return err
	}
	cli.account = acct
	dbID, err := ensureD1(cli, c)
	if err != nil {
		return err
	}
	return runMigrations(cli, c, dbID)
}

func genHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func ensureCreds(c *Cfg) (adminUser, adminPass, secret string, auto bool, err error) {
	adminUser = c.AdminUser
	adminPass = c.AdminPass
	secret = c.Secret
	if secret == "" {
		secret = genHex(16)
	}
	if adminUser == "" && c.Yes {
		adminUser = "admin"
	}
	if adminPass == "" && c.Yes {
		adminPass = genHex(9)
		auto = true
	}
	if adminUser == "" || adminPass == "" {
		return "", "", "", false, fmt.Errorf("需要 ADMIN_USERNAME / ADMIN_PASSWORD（或加 --yes 自动生成管理员密码）")
	}
	return adminUser, adminPass, secret, auto, nil
}

func readBundle(c *Cfg) ([]byte, error) {
	data, err := os.ReadFile(filepath.FromSlash(c.Bundle))
	if err != nil {
		return nil, fmt.Errorf("读取 bundle 失败 (%s): %w — 请先构建: npm run build", c.Bundle, err)
	}
	return data, nil
}

func buildBindings(c *Cfg, dbID string) []map[string]any {
	b := []map[string]any{{"type": "d1_databases", "name": "DB", "id": dbID}}
	vars := map[string]string{
		"SITE_NAME":       c.SiteName,
		"SITE_ID":         c.SiteID,
		"ENABLE_COMMENTS": c.EnableComments,
		"BOOKS_ENABLED":   c.Books,
		"CACHE_TTL":       c.CacheTTL,
		"MAX_PAGE_LENGTH": c.MaxPage,
	}
	for k, v := range vars {
		b = append(b, map[string]any{"type": "vars", "name": k, "value": v})
	}
	return b
}

func uploadWorker(cli *apiClient, c *Cfg, dbID string, bundle []byte) error {
	meta := map[string]any{
		"name":                c.Worker,
		"main_module":         "worker.mjs",
		"compatibility_date":  "2025-06-01",
		"compatibility_flags": []string{"nodejs_compat"},
		"bindings":            buildBindings(c, dbID),
	}
	metaJSON, _ := json.Marshal(meta)

	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	metaPart, err := mw.CreateFormField("metadata")
	if err != nil {
		return err
	}
	if _, err := metaPart.Write(metaJSON); err != nil {
		return err
	}
	filePart, err := mw.CreateFormFile("worker.mjs", "worker.mjs")
	if err != nil {
		return err
	}
	if _, err := filePart.Write(bundle); err != nil {
		return err
	}
	if err := mw.Close(); err != nil {
		return err
	}

	req, err := http.NewRequest("PUT", cli.base+"/accounts/"+cli.account+"/workers/scripts/"+c.Worker, &buf)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+cli.token)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	resp, err := cli.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	var j map[string]any
	_ = json.Unmarshal(raw, &j)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("上传 Worker 失败 (HTTP %d): %s", resp.StatusCode, firstErr(j))
	}
	return nil
}

func putSecret(cli *apiClient, c *Cfg, name, value string) error {
	_, err := cli.put("/accounts/"+cli.account+"/workers/scripts/"+c.Worker+"/secrets", map[string]any{"name": name, "text": value, "type": "secret_text"})
	if err != nil {
		return fmt.Errorf("写入 Secret %s: %w", name, err)
	}
	return nil
}

func runDeploy(c *Cfg) error {
	openLog(c.LogFile)
	info("grafctl " + version + " — Graf 一键部署 (Cloudflare API 直连)")

	if c.DryRun {
		printPlan(c)
		return nil
	}
	if err := ensureToken(c); err != nil {
		return err
	}

	cli := newAPI(c.Token, c.Account)
	acct, err := resolveAccount(cli, c.Account)
	if err != nil {
		return err
	}
	cli.account = acct
	info("账号: " + acct)

	step("D1 数据库")
	dbID, err := ensureD1(cli, c)
	if err != nil {
		return err
	}
	ok("D1: " + c.DbName + " (" + short(dbID) + ")")

	step("D1 迁移")
	if err := runMigrations(cli, c, dbID); err != nil {
		return err
	}

	adminUser, adminPass, secret, auto, err := ensureCreds(c)
	if err != nil {
		return err
	}
	step("上传 Worker")
	bundle, err := readBundle(c)
	if err != nil {
		return err
	}
	if err := uploadWorker(cli, c, dbID, bundle); err != nil {
		return err
	}
	ok("Worker " + c.Worker + " 已上传")

	step("写入 Secrets")
	for _, kv := range [][2]string{{"SECRET", secret}, {"ADMIN_USERNAME", adminUser}, {"ADMIN_PASSWORD", adminPass}} {
		if err := putSecret(cli, c, kv[0], kv[1]); err != nil {
			return err
		}
	}
	ok("SECRET / ADMIN_USERNAME / ADMIN_PASSWORD 已写入")

	step("线上自检")
	url := "https://" + c.Worker + "." + subdomainOr(cli) + ".workers.dev"
	hc := &http.Client{Timeout: 20 * time.Second}
	if resp, err := hc.Get(url + "/robots.txt"); err == nil {
		resp.Body.Close()
		if resp.StatusCode == 200 {
			ok("站点可访问: " + url)
		} else {
			warn("robots.txt HTTP " + itoa(resp.StatusCode))
		}
	} else {
		warn("自检失败(网络?), 稍后手动确认: " + url)
	}

	fmt.Println()
	fmt.Println("  ═══════════ 部署完成 ═══════════")
	fmt.Println("  站点: " + url)
	fmt.Println("  后台: " + url + "/admin")
	fmt.Println("  管理员: " + adminUser)
	if auto {
		fmt.Println("  密码(自动生成, 仅显示一次): " + adminPass)
		fmt.Println("  提示: 登录后请更换 ADMIN_PASSWORD")
	}
	fmt.Println("  ════════════════════════════════")
	return nil
}

func printPlan(c *Cfg) {
	fmt.Println("(--dry-run) 演练计划, 不会触碰 Cloudflare:")
	fmt.Println("  1) D1 数据库    " + c.DbName + " (缺省自动创建)")
	fmt.Println("  2) D1 迁移      migrations/*.sql (schema-aware 幂等)")
	fmt.Println("  3) 上传 Worker  " + c.Bundle + " -> " + c.Worker)
	fmt.Println("  4) Secrets      SECRET / ADMIN_USERNAME / ADMIN_PASSWORD")
	fmt.Println("  5) 自检         https://" + c.Worker + ".<subdomain>.workers.dev/robots.txt")
}

func subdomainOr(cli *apiClient) string {
	if s, err := accountSubdomain(cli); err == nil && s != "" {
		return s
	}
	return "workers.dev"
}
