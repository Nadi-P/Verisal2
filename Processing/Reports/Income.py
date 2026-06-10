from Reports.Report import Report
from Headers import Headers, Masks
from Constants import GROUP_LIST


class Income(Report):
    def __init__(self, df):
        super().__init__()
        self.id = "income"
        self.display_label = "הכנסות זקופות"
        self.is_input = True
        self.dependencies = []

        if df is not None:
            self.df = df
            self.rows_count = len(df)
            self.columns_count = len(df.columns)
            self.aggregated = self.aggregate_income(df)
    # ------------------------------------------------------------------
    #  Aggregation
    #  Moved verbatim from Functions.Aggregations.aggregate_income.
    #  Not wired into __init__ yet — call site to be decided later.
    # ------------------------------------------------------------------
    @staticmethod
    def aggregate_income(df):
        incomeFileHeaders = Headers.InputFiles.Income
        incomeAGGHeaders  = Headers.AggregatedFiles.IncomeAGG
        mask              = Masks.MealsAndGiftsIncomeMask.mask
        df = Report.standarize_df(df)

        result = df.groupby(GROUP_LIST).agg({incomeFileHeaders.total_amount: 'sum'}).reset_index()
        result = result.rename(columns={incomeFileHeaders.total_amount: incomeAGGHeaders.total})

        df_mg = df[df[incomeFileHeaders.component_name].isin(mask)]
        mg_agg = df_mg.groupby(GROUP_LIST).agg({incomeFileHeaders.total_amount: 'sum'}).reset_index()
        mg_agg = mg_agg.rename(columns={incomeFileHeaders.total_amount: 'meals_gifts_total'})
        result = result.merge(mg_agg, on=GROUP_LIST, how='left')
        result['meals_gifts_total'] = result['meals_gifts_total'].fillna(0)

        return result
