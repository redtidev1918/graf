package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"time"
)

var logFile *os.File

// ColorEnabled 控制彩色输出(受终端/--no-color/NO_COLOR 约束)
var ColorEnabled bool

func color(code, s string) string {
	if !ColorEnabled {
		return s
	}
	return "\x1b[" + code + "m" + s + "\x1b[0m"
}

func openLog(path string) {
	if path == "" {
		return
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err == nil {
		logFile = f
	}
}

func logLine(kind, msg string) {
	stamp := time.Now().Format("2006-01-02 15:04:05")
	line := fmt.Sprintf("[%s] %s %s\n", stamp, kind, msg)
	if logFile != nil {
		_, _ = logFile.WriteString(line)
	}
	codes := map[string]string{"INFO": "90", "OK": "32", "WARN": "33", "STEP": "36", "ERROR": "31", "DEBUG": "2"}
	fmt.Println(color(codes[kind], kind) + " " + msg)
}

func info(msg string)  { logLine("ℹ", msg) }
func ok(msg string)    { logLine("✔", msg) }
func warn(msg string)  { logLine("⚠", msg) }
func step(msg string)  { logLine("▶", msg) }
func debug(msg string) { logLine("·", msg) }

func isTerminal() bool {
	fi, err := os.Stdin.Stat()
	if err != nil {
		return false
	}
	return fi.Mode()&os.ModeCharDevice != 0
}

func sttyEcho(on bool) error {
	if runtime.GOOS == "windows" {
		return nil
	}
	arg := "-echo"
	if on {
		arg = "echo"
	}
	cmd := exec.Command("stty", arg)
	cmd.Stdin = os.Stdin
	return cmd.Run()
}

func jsonGet(obj map[string]any, path ...string) string {
	cur := any(obj)
	for _, key := range path {
		m, ok := cur.(map[string]any)
		if !ok {
			return ""
		}
		cur = m[key]
	}
	if cur == nil {
		return ""
	}
	switch v := cur.(type) {
	case string:
		return v
	case float64:
		return fmt.Sprintf("%v", v)
	case bool:
		return fmt.Sprintf("%v", v)
	default:
		b, _ := json.Marshal(v)
		return string(b)
	}
}

func itoa(n int) string {
	return fmt.Sprintf("%d", n)
}

func short(id string) string {
	if len(id) > 10 {
		return id[:8] + "…"
	}
	return id
}
