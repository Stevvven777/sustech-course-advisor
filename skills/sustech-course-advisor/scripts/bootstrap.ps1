$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$NodeVersion = if ($env:SUSTECH_ADVISOR_NODE_VERSION) { $env:SUSTECH_ADVISOR_NODE_VERSION } else { "20.18.0" }
$AdvisorVersion = if ($env:SUSTECH_ADVISOR_VERSION) { $env:SUSTECH_ADVISOR_VERSION } else { "0.2.2" }
$SustechVersion = if ($env:SUSTECH_CLI_VERSION) { $env:SUSTECH_CLI_VERSION } else { "0.10.0" }
$AdvisorRepository = if ($env:SUSTECH_ADVISOR_RELEASE_REPOSITORY) { $env:SUSTECH_ADVISOR_RELEASE_REPOSITORY } else { "Stevvven777/sustech-course-advisor" }
$AdvisorReleaseTag = if ($env:SUSTECH_ADVISOR_RELEASE_TAG) { $env:SUSTECH_ADVISOR_RELEASE_TAG } else { "v$AdvisorVersion" }
$AdvisorAsset = "sustech-course-advisor-$AdvisorVersion.tgz"
$AdvisorReleaseBaseUrl = if ($env:SUSTECH_ADVISOR_RELEASE_BASE_URL) { $env:SUSTECH_ADVISOR_RELEASE_BASE_URL.TrimEnd("/") } else { "https://github.com/$AdvisorRepository/releases/download/$AdvisorReleaseTag" }
$InstallRoot = if ($env:SUSTECH_ADVISOR_INSTALL_ROOT) { $env:SUSTECH_ADVISOR_INSTALL_ROOT } else { Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "sustech-course-advisor" }
$PackageRoot = Join-Path $InstallRoot "packages"
$BinRoot = Join-Path $InstallRoot "bin"

function Test-NodeVersion([string]$NodePath) {
  $actual = (& $NodePath -p "process.versions.node").Split(".") | ForEach-Object { [int]$_ }
  $minimum = $NodeVersion.Split(".") | ForEach-Object { [int]$_ }
  for ($index = 0; $index -lt [Math]::Max($actual.Count, $minimum.Count); $index++) {
    $left = if ($index -lt $actual.Count) { $actual[$index] } else { 0 }
    $right = if ($index -lt $minimum.Count) { $minimum[$index] } else { 0 }
    if ($left -ne $right) { return $left -gt $right }
  }
  return $true
}

