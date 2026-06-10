import re
import numpy as np
import pandas as pd

from Reports.Report import Report
from Files import Files
from Headers import Headers, Helpers, PayrollCodes
from Constants import JOIN_KEY, KEY_REGEX


class MonthsComparison(Report):
    def __init__(self, center_df, components_df, providents_df, income_df, deductions_df, costing_df, absences_df):
        super().__init__()
        self.id = "months_comparison"
        self.display_label = "השוואת חודשים"
        self.is_input = False
        self.dependencies = ["center", "components", "providents", "income", "deductions", "costing", "absences"]

        self.center_df = center_df
        self.components_df = components_df
        self.providents_df = providents_df
        self.income_df = income_df
        self.deductions_df = deductions_df
        self.costing_df = costing_df
        self.absences_df = absences_df

        self.parse_preset()

    # ------------------------------------------------------------------
    #  Construction
    #  Moved verbatim from Functions.get_months_comparison.
    #  Not wired into __init__ yet — call site to be decided later.
    #  Still references Functions.run_payroll_audit() — that dependency
    #  will move in a later phase when run_payroll_audit relocates too.
    # ------------------------------------------------------------------
    @staticmethod
    def get_months_comparison(input_months1=None, input_year1=None, input_months2=None, input_year2=None):
        from Functions import Functions   # deferred to avoid circular import
        comparison_h = Headers.MonthsComparison
        source_df = Functions.run_payroll_audit()

        month1 = Files.max_month
        year1  = Files.max_year
        month2 = Files.min_month
        year2  = Files.min_year

        if input_months1 and input_months2 and input_year1 and input_year2:
            year1, year2 = input_year1, input_year2
            month1, month2 = input_months1, input_months2

        curr_table = source_df[
            (source_df[PayrollCodes.work_month] == month1) &
            (source_df[PayrollCodes.work_year]  == year1)
        ].copy()

        prev_table = source_df[
            (source_df[PayrollCodes.work_month] == month2) &
            (source_df[PayrollCodes.work_year]  == year2)
        ].copy()

        def create_lookup_key(key):
            split_pattern = KEY_REGEX
            parts = re.split(split_pattern, key)
            return f"{parts[1]}-{month2}-{str(year2)}"

        curr_table['LookupPrev'] = curr_table[JOIN_KEY].apply(create_lookup_key)

        # 4. מיזוג לפי המפתח המחושב (Joined)
        joined = curr_table.merge(
            prev_table,
            left_on='LookupPrev',
            right_on=JOIN_KEY,
            how='left',
            suffixes=('', '_prev')
        )

        # 5. יצירת שורות האנליזה (Unpivot מבוקר)
        check_list = [
            {"בדיקה": "שכר ברוטו",          "סיווג": "תשלומים",     "עמודה": "תמחיר_ברוטו"},
            {"בדיקה": "שכר נטו",            "סיווג": "תשלומים",     "עמודה": "תמחיר_נטו לתשלום"},
            {"בדיקה": "עלות מעסיק",         "סיווג": "עלויות",      "עמודה": "תמחיר_עלות מעסיק"},
            {"בדיקה": "מס הכנסה",           "סיווג": "ניכויי חובה", "עמודה": "תמחיר_מס הכנסה"},
            {"בדיקה": "ב.ל עובד",           "סיווג": "ניכויי חובה", "עמודה": "תמחיר_ב.ל. עובד"},
            {"בדיקה": "ב.ל מעסיק",          "סיווג": "עלויות",      "עמודה": "תמחיר_ב.ל. מעסיק"},
            {"בדיקה": "גמל מעסיק",          "סיווג": "סוציאליות",   "עמודה": "קופות_קופות_סה\"כ גמל מעסיק"},
            {"בדיקה": "קה\"ל מעסיק",        "סיווג": "סוציאליות",   "עמודה": "קופות_קופות_סה\"כ קה\"ל מעסיק"},
            {"בדיקה": "ניכויי רשות",        "סיווג": "ניכויים",     "עמודה": "ניכויים_סה\"כ ניכויי רשות"},
            {"בדיקה": "זקיפות שווי",        "סיווג": "זקיפות",      "עמודה": "זקיפות_סהכ_זקיפות"},
            {"בדיקה": "רכיבים לסוציאליות", "סיווג": "בסיס שכר",    "עמודה": "רכיבים_סהכ_רכיבים_לסוציאליות"},
            {"בדיקה": "ימי עבודה",          "סיווג": "נוכחות",      "עמודה": "תמחיר_כמות ימים"},
        ]

        analysis_rows = []
        month1_str = f"{month1:02d}/{year1}"
        month2_str = f"{month2:02d}/{year2}"
        # לכל עובד ב-Joined, אנחנו מייצרים שורות (אחת לכל בדיקה)
        for _, row in joined.iterrows():
            for item in check_list:
                col_name = item['עמודה']
                curr_val = row[col_name] if pd.notnull(row[col_name]) else 0
                prev_val = row[col_name + '_prev'] if col_name + '_prev' in row and pd.notnull(row[col_name + '_prev']) else 0

                analysis_rows.append({
                    comparison_h.employee_id:   row[f"תמחיר_{Helpers.SystemReportsBase.employee_id}"],
                    comparison_h.employee_name: row[f"תמחיר_{Helpers.SystemReportsBase.employee_name}"],
                    comparison_h.check:         item['בדיקה'],
                    comparison_h.category:      item['סיווג'],
                    month1_str: curr_val,
                    month2_str: prev_val,
                })
        final_df = pd.DataFrame(analysis_rows)

        final_df[comparison_h.offset] = final_df[month1_str] - final_df[month2_str]
        # 6. חישוב סטייה ואחוזים
        final_df[comparison_h.offset_pct] = np.where(
            final_df[month2_str] != 0,
            (final_df[comparison_h.offset] / final_df[month2_str] * 100),
            0
        )

        # Format as a string with the % symbol
        final_df[comparison_h.offset_pct] = final_df[comparison_h.offset_pct].apply(lambda x: f"{x:.2f}%")
        return final_df
