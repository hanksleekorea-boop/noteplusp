@echo off
title NotePlusP - Evernote Full Backup
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0evernote_full_backup.ps1"
if errorlevel 1 (
  echo.
  echo Backup helper did not complete. Review the message above.
  pause
)
