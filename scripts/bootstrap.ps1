param(
  [switch]$Build
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Starting local dependencies..."
docker compose up -d postgres

Write-Host "Running API migration..."
docker compose run --rm api npm run db:migrate

Write-Host "Seeding operational sample data..."
docker compose run --rm api npm run seed

if ($Build) {
  Write-Host "Building apps..."
  docker compose run --rm api npm run build
  docker compose run --rm web npm run build
}

Write-Host "Bringing up API and Web..."
docker compose up -d api web

Write-Host "Done. UI: http://localhost:3000 API: http://localhost:4000/health"
