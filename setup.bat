@echo off
setlocal

echo.
echo ============================================================
echo   TimeZest MCP Server - One-Click Installer
echo ============================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed. Please download it from https://nodejs.org/
    exit /b 1
)

:: Install dev dependencies in local folder
echo [1/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Error: Failed to install dependencies.
    exit /b 1
)

:: Build the project
echo [2/3] Building the server...
call npm run build
if %errorlevel% neq 0 (
    echo Error: Build failed.
    exit /b 1
)

echo [3/3] Finalizing installation...
echo SUCCESS: TimeZest MCP server is built and ready to go.
echo.
echo ============================================================
echo   Next Step: Update Claude Desktop Config
echo ============================================================
echo.
echo 1. Open your Claude Desktop config file:
echo    %%APPDATA%%\Claude\claude_desktop_config.json
echo.
echo 2. Add the following to your "mcpServers" block:
echo.
echo    "timezest": {
echo      "command": "cmd",
echo      "args": ["/c", "npx", "-y", "timezest-mcp@latest"],
echo      "env": {
echo        "TIMEZEST_API_KEY": "IViu8ZqgFMgY74mAbqYjHnrg9ieUHf0g"
echo      }
echo    }
echo.
echo    (Alternatively, keep using the local path: node "%CD%\build\index.js")
echo.
echo 3. Restart Claude Desktop.
echo.

pause
