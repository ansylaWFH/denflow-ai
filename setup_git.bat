@echo off
echo ========================================
echo   MailFlow AI - Render Deployment
echo ========================================
echo.

echo Step 1: Initializing Git repository...
git init
if errorlevel 1 (
    echo ERROR: Git not found. Please install Git first.
    pause
    exit /b 1
)

echo.
echo Step 2: Adding all files...
git add .

echo.
echo Step 3: Creating initial commit...
git commit -m "Initial commit - MailFlow AI ready for deployment"

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Create a repository on GitHub
echo 2. Run these commands (replace YOUR_USERNAME):
echo.
echo    git remote add origin https://github.com/YOUR_USERNAME/mailflow-ai.git
echo    git branch -M main
echo    git push -u origin main
echo.
echo 3. Then follow DEPLOYMENT_GUIDE.md
echo.
pause
