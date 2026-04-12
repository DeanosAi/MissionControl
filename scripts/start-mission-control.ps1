$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$nextCli = Join-Path $repoRoot 'node_modules\.bin\next.cmd'
$buildId = Join-Path $repoRoot '.next\BUILD_ID'

if (-not (Test-Path $nextCli)) {
  throw "Next.js CLI not found at $nextCli. Run npm install in $repoRoot first."
}

Set-Location $repoRoot

$env:NODE_ENV = 'production'
$env:HOSTNAME = '127.0.0.1'
$env:PORT = '3000'

& node .\scripts\prepare-runtime.mjs
if ($LASTEXITCODE -ne 0) {
  throw 'Mission Control runtime preparation failed.'
}

if (-not (Test-Path $buildId)) {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    throw 'Mission Control build failed.'
  }
}

& $nextCli start --hostname 127.0.0.1 --port 3000
if ($LASTEXITCODE -ne 0) {
  throw "Mission Control exited with code $LASTEXITCODE."
}
