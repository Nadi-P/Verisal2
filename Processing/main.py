from typing import List
from io import BytesIO

from Processing.Files import Files
from Processing.Functions import Functions
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd

app = FastAPI()

# 1. Setup CORS so React (5173) can talk to Python (8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/get_report")
def get_report(report_name: str):
    report_mapping = {
        "center": Files.centerDF,
        "costing": Files.costingDF,
        "income": Files.incomeDF,
        "absences": Files.absencesDF,
        "deductions": Files.deductionsDF,
        "providents": Files.providentsDF,
        "components": Files.componentsDF,
        "social_analysis": Files.socialAnalysisDF,
        "months_comparison": Files.monthsComparisonDF,
        "reports_against_center": Files.reportsAgainstCenterDF
    }

    checkup_mapping = {
        "social_analysis": Files.socialAnalysisCheckupColumns,
        "months_comparison": Files.monthsComparisonCheckupColumns,
        "reports_against_center": Files.reportsAgainstCenterCheckupColumns,
    }

    df = report_mapping.get(report_name)

    if df is not None:
        df = df.fillna(0)
        if df.empty:
            return []

        # Build serializable checkup rules: evaluate each lambda to get a bool per row/column
        checkup_results = {}
        checkup_cols = checkup_mapping.get(report_name, {})
        for col_name, condition in checkup_cols.items():
            if col_name in df.columns:
                results = []
                for val in df[col_name]:
                    if isinstance(val, str):
                        newVal = val.replace("%", "")
                        results.append(condition(float(newVal)))
                    else:
                        results.append(condition(val))

                checkup_results[col_name] = results

        return {
            "status": "success",
            "data": df.to_dict(orient="records"),
            "checkup": checkup_results,
            "metadata": {
                "company_name": Files.company_name,
                "min_month": Files.min_month,
                "min_year": Files.min_year,
                "max_month": Files.max_month,
                "max_year": Files.max_year
            }
        }

    return {"error": f"Report '{report_name}' not found"}

from fastapi import Query

@app.get("/api/update-months-comparison")
async def update_months_comparison(
    m1: int = Query(...),
    y1: int = Query(...),
    m2: int = Query(...),
    y2: int = Query(...)
):
    try:
        new_df = Functions.get_months_comparison(
            input_months1=m1, input_year1=y1,
            input_months2=m2, input_year2=y2
        )

        # Persist the new comparison DataFrame so that reloading the report
        # from the side menu returns the updated comparison instead of the default.
        new_df = new_df.fillna(0)
        Files.monthsComparisonDF = new_df

        # Build checkup results the same way /api/get_report does
        checkup_results = {}
        checkup_cols = Files.monthsComparisonCheckupColumns or {}
        for col_name, condition in checkup_cols.items():
            if col_name in new_df.columns:
                results = []
                for val in new_df[col_name]:
                    if isinstance(val, str):
                        newVal = val.replace("%", "")
                        results.append(condition(float(newVal)))
                    else:
                        results.append(condition(val))
                checkup_results[col_name] = results

        return {
            "status": "success",
            "data": new_df.to_dict(orient='records'),
            "checkup": checkup_results,
            "message": f"Compared {m1}/{y1} vs {m2}/{y2}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/api/export_report")
def export_report(report_name: str):
    report_mapping = {
        "center": Files.centerDF,
        "costing": Files.costingDF,
        "income": Files.incomeDF,
        "absences": Files.absencesDF,
        "deductions": Files.deductionsDF,
        "providents": Files.providentsDF,
        "components": Files.componentsDF,
        "social_analysis": Files.socialAnalysisDF,
        "months_comparison": Files.monthsComparisonDF,
        "reports_against_center": Files.reportsAgainstCenterDF,
    }

    df = report_mapping.get(report_name)
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"Report '{report_name}' not found")

    buffer = BytesIO()
    df.fillna(0).to_excel(buffer, index=False, engine="openpyxl")
    buffer.seek(0)

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={report_name}.xlsx"},
    )

@app.post("/api/upload_reports")
async def upload_reports(files: List[UploadFile] = File(...)):
    try:
        # Pass the list of upload objects directly to the processing logic
        Functions.InitializeFromFiles(files)
        return {"status": "success", "message": f"Successfully processed {len(files)} files"}
    except Exception as e:
        return {"status": "error", "message": str(e)}