@echo off
setlocal enabledelayedexpansion

cd /d "C:\Users\pc\Desktop\LearnAble\frontend"

echo.
echo ========================================
echo Step 1: TypeScript Compilation
echo ========================================
node ./node_modules/typescript/bin/tsc -b
set TSC_EXIT=%ERRORLEVEL%
if %TSC_EXIT% equ 0 (
    echo [PASS] TypeScript compilation successful
) else (
    echo [FAIL] TypeScript compilation failed with exit code %TSC_EXIT%
)
echo.

echo ========================================
echo Step 2: Vite Build
echo ========================================
node ./node_modules/vite/bin/vite.js build
set VITE_EXIT=%ERRORLEVEL%
if %VITE_EXIT% equ 0 (
    echo [PASS] Vite build successful
) else (
    echo [FAIL] Vite build failed with exit code %VITE_EXIT%
)
echo.

echo ========================================
echo Step 3: Vitest
echo ========================================
if exist "./node_modules/vitest/vitest.mjs" (
    node ./node_modules/vitest/vitest.mjs run
    set VITEST_EXIT=%ERRORLEVEL%
    if !VITEST_EXIT! equ 0 (
        echo [PASS] Vitest tests passed
    ) else (
        echo [FAIL] Vitest tests failed with exit code !VITEST_EXIT!
    )
) else (
    echo [SKIP] Vitest not found
    set VITEST_EXIT=-1
)
echo.

echo ========================================
echo VALIDATION SUMMARY
echo ========================================
echo TypeScript: %TSC_EXIT%
echo Vite:       %VITE_EXIT%
echo Vitest:     %VITEST_EXIT%
echo ========================================
