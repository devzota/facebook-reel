@echo off
chcp 65001 >nul
title ZTTeam Attach Video Manual
echo ========================================================
echo   ZTTeam - Cong cu gan Video Reels truc tiep len VPS
echo ========================================================
echo.

set /p POST_ID="Nhap ID bai viet (vi du 7345): "
set /p VIDEO_PATH="Nhap hoac keo tha file video MP4 vao day: "
set /p TARGET_PORT="Chon he thong (3000 cho auto.ztteam | 3001 cho didinao, mac dinh 3000): "

if "%TARGET_PORT%"=="" set TARGET_PORT=3000

node scripts/ztteam_attach_manual_video.js %POST_ID% %VIDEO_PATH% %TARGET_PORT%

echo.
pause
