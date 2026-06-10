import numpy as np
import pandas as pd

from Reports.Report import Report
from Reports.Center import Center
from Reports.Components import Components
from Reports.Providents import Providents
from Files import Files
from Headers import Headers, PayrollCodes
from Constants import JOIN_KEY


class SocialAnalysis(Report):
    def __init__(self, center_df, components_df, providents_df):
        super().__init__()
        self.id = "social_analysis"
        self.display_label = "אנליזה סוציאלית"
        self.is_input = False
        self.dependencies = ["center", "components", "providents"]

        self.center_df = center_df
        self.components_df = components_df
        self.providents_df = providents_df

        self.parse_preset()

    # ------------------------------------------------------------------
    #  Construction
    #  Moved verbatim from Functions.get_social_analysis.
    #  Not wired into __init__ yet — call site to be decided later.
    # ------------------------------------------------------------------
    @staticmethod
    def get_social_analysis():
        components_h = Headers.InputFiles.Components
        providents_h = Headers.AggregatedFiles.ProvidentsAGG
        social_h     = Headers.SocialAnalysisFile

        center_df     = Center.aggregate_center(Files.center_df_coded)
        providentsAgg = Providents.aggregate_providents(Files.providentsDF)
        componentsAgg = Components.aggregate_components(Files.componentsDF)

        # 1. הכנת עמודת קה"ל מהמרכז (נשאר התלות היחידה במרכז כאן)
        center_cols = center_df[[
            PayrollCodes.employee_id,
            PayrollCodes.is_study_fund_exist
        ]].drop_duplicates(subset=[PayrollCodes.employee_id])

        # 2. הבסיס החדש: כל מי שמופיע ברכיבי השכר (Social Total)
        # אנחנו מתחילים מכאן כדי לא לאבד עובדים שאין להם הפרשות לקופות.
        # שם העובד נלקח ישירות מדוח הרכיבים ולא מהמרכז.
        main_df = componentsAgg[[
            JOIN_KEY,
            components_h.work_month,
            components_h.employee_id,
            components_h.employee_name,
            components_h.social_total
        ]].copy()

        # 3. מיזוג נתוני הקופות לתוך בסיס השכר (Left Merge)
        main_df = main_df.merge(
            providentsAgg[[
                JOIN_KEY,
                providents_h.employee_pension_total,
                providents_h.employer_pension_total,
                providents_h.severance_total,
                providents_h.employer_study_fund_total
            ]],
            on=JOIN_KEY,
            how='left'
        ).fillna(0)

        # 4. מיזוג עמודת קה"ל מהמרכז לפי מספר עובד
        main_df = main_df.merge(
            center_cols,
            left_on=components_h.employee_id,
            right_on=PayrollCodes.employee_id,
            how='left'
        )

        # משתני עזר לחישוב
        social_base = pd.to_numeric(main_df[components_h.social_total], errors='coerce').fillna(0)
        ee_pension  = pd.to_numeric(main_df[providents_h.employee_pension_total], errors='coerce').fillna(0)
        er_pension  = pd.to_numeric(main_df[providents_h.employer_pension_total], errors='coerce').fillna(0)

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

        # ד. בסיס קה"ל נגזר - רק אם רשום "כן"
        main_df[social_h.capped_val] = np.where(
            main_df[PayrollCodes.is_study_fund_exist] == "כן",
            social_base.clip(upper=15712),
            0
        )

        # סידור עמודות סופי
        headersList = [
            JOIN_KEY,
            components_h.employee_name,
            components_h.employee_id,
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
