@echo off
echo ========================================
echo    AI Chat - OpenAI 聊天应用
echo ========================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未检测到 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] 检测到 Node.js 版本:
node --version
echo.

REM 检查 node_modules 是否存在
if not exist "node_modules\" (
    echo [2/4] 首次运行，正在安装依赖...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
    echo.
) else (
    echo [2/4] 依赖已安装
    echo.
)

REM 检查 .env 文件
if not exist ".env" (
    echo [3/4] 创建配置文件...
    copy .env.example .env >nul
    echo 已创建 .env 文件
    echo.
    echo [重要] 请编辑 .env 文件，添加你的 OpenAI API Key
    echo 或在应用启动后通过界面配置
    echo.
) else (
    echo [3/4] 配置文件已存在
    echo.
)

REM 停止可能正在运行的 Node.js 进程
echo [4/5] 检查并清理端口...
taskkill /F /IM node.exe >nul 2>nul
timeout /t 1 /nobreak >nul
echo 端口已清理
echo.

echo [5/5] 启动服务器...
echo.
echo ========================================
echo 服务器地址: http://localhost:3000
echo 按 Ctrl+C 停止服务器
echo ========================================
echo.

node server.js

REM 如果服务器异常退出，显示错误
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================
    echo [错误] 服务器异常退出
    echo 错误码: %ERRORLEVEL%
    echo ========================================
    pause
)
