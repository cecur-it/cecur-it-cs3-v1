#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Installs and enrolls the Cecur CS3 Windows log forwarder (Fluent Bit + watchdog task).

.DESCRIPTION
  1. Verifies and unpacks a locally supplied Fluent Bit Windows ZIP (air-gap friendly; SHA-256 checked).
  2. Redeems the one-time enrollment token at /api/fleet/enroll/claim (TLS trust via -CaFile,
     optional SPKI pin via -PinSha256) and receives a per-agent ingest key.
  3. Renders the config into a data directory ACL'd to SYSTEM + Administrators only.
  4. Registers the "CecurForwarder" service (auto-restart) and the "CecurForwarderWatchdog"
     scheduled task (runs Test-CecurForwarder.ps1 -Remediate every minute).

  Re-running without a token keeps existing credentials (idempotent upgrade of config/watchdog).

.EXAMPLE
  $t = Read-Host -AsSecureString 'Enrollment token'
  .\Install-CecurForwarder.ps1 -ConsoleUrl https://cs3.example.internal -AgentId cecur-ag-ab12cd34 `
      -EnrollmentToken $t -CaFile .\internal-ca.pem -FluentBitZip .\fluent-bit-3.1.9-win64.zip `
      -FluentBitSha256 <hex>

.EXAMPLE
  .\Install-CecurForwarder.ps1 -Uninstall
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$ConsoleUrl,
  [string]$AgentId,
  [securestring]$EnrollmentToken,
  [string]$TokenFile,
  [string]$CaFile,
  [ValidatePattern('^[A-Za-z0-9+/=]{44}$')]
  [string]$PinSha256,
  [string]$FluentBitZip,
  [string]$FluentBitSha256,
  [switch]$NoRevocationCheck,
  [switch]$Uninstall,
  [string]$InstallDir = (Join-Path $env:ProgramFiles 'CecurForwarder'),
  [string]$DataDir = (Join-Path $env:ProgramData 'CecurForwarder')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ServiceName = 'CecurForwarder'
$TaskName = 'CecurForwarderWatchdog'
$SrcDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Log([string]$m) { Write-Host "[cecur-forwarder] $m" }

function Protect-Directory([string]$Path) {
  # Well-known SIDs keep this locale-independent: S-1-5-18 = SYSTEM, S-1-5-32-544 = Administrators.
  & icacls.exe $Path /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "icacls failed on $Path" }
}

function ConvertTo-PlainText([securestring]$Secure) {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

# ---------------------------------------------------------------------------------------- uninstall
if ($Uninstall) {
  if ($PSCmdlet.ShouldProcess($ServiceName, 'Remove forwarder')) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    if (Get-Service $ServiceName -ErrorAction SilentlyContinue) {
      Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue
      & sc.exe delete $ServiceName | Out-Null
    }
    Remove-Item $InstallDir, $DataDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Log 'removed'
  }
  return
}

# ------------------------------------------------------------------------------------------ validate
if (-not $ConsoleUrl) { throw '-ConsoleUrl is required' }
$uri = [Uri]$ConsoleUrl
if ($uri.Scheme -ne 'https') { throw 'Console URL must be https:// (plaintext HTTP is refused)' }
$base = '{0}://{1}:{2}' -f $uri.Scheme, $uri.Host, $uri.Port
$confPath = Join-Path $DataDir 'fluent-bit.conf'
$envPath = Join-Path $DataDir 'agent.json'

$curl = Get-Command curl.exe -ErrorAction SilentlyContinue
if (-not $curl) { throw 'curl.exe (Windows 10 1803+ / Server 2019+) is required for the enrollment claim.' }

# ----------------------------------------------------------------------------------------- directories
foreach ($d in @($InstallDir, $DataDir, (Join-Path $DataDir 'buffer'), (Join-Path $DataDir 'pki'))) {
  New-Item -ItemType Directory -Path $d -Force | Out-Null
}
Protect-Directory $DataDir

$caDest = Join-Path $DataDir 'pki\ca.pem'
if ($CaFile) { Copy-Item -LiteralPath $CaFile -Destination $caDest -Force }

# ------------------------------------------------------------------------------------------ Fluent Bit
$fbExe = Join-Path $InstallDir 'fluent-bit\bin\fluent-bit.exe'
if (-not (Test-Path $fbExe)) {
  if (-not $FluentBitZip) { throw 'Fluent Bit is not installed; supply -FluentBitZip (and -FluentBitSha256).' }
  if ($FluentBitSha256) {
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $FluentBitZip).Hash
    if ($actual -ne $FluentBitSha256.ToUpperInvariant()) { throw "Fluent Bit ZIP checksum mismatch (got $actual)" }
  } else {
    Write-Warning '-FluentBitSha256 not supplied: package integrity is NOT verified.'
  }
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ("cecur-fb-" + [guid]::NewGuid())
  Expand-Archive -LiteralPath $FluentBitZip -DestinationPath $tmp
  $root = Get-ChildItem $tmp -Directory | Select-Object -First 1
  Move-Item -LiteralPath $root.FullName -Destination (Join-Path $InstallDir 'fluent-bit')
  Remove-Item $tmp -Recurse -Force
  if (-not (Test-Path $fbExe)) { throw 'fluent-bit.exe not found after extraction' }
}

# --------------------------------------------------------------------------------------------- enroll
$token = $null
if ($EnrollmentToken) { $token = ConvertTo-PlainText $EnrollmentToken }
elseif ($TokenFile) { $token = (Get-Content -LiteralPath $TokenFile -Raw).Trim() }
elseif ($env:CS3_ENROLL_TOKEN) { $token = $env:CS3_ENROLL_TOKEN }

if ($token) {
  if (-not $AgentId -or $AgentId -notmatch '^[A-Za-z0-9._-]{1,64}$') { throw '-AgentId is required and must match [A-Za-z0-9._-]{1,64}' }
  if ($token -notmatch '^[A-Za-z0-9._~+/=-]{8,128}$') { throw 'Enrollment token has unexpected characters' }
  Write-Log "claiming enrollment for $AgentId"
  $curlArgs = @('-fsS', '--max-time', '30', '--proto', '=https', '--tlsv1.2', '-X', 'POST',
            '-H', 'Content-Type: application/json', '--data', '@-')
  if (Test-Path $caDest) { $curlArgs += @('--cacert', $caDest) }
  if ($PinSha256) { $curlArgs += @('--pinnedpubkey', "sha256//$PinSha256") }
  if ($NoRevocationCheck) { $curlArgs += '--ssl-no-revoke' }
  # Token travels via stdin, not the command line (visible in process listings / 4688 events).
  $body = '{"agentId":"' + $AgentId + '","token":"' + $token + '"}'
  $resp = $body | & curl.exe @curlArgs "$base/api/fleet/enroll/claim"
  if ($LASTEXITCODE -ne 0) { throw 'Enrollment claim failed (expired/used token, TLS trust or pin mismatch?)' }
  $token = $null; $body = $null
  $claim = ($resp -join '') | ConvertFrom-Json
  if (-not $claim.ingestKey) { throw 'Console response did not include an ingest key' }
  [pscustomobject]@{
    host = $uri.Host; port = $uri.Port; agentId = $claim.agentId; ingestKey = $claim.ingestKey
    hostname = $env:COMPUTERNAME; pin = $PinSha256
  } | ConvertTo-Json | Set-Content -LiteralPath $envPath -Encoding ASCII
}
elseif (-not (Test-Path $envPath)) {
  throw 'No enrollment token (-EnrollmentToken / -TokenFile / CS3_ENROLL_TOKEN) and no existing credentials.'
}
$cfg = Get-Content -LiteralPath $envPath -Raw | ConvertFrom-Json

# ------------------------------------------------------------------------------------------ config
$tpl = Get-Content -LiteralPath (Join-Path $SrcDir 'templates\fluent-bit-windows.conf') -Raw
$caForConf = if (Test-Path $caDest) { $caDest } else { '' }
$map = @{
  '@@DATA_DIR@@' = $DataDir; '@@HOSTNAME@@' = $cfg.hostname; '@@CS3_HOST@@' = $cfg.host
  '@@CS3_PORT@@' = [string]$cfg.port; '@@CA_FILE@@' = $caForConf; '@@INGEST_KEY@@' = $cfg.ingestKey
}
foreach ($k in $map.Keys) { $tpl = $tpl.Replace($k, $map[$k]) }
if (-not $caForConf) { $tpl = ($tpl -split "`r?`n" | Where-Object { $_ -notmatch '^\s*tls\.ca_file\s' }) -join "`r`n" }  # fall back to the Windows trust store
Set-Content -LiteralPath $confPath -Value $tpl -Encoding ASCII

Copy-Item (Join-Path $SrcDir 'Test-CecurForwarder.ps1') (Join-Path $InstallDir 'Test-CecurForwarder.ps1') -Force

# ----------------------------------------------------------------------------------------- service
$binPath = '"{0}" -c "{1}"' -f $fbExe, $confPath
if (Get-Service $ServiceName -ErrorAction SilentlyContinue) {
  Stop-Service $ServiceName -Force
  & sc.exe config $ServiceName binPath= $binPath start= delayed-auto | Out-Null
} else {
  New-Service -Name $ServiceName -BinaryPathName $binPath -DisplayName 'Cecur CS3 Log Forwarder' `
    -Description 'Forwards Windows event logs to the Cecur CS3 console' -StartupType Automatic | Out-Null
  & sc.exe config $ServiceName start= delayed-auto | Out-Null
}
# Restart after 5s, 30s, 60s; reset the failure counter after a day.
& sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/30000/restart/60000 | Out-Null
Start-Service $ServiceName

# ---------------------------------------------------------------------------------------- watchdog
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument ('-NoProfile -ExecutionPolicy Bypass -File "{0}" -Remediate' -f (Join-Path $InstallDir 'Test-CecurForwarder.ps1'))
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

Start-Sleep -Seconds 3
if ((Get-Service $ServiceName).Status -ne 'Running') { throw "Service $ServiceName failed to start; see the Application event log." }
Write-Log "installed and running (agent $($cfg.agentId))"