$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
$NpmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($NodeCommand -and $NpmCommand -and (Test-NodeVersion $NodeCommand.Source)) {
  $NodeBin = $NodeCommand.Source
  $NpmBin = $NpmCommand.Source
} else {
  $architecture = [Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
  $platform = switch ($architecture) { "x64" { "win-x64" } "arm64" { "win-arm64" } default { throw "Unsupported Windows architecture for isolated Node.js bootstrap." } }
  $nodeName = "node-v$NodeVersion-$platform"
  $nodeHome = Join-Path (Join-Path $InstallRoot "runtime") $nodeName
  $NodeBin = Join-Path $nodeHome "node.exe"
  $NpmBin = Join-Path $nodeHome "npm.cmd"
  if (-not (Test-Path $NodeBin)) {
    $temporary = Join-Path ([IO.Path]::GetTempPath()) ("sustech-advisor-" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $temporary | Out-Null
    try {
      $archive = "$nodeName.zip"
      $baseUrl = "https://nodejs.org/dist/v$NodeVersion"
      Invoke-WebRequest "$baseUrl/$archive" -OutFile (Join-Path $temporary $archive) -TimeoutSec 180
      Invoke-WebRequest "$baseUrl/SHASUMS256.txt" -OutFile (Join-Path $temporary "SHASUMS256.txt") -TimeoutSec 180
      $line = Get-Content (Join-Path $temporary "SHASUMS256.txt") | Where-Object { $_ -match "\s$([Regex]::Escape($archive))$" } | Select-Object -First 1
      if (-not $line) { throw "Node.js checksum entry is missing." }
      $expected = ($line -split "\s+")[0].ToLowerInvariant()
      $actual = (Get-FileHash (Join-Path $temporary $archive) -Algorithm SHA256).Hash.ToLowerInvariant()
      if ($actual -ne $expected) { throw "Node.js checksum verification failed." }
      New-Item -ItemType Directory -Force -Path (Join-Path $InstallRoot "runtime") | Out-Null
      Expand-Archive (Join-Path $temporary $archive) -DestinationPath (Join-Path $InstallRoot "runtime")
    } finally {
      Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

New-Item -ItemType Directory -Force -Path $PackageRoot, $BinRoot | Out-Null
$releaseTemporary = Join-Path ([IO.Path]::GetTempPath()) ("sustech-advisor-release-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $releaseTemporary | Out-Null
try {
  $advisorArchive = Join-Path $releaseTemporary $AdvisorAsset
  $advisorChecksum = "$advisorArchive.sha256"
  Invoke-WebRequest "$AdvisorReleaseBaseUrl/$AdvisorAsset" -OutFile $advisorArchive -TimeoutSec 180
  Invoke-WebRequest "$AdvisorReleaseBaseUrl/$AdvisorAsset.sha256" -OutFile $advisorChecksum -TimeoutSec 180
  $checksumPattern = "^\s*([0-9A-Fa-f]{64})\s+\*?$([Regex]::Escape($AdvisorAsset))\s*$"
  $checksumLine = Get-Content $advisorChecksum | Where-Object { $_ -match $checksumPattern } | Select-Object -First 1
  if (-not $checksumLine) { throw "Advisor checksum entry is missing." }
  $expected = ([Regex]::Match($checksumLine, $checksumPattern).Groups[1].Value).ToLowerInvariant()
  $actual = (Get-FileHash $advisorArchive -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { throw "Advisor GitHub Release checksum verification failed." }

  $oldPath = $env:Path
  try {
    $env:Path = ((Split-Path $NodeBin) + [IO.Path]::PathSeparator + $env:Path)
    & $NpmBin view "sustech-cli@$SustechVersion" version --json --fetch-timeout=15000 --fetch-retries=1 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=5000 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "sustech-cli@$SustechVersion is not available from the selected npm registry." }
    & $NodeBin (Join-Path $PSScriptRoot "install-policy.mjs") prepare $PackageRoot $advisorArchive $AdvisorAsset $SustechVersion
    if ($LASTEXITCODE -ne 0) { throw "Could not establish the isolated runtime dependency policy." }
    & $NpmBin install --prefix $PackageRoot --omit=dev --no-audit --no-fund --fetch-timeout=15000 --fetch-retries=1 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=5000
    if ($LASTEXITCODE -ne 0) { throw "Package installation failed." }
    & $NodeBin (Join-Path $PSScriptRoot "install-policy.mjs") verify $PackageRoot $AdvisorVersion $SustechVersion
    if ($LASTEXITCODE -ne 0) { throw "Installed packages do not satisfy the audited version policy." }
    & $NpmBin audit --prefix $PackageRoot --omit=dev --audit-level=low --fetch-timeout=15000 --fetch-retries=1 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=5000 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Installed runtime dependency audit failed." }
  } finally {
    $env:Path = $oldPath
  }
} finally {
  Remove-Item -LiteralPath $releaseTemporary -Recurse -Force -ErrorAction SilentlyContinue
}

$advisorEntry = Join-Path $PackageRoot "node_modules\sustech-course-advisor\dist\cli.js"
$sustechEntry = Join-Path $PackageRoot "node_modules\sustech-cli\dist\cli.js"
Set-Content -LiteralPath (Join-Path $BinRoot "sustech-advisor.cmd") -Encoding Ascii -Value "@echo off`r`n`"$NodeBin`" `"$advisorEntry`" %*`r`n"
Set-Content -LiteralPath (Join-Path $BinRoot "sustech.cmd") -Encoding Ascii -Value "@echo off`r`n`"$NodeBin`" `"$sustechEntry`" %*`r`n"

& (Join-Path $BinRoot "sustech.cmd") version | Out-Null
& (Join-Path $BinRoot "sustech-advisor.cmd") help | Out-Null
$oldSustechBin = $env:SUSTECH_BIN
try {
  $env:SUSTECH_BIN = Join-Path $BinRoot "sustech.cmd"
  $doctorText = (& (Join-Path $BinRoot "sustech-advisor.cmd") doctor 2>$null | Out-String)
  $doctor = $doctorText | ConvertFrom-Json
  if (-not $doctor.installationReady) { throw "Installed commands do not satisfy the advisor capability contract." }
} finally {
  if ($null -eq $oldSustechBin) { Remove-Item Env:SUSTECH_BIN -ErrorAction SilentlyContinue }
  else { $env:SUSTECH_BIN = $oldSustechBin }
}
Write-Output "Installation verified. Use these executables without changing PATH:"
Write-Output (Join-Path $BinRoot "sustech.cmd")
Write-Output (Join-Path $BinRoot "sustech-advisor.cmd")
exit 0
