from typing import List
import io

from Files import Files
from Headers import Headers
from Constants import KEYWORDS, DISPLAY_NAMES
from fastapi import UploadFile
import pandas as pd



def GetFileFromObject(file_obj, key):
    """
    Reads a system-report Excel file from an UploadFile buffer.
    Tries sheet index 1 (standard שקלולית layout); on failure falls back to the
    first sheet whose name contains "בע"מ". Use _load_center_sheets for the
    center file — it has its own signature-based detection and produces two DFs.
    """
    display = DISPLAY_NAMES.get(key, key)

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
          to that code (real codes are always positive).
        - Else walk ALWAYS_INCLUDE: a list of (substrings, fake_code) tuples.
          The first tuple whose substrings are ALL contained in the column header
          wins — keep the column, rename it to that fake_code (always negative,
          so it can't collide with a real code).
        - Else → drop the column.
    Every column in the resulting DF is keyed by an integer code (positive for
    real codes, negative for ALWAYS_INCLUDE matches).
    """

    ALWAYS_INCLUDE = [
        # (["substring1", "substring2"], -1),
        (["מספר", "עובד"], -1),   # in case signature detection fails, we still want to keep these columns by matching their headers
        (["מס", "זהות"], -2),
        (["שם", "עובד"], -3),
        (["האם", "קה\"ל"], -4),

    ]

    if header_row <= 0:
        # No row above the headers → no real codes; only ALWAYS_INCLUDE matches survive.
        keep_cols = []
        rename_map = {}
        for header_name in data_df.columns:
            for needles, fake_code in ALWAYS_INCLUDE:
                if all(n in header_name for n in needles):
                    keep_cols.append(header_name)
                    rename_map[header_name] = fake_code
                    break
        if not keep_cols:
            return data_df.iloc[:, :0].copy()
        return data_df[keep_cols].rename(columns=rename_map).copy()

    codes_row = raw_df.iloc[header_row - 1]

    # Iterate by POSITION, not by header name. data_df.columns[pos] is pandas'
    # already-deduplicated, stripped column name at position pos — matching by
    # name fails silently when headers repeat (pandas appends ".1") or contain
    # invisible chars (RTL marks, NBSP) that survive .strip().
    n_cols = min(len(data_df.columns), len(codes_row))

    keep_positions = []   # positional indices into data_df
    new_codes = []        # integer code for each kept position

    for pos in range(n_cols):
        col_name = data_df.columns[pos]

        code_cell = codes_row.iat[pos]
        code_int = None
        if isinstance(code_cell, bool):
            pass
        elif isinstance(code_cell, int):
            code_int = code_cell
        elif isinstance(code_cell, float) and not pd.isna(code_cell) and float(code_cell).is_integer():
            code_int = int(code_cell)
        elif isinstance(code_cell, str):
            s = code_cell.strip()
            if s.lstrip('-').isdigit():
                code_int = int(s)

        if code_int is not None:
            keep_positions.append(pos)
            new_codes.append(code_int)
            continue

        if isinstance(col_name, str):
            for needles, fake_code in ALWAYS_INCLUDE:
                if all(n in col_name for n in needles):
                    keep_positions.append(pos)
                    new_codes.append(fake_code)
                    break

    if not keep_positions:
        return data_df.iloc[:, :0].copy()

    coded = data_df.iloc[:, keep_positions].copy()
    coded.columns = new_codes
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
    display = DISPLAY_NAMES.get("center", "center")

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
    Maps file objects, parses them into pandas DataFrames, 
    and returns a dictionary of dataframes.
    """
    # 1. Filter to only .xlsx/.xls files
    excel_files = [f for f in files_list if f.filename.lower().endswith(('.xlsx', '.xls'))]

    if not excel_files:
        raise ValueError("לא נמצאו קבצי Excel בתיקייה שנבחרה")

    # 2. Map the uploaded file objects to their temporary keys
    file_map = {}
    unmatched = []
    for file_obj in excel_files:
        filename = file_obj.filename.lower()
        matched = False
        for key, keyword in KEYWORDS.items():
            if keyword.lower() in filename:
                if key in file_map:
                    display = DISPLAY_NAMES[key]
                    raise ValueError(f"נמצאו מספר קבצים עבור \"{display}\" — נדרש קובץ אחד בלבד לכל סוג")
                file_map[key] = file_obj
                matched = True
                break
        if not matched:
            unmatched.append(file_obj.filename)

    # 3. Validate all required keys are present
    expected_keys = set(KEYWORDS.keys())
    matched_keys = set(file_map.keys())
    missing_keys = expected_keys - matched_keys

    if missing_keys or unmatched:
        lines = []
        if missing_keys:
            lines.append("קבצים חסרים:")
            for k in missing_keys:
                lines.append(f"  - {DISPLAY_NAMES[k]}")
        if unmatched:
            lines.append("קבצים לא מזוהים:")
            for name in unmatched:
                lines.append(f"  - {name}")
        raise ValueError("\n".join(lines))

    # 4. Parse the file objects into actual pandas DataFrames
    dfs_map = {}
    for key, file_obj in file_map.items():
        if key == "center":
            # The center file yields a tuple: (center_df, center_df_coded)
            center_df, center_df_coded = _load_center_sheets(file_obj)
            dfs_map["center"] = center_df
            dfs_map["center_coded"] = center_df_coded
        else:
            # All other standard files yield a single DataFrame
            dfs_map[key] = GetFileFromObject(file_obj, key)

    return dfs_map