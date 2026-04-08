from Processing.Files import Files
from Processing.Functions import Functions 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd

Functions.InitializeData()


dfs = [
    Files.socialAnalysisDF,
    Files.monthsComparisonDF,
    Files.reportsAgainstCenterDF
]

for df in dfs:
    print(f"Rows: {len(df)}, Columns: {len(df.columns)}")



