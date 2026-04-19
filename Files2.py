class Files:
    current_month = None
    current_year = None
    company_name = None
    min_month = None
    min_year = None
    max_month = None
    max_year = None

    centerDF = None
    center_df_coded = None
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

    # Keyword Mapping (used to match uploaded filenames)
    KEYWORDS = {
        "center": "מרכז",
        "deductions": "ניכוי",
        "absences": "העדר",
        "providents": "גמל",
        "components": "רכיב",
        "income": "הכנס",
        "costing": "תמחיר"
    }

    # Display names (shown to the user in error messages)
    DISPLAY_NAMES = {
        "center": "קובץ מרכז שכר",
        "deductions": "ניכויי רשות",
        "absences": "היעדרויות",
        "providents": "קופות גמל",
        "components": "רכיבי שכר",
        "income": "הכנסות זקופות",
        "costing": "דוח תמחיר"
    }

    files_map = None
