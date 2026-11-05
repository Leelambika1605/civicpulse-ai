@echo off
title Push to GitHub - CivicPulse AI
echo ==============================================================
echo PUSH CIVICPULSE AI TO GITHUB
echo ==============================================================
echo.
echo 1. Go to https://github.com/new and create a new repository.
echo 2. Copy the HTTPS link (e.g., https://github.com/yourname/civicpulse-ai.git)
echo.
set /p REPO_URL="Paste your GitHub Repository URL here: "

if "%REPO_URL%"=="" (
    echo [ERROR] No URL provided. Exiting.
    pause
    exit /b
)

echo.
echo [1/3] Setting branch to main...
git branch -M main

echo [2/3] Adding remote origin...
git remote remove origin 2>nul
git remote add origin %REPO_URL%

echo [3/3] Pushing to GitHub...
git push -u origin main

echo.
echo ==============================================================
echo SUCCESS! Your code is now live on GitHub.
echo Next step: Go to https://render.com to deploy it for free.
echo ==============================================================
pause
