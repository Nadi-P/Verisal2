from Reports.Report import Report
from Headers import Headers
from Constants import GROUP_LIST


class Deductions(Report):
    def __init__(self, df):
        super().__init__()
        self.id = "deductions"
        self.display_label = "ניכויי רשות"
        self.is_input = True
        self.dependencies = []
        self.df = df

        self.parse_preset()

        if df is not None:
            self.rows_count = len(df)
            self.columns_count = len(df.columns)

    # ------------------------------------------------------------------
    #  Aggregation
    #  Moved verbatim from Functions.Aggregations.aggregate_deductions.
    #  Not wired into __init__ yet — call site to be decided later.
    # ------------------------------------------------------------------
    @staticmethod
    def aggregate_deductions(df):
        deductionsFileHeaders = Headers.InputFiles.Deductions
        df = Report.standarize_df(df)

        agg_map = {
            deductionsFileHeaders.total_sum: 'sum',
            deductionsFileHeaders.component_code: 'count'
        }
        result = df.groupby(GROUP_LIST).agg(agg_map).reset_index()

        result = result.rename(columns={
            deductionsFileHeaders.total_sum: 'סה"כ ניכויי רשות',
            deductionsFileHeaders.component_code: 'מספר רכיבים שונים'
        })

        return result
