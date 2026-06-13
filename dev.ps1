function boot {
    Set-Location C:\Verisal2\Processing
    .\venv\Scripts\Activate.ps1
    python -m uvicorn main:app --reload
}

function dev {
    Set-Location C:\Verisal2\UI
    npm run dev
}

function push {
    param(
        [Parameter(Mandatory=$true, Position=0, ValueFromRemainingArguments=$true)]
        [string[]]$Message
    )
    $msg = $Message -join ' '
    Set-Location C:\Verisal2
    git add .
    if ($?) { git commit -m $msg }
    if ($?) { git push }
}