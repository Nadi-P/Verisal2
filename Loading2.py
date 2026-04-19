from typing import List
import io

from Files2 import Files
from Headers import Headers
from Functions import Functions
from fastapi import UploadFile
import pandas as pd



def GetFileFromObject(file_obj, key):
    """
    Reads a system-report Excel file from an UploadFile buffer.
    Tries sheet index 1 (standard שקלולית layout); on failure falls back to the
    first sheet whose name contains "בע"מ". Use _load_center_sheets for the
    center file — it has its own signature-based detection and produces two DFs.
    """
    display = Files.DISPLAY_NAMES.get(key, key)

    if not file_obj:
        raise ValueError(f"קובץ {display} לא נמצא")

    try:
        file_obj.file.seek(0)
        content = file_obj.file.read()
        buffer = io.BytesIO(content)

        with pd.ExcelFile(buffer) as xls:
            sheet_names = xls.sheet_names
            df = None
            if len(sheet_names) > 1:
                try:
                    df = pd.read_excel(xls, sheet_name=sheet_names[1], header=0)
                except Exception:
                    df = None
            if df is None:
                match = next((s for s in sheet_names if "בע\"מ" in s), None)
                if match is None:
                    raise ValueError(
                        f"לא נמצא גיליון מתאים בקובץ {display} — הגיליון השני לא נטען "
                        f"ולא קיים גיליון שבשמו מופיע \"בע\"מ\""
                    )
                df = pd.read_excel(xls, sheet_name=match, header=0)

        df.columns = df.columns.astype(str).str.strip()
        return df
    except Exception as e:
        raise ValueError(f"שגיאה בקריאת {display}: {e}")

def _find_center_signature_row(raw_df):
    """
    Scan a header-less DataFrame for the row that anchors the center sheet:
        col 0 contains both "מספר" and "עובד"
        col 1 contains both "מס"   and "זהות"
        col 2 contains both "שם"   and "עובד"
    Returns the row index (int) or None if not found.
    """
    if raw_df is None or raw_df.shape[1] < 3:
        return None

    def has_all(val, *needles):
        if not isinstance(val, str):
            return False
        return all(n in val for n in needles)

    col0 = raw_df.iloc[:, 0]
    col1 = raw_df.iloc[:, 1]
    col2 = raw_df.iloc[:, 2]

    for i in range(len(raw_df)):
        if (has_all(col0.iat[i], "מספר", "עובד")
                and has_all(col1.iat[i], "מס", "זהות")
                and has_all(col2.iat[i], "שם", "עובד")):
            return i
    return None

def _build_center_coded_df(raw_df, header_row, data_df):
    """
    Build the "coded" projection of the center DF.

    Looks at the row immediately above `header_row` (the codes row). For each
    column in `data_df`:
        - If the cell above is a pure integer code → keep the column, rename it
        to the integer code (as a string).
        - Else if the original header is in ALWAYS_INCLUDE → keep the column,
        keep the original header.
        - Else → drop the column.
    """
    # Internal "always include even without a code" headers. Fill in as needed.
    ALWAYS_INCLUDE = set()

    if header_row <= 0:
        # No row above the headers → nothing has a code; only ALWAYS_INCLUDE survives.
        keep = [c for c in data_df.columns if c in ALWAYS_INCLUDE]
        return data_df[keep].copy() if keep else data_df.iloc[:, :0].copy()

    codes_row = raw_df.iloc[header_row - 1]
    # Headers row, used to map positional codes to actual cleaned column names.
    headers_row = raw_df.iloc[header_row]

    keep_cols = []   # names from data_df.columns
    rename_map = {}  # data_df col name -> stringified integer code

    for pos in range(min(len(headers_row), len(codes_row))):
        raw_header = headers_row.iat[pos]
        if raw_header is None or (isinstance(raw_header, float) and pd.isna(raw_header)):
            continue
        header_name = str(raw_header).strip()
        if header_name not in data_df.columns:
            continue

        code_cell = codes_row.iat[pos]
        code_int = None
        if isinstance(code_cell, (int,)) and not isinstance(code_cell, bool):
            code_int = code_cell
        elif isinstance(code_cell, float) and not pd.isna(code_cell) and float(code_cell).is_integer():
            code_int = int(code_cell)
        elif isinstance(code_cell, str):
            s = code_cell.strip()
            if s.lstrip('-').isdigit():
                code_int = int(s)

        if code_int is not None:
            keep_cols.append(header_name)
            rename_map[header_name] = str(code_int)
        elif header_name in ALWAYS_INCLUDE:
            keep_cols.append(header_name)

    if not keep_cols:
        return data_df.iloc[:, :0].copy()

    coded = data_df[keep_cols].copy()
    if rename_map:
        coded = coded.rename(columns=rename_map)
    return coded

