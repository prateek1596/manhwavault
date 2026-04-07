$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "backend")

& (Join-Path $scriptDir ".venv\Scripts\python.exe") -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
