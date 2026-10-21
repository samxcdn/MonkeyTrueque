@echo off
setlocal
pushd "%~dp0"
set "MAVEN_OPTS=%MAVEN_OPTS% -Dmaven.repo.local=%USERPROFILE%\.m2\repository"
if exist "..\.env" for /f "usebackq eol=# tokens=1,* delims==" %%A in ("..\.env") do (
  if /i "%%A"=="APP_JWT_SECRET" set "%%A=%%B"
  if /i "%%A"=="APP_JWT_EXPIRATION_MINUTES" set "%%A=%%B"
  if /i "%%A"=="DEMO_ADMIN_ENABLED" set "%%A=%%B"
  if /i "%%A"=="DEMO_ADMIN_USERNAME" set "%%A=%%B"
  if /i "%%A"=="DEMO_ADMIN_PASSWORD" set "%%A=%%B"
  if /i "%%A"=="DEMO_DATA_ENABLED" set "%%A=%%B"
)
if exist ".env" for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
  if /i "%%A"=="CLOUDINARY_CLOUD_NAME" set "%%A=%%B"
  if /i "%%A"=="CLOUDINARY_API_KEY" set "%%A=%%B"
  if /i "%%A"=="CLOUDINARY_API_SECRET" set "%%A=%%B"
)
if not defined DEMO_ADMIN_ENABLED set "DEMO_ADMIN_ENABLED=true"
if not defined DEMO_ADMIN_USERNAME set "DEMO_ADMIN_USERNAME=admin"
if not defined DEMO_ADMIN_PASSWORD set "DEMO_ADMIN_PASSWORD=Admin123*"
if not defined DEMO_DATA_ENABLED set "DEMO_DATA_ENABLED=false"
call mvnw.cmd spring-boot:run
popd
endlocal
