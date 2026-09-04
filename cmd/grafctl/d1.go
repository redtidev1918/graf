package main

import (
	"fmt"
	"io/fs"
	"sort"
	"strings"

	assets "github.com/redtidev1918/graf"
)

func findD1(cli *apiClient, name string) (string, error) {
	j, err := cli.get("/accounts/" + cli.account + "/d1/database?per_page=100")
	if err != nil {
		return "", err
	}
	res, _ := j["result"].([]any)
	for _, item := range res {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if jsonGet(m, "name") == name {
			return jsonGet(m, "uuid"), nil
		}
	}
	return "", nil
}

func createD1(cli *apiClient, name string) (string, error) {
	j, err := cli.post("/accounts/"+cli.account+"/d1/database", map[string]any{"name": name})
	if err != nil {
		return "", err
	}
	return jsonGet(j, "result", "uuid"), nil
}

func ensureD1(cli *apiClient, c *Cfg) (string, error) {
	if c.DbID != "" {
		return c.DbID, nil
	}
	id, err := findD1(cli, c.DbName)
	if err != nil {
		return "", err
	}
	if id != "" {
		return id, nil
	}
	info("创建 D1 数据库 " + c.DbName + " ...")
	id, err = createD1(cli, c.DbName)
	if err != nil {
		id2, e2 := findD1(cli, c.DbName)
		if e2 == nil && id2 != "" {
			return id2, nil
		}
		return "", err
	}
	return id, nil
}

func d1Query(cli *apiClient, dbID, sql string) ([]map[string]any, error) {
	j, err := cli.post("/accounts/"+cli.account+"/d1/database/"+dbID+"/query", map[string]any{"sql": sql})
	if err != nil {
		return nil, err
	}
	res, ok := j["result"].([]any)
	if !ok || len(res) == 0 {
		return nil, nil
	}
	first, ok := res[0].(map[string]any)
	if !ok {
		return nil, nil
	}
	rows, _ := first["results"].([]any)
	out := make([]map[string]any, 0, len(rows))
	for _, r := range rows {
		if m, ok := r.(map[string]any); ok {
			out = append(out, m)
		}
	}
	return out, nil
}

func d1ExistsTable(cli *apiClient, dbID, table string) (bool, error) {
	rows, err := d1Query(cli, dbID, "SELECT name FROM sqlite_master WHERE type='table' AND name='"+table+"'")
	if err != nil {
		return false, err
	}
	return len(rows) > 0, nil
}

func d1ExistsIndex(cli *apiClient, dbID, index string) (bool, error) {
	rows, err := d1Query(cli, dbID, "SELECT name FROM sqlite_master WHERE type='index' AND name='"+index+"'")
	if err != nil {
		return false, err
	}
	return len(rows) > 0, nil
}

func d1HasColumn(cli *apiClient, dbID, table, col string) (bool, error) {
	rows, err := d1Query(cli, dbID, "SELECT name FROM pragma_table_info('"+table+"') WHERE name='"+col+"'")
	if err != nil {
		return false, err
	}
	return len(rows) > 0, nil
}

func listMigrations() ([]string, error) {
	entries, err := fs.ReadDir(assets.Migrations, "migrations")
	if err != nil {
		return nil, err
	}
	var out []string
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || !strings.HasSuffix(name, ".sql") {
			continue
		}
		if len(name) > 0 && name[0] >= '0' && name[0] <= '9' {
			out = append(out, name)
		}
	}
	sort.Strings(out)
	return out, nil
}

func splitStatements(content string) []string {
	var out []string
	for _, st := range strings.Split(content, ";") {
		st = strings.TrimSpace(st)
		if st != "" {
			out = append(out, st)
		}
	}
	return out
}

func migrationNeeded(cli *apiClient, dbID, name string, applied map[string]bool) (bool, error) {
	if applied[name] {
		return false, nil
	}
	needs := true
	switch {
	case strings.HasPrefix(name, "0001"):
		okV, err := d1ExistsTable(cli, dbID, "accounts")
		if err != nil {
			return false, err
		}
		needs = !okV
	case strings.HasPrefix(name, "0002"):
		okV, err := d1ExistsIndex(cli, dbID, "idx_comments_dedupe")
		if err != nil {
			return false, err
		}
		needs = !okV
	case strings.HasPrefix(name, "0003"):
		ok1, err := d1ExistsTable(cli, dbID, "books")
		if err != nil {
			return false, err
		}
		ok2, err := d1HasColumn(cli, dbID, "pages", "book_id")
		if err != nil {
			return false, err
		}
		needs = !(ok1 && ok2)
	}
	return needs, nil
}

func runMigrations(cli *apiClient, c *Cfg, dbID string) error {
	files, err := listMigrations()
	if err != nil {
		return fmt.Errorf("读取迁移目录: %w", err)
	}
	if _, err := d1Query(cli, dbID, "CREATE TABLE IF NOT EXISTS graf_migrations (name TEXT PRIMARY KEY, created_at TEXT NOT NULL)"); err != nil {
		return fmt.Errorf("初始化迁移记账表: %w", err)
	}
	rows, err := d1Query(cli, dbID, "SELECT name FROM graf_migrations")
	if err != nil {
		return err
	}
	applied := map[string]bool{}
	for _, r := range rows {
		if n, ok := r["name"].(string); ok {
			applied[n] = true
		}
	}
	count := 0
	for _, name := range files {
		content, err := assets.Migrations.ReadFile("migrations/" + name)
		if err != nil {
			return err
		}
		need, err := migrationNeeded(cli, dbID, name, applied)
		if err != nil {
			return err
		}
		if !need {
			debug("跳过已应用的迁移: " + name)
			continue
		}
		step("执行迁移 " + name)
		for _, st := range splitStatements(string(content)) {
			if _, err := d1Query(cli, dbID, st); err != nil {
				return fmt.Errorf("迁移 %s 失败: %w", name, err)
			}
		}
		if _, err := d1Query(cli, dbID, "INSERT OR IGNORE INTO graf_migrations (name, created_at) VALUES ('"+name+"', datetime('now'))"); err != nil {
			return err
		}
		count++
	}
	ok("迁移完成 (新增 " + itoa(count) + " 个)")
	return nil
}
