@echo off
:: 브라우저를 2초 후 열기
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3001"
:: 백엔드 서버 시작
cd /d "%~dp0backend"
node server.js
