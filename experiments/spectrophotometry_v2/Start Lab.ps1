$ErrorActionPreference = 'Stop'
$labUrl = 'http://127.0.0.1:8774'
try {
    $existingLab = Invoke-WebRequest -UseBasicParsing -Uri $labUrl -TimeoutSec 2
    if ($existingLab.Content -match 'Spectrophotometry Studio v2') {
        Start-Process $labUrl
        return
    }
    throw 'Port 8774 is already serving another page. Use a different port from the README.'
} catch [System.Net.WebException] {
    # No existing local lab: start a new server below.
} catch [System.Net.Http.HttpRequestException] {
    # No existing local lab: start a new server below.
}
$labPython = (Get-Command python -ErrorAction Stop).Source
$labServer = Start-Process -FilePath $labPython -ArgumentList @('serve.py') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
try {
    for ($attempt=0; $attempt -lt 20; $attempt++) {
        try { $null = Invoke-WebRequest -UseBasicParsing -Uri $labUrl -TimeoutSec 1; break }
        catch { Start-Sleep -Milliseconds 200 }
    }
    if ($labServer.HasExited) { throw 'The local server could not start.' }
    Start-Process $labUrl
    Write-Host 'The local 3D lab is open. Keep this window open while using it.'
    $null = Read-Host 'Press Enter when you want to stop this server'
} finally {
    if (-not $labServer.HasExited) { Stop-Process -Id $labServer.Id }
}
