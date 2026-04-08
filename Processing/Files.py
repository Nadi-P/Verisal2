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

    controlFiles = {}

    def initialize_file_mapping():
        """Scans the folder and maps files to keys based on keywords."""
        files_in_folder = [f for f in os.listdir(Files.base_path) if f.endswith('.xlsx')]
        
        for file_name in files_in_folder:
            found_match = False
            for key, keyword in Files.KEYWORDS.items():
                if keyword in file_name:
                    Files.controlFiles[key] = file_name
                    found_match = True
                    break # Stop checking keywords once a match is found
            
            if not found_match:
                # Instructions for the user as requested
                instructions = "\n".join([f"- {k}: Must contain '{v}'" for k, v in Files.KEYWORDS.items()])
                raise ValueError(
                    f"\n[!] Unknown file detected: {file_name}\n"
                    f"Every .xlsx file in the folder must match one of these categories:\n{instructions}"
                )

    def GetFile(key, sheetName):
        """Loads a file by its mapped key (e.g., 'center', 'income')"""
        file_name = Files.controlFiles.get(key)
        if not file_name:
            print(f"Warning: No file was found for {key}")
            return pd.DataFrame()

        full_path = os.path.join(Files.base_path, file_name)
        
        # Center file logic: header on row 7, others on row 0
        header_row = 7 if key == "center" else 0
        
        try:
            with pd.ExcelFile(full_path) as xls:
                sheetName = xls.sheet_names[0] if sheetName == None else sheetName
                df = pd.read_excel(xls, sheet_name=sheetName, header=header_row)
            
            df.columns = df.columns.astype(str).str.strip()
            return df
        except Exception as e:
            print(f"Error loading {file_name}: {e}")
            return pd.DataFrame()

