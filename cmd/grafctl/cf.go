package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type apiClient struct {
	token   string
	base    string
	client  *http.Client
	account string
}

func newAPI(token, account string) *apiClient {
	return &apiClient{
		token:   token,
		base:    "https://api.cloudflare.com/client/v4",
		client:  &http.Client{Timeout: 90 * time.Second},
		account: account,
	}
}

func (a *apiClient) do(method, path string, body []byte, contentType string) (map[string]any, error) {
	var rd io.Reader
	if body != nil {
		rd = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, a.base+path, rd)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+a.token)
	req.Header.Set("Accept", "application/json")
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	resp, err := a.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return nil, err
	}
	var j map[string]any
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &j); err != nil {
			return nil, fmt.Errorf("%s %s: 非 JSON 响应 (%d): %s", method, path, resp.StatusCode, trunc(string(raw), 400))
		}
	}
	if resp.StatusCode >= 400 || (j != nil && j["success"] == false) {
		msg := firstErr(j)
		if msg == "" {
			msg = trunc(string(raw), 300)
		}
		return j, fmt.Errorf("%s %s -> HTTP %d: %s", method, path, resp.StatusCode, msg)
	}
	return j, nil
}

func (a *apiClient) get(path string) (map[string]any, error) {
	return a.do("GET", path, nil, "")
}
func (a *apiClient) post(path string, body any) (map[string]any, error) {
	b, _ := json.Marshal(body)
	return a.do("POST", path, b, "application/json")
}
func (a *apiClient) put(path string, body any) (map[string]any, error) {
	b, _ := json.Marshal(body)
	return a.do("PUT", path, b, "application/json")
}

func firstErr(j map[string]any) string {
	if j == nil {
		return ""
	}
	if errs, ok := j["errors"].([]any); ok && len(errs) > 0 {
		if m, ok := errs[0].(map[string]any); ok {
			if msg, ok := m["message"].(string); ok && msg != "" {
				return msg
			}
		}
	}
	return ""
}

func trunc(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func resolveAccount(cli *apiClient, want string) (string, error) {
	if want != "" {
		return want, nil
	}
	j, err := cli.get("/accounts?per_page=50")
	if err != nil {
		return "", err
	}
	res, ok := j["result"].([]any)
	if !ok || len(res) == 0 {
		return "", fmt.Errorf("账号列表为空")
	}
	m, ok := res[0].(map[string]any)
	if !ok {
		return "", fmt.Errorf("无法解析账号列表")
	}
	id := jsonGet(m, "id")
	if id == "" {
		return "", fmt.Errorf("无法解析账号 ID")
	}
	return id, nil
}

func accountSubdomain(cli *apiClient) (string, error) {
	j, err := cli.get("/accounts/" + cli.account + "/workers/subdomain")
	if err != nil {
		return "", err
	}
	return jsonGet(j, "result", "subdomain"), nil
}

func ensureToken(c *Cfg) error {
	if c.Token == "" {
		return fmt.Errorf("缺少 CLOUDFLARE_API_TOKEN：请在 Cloudflare 创建 API Token (Workers + D1 Edit) 并设置环境变量")
	}
	return nil
}
