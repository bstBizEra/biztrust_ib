$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$dataRoot = Join-Path $projectRoot '.data'
$clusterPath = Join-Path $dataRoot 'postgres'
$pgBinary = 'C:\laragon\bin\postgresql\postgresql-17.10\bin'
if (!(Test-Path -LiteralPath (Join-Path $pgBinary 'initdb.exe'))) { throw 'PostgreSQL 17 tools not found. Configure DATABASE_URL and DATABASE_ADMIN_URL for an isolated database instead.' }
New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
if (!(Test-Path -LiteralPath (Join-Path $clusterPath 'PG_VERSION'))) {
  $passwordFile = Join-Path $dataRoot 'bootstrap-password'
  & (Join-Path $pgBinary 'initdb.exe') -D $clusterPath -U postgres --auth-local=trust --auth-host=scram-sha-256 --encoding=UTF8 --no-locale --pwfile $passwordFile
  if ($LASTEXITCODE -ne 0) { throw 'Run npm run db:local after preparing bootstrap credentials with scripts/setup-local.ts.' }
}
& (Join-Path $pgBinary 'pg_ctl.exe') -D $clusterPath status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  $startArgs = '-D "' + $clusterPath + '" -l "' + (Join-Path $dataRoot 'postgres.log') + '" -o "-h 127.0.0.1 -p 15432" -w start'
  $process = Start-Process -FilePath (Join-Path $pgBinary 'pg_ctl.exe') -ArgumentList $startArgs -WindowStyle Hidden -PassThru
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw 'Isolated PostgreSQL did not start; inspect .data/postgres.log.' }
}
Write-Output 'BizTrust development PostgreSQL available at 127.0.0.1:15432.'
