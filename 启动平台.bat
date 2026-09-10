@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist "release\SpecFlow-Engineering-Studio-v0.2.0-Portable.exe" (
  echo 正在启动 SpecFlow Engineering Studio v0.2 ...
  start "" "release\SpecFlow-Engineering-Studio-v0.2.0-Portable.exe"
  exit /b
)
if exist "release\win-unpacked\SpecFlow Engineering Studio.exe" (
  echo 正在启动 SpecFlow Engineering Studio v0.2 ...
  start "" "release\win-unpacked\SpecFlow Engineering Studio.exe"
  exit /b
)
where npm >nul 2>nul || ( echo 未检测到 Node.js/npm，请运行 release 目录中的安装版或免安装版。 & pause & exit /b 1 )
if not exist node_modules\ ( echo 正在安装桌面运行依赖... & call npm install || ( pause & exit /b 1 ) )
echo 正在以源码桌面模式启动 SpecFlow Engineering Studio v0.2 ...
call npm run desktop
pause
