import io
import os
import pandas as pd

class Files:
    prefix = r"C:\Users\nadav\OneDrive\Desktop"
    folderName = r"PAQA - Test Files - Copy"
    base_path = os.path.join(prefix, folderName)

    current_month = None
    current_year = None
    company_name = None
    min_month = None
    min_year = None
    max_month = None
    max_year = None

    centerDF = None
    costingDF = None
    incomeDF = None
    absencesDF = None
    deductionsDF = None
    providentsDF = None
    componentsDF = None
    socialAnalysisDF = None
    reportsAgainstCenterDF = None
    monthsComparisonDF = None

    monthsComparisonCheckupColumns = None
    socialAnalysisCheckupColumns = None
    reportsAgainstCenterCheckupColumns = None

    # Keyword Mapping
    KEYWORDS = {
        "center": "מרכז",
        "deductions": "ניכוי",
        "absences": "העדר",
        "providents": "גמל",
        "components": "רכיב",
        "income": "הכנס",
        "costing": "תמחיר"
    }

    files_map = None
