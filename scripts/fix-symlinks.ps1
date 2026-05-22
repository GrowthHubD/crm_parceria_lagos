# Substitui symlinks problemáticos em .open-next por cópias reais.
# Necessário porque o esbuild do wrangler em Windows não consegue ler symlinks
# do pnpm (Access denied), bloqueando o deploy.
$ErrorActionPreference = "Stop"

$base = ".open-next\server-functions\default\node_modules\.pnpm\next@16.2.3_@babel+core@7.2_7071f966dd8a1c505aa4c151b59f9b24\node_modules"

$mappings = @{
  "react"      = "..\..\react@19.2.4\node_modules\react"
  "react-dom"  = "..\..\react-dom@19.2.4_react@19.2.4\node_modules\react-dom"
}

foreach ($pkg in $mappings.Keys) {
  $linkPath = Join-Path $base $pkg
  $targetAbs = Join-Path $base $mappings[$pkg]

  if (-not (Test-Path $targetAbs)) {
    Write-Host "SKIP $pkg`: target not found ($targetAbs)"
    continue
  }
  $resolved = (Resolve-Path $targetAbs).Path

  # Remove symlink. cmd /c rd lida com symlinks de diretório corretamente.
  cmd /c "rd /s /q `"$linkPath`"" 2>&1 | Out-Null
  Start-Sleep -Milliseconds 300

  if (Test-Path $linkPath) {
    Write-Host "FAILED to remove $pkg"
    continue
  }
  Copy-Item -Recurse -Force $resolved $linkPath
  Write-Host "OK $pkg`: copied from $resolved"
}
