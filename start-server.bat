@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
set "PORT=8080"
set "URL=http://localhost:%PORT%"
echo.
echo  ================================================
echo   YouTube Ultra - lokaler Server
echo  ================================================
echo.
echo  Starte Server im Ordner:
echo  %~dp0
echo.
where py >nul 2>nul
if not errorlevel 1 (
  echo  Quelle: Python [py]
  start "YU-Server" /min cmd /c "py -m http.server %PORT%"
  goto :open
)
where python >nul 2>nul
if not errorlevel 1 (
  echo  Quelle: Python [python]
  start "YU-Server" /min cmd /c "python -m http.server %PORT%"
  goto :open
)
where node >nul 2>nul
if not errorlevel 1 (
  echo  Quelle: Node.js
  start "YU-Server" /min cmd /c "npx --yes serve -l %PORT% ."
  goto :open
)
echo  FEHLER: Weder Python noch Node.js gefunden.
echo.
echo  Installiere Python (python.org) oder Node.js (nodejs.org)
echo  und starte diese Datei bitte erneut.
echo.
pause
exit /b 1

:open
timeout /t 2 /nobreak >nul
start "" "%URL%"
echo  Server laeuft auf: %URL%
echo  Dieses Fenster darf offen bleiben - beim Schliessen
echo  stoppt der Server. Viel Spass!
echo.
pause
endlocal
