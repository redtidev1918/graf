#!/bin/sh
# grafctl 一键安装：下载最新版对应平台二进制到 PATH（需要 curl + tar/gzip；Windows 请手动下载 zip）
set -e
os="$(uname -s | tr 'A-Z' 'a-z')"
arch="$(uname -m)"
case "$os" in
  darwin) os="darwin" ;;
  linux) os="linux" ;;
  *) echo "暂不支持的系统: $os (请到 Releases 下载 Windows zip)"; exit 1 ;;
esac
case "$arch" in
  x86_64|amd64) arch="amd64" ;;
  aarch64|arm64) arch="arm64" ;;
  *) echo "暂不支持的架构: $arch"; exit 1 ;;
esac
repo="redtidev1918/graf"
tag="$(curl -fsSL "https://api.github.com/repos/$repo/releases/latest" | sed -n 's/.*"tag_name": "\([^"]*\)".*/\1/p' | head -1)"
[ -n "$tag" ] || { echo "无法获取最新版本"; exit 1; }
ver="${tag#v}"
name="grafctl_${ver}_${os}_${arch}.tar.gz"
url="https://github.com/$repo/releases/download/${tag}/${name}"
tmp="$(mktemp -d)"
echo "==> 下载 ${name} ..."
curl -fsSL "$url" -o "$tmp/grafctl.tar.gz"
tar -xzf "$tmp/grafctl.tar.gz" -C "$tmp"
bin="$HOME/.local/bin"
mkdir -p "$bin"
install -m 0755 "$tmp/grafctl" "$bin/grafctl"
rm -rf "$tmp"
echo "==> grafctl 已安装到 $bin/grafctl"
case ":$PATH:" in
  *":$bin:"*) ;;
  *) echo "提示: 把 $bin 加入 PATH:  export PATH=\"$HOME/.local/bin:$PATH\"" ;;
esac
echo ""
echo "下一步(只需一次):"
echo "  grafctl auth          # 粘贴 Cloudflare API Token"
echo "  grafctl deploy --yes  # 之后零依赖一键部署"
