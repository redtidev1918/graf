package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func configDir() (string, error) {
	d, err := os.UserConfigDir()
	if err != nil || d == "" {
		h, _ := os.UserHomeDir()
		if h == "" {
			return "", fmt.Errorf("无法定位用户配置目录")
		}
		d = filepath.Join(h, ".config")
	}
	return filepath.Join(d, "grafctl"), nil
}

func configPath() (string, error) {
	d, err := configDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(d, "config.json"), nil
}

func loadSavedToken() string {
	p, err := configPath()
	if err != nil {
		return ""
	}
	b, err := os.ReadFile(p)
	if err != nil {
		return ""
	}
	// config.json is { "token": "..." } — parse minimally.
	i := strings.Index(string(b), "\"token\"")
	if i < 0 {
		return ""
	}
	rest := string(b)[i+len("\"token\""):]
	j := strings.Index(rest, "\"")
	if j < 0 {
		return ""
	}
	rest = rest[j+1:]
	k := strings.Index(rest, "\"")
	if k < 0 {
		return ""
	}
	return rest[:k]
}

func saveToken(token string) error {
	dir, err := configDir()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	p, err := configPath()
	if err != nil {
		return err
	}
	body := []byte(fmt.Sprintf("{\"token\":\"%s\"}\n", token))
	return os.WriteFile(p, body, 0o600)
}

func runAuth(c *Cfg) error {
	token, err := hiddenInput("Cloudflare API Token (输入不可见): ")
	if err != nil {
		return err
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return fmt.Errorf("Token 不能为空")
	}
	if err := saveToken(token); err != nil {
		return err
	}
	p, _ := configPath()
	ok("Token 已保存到 " + p)
	info("之后直接运行: grafctl deploy --yes")
	return nil
}
