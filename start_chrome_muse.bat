@echo off
chcp 65001 >nul
echo ========================================================
echo   ZTTeam - Khoi chay Chrome cho Muse.ai (Port 9222)
echo ========================================================
echo.

set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_PATH%" (
    set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
)
if not exist "%CHROME_PATH%" (
    set "CHROME_PATH=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
)

echo [1] Tim thay Google Chrome tai:
echo     "%CHROME_PATH%"
echo [2] Thu muc Profile luu tru:
echo     "%USERPROFILE%\chrome-muse-profile"
echo [3] Dang khoi chay Chrome voi cong Remote Debugging 9222...
echo.

start "" "%CHROME_PATH%" --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\chrome-muse-profile" "https://muse.ai/"

echo ========================================================
echo   Da bat Chrome thanh cong!
echo   Hay dang nhap Muse.ai tren cua so Chrome vua mo.
echo   Sau khi dang nhap xong, bao lai de chay tiep script test.
echo ========================================================
pause
