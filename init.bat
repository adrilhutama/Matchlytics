@echo off
setlocal enabledelayedexpansion

echo.
echo  ==========================================
echo    Matchlytics - Local Environment Setup
echo  ==========================================
echo.

REM ─── Step 1: Python virtual environment ──────────────────────────
echo [1/4] Setting up Python environment...
if not exist "venv" (
    python -m venv venv
    echo        Created venv
) else (
    echo        venv already exists, skipping
)
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r scripts\requirements.txt
echo.

REM ─── Step 2: Frontend dependencies ────────────────────────────────
echo [2/4] Installing frontend dependencies...
cd frontend
if not exist "node_modules" (
    npm install
    echo        Installed node_modules
) else (
    echo        node_modules already exists, skipping
)
cd ..
echo.

REM ─── Step 3: Environment files ────────────────────────────────────
echo [3/4] Checking environment files...
if not exist ".env" (
    copy .env.example .env
    echo        Created .env from .env.example  (fill in your tokens)
) else (
    echo        .env already exists
)
if not exist "frontend\.env" (
    copy frontend\.env.example frontend\.env
    echo        Created frontend\.env from frontend\.env.example
) else (
    echo        frontend\.env already exists
)
echo.

REM ─── Step 4: Database migrations ──────────────────────────────────
echo [4/4] Database migrations ───────────────────────────────────────
echo.
echo     Migrations live in supabase/migrations/
echo     Apply them manually in Supabase Dashboard > SQL Editor.
echo     Files are numbered and sequential.
echo.

echo  ==========================================
echo    Setup complete
echo  ==========================================
echo.
echo     Next steps:
echo     1. Fill in SUPABASE_URL and keys in .env
echo     2. Fill in FOOTBALL_DATA_TOKEN and ODDS_API_KEY in .env
echo     3. Run migrations in Supabase SQL Editor
echo     4. cd frontend && npm run dev
echo     5. cd scripts && python sync_daily.py
echo.
pause
