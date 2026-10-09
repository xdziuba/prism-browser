param(
    [Parameter(Mandatory = $true)]
    [string]$WorkDir
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workRoot = [System.IO.Path]::GetFullPath($WorkDir)
if ($workRoot -eq $repoRoot -or $workRoot.StartsWith($repoRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'WorkDir must be outside the Prism repository.'
}

$lock = Get-Content (Join-Path $repoRoot 'chromium.lock.json') -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $workRoot | Out-Null
$toolsDir = Join-Path $workRoot 'depot_tools'
if (-not (Test-Path (Join-Path $toolsDir '.git'))) {
    git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git $toolsDir
    if ($LASTEXITCODE -ne 0) { throw 'depot_tools clone failed.' }
}
$dirty = git -C $toolsDir status --porcelain
if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'depot_tools has local changes or is invalid.' }
git -C $toolsDir fetch origin $lock.depot_tools
if ($LASTEXITCODE -ne 0) { throw 'depot_tools fetch failed.' }
git -C $toolsDir checkout --detach $lock.depot_tools
if ($LASTEXITCODE -ne 0) { throw 'depot_tools checkout failed.' }
& (Join-Path $toolsDir 'bootstrap\win_tools.bat')
if ($LASTEXITCODE -ne 0) { throw 'depot_tools bootstrap failed.' }
$env:DEPOT_TOOLS_UPDATE = '0'
$env:PATH = "$toolsDir;$env:PATH"

$chromiumDir = Join-Path $workRoot 'chromium'
New-Item -ItemType Directory -Force -Path $chromiumDir | Out-Null
Push-Location $chromiumDir
try {
    if (-not (Test-Path '.gclient')) {
        gclient config --name src $lock.source
        if ($LASTEXITCODE -ne 0) { throw 'gclient config failed.' }
    }
    elseif (-not (Get-Content '.gclient' -Raw).Contains($lock.source)) {
        throw 'Existing .gclient points at a different source.'
    }
    if (Test-Path 'src\.git') {
        $dirty = git -C src status --porcelain
        if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Chromium source has local changes or is invalid.' }
    }
    gclient sync --revision "src@$($lock.chromium_src)" --no-history --nohooks
    if ($LASTEXITCODE -ne 0) { throw 'Pinned gclient sync failed.' }
    if (-not (Test-Path 'src\.git')) { throw 'Chromium source checkout is missing.' }
    $actual = git -C src rev-parse HEAD
    if ($LASTEXITCODE -ne 0 -or $actual.Trim() -ne $lock.chromium_src) { throw "Wrong Chromium revision: $actual" }
    gclient runhooks
    if ($LASTEXITCODE -ne 0) { throw 'Chromium hooks failed.' }
    Write-Host "Pinned checkout ready: $(Join-Path $chromiumDir 'src') ($actual)"
}
finally {
    Pop-Location
}
