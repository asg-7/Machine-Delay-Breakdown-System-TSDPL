@echo off
REM Git Commit and Push Script for TSDPL_DELAY2 Anomaly Detector Module
REM Run this script in Command Prompt (cmd.exe)

cd /d C:\TSDPL\week5\TSDPL_DELAY2

echo ===== STEP 1: Check Recent Commits (to understand commit convention) =====
git log --oneline -10
echo.

echo ===== STEP 2: Check Git Status =====
git status --short
echo.

echo ===== STEP 3: Stage All Changes =====
git add -A
echo Changes staged successfully
echo.

echo ===== STEP 4: Check Staged Changes =====
git diff --cached --stat
echo.

echo ===== STEP 5: Create Commit =====
git commit -m "Add Anomaly Detection Module (Phase 8)" -m "- Add self-contained anomaly_detector/ module with IsolationForest" -m "- Implement /api/anomaly/* endpoints in FastAPI server" -m "- Add runAnomalyDetection() function to frontend" -m "- Engineer 27 shift-level features for anomaly detection" -m "- Include 5 unit tests with synthetic data generator" -m "- Update TSDPL_DELAY2readme.md with comprehensive documentation" -m "- Maintain backward compatibility with existing RUL module" -m "" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
echo.

echo ===== STEP 6: Confirm Commit =====
git log --oneline -3
echo.

echo ===== STEP 7: Push to GitHub =====
git push origin main
echo.

echo ===== COMPLETE =====
echo Commit and push completed successfully!
pause
