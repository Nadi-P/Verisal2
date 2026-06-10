from Reports.Report import Report


class Costing(Report):
    def __init__(self, df):
        super().__init__()
        self.id = "costing"
        self.display_label = "דוח תמחיר"
        self.is_input = True
        self.dependencies = []

        if df is not None:
            self.df = df
            self.rows_count = len(df)
            self.columns_count = len(df.columns)
            self.aggregated = self.aggregate_costing(df)

    @staticmethod
    def aggregate_costing(df):
        return Report.standarize_df(df)
