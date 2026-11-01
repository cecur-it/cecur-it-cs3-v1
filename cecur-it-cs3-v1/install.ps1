#requires -Version 5.1
<#
.SYNOPSIS
  install.ps1 — Windows OS-specific installer script for the CS3 Platform,
  covering all three deployment profiles (cloud | onprem | airgap).

.DESCRIPTION
  Invoked BY cs3-launcher.mjs after the onboarding wizard has populated
  .env — it is not normally run directly by an operator. Performs the
  Windows-native OS-level provisioning step for the profile already
  selected and validated by the launcher: pinned Ollama install with
  loopback-only binding under a dedicated low-privilege local account,
  approved model pulls (onprem) or offline bundle load (airgap), and
  starting the CS3 ESOC Console container.

.PARAMETER Profile
  Required. One of: cloud, onprem, airgap.

.PARAMETER Bundle
  Required for -Profile airgap. Path to a pre-verified model bundle.

.EXAMPLE
  install.ps1 -Profile onprem
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('cloud', 'onprem', 'airgap')]
  [string]$Profile,

  [Parameter(Mandatory = $false)]
  [string]$Bundle
)

$ErrorActionPreference = 'Stop'

# Pin the exact Ollama release qualified for this CS3 release (2026 release with
# Gemma-4 / Nemotron-3-Nano support). Keep in lockstep with OLLAMA_PINNED_VERSION
# in scripts/install-ollama.sh.
$OllamaPinnedVersion = '0.40.5'
$ServiceAccount = 'cs3-ollama'
$ServiceName = 'cs3-ollama'
$OllamaBindAddr = '127.0.0.1:11434'
$OllamaHome = Join-Path $env:ProgramData 'CS3\ollama'
$ModelsTarget = Join-Path $OllamaHome 'models'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Log {
  param([string]$Message)
  Write-Host "[install.ps1] $Message"
}

function Write-WarnLog {
  param([string]$Message)
  Write-Warning "[install.ps1] $Message"
}

function Write-FailClosed {
  param([string]$Message)
  Write-Error "[install.ps1][FAIL] $Message"
  exit 1
}

$envPath = Join-Path $RepoRoot '.env'
if (-not (Test-Path $envPath)) {
  Write-FailClosed ".env not found. Run cs3-launcher.mjs first so the onboarding wizard can populate it."
}

function Import-DotEnv {
  param([string]$Path)
  $map = @{}
  Get-Content -Path $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq '' -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 0) { return }
    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()
    $map[$key] = $value
  }
  return $map
}

$EnvMap = Import-DotEnv -Path $envPath

function New-RandomPassword {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $rng.Dispose()
  # Base64 plus a fixed suffix guarantees upper/lower/digit/symbol complexity classes.
  return ([Convert]::ToBase64String($bytes) + 'aA1!')
}

