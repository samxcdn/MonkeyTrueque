@echo off
setlocal
pushd "%~dp0"
set "MAVEN_OPTS=%MAVEN_OPTS% -Dmaven.repo.local=%USERPROFILE%\.m2\repository"
if exist "..\.env" for /f "usebackq eol=# tokens=1,* delims==" %%A in ("..\.env") do (
  if /i "%%A"=="APP_JWT_SECRET" set "%%A=%%B"
  if /i "%%A"=="DEMO_DATA_ENABLED" set "%%A=%%B"
)
if not defined DEMO_DATA_ENABLED set "DEMO_DATA_ENABLED=false"
call mvnw.cmd spring-boot:run
popd
endlocal
