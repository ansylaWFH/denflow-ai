@echo off
echo ==========================================
echo      Starting MailFlow AI System
echo ==========================================

echo [1/2] Starting Backend Server (FastAPI)...
start "MailFlow Backend" cmd /k "python server.py"

echo [2/2] Starting Frontend Interface (Vite)...
cd frontend
start "MailFlow Frontend" cmd /k "npm run dev"

echo.
echo ==========================================
echo System is running!
echo.
echo [IMPORTANT] Access the UI here: http://localhost:5173
echo.
echo (Do NOT use the 8000 port, that is for the backend only)
echo ==========================================
pause
