@echo off
rem Arranca MonkeyTrueque completo: catalogo (8081), intercambios (8082) y la web (4200).
rem Cada parte se abre en su propia ventana; cerrar una ventana apaga esa parte.
setlocal
set "RAIZ=%~dp0"

echo Iniciando catalogo (8081)...
start "MonkeyTrueque - Catalogo 8081" cmd /k "cd /d "%RAIZ%backend\catalog-service" && iniciar.cmd"

echo Iniciando intercambios (8082)...
start "MonkeyTrueque - Intercambios 8082" cmd /k "cd /d "%RAIZ%backend\exchange-service" && iniciar.cmd"

echo Iniciando la web (4200)...
if exist "%RAIZ%frontend\node_modules" (
  start "MonkeyTrueque - Web 4200" cmd /k "cd /d "%RAIZ%frontend" && npm start"
) else (
  start "MonkeyTrueque - Web 4200" cmd /k "cd /d "%RAIZ%frontend" && npm install && npm start"
)

echo.
echo Se abrieron 3 ventanas. Espera a que digan:
echo   - Started CatalogServiceApplication
echo   - Started ExchangeServiceApplication
echo   - Local: http://localhost:4200
echo Luego abre http://localhost:4200  (admin / Admin123*)
echo.
endlocal
