@echo off
REM Mission Control - GPT OAuth Tunnel (CMD version)
REM Run this in Command Prompt (not PowerShell)

echo.
echo === Mission Control GPT OAuth Tunnel ===
echo.

REM Check if OAuth proxy is running
curl -s http://localhost:3001/health >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] OAuth proxy is running
) else (
    echo [WARNING] OAuth proxy not detected on localhost:3001
    echo Start it first: node scripts\chat-oauth-proxy.js
    echo.
)

echo Starting SSH reverse tunnel...
echo   Local:  localhost:3001 (your OAuth proxy)
echo   Remote: app.missioncontroldb.online localhost:3001 (VPS)
echo.
echo The VPS will detect GPT as available when this tunnel is open.
echo Press Ctrl+C to stop the tunnel.
echo.

:retry
echo [%time%] Connecting tunnel...

REM SSH reverse tunnel
ssh -i %USERPROFILE%\.ssh\id_ed25519 ^
    -R 3001:localhost:3001 ^
    -N ^
    -o "ServerAliveInterval=30" ^
    -o "ServerAliveCountMax=3" ^
    -o "ExitOnForwardFailure=yes" ^
    deanadmin@app.missioncontroldb.online

echo [%time%] Tunnel disconnected. Reconnecting in 5s...
timeout /t 5 /nobreak >nul
goto retry