def _load_center_sheets(file_obj):
    """
    Load the center workbook and return (centerDF, centerDFCoded).
        1. Try sheet index 0; look for the signature row inside it.
        2. If sheet 0 raises during read or has no signature, scan the remaining
            sheets for the first one that does.
        3. Use the discovered row as the header row for the regular DF, and the
            row above it as the source of integer codes for the coded DF.
        4. Raise if no sheet contains the signature.
    """
    display = Files.DISPLAY_NAMES.get("center", "center")

    if not file_obj:
        raise ValueError(f"קובץ {display} לא נמצא")

    try:
        file_obj.file.seek(0)
        content = file_obj.file.read()
        buffer = io.BytesIO(content)

        with pd.ExcelFile(buffer) as xls:
            sheet_names = xls.sheet_names
            if not sheet_names:
                raise ValueError(f"קובץ {display} אינו מכיל גיליונות")

            # Try sheet 0 first; on any read error, fall back to the scan.
            ordered = list(sheet_names)
            first = ordered[0]
            rest = ordered[1:]

            signature_row = None
            target_sheet = None
            raw_df = None

            def _try_sheet(name):
                try:
                    candidate = pd.read_excel(xls, sheet_name=name, header=None)
                except Exception:
                    return None, None
                return candidate, _find_center_signature_row(candidate)

            raw_df, signature_row = _try_sheet(first)
            if signature_row is not None:
                target_sheet = first
            else:
                for name in rest:
                    candidate_df, candidate_row = _try_sheet(name)
                    if candidate_row is not None:
                        raw_df = candidate_df
                        signature_row = candidate_row
                        target_sheet = name
                        break

            if signature_row is None:
                raise ValueError(
                    f"לא נמצא גיליון תקף בקובץ {display} — חיפשנו שורת כותרות "
                    f"עם 'מספר עובד', 'מס' זהות' ו'שם עובד' ולא מצאנו"
                )

            center_df = pd.read_excel(xls, sheet_name=target_sheet, header=signature_row)
            center_df.columns = center_df.columns.astype(str).str.strip()

            center_df_coded = _build_center_coded_df(raw_df, signature_row, center_df)

            return center_df, center_df_coded
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"שגיאה בקריאת {display}: {e}")

def InitializeFromFiles(files_list: List[UploadFile]):
    """
    Replaces InitializeData(folder_path).
    Maps file objects and loads them into memory.
    """
    # 1. Filter to only .xlsx/.xls files (ignore hidden files, thumbs.db, etc.)
    excel_files = [f for f in files_list if f.filename.lower().endswith(('.xlsx', '.xls'))]

    if not excel_files:
        raise ValueError("לא נמצאו קבצי Excel בתיקייה שנבחרה")

    # 2. Map the uploaded file objects to their keys
    Files.files_map = {}
    file_map = Files.files_map
    unmatched = []
    for file_obj in excel_files:
        filename = file_obj.filename.lower()
        matched = False
        for key, keyword in Files.KEYWORDS.items():
            if keyword.lower() in filename:
                if key in file_map:
                    display = Files.DISPLAY_NAMES[key]
                    raise ValueError(f"נמצאו מספר קבצים עבור \"{display}\" — נדרש קובץ אחד בלבד לכל סוג")
                file_map[key] = file_obj
                matched = True
                break
        if not matched:
            unmatched.append(file_obj.filename)

    # 3. Validate all 7 files are present
    expected_keys = set(Files.KEYWORDS.keys())
    matched_keys = set(file_map.keys())
    missing_keys = expected_keys - matched_keys

    if missing_keys or unmatched:
        lines = []
        if missing_keys:
            lines.append("קבצים חסרים:")
            for k in missing_keys:
                lines.append(f"  - {Files.DISPLAY_NAMES[k]}")
        if unmatched:
            lines.append("קבצים לא מזוהים:")
            for name in unmatched:
                lines.append(f"  - {name}")
        raise ValueError("\n".join(lines))

    # 4. Load all 7 DataFrames. Center uses signature-based detection and
    #    produces an additional "coded" projection alongside the regular DF.
    Files.centerDF, Files.center_df_coded = _load_center_sheets(file_map.get("center"))
    Files.componentsDF = GetFileFromObject(file_map.get("components"), "components")
    Files.providentsDF = GetFileFromObject(file_map.get("providents"), "providents")
    Files.incomeDF = GetFileFromObject(file_map.get("income"), "income")
    Files.deductionsDF = GetFileFromObject(file_map.get("deductions"), "deductions")
    Files.costingDF = GetFileFromObject(file_map.get("costing"), "costing")
    Files.absencesDF = GetFileFromObject(file_map.get("absences"), "absences")

    # 5. Extract company name from "שם חברה" column in system reports
    try:
        Files.company_name = Functions.extract_data_from_files("companyName")
    except Exception as e:
        raise ValueError(f"שגיאה בחילוץ שם חברה: {e}")

    # 6. Extract date metadata
    try:
        Files.current_year = Functions.extract_data_from_files("currentYear")
        Files.current_month = Functions.extract_data_from_files("currentMonth")
        Files.min_year = Functions.extract_data_from_files("minYear")
        Files.max_year = Functions.extract_data_from_files("maxYear")
        Files.min_month = Functions.extract_data_from_files("minMonth")
        Files.max_month = Functions.extract_data_from_files("maxMonth")
    except Exception as e:
        raise ValueError(f"שגיאה בחילוץ תאריכים מהקבצים: {e}")

    # 7. Generate derived reports
    try:
        Files.socialAnalysisDF = Functions.get_social_analysis()
    except Exception as e:
        raise ValueError(f"שגיאה ביצירת דוח אנליזה סוציאלית: {e}")

    try:
        Files.monthsComparisonDF = Functions.get_months_comparison()
    except Exception as e:
        raise ValueError(f"שגיאה ביצירת דוח השוואת חודשים: {e}")

    try:
        Files.reportsAgainstCenterDF = Functions.get_reports_against_center()
    except Exception as e:
        raise ValueError(f"שגיאה ביצירת דוח דוחות מול מרכז שכר: {e}")

    # comparison_h = Headers.MonthsComparison
    # rac_h = Headers.ReportsAgainstCenter
    # Files.socialAnalysisCheckupColumns = {

    # }
    # Files.monthsComparisonCheckupColumns = {
    #     comparison_h.offset: lambda val : val > 0,
    #     comparison_h.offset_pct: lambda val : val > 0,
    # }
    # Files.reportsAgainstCenterCheckupColumns = {
    #     rac_h.offset: lambda val : val == 0,
    #     rac_h.offset_pct: lambda val : val == 0,
    # }

