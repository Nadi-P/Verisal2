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
def get_report(report_name: str): # Match the query param name
    report_mapping = {
        "center": Files.centerDF,
        "costing": Files.costingDF, # Changed from "Costing" to lowercase
        "income": Files.incomeDF,
        "absences": Files.absencesDF,
        "deductions": Files.deductionsDF,
        "providents": Files.providentsDF,
        "components": Files.componentsDF,
        "social_analysis": Files.socialAnalysisDF,
        "months_comparison": Files.monthsComparisonDF,
        "reports_against_center": Files.reportsAgainstCenterDF
    }

    df = report_mapping.get(report_name)

    if df is not None:
        df = df.fillna(0)
        # Handling the case where the DF might be empty
        if df.empty:
            return []
        return {
        "status": "success",
        "data": df.to_dict(orient="records"),
        "metadata": {
            "company_name": Files.company_name,
            "min_month": Files.min_month,
            "min_year": Files.min_year,
            "max_month": Files.max_month,
            "max_year": Files.max_year
        }
    }
    
    return {"error": f"Report '{report_name}' not found"}