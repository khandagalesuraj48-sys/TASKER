@echo off
echo Resetting Git index...
del /f /q .git\index 2>nul
del /f /q .git\index.lock 2>nul
git reset
echo Git index successfully restored!
git status
