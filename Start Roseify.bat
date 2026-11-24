@echo off
title Roseify
cd /d "%~dp0"
echo Starting Roseify... keep this window open while you use the app.
start "" http://localhost:3000
npm start
pause
