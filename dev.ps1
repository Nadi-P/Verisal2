function boot {
    Set-Location C:\Verisal2\Processing
    .\venv\Scripts\Activate.ps1
    python -m uvicorn main:app --reload
}

function dev {
    Set-Location C:\Verisal2\UI
    npm run dev
}
