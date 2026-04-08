import re
import os
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
    
    def InitializeData():
        Files.initialize_file_mapping()

        Files.company_name = Functions.extract_data_from_files("companyName")

        Files.centerDF = Files.GetFile("center", Files.company_name)
        Files.componentsDF = Files.GetFile("components", Files.company_name)
        Files.providentsDF = Files.GetFile("providents", Files.company_name)
        Files.incomeDF = Files.GetFile("income", Files.company_name)
        Files.deductionsDF = Files.GetFile("deductions", Files.company_name)
        Files.costingDF = Files.GetFile("costing", Files.company_name)
        Files.absencesDF = Files.GetFile("absences", Files.company_name)

        Files.current_year = Functions.extract_data_from_files("currentYear")
        Files.min_year = Functions.extract_data_from_files("minYear")
        Files.max_year = Functions.extract_data_from_files("maxYear")

        Files.current_month = Functions.extract_data_from_files("currentMonth")
        Files.min_month = Functions.extract_data_from_files("minMonth")
        Files.max_month = Functions.extract_data_from_files("maxMonth")

        Files.socialAnalysisDF = Functions.get_social_analysis()
        Files.monthsComparisonDF = Functions.get_months_comparison()
        Files.reportsAgainstCenterDF = Functions.get_reports_against_center()

        social_h = Headers.SocialAnalysis.SocialAnalysisFile
        Files.socialAnalysisCheckupColumns = {
            social_h.total_sum : lambda val : val > 0,
            social_h.ee_prov_sum : lambda val : val > 0,
            social_h.er_prov_sum : lambda val : val > 0,
            social_h.er_sev_sum : lambda val : val > 0,
            social_h.ee_edu_sum : lambda val : val > 0,
            social_h.er_edu_sum : lambda val : val > 0,
            social_h.ee_prov_pct : lambda val : val > 0,
            social_h.er_prov_pct : lambda val : val > 0,
            social_h.capped_val : lambda val : val > 0,
        }
        Files.socialAnalysisCheckupColumns = {
            
        }


    def extract_data_from_files(requiredDataName):
        centerFileName = Files.controlFiles.get("center")
        if not centerFileName:
            raise ValueError("Center file not found in mapped files.")

        match requiredDataName:
            case "companyName":
                path = os.path.join(Files.base_path, centerFileName)
                with pd.ExcelFile(path) as xls:
                    # Returns the name of the first sheet
                    return xls.sheet_names[0]

            case "currentMonth":
                # Splitting 'קובץ מרכז שכר לחודש 08.2025.xlsx' to get the date part
                # Assuming format: "Filename MM.YYYY.xlsx"
                date_part = centerFileName.split()[-1].replace('.xlsx', '')
                return Functions.Aggregations.extract_year(date_part.replace('.', '/'))

            case "currentYear":
                date_part = centerFileName.split()[-1].replace('.xlsx', '')
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

    def get_queryable_merged_reports():
        def aggregate_center(df):
            center_h = Headers.InputFiles.Center
            df = df.copy()
            
            df = df.rename(columns={
                center_h.employee_id_shiklulit : center_h.employee_id,
            })
            df[center_h.work_month] = Files.current_month
            df[center_h.work_year] = Files.current_year
            df = Functions.Aggregations.standarize_df(df)
    
            
            return df

        def aggregate_components(df):
            components_h = Headers.InputFiles.Components
            df = df.copy()

            pivot_df = df.pivot(
            index=[components_h.work_year, components_h.work_month, components_h.employee_id],
            columns=components_h.component_name,
            values=[
                components_h.component_id, 
                components_h.tarriff, 
                components_h.quantity, 
                components_h.total_amount
            ]
            )

            # 3. Flatten the Multi-Index columns
            # This turns ('תעריף', 'Basic Salary') into 'Basic Salary_תעריף'
            pivot_df.columns = [f"{col[1]}_{col[0]}" for col in pivot_df.columns]

            pivot_df = pivot_df.reset_index().fillna(0)

            pivot_df = Functions.Aggregations.standarize_df(pivot_df)
            
            final_table = pivot_df.fillna(0)

            return final_table

        def aggregate_providents(df):
            prov_h = Headers.InputFiles.Providents
            df = df.copy()

            pivot_df = df.pivot_table(
                index=[prov_h.work_year, prov_h.work_month, prov_h.employee_id],
                columns=prov_h.fund_name,
                values=[
                    prov_h.fund_code,
                    prov_h.fund_type,
                    prov_h.salary_for_pension,
                    prov_h.employee_pension,
                    prov_h.employee_disability,
                    prov_h.employee_other,
                    prov_h.employee_total,
                    prov_h.employer_pension,
                    prov_h.employer_disability,
                    prov_h.employer_other,
                    prov_h.severance_pay,
                    prov_h.employer_total,
                    prov_h.employee_employer_total,
                    prov_h.work_days
                ],
                # 'sum' handles the numeric duplicates. 
                # For non-numeric (like fund_code), 'first' or 'max' is usually best.
                aggfunc={
                    prov_h.fund_code: 'first',
                    prov_h.fund_type: 'first',
                    prov_h.salary_for_pension: 'sum',
                    prov_h.employee_pension: 'sum',
                    prov_h.employee_disability: 'sum',
                    prov_h.employee_other: 'sum',
                    prov_h.employee_total: 'sum',
                    prov_h.employer_pension: 'sum',
                    prov_h.employer_disability: 'sum',
                    prov_h.employer_other: 'sum',
                    prov_h.severance_pay: 'sum',
                    prov_h.employer_total: 'sum',
                    prov_h.employee_employer_total: 'sum',
                    prov_h.work_days: 'sum'
                }
            )
            pivot_df.columns = [f"{col[1]}_{col[0]}" for col in pivot_df.columns]

            pivot_df = pivot_df.reset_index()
            
            pivot_df[prov_h.work_month] = pivot_df[prov_h.work_month].apply(Functions.extract_month)
            
            pivot_df[Functions.join_key] = Functions.create_key(
                pivot_df, 
                prov_h.employee_id, 
                prov_h.work_month, 
                prov_h.work_year
            )

            final_table = pivot_df.fillna(0)
            
            return final_table

        def aggregate_absences(df):
            absences_h = Headers.InputFiles.Absences
            df = df.copy()

            df[absences_h.work_month] = df[absences_h.work_month].apply(Functions.extract_month)

            df[Functions.join_key] = Functions.create_key(
                df, 
                absences_h.employee_id, 
                absences_h.work_month, 
                absences_h.work_year
            )
            df.drop(columns=[
                absences_h.quarter, 
                absences_h.half_year,
                absences_h.sub_department_name, 
                absences_h.id_number, 
                absences_h.company_name
                ])
            df = df.fillna(0)

            return df

        def aggregate_income(df):
            income_h = Headers.InputFiles.Income
            df = df.copy()

            df[income_h.work_month] = df[income_h.work_month].apply(Functions.extract_month)

            df[Functions.join_key] = Functions.create_key(
                df, 
                income_h.employee_id, 
                income_h.work_month, 
                income_h.work_year
            )
            df.drop(columns=[
                income_h.quarter, 
                income_h.half_year,
                income_h.sub_department_name, 
                income_h.id_number, 
                income_h.company_name
                ])
            df = df.fillna(0)

            return df

        def aggregate_deductions(df):
            deduct_h = Headers.InputFiles.Deductions
            df = df.copy()

            # 1. Pivot the table using Component Name as the new columns
            pivot_df = df.pivot_table(
                index=[deduct_h.work_year, deduct_h.work_month, deduct_h.employee_id],
                columns=deduct_h.component_name,
                values=[
                    deduct_h.component_code,
                    deduct_h.rate,
                    deduct_h.quantity,
                    deduct_h.total_sum
                ],
                aggfunc={
                    deduct_h.component_code: 'first',
                    deduct_h.rate: 'mean',  
                    deduct_h.quantity: 'sum',
                    deduct_h.total_sum: 'sum'
                }
            )

            pivot_df.columns = [f"{col[1]}_{col[0]}" for col in pivot_df.columns]

            pivot_df = pivot_df.reset_index()
            
            pivot_df[deduct_h.work_month] = pivot_df[deduct_h.work_month].apply(Functions.extract_month)
            
            pivot_df[Functions.join_key] = Functions.create_key(
                pivot_df, 
                deduct_h.employee_id, 
                deduct_h.work_month, 
                deduct_h.work_year
            )

            final_table = pivot_df.fillna(0)
            
            return final_table

        def aggregate_costing(df):
            costing_h = Headers.InputFiles.Costing
            df = df.copy()
            for col in df.columns:
                df[col] = df[col].astype(str)

            df[costing_h.work_month] = df[costing_h.work_month].apply(Functions.extract_month)

            df[Functions.join_key] = Functions.create_key(
                df, 
                costing_h.employee_id, 
                costing_h.work_month, 
                costing_h.work_year
            )

            df.drop(columns=[
                costing_h.quarter, 
                costing_h.half_year,
                costing_h.sub_department_name, 
                costing_h.id_number, 
                costing_h.company_name
                ])
            df = df.fillna(0)

            return df

  
        center_h = Headers.InputFiles.Center

        center_df = Files.centerDF
        components_df = Files.componentsDF
        providents_df = Files.providentsDF
        income_df = Files.incomeDF
        deductions_df = Files.deductionsDF
        costing_df = Files.costingDF
        absences_df = Files.absencesDF

        center_agg = aggregate_center(center_df)
        components_agg = aggregate_components(components_df)
        providents_agg = aggregate_providents(providents_df)
        income_agg = aggregate_income(income_df)
        deductions_agg = aggregate_deductions(deductions_df)
        costing_agg = aggregate_costing(costing_df)
        absences_agg = aggregate_absences(absences_df)

        key_cols = [Functions.join_key, center_h.work_year, center_h.work_month, center_h.employee_id]

        master_keys = pd.concat([
            center_agg[key_cols],
            components_agg[key_cols],
            providents_agg[key_cols],
            income_agg[key_cols],
            deductions_agg[key_cols],
            costing_agg[key_cols],
            absences_agg[key_cols]
        ]).drop_duplicates(subset=[Functions.join_key])

        merged_df = master_keys.merge(center_agg, on=key_cols, how='left')
        merged_df = merged_df.merge(components_agg, on=key_cols, how='left')
        merged_df = merged_df.merge(providents_agg, on=key_cols, how='left')
        merged_df = merged_df.merge(deductions_agg, on=key_cols, how='left')
        merged_df = merged_df.merge(income_agg, on=key_cols, how='left')
        merged_df = merged_df.merge(costing_agg, on=key_cols, how='left')
        merged_df = merged_df.merge(absences_agg, on=key_cols, how='left')

        print(f"Center: {len(center_agg.columns)} columns")
        print(f"Components: {len(components_agg.columns)} columns")
        print(f"Providents: {len(providents_agg.columns)} columns")
        print(f"Income: {len(income_agg.columns)} columns")
        print(f"Deductions: {len(deductions_agg.columns)} columns")
        print(f"Costing: {len(costing_agg.columns)} columns")
        print(f"Absences: {len(absences_agg.columns)} columns")
        
        print(f"Merged: {len(merged_df.columns)} columns")

        return merged_df

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
        print(len(main_df))
        Functions.Querying.query_employee_rows(main_df)
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
        print(len(main_df))

        # 4. מיזוג נתוני המרכז (שם ותקרה) לפי מספר עובד
        main_df = main_df.merge(
            center_cols, 
            left_on=components_h.employee_id, 
            right_on=center_h.employee_id, 
            how='left'
        )
        print(len(main_df))

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
    
    def get_months_comparison():
        center_h = Headers.InputFiles.Center
        source_df = Functions.run_payroll_audit()

        max_year = source_df[center_h.work_year].max()
        max_month = source_df[source_df[center_h.work_year] == max_year][center_h.work_month].max()

        if max_month == 1:
            prev_month, prev_year = 12, max_year - 1
        else:
            prev_month, prev_year = max_month - 1, max_year

        # 2. יצירת טבלאות (CurrTable, PrevTable)
        curr_table = source_df[
            (source_df[center_h.work_month] == max_month) & 
            (source_df[center_h.work_year] == max_year)
        ].copy()
        
        prev_table = source_df[
            (source_df[center_h.work_month] == prev_month) & 
            (source_df[center_h.work_year] == prev_year)
        ].copy()

        def create_lookup_key(key):
            split_pattern = Functions.key_regex
            parts = re.split(split_pattern, key)
            return f"{parts[1]}-{prev_month}-{str(prev_year)}"

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
        
        # לכל עובד ב-Joined, אנחנו מייצרים 12 שורות (אחת לכל בדיקה)
        for _, row in joined.iterrows():
            for item in check_list:
                col_name = item['עמודה']
                curr_val = row[col_name] if pd.notnull(row[col_name]) else 0
                prev_val = row[col_name + '_prev'] if col_name + '_prev' in row and pd.notnull(row[col_name + '_prev']) else 0
                
                analysis_rows.append({
                    "מספר עובד": row[center_h.employee_id],
                    "שם עובד": row["מרכזשכר" + "_" + center_h.employee_name],
                    "שנת עבודה": row[center_h.work_year],
                    "חודש עבודה": row[center_h.work_month],
                    "בדיקה": item['בדיקה'],
                    "סיווג": item['סיווג'],
                    "נוכחי": curr_val,
                    "קודם": prev_val
                })

        final_df = pd.DataFrame(analysis_rows)

        # 6. חישוב סטייה ואחוזים (AddCalc, AddPct)
        final_df['סטייה'] = final_df['נוכחי'] - final_df['קודם']
        final_df['יחס סטייה'] = np.where(
            final_df['קודם'] != 0, 
            final_df['סטייה'] / final_df['קודם'], 
            0
        )
        final_df["אחוז סטייה"] = final_df["יחס סטייה"].apply(lambda x: f"{x * 100:.2f}%")
        
        final_df['הערות'] = ""

        return final_df

    def get_reports_against_center():
        c_h = Headers.InputFiles.Center
        cost_h = Headers.InputFiles.Costing
        inc_h = Headers.AggregatedFiles.IncomeAGG
        abs_h = Headers.AggregatedFiles.AbsencesAGG
        prov_h = Headers.AggregatedFiles.ProvidentsAGG
        cfa = Headers.AggregatedFiles.ProvidentsAGG 

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
                results.append({
                    "מספר עובד": row[c_h.employee_id],
                    "שם העובד": row[c_h.employee_name],
                    "חודש": Files.current_month,
                    "בדיקה": name,
                    "קלט (מרכז שכר)": input_val,
                    "פלט (דוחות חיצוניים)": output_val,
                    "הפרש": diff,
                    "סטטוס": "תקין" if abs(diff) < 0.1 else "הפרש בבדיקה"
                })

            results.append({
                "מספר עובד": row[c_h.employee_id],
                "שם העובד": row[c_h.employee_name],
                "חודש": Files.current_month,
                "בדיקה": '6. קה"ל (זכאות)',
                "קלט (מרכז שכר)": kahal_eligible,
                "פלט (דוחות חיצוניים)": kahal_sum,
                "הפרש": 0,
                "סטטוס": kahal_stat_text
            })

        return pd.DataFrame(results)


