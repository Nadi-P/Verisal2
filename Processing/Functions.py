import re
import os
import io
from typing import List
from fastapi import UploadFile
import numpy as np
import pandas as pd
from Processing.Files import Files
from Processing.Headers import Headers

class Functions:
    join_key = 'מפתח_עובד_חודש'
    key_regex = r'^(.+)-(\d{1,2})-(\d{4})$'
    group_list = [
        join_key, 
        Headers.InputFiles.Center.work_year, 
        Headers.InputFiles.Center.work_month, 
        Headers.InputFiles.Center.employee_id
    ]

    class Aggregations:
        def extract_month(val):
            try:
                return int(str(val).split('/')[1])
            except (IndexError, ValueError, AttributeError):
                return None

        def extract_year(val):
            try:
                return int(str(val).split('/')[0])
            except (IndexError, ValueError, AttributeError):
                return None

        def standarize_df(df):
            center_h = Headers.InputFiles.Center
            id_col = center_h.employee_id            
            month_col = center_h.work_month
            year_col = center_h.work_year
            df = df.copy()

            df[month_col] = df[month_col].apply(Functions.Aggregations.extract_month)

            # Standardize the month part
            ids = df[id_col].astype(str).str.strip()
            months = df[month_col].astype(str).str.strip()        
            years = df[year_col].astype(str).str.strip()

            df[Functions.join_key] = ids + "-" + months + "-" + years
            return df.fillna(0)
        
        def aggregate_center(df):
            center_h = Headers.InputFiles.Center
            df = df.copy()
            
            df = df.rename(columns={center_h.employee_id_shiklulit: center_h.employee_id})
            df = df.dropna(subset=[center_h.employee_id])
            df[center_h.employee_id] = pd.to_numeric(df[center_h.employee_id], errors='coerce').fillna(0).astype('int64')

            df[center_h.employee_id] = (
                pd.to_numeric(df[center_h.employee_id], errors='coerce')
                .fillna(0)
                .astype(int)
            )

            # 3. Set Year and Month
            df[center_h.work_year] = Files.current_year
            df[center_h.work_month] = f"{Files.current_year}/{Files.current_month:02}"
            # 4. Standardize (Now the join_key will be built with clean IDs)
            df = Functions.Aggregations.standarize_df(df)


            
            # 5. Calculate Total Salary
            components = [
                center_h.base_salary,
                center_h.global_overtime,
                center_h.car_or_travel_allowance,
                center_h.bonus,
                center_h.quarterly_bonus_for_social,
                center_h.quarterly_commission,
                center_h.reserve_adjustments,
            ]
            
            df[center_h.total_salary] = (
                df[components]
                .apply(pd.to_numeric, errors='coerce')
                .fillna(0)
                .sum(axis=1)
            )

            return df

        def aggregate_absences(df):
            absencesFileHeaders = Headers.InputFiles.Absences
            df = Functions.Aggregations.standarize_df(df)

            agg_map = {
                absencesFileHeaders.vacation_previous_balance: 'sum',
                absencesFileHeaders.vacation_monthly_accrual: 'sum',
                absencesFileHeaders.vacation_monthly_usage: 'sum',
                absencesFileHeaders.vacation_monthly_balance: 'sum',
                absencesFileHeaders.sick_previous_balance: 'sum',
                absencesFileHeaders.sick_monthly_accrual: 'sum',
                absencesFileHeaders.sick_monthly_usage: 'sum',
                absencesFileHeaders.sick_monthly_balance: 'sum'
            }
            
            result = df.groupby(Functions.group_list).agg(agg_map).reset_index()
            
            return result.rename(columns={
                absencesFileHeaders.vacation_previous_balance: "חופשה_יתרה_קודמת",
                absencesFileHeaders.vacation_monthly_accrual: "חופשה_צבירה_חודשית",
                absencesFileHeaders.vacation_monthly_usage: "חופשה_ניצול_חודשי",
                absencesFileHeaders.vacation_monthly_balance: "חופשה_יתרה_חודשית",
                absencesFileHeaders.sick_previous_balance: "מחלה_יתרה_קודמת",
                absencesFileHeaders.sick_monthly_accrual: "מחלה_צבירה_חודשית",
                absencesFileHeaders.sick_monthly_usage: "מחלה_ניצול_חודשי",
                absencesFileHeaders.sick_monthly_balance: "מחלה_יתרה_חודשית"
            })

        def aggregate_income(df):
            incomeFileHeaders = Headers.InputFiles.Income
            incomeAGGHeaders = Headers.AggregatedFiles.IncomeAGG
            df = Functions.Aggregations.standarize_df(df)

            df = df.groupby(Functions.group_list).agg({incomeFileHeaders.total: 'sum'}).reset_index()
            df = df.rename(columns={incomeFileHeaders.total: incomeAGGHeaders.total})
            
            return df

        def aggregate_providents(df):
            providentsFileHeaders = Headers.InputFiles.Providents
            providentsAGGHeaders = Headers.AggregatedFiles.ProvidentsAGG
            df = Functions.Aggregations.standarize_df(df)
            
            result = df.groupby(Functions.group_list).agg({
                providentsFileHeaders.employee_pension: 'sum',      # גמל עובד
                providentsFileHeaders.employer_pension: 'sum',      # גמל מעסיק
                providentsFileHeaders.severance_pay: 'sum',         # פיצויים
                providentsFileHeaders.employee_other: 'sum',       # סה"כ עובד (משמש בדרך כלל לקה"ל בדו"חות מסוימים)
                providentsFileHeaders.employer_other: 'sum',       # סה"כ מעסיק
                providentsFileHeaders.employee_disability: 'sum',   # אכ"ע עובד
                providentsFileHeaders.employer_disability: 'sum'    # אכ"ע מעסיק
            }).reset_index()
            
            result = result.rename(columns={
                providentsFileHeaders.employee_pension: providentsAGGHeaders.employee_pension_total,
                providentsFileHeaders.employer_pension: providentsAGGHeaders.employer_pension_total,
                providentsFileHeaders.severance_pay: providentsAGGHeaders.severance_total,  
                providentsFileHeaders.employee_other: providentsAGGHeaders.employee_study_fund_total,
                providentsFileHeaders.employer_other: providentsAGGHeaders.employer_study_fund_total,
                providentsFileHeaders.employee_disability: providentsAGGHeaders.employee_disability_total,
                providentsFileHeaders.employer_disability: providentsAGGHeaders.employer_disability_total,
                providentsFileHeaders.work_month: providentsAGGHeaders.work_month
            })
            
            return result

        def aggregate_deductions(df):
            deductionsFileHeaders = Headers.InputFiles.Deductions
            df = Functions.Aggregations.standarize_df(df)
            
            result = df.groupby(Functions.group_list).agg({
                deductionsFileHeaders.total_sum: 'sum',
                deductionsFileHeaders.component_code: 'count' 
            }).reset_index()
            
            result = result.rename(columns={
                deductionsFileHeaders.total_sum: 'סה"כ ניכויי רשות',
                deductionsFileHeaders.component_code: 'מספר רכיבים שונים'
            })
            
            return result

        def aggregate_components(df):
            comp_h = Headers.InputFiles.Components
            mask = Headers.SocialAnalysis.ComponentsMask
            df = Functions.Aggregations.standarize_df(df)
            social_list = [
                mask.base_salary, mask.global_overtime, mask.quarterly_bonus_social,
                mask.early_notice_payment_taxable, mask.quarterly_commission_social,
                mask.base_salary_rate_2, mask.global_overtime_rate_2, mask.hourly_holidays
            ]

            def calculate_social(row):
                if row[comp_h.component_name] in social_list:
                    return pd.to_numeric(row[comp_h.total_amount], errors='coerce')
                return 0

            df[comp_h.social_total] = df.apply(calculate_social, axis=1)
            
            result = df.groupby(Functions.group_list).agg({
                comp_h.total_amount: 'sum',
                comp_h.social_total: 'sum'
            }).reset_index()

            result = result.rename(columns={
                comp_h.social_total: 'סהכ_רכיבים_לסוציאליות'
            })

            return result
        
        def aggregate_costing(df):
            return Functions.Aggregations.standarize_df(df)

        def standarize_absences(df):
            return Functions.Aggregations.standarize_df(df)

    class Querying:
        def print_df(df):
            """
            Prints comprehensive metadata and the full content of a DataFrame.
            """
            if not isinstance(df, pd.DataFrame):
                print("Error: Input is not a Pandas DataFrame.")
                return

            # 1. Print Shape Metadata
            rows, cols = df.shape
            print("=" * 30)
            print(f"DATAFRAME SUMMARY")
            print("=" * 30)
            print(f"Total Rows:    {rows}")
            print(f"Total Columns: {cols}")
            print("-" * 30)

            # 2. Print Column Names (as a list for readability)
            print("COLUMN NAMES:")
            print(df.columns.tolist())
            print("-" * 30)

            # 3. Print Full Dataframe Content
            # Using option_context ensures we don't permanently mess up your global settings
            with pd.option_context(
                'display.max_rows', None, 
                'display.max_columns', None, 
                'display.width', 1000, 
                'display.expand_frame_repr', False
            ):
                print("FULL DATA:")
                print(df.to_string())
            print("=" * 30)

        def query_employee_rows(df):
            while True:
                try:
                    emp_id = int(input("Enter employee ID (number < 1 to exit): "))

                    if emp_id < 1:
                        print("Exiting...")
                        break
                    if emp_id in df["מספר עובד"].values:
                        print(df[df["מספר עובד"] == emp_id].to_string())
                    else:
                        print("Employee not found.")

                except ValueError:
                    print("Please enter a valid number.")

        def print_is_columns_in_df(df, columns_names):
            missing_columns = [col for col in columns_names if col not in df.columns]
            if missing_columns:
                print(f"Warning: The following columns are missing from the DataFrame: {missing_columns}")
            else:
                print("All specified columns are present in the DataFrame.")
    
    def GetFileFromObject(file_obj, key, sheetName):
        """
        Replaces GetFile(key, sheetName).
        Reads an Excel file from an UploadFile object buffer.
        """
        display = Files.DISPLAY_NAMES.get(key, key)

        if not file_obj:
            raise ValueError(f"קובץ {display} לא נמצא")

        header_row = 7 if key == "center" else 0

        try:
            file_obj.file.seek(0)
            content = file_obj.file.read()
            buffer = io.BytesIO(content)

            with pd.ExcelFile(buffer) as xls:
                target_sheet = xls.sheet_names[0] if sheetName is None else sheetName
                df = pd.read_excel(xls, sheet_name=target_sheet, header=header_row)

            df.columns = df.columns.astype(str).str.strip()
            return df
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

        # 4. Extract company name from center file
        try:
            Files.company_name = Functions.extract_data_from_files("companyName")
        except Exception as e:
            raise ValueError(f"שגיאה בחילוץ שם חברה מקובץ מרכז שכר: {e}")

        # 5. Load all 7 DataFrames (GetFileFromObject raises on failure)
        Files.centerDF = Functions.GetFileFromObject(file_map.get("center"), "center", Files.company_name)
        Files.componentsDF = Functions.GetFileFromObject(file_map.get("components"), "components", Files.company_name)
        Files.providentsDF = Functions.GetFileFromObject(file_map.get("providents"), "providents", Files.company_name)
        Files.incomeDF = Functions.GetFileFromObject(file_map.get("income"), "income", Files.company_name)
        Files.deductionsDF = Functions.GetFileFromObject(file_map.get("deductions"), "deductions", Files.company_name)
        Files.costingDF = Functions.GetFileFromObject(file_map.get("costing"), "costing", Files.company_name)
        Files.absencesDF = Functions.GetFileFromObject(file_map.get("absences"), "absences", Files.company_name)

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

        social_h = Headers.SocialAnalysis.SocialAnalysisFile
        comparison_h = Headers.MonthsComparison
        rac_h = Headers.ReportsAgainstCenter
        Files.socialAnalysisCheckupColumns = {

        }
        Files.monthsComparisonCheckupColumns = {
            comparison_h.offset: lambda val : val > 0,
            comparison_h.offset_pct: lambda val : val > 0,
        }
        Files.reportsAgainstCenterCheckupColumns = {
            rac_h.offset: lambda val : val == 0,
            rac_h.offset_pct: lambda val : val == 0,
        }

    def extract_data_from_files(requiredDataName):
        centerFileObj = Files.files_map.get("center")
        if not centerFileObj:
            raise ValueError("קובץ מרכז שכר לא נמצא")

        match requiredDataName:
            case "companyName":
                centerFileObj.file.seek(0)
                content = centerFileObj.file.read()
                buffer = io.BytesIO(content)
                with pd.ExcelFile(buffer) as xls:
                    return xls.sheet_names[0]

            case "currentMonth":
                # Splitting 'קובץ מרכז שכר לחודש 08.2025.xlsx' to get the date part
                # Assuming format: "Filename MM.YYYY.xlsx"
                filename = centerFileObj.filename
                date_part = filename.split()[-1].replace('.xlsx', '').replace('.xls', '')
                return Functions.Aggregations.extract_year(date_part.replace('.', '/'))

            case "currentYear":
                filename = centerFileObj.filename
                date_part = filename.split()[-1].replace('.xlsx', '').replace('.xls', '')
                return Functions.Aggregations.extract_month(date_part.replace('.', '/'))

            case "minYear" | "maxYear" | "minMonth" | "maxMonth":
                all_years = []
                all_months = []
                
                year_col = "שנת עבודה"
                month_col = "חודש עבודה"

                for df in [
                    Files.providentsDF, 
                    Files.componentsDF, 
                    Files.incomeDF, 
                    Files.deductionsDF, 
                    Files.costingDF, 
                    Files.absencesDF
                ]:
                    
                    if year_col in df.columns:
                        all_years.extend(df[year_col].dropna().apply(Functions.Aggregations.extract_year).unique().tolist())
                    
                    if month_col in df.columns:
                        all_months.extend(df[month_col].dropna().apply(Functions.Aggregations.extract_month).unique().tolist())

                if not all_years:
                    return None

                if requiredDataName == "minYear": return min(all_years)
                if requiredDataName == "maxYear": return max(all_years)
                if requiredDataName == "minMonth": return min(all_months) if all_months else None
                if requiredDataName == "maxMonth": return max(all_months) if all_months else None

            case _:
                return None
        
    def run_payroll_audit():
        centerFileHeaders = Headers.InputFiles.Center

        centerAgg = Functions.Aggregations.aggregate_center(Files.centerDF)
        provAgg = Functions.Aggregations.aggregate_providents(Files.providentsDF)
        componentsAgg = Functions.Aggregations.aggregate_components(Files.componentsDF)
        incomeAgg = Functions.Aggregations.aggregate_income(Files.incomeDF)
        deductionsAgg = Functions.Aggregations.aggregate_deductions(Files.deductionsDF)
        costingData = Functions.Aggregations.aggregate_costing(Files.costingDF)
        absencesAgg = Functions.Aggregations.standarize_absences(Files.absencesDF)  # שים לב שזה לא אגרגציה, אלא הכנה בלבד

        jk = Functions.join_key

        all_source_dfs = [
            centerAgg, provAgg, componentsAgg, 
            incomeAgg, deductionsAgg, costingData, absencesAgg
        ]
        
        all_keys = pd.concat([df[jk] for df in all_source_dfs if jk in df.columns]).unique()
        audit_df = pd.DataFrame({jk: all_keys})

        # 3. הגדרת המקורות והתחיליות (Prefixes)
        # המבנה מקביל בדיוק ל-SourceTables ב-PQ
        sources = [
            (centerAgg, "מרכזשכר"),
            (provAgg, "קופות"),
            (componentsAgg, "רכיבים"),
            (incomeAgg, "זקיפות"),
            (deductionsAgg, "ניכויים"),
            (costingData, "תמחיר"),
            (absencesAgg, "היעדרויות")
        ]

        for df, prefix in sources:
            rename_map = {col: f"{prefix}_{col}" for col in df.columns if col != jk}
            prefixed_df = df.rename(columns=rename_map)
            
            audit_df = audit_df.merge(prefixed_df, on=jk, how="left")

        audit_df = audit_df.fillna(0)

        split_pattern = Functions.key_regex
        parsed_keys = audit_df[jk].str.extract(split_pattern)

        audit_df[centerFileHeaders.employee_id] = parsed_keys[0].astype(int)
        audit_df[centerFileHeaders.work_month] = parsed_keys[1].astype(int)
        audit_df[centerFileHeaders.work_year] = parsed_keys[2].astype(int)


        return audit_df

    def get_social_analysis():
        center_h = Headers.InputFiles.Center
        components_h = Headers.InputFiles.Components
        providents_h = Headers.AggregatedFiles.ProvidentsAGG
        social_h = Headers.SocialAnalysis.SocialAnalysisFile

        center_df = Functions.Aggregations.aggregate_center(Files.centerDF)
        providentsAgg = Functions.Aggregations.aggregate_providents(Files.providentsDF)
        componentsAgg = Functions.Aggregations.aggregate_components(Files.componentsDF)

        # 1. הכנת עמודות מהמרכז (השם והתקרה)
        center_cols = center_df[[
            center_h.employee_id,
            center_h.employee_name,
            center_h.study_fund_tax_ceiling_deposit
        ]].drop_duplicates(subset=[center_h.employee_id])
        # 2. הבסיס החדש: כל מי שמופיע ברכיבי השכר (Social Total)
        # אנחנו מתחילים מכאן כדי לא לאבד עובדים שאין להם הפרשות לקופות

        main_df = componentsAgg[[
            Functions.join_key,
            components_h.work_month,
            components_h.employee_id,
            components_h.social_total
        ]].copy()
        # 3. מיזוג נתוני הקופות לתוך בסיס השכר (Left Merge)
        # מי שאין לו נתונים בקופות יקבל NaN, אותו נהפוך ל-0 מיד אחרי
        main_df = main_df.merge(
            providentsAgg[[
                Functions.join_key,
                providents_h.employee_pension_total,
                providents_h.employer_pension_total,
                providents_h.severance_total,
                providents_h.employer_study_fund_total
            ]], 
            on=Functions.join_key, 
            how='left'
        ).fillna(0) # קריטי: הופך חוסר נתונים בקופות ל-0

        # 4. מיזוג נתוני המרכז (שם ותקרה) לפי מספר עובד
        main_df = main_df.merge(
            center_cols, 
            left_on=components_h.employee_id, 
            right_on=center_h.employee_id, 
            how='left'
        )

        # א. יצירת עמודת שם עובד (טיפול במקרה שהעובד לא נמצא במרכז)
        main_df[components_h.emloyee_name] = main_df[center_h.employee_name].fillna("לא נמצא במרכז")

        # הכנת משתני עזר מספריים לחישוב
        social_base = pd.to_numeric(main_df[components_h.social_total], errors='coerce').fillna(0)
        ee_pension = pd.to_numeric(main_df[providents_h.employee_pension_total], errors='coerce').fillna(0)
        er_pension = pd.to_numeric(main_df[providents_h.employer_pension_total], errors='coerce').fillna(0)

        # ב. חישוב אחוז גמל עובד
        main_df[social_h.ee_prov_pct] = np.where(
            social_base != 0, 
            ((ee_pension / social_base) * 100).round(2).astype(str) + '%', 
            '0.00%'
        )

        # ג. חישוב אחוז גמל מעסיק
        main_df[social_h.er_prov_pct] = np.where(
            social_base != 0, 
            ((er_pension / social_base) * 100).round(2).astype(str) + '%', 
            '0.00%'
        )

        # ד. בסיס קהל נגזר - רק אם רשום "כן"
        main_df[social_h.capped_val] = np.where(
            main_df[center_h.study_fund_tax_ceiling_deposit] == "כן",
            social_base.clip(upper=15712),
            0
        )
        
        # סידור עמודות סופי
        headersList = [
            Functions.join_key,
            components_h.emloyee_name,
            components_h.employee_id, # משתמשים ב-ID מהרכיבים
            components_h.work_month,
            components_h.social_total,
            providents_h.employee_pension_total,
            providents_h.employer_pension_total,
            providents_h.severance_total,
            providents_h.employer_study_fund_total,
            social_h.ee_prov_pct,
            social_h.er_prov_pct,
            social_h.capped_val
        ]

        return main_df[headersList]
    
    def get_months_comparison(input_months1=None, input_year1=None, input_months2=None, input_year2=None):
        center_h = Headers.InputFiles.Center
        comparison_h = Headers.MonthsComparison
        source_df = Functions.run_payroll_audit()

        month1 = Files.max_month
        year1 = Files.max_year
        month2 = Files.min_month
        year2 = Files.min_year

        if input_months1 and input_months2 and input_year1 and input_year2:
            year1, year2 = input_year1, input_year2
            month1, month2 = input_months1, input_months2

        curr_table = source_df[
            (source_df[center_h.work_month] == month1) & 
            (source_df[center_h.work_year] == year1)
        ].copy()
        
        prev_table = source_df[
            (source_df[center_h.work_month] == month2) & 
            (source_df[center_h.work_year] == year2)
        ].copy()

        def create_lookup_key(key):
            split_pattern = Functions.key_regex
            parts = re.split(split_pattern, key)
            return f"{parts[1]}-{month2}-{str(year2)}"

        curr_table['LookupPrev'] = curr_table[Functions.join_key].apply(create_lookup_key)


        # 4. מיזוג לפי המפתח המחושב (Joined)
        # אנחנו מביאים את כל עמודות ה-Prev ומצמידים אותן ל-Curr
        joined = curr_table.merge(
            prev_table, 
            left_on='LookupPrev', 
            right_on=Functions.join_key, 
            how='left', 
            suffixes=('', '_prev')
        )

        # 5. יצירת שורות האנליזה (הפיכת עמודות לשורות - Unpivot מבוקר)
        check_list = [
            {"בדיקה": "שכר ברוטו", "סיווג": "תשלומים", "עמודה": "תמחיר_ברוטו"},
            {"בדיקה": "שכר נטו", "סיווג": "תשלומים", "עמודה": "תמחיר_נטו לתשלום"},
            {"בדיקה": "עלות מעסיק", "סיווג": "עלויות", "עמודה": "תמחיר_עלות מעסיק"},
            {"בדיקה": "מס הכנסה", "סיווג": "ניכויי חובה", "עמודה": "תמחיר_מס הכנסה"},
            {"בדיקה": "ב.ל עובד", "סיווג": "ניכויי חובה", "עמודה": "תמחיר_ב.ל. עובד"},
            {"בדיקה": "ב.ל מעסיק", "סיווג": "עלויות", "עמודה": "תמחיר_ב.ל. מעסיק"},
            {"בדיקה": "גמל מעסיק", "סיווג": "סוציאליות", "עמודה": "קופות_קופות_סה\"כ גמל מעסיק"},
            {"בדיקה": "קה\"ל מעסיק", "סיווג": "סוציאליות", "עמודה": "קופות_קופות_סה\"כ קה\"ל מעסיק"},
            {"בדיקה": "ניכויי רשות", "סיווג": "ניכויים", "עמודה": "ניכויים_סה\"כ ניכויי רשות"},
            {"בדיקה": "זקיפות שווי", "סיווג": "זקיפות", "עמודה": "זקיפות_סהכ_זקיפות"},
            {"בדיקה": "רכיבים לסוציאליות", "סיווג": "בסיס שכר", "עמודה": "רכיבים_סהכ_רכיבים_לסוציאליות"},
            {"בדיקה": "ימי עבודה", "סיווג": "נוכחות", "עמודה": "תמחיר_כמות ימים"}
        ]

        analysis_rows = []
        month1_str = f"{month1:02d}/{year1}"
        month2_str = f"{month2:02d}/{year2}"
        # לכל עובד ב-Joined, אנחנו מייצרים 12 שורות (אחת לכל בדיקה)
        for _, row in joined.iterrows():
            for item in check_list:
                col_name = item['עמודה']
                curr_val = row[col_name] if pd.notnull(row[col_name]) else 0
                prev_val = row[col_name + '_prev'] if col_name + '_prev' in row and pd.notnull(row[col_name + '_prev']) else 0
                
                analysis_rows.append({
                    comparison_h.employee_id: row[center_h.employee_id],
                    comparison_h.employee_name: row["מרכזשכר" + "_" + center_h.employee_name],
                    comparison_h.check: item['בדיקה'],
                    comparison_h.category: item['סיווג'],
                    month1_str: curr_val,
                    month2_str: prev_val
                })

        final_df = pd.DataFrame(analysis_rows)

        final_df[comparison_h.offset] = final_df[month1_str] - final_df[month2_str]
        # 6. חישוב סטייה ואחוזים (AddCalc, AddPct)
        final_df[comparison_h.offset_pct] = np.where(
            final_df[month2_str] != 0,
            (final_df[comparison_h.offset] / final_df[month2_str] * 100),
            0
        )

        # Format as a string with the % symbol
        final_df[comparison_h.offset_pct] = final_df[comparison_h.offset_pct].apply(lambda x: f"{x:.2f}%")
        return final_df

    def get_reports_against_center():
        c_h = Headers.InputFiles.Center
        cost_h = Headers.InputFiles.Costing
        inc_h = Headers.AggregatedFiles.IncomeAGG
        abs_h = Headers.AggregatedFiles.AbsencesAGG
        prov_h = Headers.AggregatedFiles.ProvidentsAGG
        fac_h = Headers.ReportsAgainstCenter

        # 1. Run Aggregations from the Functions module
        centerAgg = Functions.Aggregations.aggregate_center(Files.centerDF)
        costingAgg = Functions.Aggregations.aggregate_costing(Files.costingDF)
        absencesAgg = Functions.Aggregations.aggregate_absences(Files.absencesDF)
        incomeAgg = Functions.Aggregations.aggregate_income(Files.incomeDF)
        provAgg = Functions.Aggregations.aggregate_providents(Files.providentsDF)

        
        # Filter Center to the current period
        audit_df = centerAgg[
            (centerAgg[c_h.work_year] == Files.current_year) & 
            (centerAgg[c_h.work_month] == Files.current_month)
        ].copy()

        if audit_df.empty:
            print(f"CRITICAL ERROR: No data found in Center file for {Files.current_month}/{Files.current_year}")
            return pd.DataFrame()

        # 3. Merges (The Join Key logic is now handled inside create_key)
        jk = Functions.join_key

        audit_df = audit_df.merge(
            costingAgg[[jk, cost_h.gross_salary, cost_h.voluntary_deductions]],
            on=jk, how="left"
        )
        audit_df = audit_df.merge(
            incomeAgg[[jk, inc_h.total]], 
            on=jk, how="left"
        )
        audit_df = audit_df.merge(
            absencesAgg[[jk, abs_h.vacation_monthly_usage, abs_h.sick_monthly_usage]], 
            on=jk, how="left"
        )
        audit_df = audit_df.merge(
            provAgg[[jk, prov_h.employee_study_fund_total, prov_h.employer_study_fund_total]], 
            on=jk, how="left"
        )
        
        # 4. Analysis Loop
        results = []
        for _, row in audit_df.iterrows():
            # Standard Checks
            checks = [
                ("1. שכר ברוטו", (row.get(c_h.total_salary)), (row.get(cost_h.gross_salary))),
                ("2. שווי (ארוחות/מתנות)", (row.get(c_h.meal_value)) + (row.get(c_h.gift_value)), (row.get(inc_h.total))),
                ("3. ניכויי רשות", (row.get(c_h.local_expense_reimbursement)) + (row.get(c_h.expense_charge)) + (row.get(c_h.abroad_expense_reimbursement)), (row.get(cost_h.voluntary_deductions))),
                ("4. ניצול חופשה", (row.get(c_h.vacation_usage)), (row.get(abs_h.vacation_monthly_usage))),
                ("5. ניצול מחלה", (row.get(c_h.sick_usage)), (row.get(abs_h.sick_monthly_usage)))
            ]

            # Kahal Logic
            kahal_raw = str(row.get(c_h.study_fund_tax_ceiling_deposit, "")).strip()
            kahal_eligible = "כן" if "כן" in kahal_raw else ("לא" if "לא" in kahal_raw else "חסר נתון")
            kahal_sum = (row.get(prov_h.employee_study_fund_total)) + (row.get(prov_h.employer_study_fund_total))
            
            if kahal_eligible == "חסר נתון": kahal_stat_text = "בדיקה ידנית - חסר סימון במרכז שכר"
            elif kahal_eligible == "כן" and kahal_sum == 0: kahal_stat_text = "חסרה הפקדה!"
            elif kahal_eligible == "לא" and kahal_sum > 0: kahal_stat_text = "הפרשה קיימת ללא סימון זכאות"
            else: kahal_stat_text = "תקין"

            # Construct rows for final table
            for name, input_val, output_val in checks:
                diff = input_val - output_val
                diff_pct = (diff / input_val * 100) if input_val != 0 else 0
                results.append({
                    fac_h.employee_id: row[c_h.employee_id],
                    fac_h.employee_name: row[c_h.employee_name],
                    fac_h.month: Files.current_month,
                    fac_h.check: name,
                    fac_h.center_input: input_val,
                    fac_h.external_reports_output: output_val,
                    fac_h.offset: diff,
                    fac_h.offset_pct: f"{diff_pct:.2f}%",
                    fac_h.status: "תקין" if abs(diff) < 0.1 else "הפרש בבדיקה"
                })

            results.append({
                fac_h.employee_id: row[c_h.employee_id],
                fac_h.employee_name: row[c_h.employee_name],
                fac_h.month: Files.current_month,
                fac_h.check: '6. קה"ל (זכאות)',
                fac_h.center_input: kahal_eligible,
                fac_h.external_reports_output: kahal_sum,
                fac_h.offset: 0,
                fac_h.offset_pct: "0%",
                fac_h.status: kahal_stat_text
            })

        return pd.DataFrame(results)


