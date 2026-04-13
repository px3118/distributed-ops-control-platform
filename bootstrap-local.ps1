# bootstrap-local.ps1
# Windows PowerShell 5.1 compatible

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Info {
    param([string]$Message)
    Write-Host "    $Message" -ForegroundColor Gray
}

function Fail {
    param(
        [string]$Message,
        [int]$Code = 1
    )

    Write-Host ""
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit $Code
}

function Test-CommandExists {
    param([string]$CommandName)
    return $null -ne (Get-Command $CommandName -ErrorAction SilentlyContinue)
}

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$FriendlyName = $FilePath,
        [switch]$IgnoreExitCode
    )

    Write-Info "$FriendlyName"

    $stdoutFile = [System.IO.Path]::GetTempFileName()
    $stderrFile = [System.IO.Path]::GetTempFileName()

    try {
        $process = Start-Process `
            -FilePath $FilePath `
            -ArgumentList $Arguments `
            -NoNewWindow `
            -Wait `
            -PassThru `
            -RedirectStandardOutput $stdoutFile `
            -RedirectStandardError $stderrFile

        $stdout = ""
        $stderr = ""

        if (Test-Path $stdoutFile) {
            $stdout = Get-Content $stdoutFile -Raw
        }

        if (Test-Path $stderrFile) {
            $stderr = Get-Content $stderrFile -Raw
        }

        if (-not [string]::IsNullOrWhiteSpace($stdout)) {
            Write-Host $stdout.TrimEnd()
        }

        if (-not [string]::IsNullOrWhiteSpace($stderr)) {
            Write-Host $stderr.TrimEnd() -ForegroundColor Yellow
        }

        if (-not $IgnoreExitCode -and $process.ExitCode -ne 0) {
            throw "$FriendlyName failed with exit code $($process.ExitCode)."
        }

        return @{
            ExitCode = $process.ExitCode
            StdOut   = $stdout
            StdErr   = $stderr
        }
    }
    finally {
        Remove-Item $stdoutFile -Force -ErrorAction SilentlyContinue
        Remove-Item $stderrFile -Force -ErrorAction SilentlyContinue
    }
}

function Get-NpmCmdPath {
    $npmCmd = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
    if ($npmCmd) {
        return $npmCmd.Source
    }

    $npm = Get-Command "npm" -ErrorAction SilentlyContinue
    if ($npm) {
        return $npm.Source
    }

    Fail "npm was not found in PATH."
}

function Get-DockerComposeCommand {
    if (Test-CommandExists "docker") {
        try {
            $result = Invoke-NativeCommand -FilePath "docker" -Arguments @("compose", "version") -FriendlyName "docker compose version" -IgnoreExitCode
            if ($result.ExitCode -eq 0) {
                return @("docker", "compose")
            }
        }
        catch {
        }
    }

    if (Test-CommandExists "docker-compose") {
        return @("docker-compose")
    }

    return $null
}

function Convert-JsonObjectToHashtable {
    param([Parameter(Mandatory = $true)]$InputObject)

    if ($null -eq $InputObject) {
        return $null
    }

    if ($InputObject -is [System.Collections.IDictionary]) {
        $hash = @{}
        foreach ($key in $InputObject.Keys) {
            $hash[$key] = Convert-JsonObjectToHashtable $InputObject[$key]
        }
        return $hash
    }

    if (($InputObject -is [System.Collections.IEnumerable]) -and -not ($InputObject -is [string])) {
        $list = @()
        foreach ($item in $InputObject) {
            $list += ,(Convert-JsonObjectToHashtable $item)
        }
        return $list
    }

    if ($InputObject -is [psobject]) {
        $props = @($InputObject.PSObject.Properties)
        if ($props.Length -gt 0) {
            $hash = @{}
            foreach ($prop in $props) {
                $hash[$prop.Name] = Convert-JsonObjectToHashtable $prop.Value
            }
            return $hash
        }
    }

    return $InputObject
}

function Read-PackageJson {
    param([string]$Path = "package.json")

    if (-not (Test-Path $Path)) {
        Fail "package.json was not found in $(Get-Location)."
    }

    try {
        $json = Get-Content $Path -Raw | ConvertFrom-Json
        return Convert-JsonObjectToHashtable $json
    }
    catch {
        Fail "Failed to parse package.json. $($_.Exception.Message)"
    }
}

function Get-PackageVersion {
    param(
        [hashtable]$PackageJson,
        [string]$PackageName
    )

    foreach ($section in @("dependencies", "devDependencies", "optionalDependencies")) {
        if ($PackageJson.ContainsKey($section)) {
            $group = $PackageJson[$section]
            if (($group -is [hashtable]) -and $group.ContainsKey($PackageName)) {
                return [string]$group[$PackageName]
            }
        }
    }

    return $null
}

function Ensure-EnvFile {
    if (Test-Path ".env") {
        Write-Info ".env already exists"
        return
    }

    foreach ($candidate in @(".env.local.example", ".env.example", ".env.sample")) {
        if (Test-Path $candidate) {
            Copy-Item $candidate ".env"
            Write-Info "Created .env from $candidate"
            return
        }
    }

    New-Item -ItemType File -Path ".env" -Force | Out-Null
    Write-Info "Created blank .env"
}

function Ensure-NextPatchedIfNeeded {
    param([string]$NpmCmd)

    $pkg = Read-PackageJson
    $nextVersion = Get-PackageVersion -PackageJson $pkg -PackageName "next"

    if ([string]::IsNullOrWhiteSpace($nextVersion)) {
        Write-Info "No Next.js dependency found"
        return
    }

    Write-Info "Detected next version spec: $nextVersion"

    if ($nextVersion -match '15\.5\.2') {
        Write-Host "    Patching next from 15.5.2 to 15.5.7" -ForegroundColor Yellow
        $null = Invoke-NativeCommand -FilePath $NpmCmd -Arguments @("install", "next@15.5.7") -FriendlyName "npm install next@15.5.7"
    }
}

function Install-NpmDependencies {
    param([string]$NpmCmd)

    if (Test-Path "package-lock.json") {
        $null = Invoke-NativeCommand -FilePath $NpmCmd -Arguments @("ci") -FriendlyName "npm ci"
    }
    else {
        $null = Invoke-NativeCommand -FilePath $NpmCmd -Arguments @("install") -FriendlyName "npm install"
    }
}

function Run-NpmScriptIfPresent {
    param(
        [string]$NpmCmd,
        [string]$ScriptName,
        [switch]$Optional
    )

    $pkg = Read-PackageJson
    $scripts = $pkg["scripts"]

    if (($scripts -is [hashtable]) -and $scripts.ContainsKey($ScriptName)) {
        $null = Invoke-NativeCommand -FilePath $NpmCmd -Arguments @("run", $ScriptName) -FriendlyName "npm run $ScriptName"
        return
    }

    if (-not $Optional) {
        Fail "Required npm script '$ScriptName' was not found in package.json."
    }

    Write-Info "npm script '$ScriptName' not present; skipping"
}

function Start-DockerServices {
    $compose = Get-DockerComposeCommand
    if ($null -eq $compose) {
        Write-Info "Docker Compose not available; skipping containers"
        return
    }

    $composeFile = $null
    foreach ($candidate in @("docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml")) {
        if (Test-Path $candidate) {
            $composeFile = $candidate
            break
        }
    }

    if ($null -eq $composeFile) {
        Write-Info "No compose file found; skipping containers"
        return
    }

    if ($compose.Count -eq 2) {
        $null = Invoke-NativeCommand -FilePath $compose[0] -Arguments @($compose[1], "up", "-d", "--build") -FriendlyName "docker compose up"
    }
    else {
        $null = Invoke-NativeCommand -FilePath $compose[0] -Arguments @("up", "-d", "--build") -FriendlyName "docker-compose up"
    }
}

function Run-RepoBootstrapIfPresent {
    param([string]$NpmCmd)

    foreach ($scriptName in @("bootstrap", "db:setup", "migrate", "seed")) {
        Run-NpmScriptIfPresent -NpmCmd $NpmCmd -ScriptName $scriptName -Optional
    }
}

function Show-ToolVersions {
    if (-not (Test-CommandExists "node")) {
        Fail "Node.js is not installed or not in PATH."
    }

    if (-not (Test-CommandExists "npm")) {
        Fail "npm is not installed or not in PATH."
    }

    $null = Invoke-NativeCommand -FilePath "node" -Arguments @("--version") -FriendlyName "node --version"
    $null = Invoke-NativeCommand -FilePath "npm.cmd" -Arguments @("--version") -FriendlyName "npm --version"

    if (Test-CommandExists "docker") {
        $null = Invoke-NativeCommand -FilePath "docker" -Arguments @("--version") -FriendlyName "docker --version" -IgnoreExitCode
    }
    else {
        Write-Info "Docker not found; Docker-based steps may be skipped"
    }
}

try {
    Write-Step "Checking required tools"
    Show-ToolVersions

    $npmCmd = Get-NpmCmdPath

    Write-Step "Preparing environment file"
    Ensure-EnvFile

    Write-Step "Patching vulnerable Next.js version if needed"
    Ensure-NextPatchedIfNeeded -NpmCmd $NpmCmd

    Write-Step "Installing npm dependencies"
    Install-NpmDependencies -NpmCmd $NpmCmd

    Write-Step "Starting Docker services"
    Start-DockerServices

    Write-Step "Running repository bootstrap scripts if present"
    Run-RepoBootstrapIfPresent -NpmCmd $NpmCmd

    Write-Step "Running build"
    Run-NpmScriptIfPresent -NpmCmd $NpmCmd -ScriptName "build" -Optional

    Write-Step "Done"
    Write-Host "Local bootstrap completed successfully." -ForegroundColor Green
}
catch {
    Fail $_.Exception.Message
}