import pandas as pd

from Reports.Report import Report
from Reports.Center import Center
from Reports.Costing import Costing
from Reports.Absences import Absences
from Reports.Income import Income
from Reports.Providents import Providents
from Files import Files
from Headers import Headers, PayrollCodes
from Constants import JOIN_KEY


class ReportsAgainstCenter(Report):
    def __init__(self, center_df, costing_df, income_df, absences_df, providents_df):
        super().__init__()
        self.id = "reports_against_center"
        self.display_label = "דוחות מול מרכז שכר"
        self.is_input = False
        self.dependencies = ["center", "costing", "income", "absences", "providents"]

        self.center_df = center_df
        self.costing_df = costing_df
        self.income_df = income_df
        self.absences_df = absences_df
        self.providents_df = providents_df

        self.parse_preset()

    # ------------------------------------------------------------------
    #  Construction
    #  Moved verbatim from Functions.get_reports_against_center.
    #  Not wired into __init__ yet — call site to be decided later.
    # ------------------------------------------------------------------
    @staticmethod
    def get_reports_against_center():
        cost_h = Headers.InputFiles.Costing
        inc_h  = Headers.AggregatedFiles.IncomeAGG
        abs_h  = Headers.AggregatedFiles.AbsencesAGG
        prov_h = Headers.AggregatedFiles.ProvidentsAGG
        fac_h  = Headers.ReportsAgainstCenter

        # 1. Run Aggregations from the report classes
        centerAgg   = Center.aggregate_center(Files.center_df_coded)
        costingAgg  = Costing.aggregate_costing(Files.costingDF)
        absencesAgg = Absences.aggregate_absences(Files.absencesDF)
        incomeAgg   = Income.aggregate_income(Files.incomeDF)
        provAgg     = Providents.aggregate_providents(Files.providentsDF)

        # 2. Filter Center to the current period
        audit_df = centerAgg[
            (centerAgg[PayrollCodes.work_year]  == Files.current_year) &
            (centerAgg[PayrollCodes.work_month] == Files.current_month)
        ].copy()

        if audit_df.empty:
            print(f"CRITICAL ERROR: No data found in Center file for {Files.current_month}/{Files.current_year}")
            return pd.DataFrame()

        # 3. Merges
        jk = JOIN_KEY

        audit_df = audit_df.merge(
            costingAgg[[jk, cost_h.gross_salary, cost_h.voluntary_deductions]],
            on=jk, how="left"
        )
        audit_df = audit_df.merge(
            incomeAgg[[jk, inc_h.total, 'meals_gifts_total']],
            on=jk, how="left"
        )
        audit_df = audit_df.merge(
            absencesAgg[[jk, abs_h.vacation_monthly_usage, abs_h.sick_monthly_usage]],
            on=jk, how="left"
        )
        audit_df = audit_df.merge(
            provAgg[[jk, prov_h.employee_study_fund_total, prov_h.employer_study_fund_total, prov_h.total_study_fund_base]],
            on=jk, how="left"
        )

        # 4. Analysis Loop
        results = []
        for _, row in audit_df.iterrows():
            # Standard Checks
            checks = [
                ("שכר ברוטו",            (row.get(PayrollCodes.total_salary)),                                                                                                                                  (row.get(cost_h.gross_salary))),
                ("שווי (ארוחות/מתנות)", (row.get(PayrollCodes.shovi_meals_value)) + (row.get(PayrollCodes.shovi_gifts)),                                                                                       (row.get('meals_gifts_total', 0))),
                ("ניכויי רשות",          (row.get(PayrollCodes.expense_reimbursement)) + (row.get(PayrollCodes.expense_reimbursement_charge)) + (row.get(PayrollCodes.abroad_expense_reimbursement)),         (row.get(cost_h.voluntary_deductions))),
                ("ניצול חופשה",          (row.get(PayrollCodes.vacation_usage)),                                                                                                                                (row.get(abs_h.vacation_monthly_usage))),
                ("ניצול מחלה",           (row.get(PayrollCodes.sick_usage)),                                                                                                                                    (row.get(abs_h.sick_monthly_usage))),
            ]

            # Kahal Logic
            kahal_raw      = str(row.get(PayrollCodes.is_study_fund_exist, "")).strip()
            kahal_eligible = "כן" if "כן" in kahal_raw else "ללא קה\"ל"
            kahal_sum      = row.get(prov_h.total_study_fund_base)

            if   kahal_eligible == "חסר נתון":                       kahal_stat_text = "בדיקה ידנית - חסר סימון במרכז שכר"
            elif kahal_eligible == "כן" and kahal_sum == 0:          kahal_stat_text = "חסרה הפקדה!"
            elif kahal_eligible == "לא" and kahal_sum > 0:           kahal_stat_text = "הפרשה קיימת ללא סימון זכאות"
            else:                                                     kahal_stat_text = "תקין"

            # Construct rows for final table
            for name, input_val, output_val in checks:
                diff = input_val - output_val
                diff_pct = (diff / input_val * 100) if input_val != 0 else 0
                results.append({
                    fac_h.employee_id:              row[PayrollCodes.employee_id],
                    fac_h.employee_name:            row[PayrollCodes.employee_name],
                    fac_h.month:                    Files.current_month,
                    fac_h.check:                    name,
                    fac_h.center_input:             input_val,
                    fac_h.external_reports_output:  output_val,
                    fac_h.offset:                   diff,
                    fac_h.offset_pct:               f"{diff_pct:.2f}%",
                })

            results.append({
                fac_h.employee_id:              row[PayrollCodes.employee_id],
                fac_h.employee_name:            row[PayrollCodes.employee_name],
                fac_h.month:                    Files.current_month,
                fac_h.check:                    'קה"ל (בסיס להפקדה)',
                fac_h.center_input:             kahal_eligible,
                fac_h.external_reports_output:  kahal_sum,
                fac_h.offset:                   0,
                fac_h.offset_pct:               "0%",
            })

        return pd.DataFrame(results)
