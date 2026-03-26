@echo off
title Todo App
echo.
echo  =============================
echo    할 일 관리 앱 시작 중...
echo  =============================
echo.

:: 브라우저를 2초 후 열기
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3001"

:: 백엔드 서버 시작 (프론트엔드 빌드 파일도 서빙)
cd /d "%~dp0backend"
node server.js
