from Reports.Report import Report
from Headers import Headers
from Constants import GROUP_LIST


class Providents(Report):
    def __init__(self, df):
        super().__init__()
        self.id = "providents"
        self.display_label = "קופות גמל"
        self.is_input = True
        self.dependencies = []

        if df is not None:
            self.df = df
            self.rows_count = len(df)
            self.columns_count = len(df.columns)
            self.aggregated = self.aggregate_providents(df)

    @staticmethod
    def aggregate_providents(df):
        providentsFileHeaders = Headers.InputFiles.Providents
        df = Report.standarize_df(df)
        df["total_study_fund_base"] = df[providentsFileHeaders.salary_for_pension].where(
            df[providentsFileHeaders.fund_type] == "קה\"ל", 0
        )

        agg_map = {
            providentsFileHeaders.employee_pension:    'sum',   # גמל עובד
            providentsFileHeaders.employer_pension:    'sum',   # גמל מעסיק
            providentsFileHeaders.severance_pay:       'sum',   # פיצויים
            providentsFileHeaders.employee_other:      'sum',   # סה"כ עובד
            providentsFileHeaders.employer_other:      'sum',   # סה"כ מעסיק
            providentsFileHeaders.employee_disability: 'sum',   # אכ"ע עובד
            providentsFileHeaders.employer_disability: 'sum',
            "total_study_fund_base":                   'sum',   # בסיס לחישוב
        }
        result = df.groupby(GROUP_LIST).agg(agg_map).reset_index()

        return result
