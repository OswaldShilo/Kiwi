$backendProcess = $null
try {
    $outLog = Join-Path $env:TEMP "kiwi_backend_out.log"
    $errLog = Join-Path $env:TEMP "kiwi_backend_err.log"
    $backendProcess = Start-Process uv -ArgumentList "run", "uvicorn", "app.main:app", "--port", "8000" -PassThru -NoNewWindow -WorkingDirectory $PSScriptRoot -RedirectStandardOutput $outLog -RedirectStandardError $errLog
    Start-Sleep -Seconds 2
    pnpm --silent --dir kiwi-ui start
} finally {
    if ($backendProcess) {
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Clear-Host
}
