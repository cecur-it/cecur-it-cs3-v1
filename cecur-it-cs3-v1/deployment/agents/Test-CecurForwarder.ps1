<#
.SYNOPSIS
  Health check for the Cecur CS3 Windows forwarder; with -Remediate performs bounded auto-remediation.

.DESCRIPTION
  Exit 0 = healthy, 1 = degraded (reported), 2 = remediation attempted/exhausted.
  Mirrors cs3-forwarder-watchdog.sh: service state -> local health endpoint -> restart budget.
  Console reachability, buffer size and certificate expiry are reported, never "fixed" by restarts.
  Findings go to the Application event log (source CecurForwarder) so the SIEM can alert on them.
#>
[CmdletBinding()]
param(
  [switch]$Remediate,
  [int]$MaxRestartsPerHour = 5,
  [int]$FailThreshold = 3,
  [int]$BufferWarnMB = 3072,
  [int]$CertWarnDays = 14,
  [string]$DataDir = (Join-Path $env:ProgramData 'CecurForwarder')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'
$Service = 'CecurForwarder'
$StateFile = Join-Path $DataDir 'watchdog-state.json'
$exit = 0

if (-not [System.Diagnostics.EventLog]::SourceExists('CecurForwarder')) {
  New-EventLog -LogName Application -Source CecurForwarder -ErrorAction SilentlyContinue
}
function Say([string]$level, [string]$msg, [int]$id = 4100) {
  $type = switch ($level) { 'crit' { 'Error' } 'warning' { 'Warning' } default { 'Information' } }
  Write-EventLog -LogName Application -Source CecurForwarder -EventId $id -EntryType $type -Message $msg -ErrorAction SilentlyContinue
  Write-Output "[$level] $msg"
}

$state = [pscustomobject]@{ fails = 0; restarts = @() }
if (Test-Path $StateFile) {
  try { $state = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json } catch { }
}
$cutoff = [DateTimeOffset]::UtcNow.AddHours(-1).ToUnixTimeSeconds()
$recent = @($state.restarts | Where-Object { $_ -ge $cutoff })

function Invoke-Remediation([string]$reason) {
  if (-not $Remediate) { Say 'warning' "unhealthy ($reason); -Remediate not set"; $script:exit = 1; return }
  if ($recent.Count -ge $MaxRestartsPerHour) {
    Say 'crit' "restart budget exhausted ($($recent.Count)/h); manual intervention needed. Reason: $reason" 4102
    $script:exit = 2; return
  }
  Say 'warning' "restarting ${Service}: $reason" 4101
  Restart-Service $Service -Force
  $script:recent = @($script:recent + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds())
  $script:exit = 2
}

$svc = Get-Service $Service -ErrorAction SilentlyContinue
if (-not $svc) { Say 'crit' 'service not installed' 4103; exit 1 }

if ($svc.Status -ne 'Running') {
  Invoke-Remediation 'service not running'
} else {
  try {
    Invoke-RestMethod -Uri 'http://127.0.0.1:2020/api/v1/health' -TimeoutSec 5 | Out-Null
    $state.fails = 0
  } catch {
    $state.fails = [int]$state.fails + 1
    Say 'notice' "health check failed ($($state.fails)/$FailThreshold)"
    if ($state.fails -ge $FailThreshold) { $state.fails = 0; Invoke-Remediation 'health endpoint failing' }
  }
}

# Report-only checks.
$agentFile = Join-Path $DataDir 'agent.json'
if (Test-Path $agentFile) {
  $a = Get-Content -LiteralPath $agentFile -Raw | ConvertFrom-Json
  if (-not (Test-NetConnection -ComputerName $a.host -Port $a.port -WarningAction SilentlyContinue).TcpTestSucceeded) {
    Say 'warning' "console $($a.host):$($a.port) unreachable; events are buffering on disk"
    if ($exit -eq 0) { $exit = 1 }
  }
}
$buf = Join-Path $DataDir 'buffer'
if (Test-Path $buf) {
  $mb = [int]((Get-ChildItem $buf -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB)
  if ($mb -gt $BufferWarnMB) { Say 'warning' "buffer is ${mb}MB (> ${BufferWarnMB}MB): console backpressure or prolonged outage"; if ($exit -eq 0) { $exit = 1 } }
}
foreach ($f in @('pki\ca.pem', 'pki\agent.crt')) {
  $p = Join-Path $DataDir $f
  if (Test-Path $p) {
    try {
      $c = [Security.Cryptography.X509Certificates.X509Certificate2]::new($p)
      if ($c.NotAfter -lt (Get-Date).AddDays($CertWarnDays)) {
        Say 'warning' "certificate $f expires $($c.NotAfter.ToString('s')); rotate per operations/certificate-rotation.md"
        if ($exit -eq 0) { $exit = 1 }
      }
    } catch { Say 'warning' "certificate $f is unreadable" }
  }
}

$state.restarts = $recent
try { $state | ConvertTo-Json | Set-Content -LiteralPath $StateFile -Encoding ASCII } catch { }
exit $exit
