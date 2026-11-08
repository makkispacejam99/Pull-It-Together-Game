<#
  Servidor estático mínimo para desarrollo local en Windows.

  Uso:
    pwsh -File tools/serve.ps1
    pwsh -File tools/serve.ps1 -Port 8080

  No requiere Node, Python ni dependencias.
#>

param(
  [int]$Port = 5173,
  [string]$Root = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath($Root)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
  $listener.Start()
} catch {
  Write-Host "No se pudo abrir http://localhost:$Port/ — ¿ya hay algo usándolo?" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "  PULL IT TOGETHER · servidor local" -ForegroundColor Yellow
Write-Host "  http://localhost:$Port/" -ForegroundColor Green
Write-Host "  Ctrl+C para detener" -ForegroundColor DarkGray
Write-Host ""

$mime = @{
  '.html'  = 'text/html; charset=utf-8'
  '.css'   = 'text/css; charset=utf-8'
  '.js'    = 'text/javascript; charset=utf-8'
  '.mjs'   = 'text/javascript; charset=utf-8'
  '.json'  = 'application/json; charset=utf-8'
  '.png'   = 'image/png'
  '.jpg'   = 'image/jpeg'
  '.jpeg'  = 'image/jpeg'
  '.gif'   = 'image/gif'
  '.svg'   = 'image/svg+xml'
  '.ico'   = 'image/x-icon'
  '.ogg'   = 'audio/ogg'
  '.mp3'   = 'audio/mpeg'
  '.wav'   = 'audio/wav'
  '.woff2' = 'font/woff2'
  '.woff'  = 'font/woff'
  '.txt'   = 'text/plain; charset=utf-8'
  '.md'    = 'text/markdown; charset=utf-8'
}

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
  } catch {
    break
  }

  $request = $context.Request
  $response = $context.Response

  try {
    $relative = [Uri]::UnescapeDataString($request.Url.LocalPath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }

    $full = [IO.Path]::GetFullPath((Join-Path $Root $relative))

    if (-not $full.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) {
      $response.StatusCode = 403
      $response.Close()
      continue
    }

    if ((Test-Path -LiteralPath $full) -and (Get-Item -LiteralPath $full).PSIsContainer) {
      $full = Join-Path $full 'index.html'
    }

    if (Test-Path -LiteralPath $full -PathType Leaf) {
      $bytes = [IO.File]::ReadAllBytes($full)
      $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
      $response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $response.Headers.Add('Cache-Control', 'no-store')
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $response.StatusCode = 404
      $body = [Text.Encoding]::UTF8.GetBytes("404 · No encontrado: $relative")
      $response.ContentType = 'text/plain; charset=utf-8'
      $response.OutputStream.Write($body, 0, $body.Length)
    }
  } catch {
    try { $response.StatusCode = 500 } catch { }
  } finally {
    try { $response.Close() } catch { }
  }
}
