import sys
from pathlib import Path

from LineageFrame.frame import LineageFrame
from LineageFrame.manager import LineageManager
sys.path.insert(0, str(Path(__file__).resolve().parent))

import os
from typing import List

from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from Loading import InitializeFromFiles
from Reports.Absences import Absences

from Headers import Headers, Helpers
from api import Api


# ---------------------------------------------------------------------------
# FastAPI app — module-level so uvicorn can find `main:app`.
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


TEST_FOLDER = r"C:\Users\nadav\OneDrive\Desktop\tests\טסט אייאיי"


def build_upload_files_from_folder(folder_path: str) -> List[UploadFile]:
    """Open every .xlsx/.xls file in folder_path as a real Starlette UploadFile."""
    files: List[UploadFile] = []
    for entry in sorted(os.listdir(folder_path)):
        full = os.path.join(folder_path, entry)
        if not os.path.isfile(full):
            continue
        if not entry.lower().endswith((".xlsx", ".xls")):
            continue
        fh = open(full, "rb")
        files.append(UploadFile(filename=entry, file=fh))
    return files



def run_parsing_test():
    LM = LineageManager()
    files_map = InitializeFromFiles(build_upload_files_from_folder(TEST_FOLDER))
    components = files_map["components"]
    print(f"c: {len(components.columns)}, r: {len(components[components.columns[0]])}")
    compsLF = LineageFrame.from_pandas(components, "components", LM)
    comps_h = Headers.InputFiles.Components

    compsCopy = compsLF.copy()
    groupby_list = [
        Helpers.SystemReportsBase.work_month,
        Helpers.SystemReportsBase.employee_id,
    ]
    agg_map = {
        comps_h.total_amount: 'sum',
        comps_h.employee_name: 'first',
    }
    compsGrouped = compsCopy.groupby(groupby_list).agg(agg_map)
    print(compsGrouped.to_string())

    sum_col = compsGrouped[comps_h.total_amount]
    for cell in sum_col.cells:
        print(cell.pretty())


if __name__ == "__main__":
    pass
    # run_parsing_test()
