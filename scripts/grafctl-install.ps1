# grafctl Windows 一键安装： irm https://raw.githubusercontent.com/redtidev1918/graf/master/scripts/grafctl-install.ps1 | iex
$ErrorActionPreference = "Stop"
$repo = "redtidev1918/graf"
$arch = if ($env:PROCESSOR_ARCHITECTURE -match "ARM64|ARM") { "arm64" } else { "amd64" }
$releases = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases?per_page=100"
$tag = ($releases | Where-Object { $_.tag_name -like "v*-grafctl" } | Select-Object -First 1).tag_name
if (-not $tag) { throw "无法获取最新 grafctl 版本" }
$ver = if ($tag.StartsWith("v")) { $tag.Substring(1) } else { $tag }
$name = "grafctl_${ver}_windows_${arch}.zip"
$url = "https://github.com/$repo/releases/download/${tag}/${name}"
$tmp = Join-Path $env:TEMP ("grafctl-install-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Write-Host ("==> 下载 " + $name + " ...")
Invoke-WebRequest -Uri $url -OutFile (Join-Path $tmp "g.zip")
Expand-Archive -Path (Join-Path $tmp "g.zip") -DestinationPath $tmp -Force
$bin = Join-Path $env:USERPROFILE ".local\bin"
New-Item -ItemType Directory -Force -Path $bin | Out-Null
Copy-Item -Force (Join-Path $tmp "grafctl.exe") (Join-Path $bin "grafctl.exe")
Remove-Item -Recurse -Force $tmp
Write-Host ("==> 已安装到 " + $bin + "\grafctl.exe")
if ($env:PATH -notlike ("*" + $bin + "*")) {
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if ($userPath -notlike ("*" + $bin + "*")) {
    [Environment]::SetEnvironmentVariable("Path", ($userPath.TrimEnd(';') + ";" + $bin), "User")
  }
  $env:PATH = "$env:PATH;$bin"
  Write-Host ("==> 已将 " + $bin + " 加入用户 PATH（新开终端生效）")
}
Write-Host ""
Write-Host "下一步(只需一次):"
Write-Host "  grafctl auth"
Write-Host "  grafctl deploy --yes"
