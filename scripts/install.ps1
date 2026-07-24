param(
    [string]$InstallDir = "$env:LOCALAPPDATA\worktrace\bin",
    [string]$SourceUrl = "https://raw.githubusercontent.com/dawidpolakowskicgi/worktrace/main/worktrace.sh",
    [switch]$NoPathUpdate
)

$ErrorActionPreference = "Stop"

function Find-RepoSource {
    if (-not $PSScriptRoot) {
        return $null
    }

    $repoRoot = Split-Path -Parent $PSScriptRoot

    if (-not $repoRoot) {
        return $null
    }

    $candidate = Join-Path $repoRoot "worktrace.sh"

    if (Test-Path -LiteralPath $candidate) {
        return $candidate
    }

    return $null
}

function Find-Bash {
    $candidates = @(
        "$env:ProgramFiles\Git\bin\bash.exe",
        "$env:ProgramFiles\Git\usr\bin\bash.exe",
        "${env:ProgramFiles(x86)}\Git\bin\bash.exe",
        "${env:ProgramFiles(x86)}\Git\usr\bin\bash.exe"
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    }

    $command = Get-Command "bash.exe" -ErrorAction SilentlyContinue

    if ($command) {
        return $command.Source
    }

    return $null
}

function Add-UserPath {
    param([string]$PathToAdd)

    $current = [Environment]::GetEnvironmentVariable("Path", "User")
    $parts = @()

    if ($current) {
        $parts = $current -split ";" | Where-Object { $_ }
    }

    foreach ($part in $parts) {
        $normalizedPart = $part -replace "[\\/]+$", ""
        $normalizedPathToAdd = $PathToAdd -replace "[\\/]+$", ""

        if ($normalizedPart -ieq $normalizedPathToAdd) {
            return $false
        }
    }

    $updatedParts = @($parts + $PathToAdd)
    [Environment]::SetEnvironmentVariable("Path", ($updatedParts -join ";"), "User")
    return $true
}

if (-not $InstallDir) {
    throw "InstallDir cannot be empty."
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

$worktraceScript = Join-Path $InstallDir "worktrace.sh"
$worktraceCmd = Join-Path $InstallDir "worktrace.cmd"
$repoSource = Find-RepoSource

if ($repoSource) {
    Copy-Item -LiteralPath $repoSource -Destination $worktraceScript -Force
} else {
    Invoke-WebRequest -Uri $SourceUrl -OutFile $worktraceScript
}

$cmdContent = @'
@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "BASH_EXE="

if not defined BASH_EXE if exist "%ProgramFiles%\Git\bin\bash.exe" set "BASH_EXE=%ProgramFiles%\Git\bin\bash.exe"
if not defined BASH_EXE if exist "%ProgramFiles%\Git\usr\bin\bash.exe" set "BASH_EXE=%ProgramFiles%\Git\usr\bin\bash.exe"
if not defined BASH_EXE if exist "%ProgramFiles(x86)%\Git\bin\bash.exe" set "BASH_EXE=%ProgramFiles(x86)%\Git\bin\bash.exe"
if not defined BASH_EXE if exist "%ProgramFiles(x86)%\Git\usr\bin\bash.exe" set "BASH_EXE=%ProgramFiles(x86)%\Git\usr\bin\bash.exe"

if not defined BASH_EXE where bash.exe >nul 2>nul && set "BASH_EXE=bash.exe"

if not defined BASH_EXE (
  echo worktrace requires Git Bash. Install Git for Windows, then open a new terminal.
  exit /b 1
)

"%BASH_EXE%" "%SCRIPT_DIR%worktrace.sh" %*
exit /b %ERRORLEVEL%
'@

Set-Content -Path $worktraceCmd -Value $cmdContent -Encoding ASCII

$pathUpdated = $false
if (-not $NoPathUpdate) {
    $pathUpdated = Add-UserPath -PathToAdd $InstallDir
}

$bashPath = Find-Bash

Write-Host "Installed worktrace to $InstallDir"

if ($pathUpdated) {
    Write-Host "Added $InstallDir to your user PATH. Open a new terminal before running worktrace."
} elseif ($NoPathUpdate) {
    Write-Host "Skipped PATH update."
} else {
    Write-Host "$InstallDir is already in your user PATH."
}

if ($bashPath) {
    Write-Host "Detected Bash: $bashPath"
    Write-Host "Run: worktrace version"
} else {
    Write-Host "Git Bash was not detected. Install Git for Windows before running worktrace."
}
