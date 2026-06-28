import sys
from pathlib import Path

# Make the backend package root importable in dev and when frozen.
sys.path.insert(0, str(Path(__file__).resolve().parent))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import Api

# ---------------------------------------------------------------------------
# FastAPI app — module-level so uvicorn can find `app`.
# Allow both the Vite dev server and the packaged Electron app
# (file:// sends origin "null").
# ---------------------------------------------------------------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "null"],
    allow_methods=["*"],
    allow_headers=["*"],
)

api = Api()
app.include_router(api.router)


if __name__ == "__main__":
    # Entry point for the packaged backend (verisal-backend.exe): start the
    # API server the Electron app talks to.
    uvicorn.run(app, host="127.0.0.1", port=8000)
