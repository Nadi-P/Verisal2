import pandas as pd

from Reports.Report import Report
from Files import Files
from Headers import PayrollCodes, Masks


class Center(Report):
    def __init__(self, df):
        super().__init__()
        self.id = "center"
        self.display_label = "קובץ מרכז שכר"
        self.is_input = True
        self.dependencies = []

        if df is not None:
            self.df = df
            self.rows_count = len(df)
            self.columns_count = len(df.columns)
            self.aggregated = self.aggregate_center(df)


    # ------------------------------------------------------------------
    @staticmethod
    def aggregate_center(df):
        df = df.copy()

        df = df.dropna(subset=[PayrollCodes.employee_id])
        df[PayrollCodes.employee_id] = (
            pd.to_numeric(df[PayrollCodes.employee_id], errors='coerce')
            .fillna(0)
            .astype('int64')
        )

        df[PayrollCodes.work_year] = Files.current_year
        df[PayrollCodes.work_month] = f"{Files.current_year}/{Files.current_month:02}"
        df = Report.standarize_df(df, is_center=True)

        target_codes = Masks.TotalSalaryCenterMask.mask
        components = [code for code in target_codes if code in df.columns]
        df[PayrollCodes.total_salary] = (
            df[components]
            .apply(pd.to_numeric, errors='coerce')
            .fillna(0)
            .sum(axis=1)
        )

        return df
