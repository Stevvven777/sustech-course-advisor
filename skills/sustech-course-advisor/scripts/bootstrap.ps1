$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$NodeVersion = if ($env:SUSTECH_ADVISOR_NODE_VERSION) { $env:SUSTECH_ADVISOR_NODE_VERSION } else { "20.18.0" }
$AdvisorVersion = if ($env:SUSTECH_ADVISOR_VERSION) { $env:SUSTECH_ADVISOR_VERSION } else { "0.2.0" }
$SustechVersion = if ($env:SUSTECH_CLI_VERSION) { $env:SUSTECH_CLI_VERSION } else { "0.10.0" }
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
      Invoke-WebRequest "$baseUrl/$archive" -OutFile (Join-Path $temporary $archive)
      Invoke-WebRequest "$baseUrl/SHASUMS256.txt" -OutFile (Join-Path $temporary "SHASUMS256.txt")
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
$oldPath = $env:Path
try {
  $env:Path = ((Split-Path $NodeBin) + [IO.Path]::PathSeparator + $env:Path)
  & $NpmBin install --prefix $PackageRoot --omit=dev --no-audit --no-fund "sustech-course-advisor@$AdvisorVersion" "sustech-cli@$SustechVersion"
} finally {
  $env:Path = $oldPath
}

$advisorEntry = Join-Path $PackageRoot "node_modules\sustech-course-advisor\dist\cli.js"
$sustechEntry = Join-Path $PackageRoot "node_modules\sustech-cli\dist\cli.js"
Set-Content -LiteralPath (Join-Path $BinRoot "sustech-advisor.cmd") -Encoding Ascii -Value "@echo off`r`n`"$NodeBin`" `"$advisorEntry`" %*`r`n"
Set-Content -LiteralPath (Join-Path $BinRoot "sustech.cmd") -Encoding Ascii -Value "@echo off`r`n`"$NodeBin`" `"$sustechEntry`" %*`r`n"

& (Join-Path $BinRoot "sustech.cmd") version | Out-Null
& (Join-Path $BinRoot "sustech-advisor.cmd") help | Out-Null
Write-Output "Installation verified. Use these executables without changing PATH:"
Write-Output (Join-Path $BinRoot "sustech.cmd")
Write-Output (Join-Path $BinRoot "sustech-advisor.cmd")