function Add-UserRight {
  param([string]$Right, [string]$Account)
  $sid = (New-Object System.Security.Principal.NTAccount($Account)).Translate([System.Security.Principal.SecurityIdentifier]).Value
  $tmp = Join-Path $env:TEMP ('cs3-secpol-' + [System.Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmp -Force | Out-Null
  try {
    $cfg = Join-Path $tmp 'current.inf'
    $db = Join-Path $tmp 'secedit.sdb'
    & secedit.exe /export /cfg $cfg /areas USER_RIGHTS | Out-Null
    $found = $false
    $lines = foreach ($line in (Get-Content -Path $cfg)) {
      if ($line -match ('^' + [regex]::Escape($Right) + '\s*=')) {
        $found = $true
        if ($line -notmatch [regex]::Escape("*$sid")) { "$line,*$sid" } else { $line }
      } else {
        $line
      }
    }
    if (-not $found) {
      $lines = foreach ($line in $lines) {
        $line
        if ($line -match '^\[Privilege Rights\]\s*$') { "$Right = *$sid" }
      }
    }
    Set-Content -Path $cfg -Value $lines -Encoding Unicode
    & secedit.exe /configure /db $db /cfg $cfg /areas USER_RIGHTS | Out-Null
  } finally {
    Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# Script-scoped: a fresh random password is generated on every run and only held in memory;
# it is handed to the Windows service registration and never written to disk.
$script:ServicePassword = $null

function Initialize-ServiceAccount {
  $script:ServicePassword = New-RandomPassword
  $secure = ConvertTo-SecureString -String $script:ServicePassword -AsPlainText -Force
  $existing = Get-LocalUser -Name $ServiceAccount -ErrorAction SilentlyContinue
  if ($null -eq $existing) {
    Write-Log "Creating dedicated, low-privilege local account: $ServiceAccount"
    # The account never logs on interactively. It needs a (random, never-stored) password because
    # Windows refuses service logons for blank-password accounts.
    New-LocalUser -Name $ServiceAccount -Password $secure -AccountNeverExpires -PasswordNeverExpires `
      -UserMayNotChangePassword -Description 'CS3 dedicated Ollama service account (non-interactive, least-privilege).' | Out-Null
    # Standard Users group only — never add this account to Administrators.
    Add-LocalGroupMember -Group 'Users' -Member $ServiceAccount -ErrorAction SilentlyContinue | Out-Null
  } else {
    Write-Log "Service account $ServiceAccount already exists — rotating its password (idempotent)."
    Set-LocalUser -Name $ServiceAccount -Password $secure
  }
  # Least privilege: may log on as a service, may never log on interactively / over the network.
  Add-UserRight -Right 'SeServiceLogonRight' -Account $ServiceAccount
  Add-UserRight -Right 'SeDenyInteractiveLogonRight' -Account $ServiceAccount
  Add-UserRight -Right 'SeDenyNetworkLogonRight' -Account $ServiceAccount
}

function Install-OllamaBinary {
  param([string]$OfflineBinary)

  $installed = Get-Command ollama -ErrorAction SilentlyContinue
  if ($installed) {
    $versionOutput = & ollama --version 2>$null
    if ($versionOutput -match [regex]::Escape($OllamaPinnedVersion)) {
      Write-Log "Ollama $OllamaPinnedVersion already installed — skipping (idempotent)."
      return
    }
  }

  if ($OfflineBinary) {
    if (-not (Test-Path $OfflineBinary)) {
      Write-FailClosed "Offline Ollama binary not found: $OfflineBinary"
    }
    Write-Log "Installing Ollama from offline binary (no network access): $OfflineBinary"
    $destDir = "$env:ProgramFiles\CS3\ollama"
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    Copy-Item -Path $OfflineBinary -Destination (Join-Path $destDir 'ollama.exe') -Force
    [Environment]::SetEnvironmentVariable('PATH', "$env:PATH;$destDir", 'Machine')
    return
  }

  if ($Profile -eq 'airgap') {
    Write-FailClosed "Profile is 'airgap' but no offline binary was provided (-Bundle must contain bin/ollama.exe). Refusing to fetch from the network."
  }

  Write-Log "Installing Ollama $OllamaPinnedVersion via winget (pinned version)..."
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    Write-FailClosed "winget was not found. Install Ollama $OllamaPinnedVersion manually from https://ollama.com/download and re-run."
  }
  & winget install --id Ollama.Ollama --version $OllamaPinnedVersion --silent --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) {
    Write-FailClosed "winget install of Ollama $OllamaPinnedVersion failed with exit code $LASTEXITCODE."
  }
}

function Set-LoopbackOnlyBinding {
  # Ollama on Windows reads OLLAMA_HOST from the environment; pin it to
  # loopback at the machine scope so the server never binds a routable
  # interface, matching the systemd/launchd hardening on Linux/macOS.
  [Environment]::SetEnvironmentVariable('OLLAMA_HOST', $OllamaBindAddr, 'Machine')
  $env:OLLAMA_HOST = $OllamaBindAddr
  Write-Log "OLLAMA_HOST pinned to $OllamaBindAddr (loopback only)."
}

function Set-OllamaModelsPath {
  # Ollama on Windows reads OLLAMA_MODELS from the environment. Without this the service account would
  # fall back to its own (non-existent) profile and the models pulled/loaded below would never be found.
  New-Item -ItemType Directory -Path $ModelsTarget -Force | Out-Null
  [Environment]::SetEnvironmentVariable('OLLAMA_MODELS', $ModelsTarget, 'Machine')
  $env:OLLAMA_MODELS = $ModelsTarget
  Write-Log "OLLAMA_MODELS set to $ModelsTarget (machine scope)."
}

function Grant-ServiceAccountDataAccess {
  # Only the service account (plus SYSTEM/Administrators) may read or write the model store.
  & icacls.exe $OllamaHome /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" "${ServiceAccount}:(OI)(CI)M" /T /C | Out-Null
}

function Find-Nssm {
  param([string]$OfflineNssm)
  if ($OfflineNssm -and (Test-Path $OfflineNssm)) {
    $destDir = "$env:ProgramFiles\CS3\ollama"
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    Copy-Item -Path $OfflineNssm -Destination (Join-Path $destDir 'nssm.exe') -Force
    return (Join-Path $destDir 'nssm.exe')
  }
  $cmd = Get-Command nssm -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  if ($Profile -ne 'airgap') {
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
      Write-Log 'Installing NSSM (service wrapper for ollama serve) via winget...'
      & winget install --id NSSM.NSSM --silent --accept-package-agreements --accept-source-agreements
      $machinePath = [Environment]::GetEnvironmentVariable('PATH', 'Machine')
      $env:PATH = "$machinePath;$env:PATH"
      $cmd = Get-Command nssm -ErrorAction SilentlyContinue
      if ($cmd) { return $cmd.Source }
    }
  }
  return $null
}

function Register-OllamaService {
  param([string]$OfflineNssm)

  $ollamaExe = (Get-Command ollama -ErrorAction SilentlyContinue).Source
  if (-not $ollamaExe) {
    $candidate = Join-Path "$env:ProgramFiles\CS3\ollama" 'ollama.exe'
    if (Test-Path $candidate) { $ollamaExe = $candidate }
  }
  if (-not $ollamaExe) {
    Write-FailClosed 'ollama.exe not found; cannot register the cs3-ollama Windows service.'
  }
  if (-not $script:ServicePassword) {
    Write-FailClosed 'Service account password is unavailable; Initialize-ServiceAccount must run first.'
  }

  # ollama.exe is not a native Windows service binary (it never answers the Service Control Manager),
  # so it is hosted by NSSM, which runs `ollama serve` under the cs3-ollama account.
  $nssm = Find-Nssm -OfflineNssm $OfflineNssm
  if (-not $nssm) {
    Write-FailClosed "NSSM was not found. Install it (winget install NSSM.NSSM; airgap: include bin\nssm.exe in the bundle) and re-run."
  }

  # The Ollama desktop app (installed by winget) auto-starts its own server on 11434; stop it so the
  # hardened service owns the port.
  Get-Process -Name 'ollama app', 'ollama' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

  Grant-ServiceAccountDataAccess

  $logDir = Join-Path $OllamaHome 'logs'
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null

  $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Log "Service $ServiceName already registered — updating its configuration (idempotent)."
    if ($existing.Status -ne 'Stopped') { & $nssm stop $ServiceName confirm | Out-Null }
    & $nssm set $ServiceName Application $ollamaExe | Out-Null
    & $nssm set $ServiceName AppParameters 'serve' | Out-Null
  } else {
    Write-Log "Registering Windows service $ServiceName (ollama serve) under account $ServiceAccount..."
    & $nssm install $ServiceName $ollamaExe 'serve' | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-FailClosed "nssm install failed with exit code $LASTEXITCODE." }
  }

  & $nssm set $ServiceName DisplayName 'CS3 Ollama (loopback-only)' | Out-Null
  & $nssm set $ServiceName Description 'CS3 local LLM runtime: ollama serve bound to loopback under the cs3-ollama service account.' | Out-Null
  & $nssm set $ServiceName Start SERVICE_AUTO_START | Out-Null
  & $nssm set $ServiceName ObjectName ".\$ServiceAccount" $script:ServicePassword | Out-Null
  & $nssm set $ServiceName AppDirectory $OllamaHome | Out-Null
  & $nssm set $ServiceName AppEnvironmentExtra "OLLAMA_HOST=$OllamaBindAddr" "OLLAMA_MODELS=$ModelsTarget" "HOME=$OllamaHome" "USERPROFILE=$OllamaHome" | Out-Null
  & $nssm set $ServiceName AppStdout (Join-Path $logDir 'cs3-ollama.log') | Out-Null
  & $nssm set $ServiceName AppStderr (Join-Path $logDir 'cs3-ollama.err.log') | Out-Null
  & $nssm set $ServiceName AppExit Default Restart | Out-Null
  & $nssm set $ServiceName AppRestartDelay 5000 | Out-Null

  & $nssm start $ServiceName | Out-Null
  $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if (-not $svc -or $svc.Status -ne 'Running') {
    Write-FailClosed "Service $ServiceName did not reach the Running state; see $logDir for details."
  }
  Write-Log "Service $ServiceName is running, bound to $OllamaBindAddr under $ServiceAccount."
}

function Start-SocConsole {
  $image = $EnvMap['CS3_CONSOLE_IMAGE']
  $port = $EnvMap['CS3_CONSOLE_PORT']
  if (-not $port) { $port = '3000' }
  if (-not $image) {
    Write-WarnLog "CS3_CONSOLE_IMAGE not set in .env; skipping ESOC Console container start."
    return
  }

  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $docker) {
    Write-WarnLog "docker not found on PATH. Skipping ESOC Console container start. Install Docker Desktop and run manually:"
    Write-WarnLog "  docker run -d --name cs3-soc-console --env-file .env -p ${port}:3000 --add-host=host.docker.internal:host-gateway -e OLLAMA_BASE_URL=http://host.docker.internal:11434/v1 $image"
    return
  }

  & docker inspect cs3-soc-console *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Log "cs3-soc-console container already exists — restarting (idempotent)."
    & docker rm -f cs3-soc-console *> $null
  }

  if ($Profile -eq 'airgap') {
    & docker image inspect $image *> $null
    if ($LASTEXITCODE -ne 0) {
      Write-WarnLog "Image $image is not present locally. Load it with 'docker load -i <offline-image.tar>' from the verified bundle before this step."
    }
  }

  if ($Profile -ne 'airgap') {
    & docker image inspect $image *> $null
    if ($LASTEXITCODE -ne 0) {
      Write-Log "Image $image not found locally - trying registry pull, then local build from demo/demo-100226."
      & docker pull $image *> $null
      if ($LASTEXITCODE -ne 0) {
        & docker build -t $image (Join-Path $PSScriptRoot 'demo\demo-100226')
        if ($LASTEXITCODE -ne 0) { Write-WarnLog "Could not pull or build $image." }
      }
    }
  }

  # Docker Desktop runs containers in a VM, so the container's 127.0.0.1 is not the Windows host.
  # Ollama stays loopback-bound on the host (Set-LoopbackOnlyBinding); Docker Desktop forwards
  # host.docker.internal to the host's loopback, so point the console there on onprem/airgap.
  $dockerArgs = @('run', '-d', '--name', 'cs3-soc-console', '--env-file', "$envPath", '-p', "${port}:3000")
  if ($Profile -ne 'cloud') {
    $dockerArgs += @('--add-host=host.docker.internal:host-gateway', '-e', 'OLLAMA_BASE_URL=http://host.docker.internal:11434/v1')
  }
  Write-Log "Starting CS3 ESOC Console container ($image) on port $port..."
  & docker @dockerArgs $image
  if ($LASTEXITCODE -ne 0) {
    Write-WarnLog "Failed to start ESOC Console container; see docker logs for details."
  }
}

function Install-OnpremOllamaAndModel {
  Initialize-ServiceAccount
  Install-OllamaBinary -OfflineBinary $null
  Set-LoopbackOnlyBinding
  Set-OllamaModelsPath
  Register-OllamaService -OfflineNssm $null

  $ollama = Get-Command ollama -ErrorAction SilentlyContinue
  if ($ollama) {
    foreach ($model in @($EnvMap['OLLAMA_PRIMARY_MODEL'], $EnvMap['OLLAMA_FALLBACK_MODEL'])) {
      if ([string]::IsNullOrWhiteSpace($model)) { continue }
      Write-Log "Pulling approved model tag: $model"
      & ollama pull $model
      if ($LASTEXITCODE -ne 0) {
        Write-WarnLog "Failed to pull $model — confirm registry access and the tag in onboarding/models.json."
      }
    }
  } else {
    Write-WarnLog "ollama.exe not found after install step; skipping model pull."
  }
}

function Install-AirgapOllamaAndModel {
  if (-not $Bundle) {
    Write-FailClosed "airgap profile requires -Bundle <path>; this should already be guaranteed by cs3-launcher.mjs."
  }
  if ([string]::IsNullOrWhiteSpace($EnvMap['CS3_AIRGAP_BUNDLE_SHA256'])) {
    Write-FailClosed "CS3_AIRGAP_BUNDLE_SHA256 missing from .env; refusing to load an unverified bundle."
  }

  Write-Log "Extracting verified bundle (no registry pull will be attempted): $Bundle"
  $stagingDir = Join-Path $env:TEMP ("cs3-airgap-" + [System.Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null
  tar -xf $Bundle -C $stagingDir

  $offlineBinary = $null
  $candidateBinary = Join-Path $stagingDir 'bin\ollama.exe'
  if (Test-Path $candidateBinary) { $offlineBinary = $candidateBinary }

  $offlineNssm = $null
  $candidateNssm = Join-Path $stagingDir 'bin\nssm.exe'
  if (Test-Path $candidateNssm) { $offlineNssm = $candidateNssm }

  Initialize-ServiceAccount
  Install-OllamaBinary -OfflineBinary $offlineBinary
  Set-LoopbackOnlyBinding
  Set-OllamaModelsPath

  $imagesSource = Join-Path $stagingDir 'images'
  if ((Test-Path $imagesSource) -and (Get-Command docker -ErrorAction SilentlyContinue)) {
    Get-ChildItem -Path $imagesSource -Filter '*.tar' | ForEach-Object {
      Write-Log "Loading offline console image: $($_.FullName)"
      & docker load -i $_.FullName
    }
  }

  $modelsSource = Join-Path $stagingDir 'models'
  if (Test-Path $modelsSource) {
    Write-Log "Loading models directly into the local Ollama store from the bundle (no registry pull): $ModelsTarget"
    New-Item -ItemType Directory -Path $ModelsTarget -Force | Out-Null
    Copy-Item -Path (Join-Path $modelsSource '*') -Destination $ModelsTarget -Recurse -Force
  } else {
    Write-WarnLog "Bundle did not contain a models directory; nothing to load."
  }

  # Register/start the service after the models are in place so it opens a complete store.
  Register-OllamaService -OfflineNssm $offlineNssm

  Remove-Item -Path $stagingDir -Recurse -Force -ErrorAction SilentlyContinue

  if ($EnvMap['CS3_TELEMETRY_ENABLED'] -ne 'false' -or $EnvMap['CS3_UPDATE_CHECK_ENABLED'] -ne 'false') {
    Write-FailClosed "Telemetry/update checks must be disabled on the airgap profile (.env). Refusing to proceed."
  }
  Write-Log "Telemetry and update checks confirmed disabled for this airgap install."
}

switch ($Profile) {
  'cloud' {
    Start-SocConsole
  }
  'onprem' {
    Install-OnpremOllamaAndModel
    Start-SocConsole
  }
  'airgap' {
    Install-AirgapOllamaAndModel
    Start-SocConsole
  }
}

Write-Log "Windows installer finished for profile: $Profile"
