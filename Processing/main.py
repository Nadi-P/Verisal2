from Processing.Files import Files
from Processing.Functions import Functions 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd

Functions.InitializeData()

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