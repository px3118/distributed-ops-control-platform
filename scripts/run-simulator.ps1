Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Running deterministic simulator against API..."
docker compose run --rm api npm run db:migrate
npm run start --workspace apps/simulator
Write-Host "Simulator run complete. Inspect dashboard and reconciliation views."