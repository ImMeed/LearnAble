@echo off
cd /d "C:\Users\pc\Desktop\LearnAble\frontend"

echo === Step 1: TypeScript Compilation ===
node ./node_modules/typescript/bin/tsc -b
set TSC_EXIT=%ERRORLEVEL%
echo TypeScript Exit Code: %TSC_EXIT%
echo.

echo === Step 2: Vite Build ===
node ./node_modules/vite/bin/vite.js build
set VITE_EXIT=%ERRORLEVEL%
echo Vite Exit Code: %VITE_EXIT%
echo.

echo === Step 3: Vitest ===
if exist "./node_modules/vitest/vitest.mjs" (
    node ./node_modules/vitest/vitest.mjs run
    set VITEST_EXIT=%ERRORLEVEL%
    echo Vitest Exit Code: !VITEST_EXIT!
) else (
    echo Vitest not found or not runnable
    set VITEST_EXIT=-1
)
echo.

echo === SUMMARY ===
echo TypeScript: %TSC_EXIT%
echo Vite: %VITE_EXIT%
echo Vitest: %VITEST_EXIT%
