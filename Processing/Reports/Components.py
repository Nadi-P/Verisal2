import pandas as pd

from Reports.Report import Report
from Headers import Headers, Masks
from Constants import GROUP_LIST


class Components(Report):
    def __init__(self, df):
        super().__init__()
        self.id = "components"
        self.display_label = "רכיבי שכר"
        self.is_input = True
        self.dependencies = []

        if df is not None:
            self.df = df
            self.rows_count = len(df)
            self.columns_count = len(df.columns)
            self.aggregated = self.aggregate_components(df)
    
    @staticmethod
    def aggregate_components(df):
        comp_h = Headers.InputFiles.Components
        df = Report.standarize_df(df)
        social_list = Masks.SocialAnalaysisComponentsMask.mask

        def calculate_social(row):
            if row[comp_h.component_name] in social_list:
                return pd.to_numeric(row[comp_h.total_amount], errors='coerce')
            return 0
        

        df[comp_h.social_total] = df.apply(calculate_social, axis=1)

        agg_map = {
            comp_h.total_amount: 'sum',
            comp_h.social_total: 'sum',
            comp_h.employee_name: 'first',
        }
        result = df.groupby(GROUP_LIST).agg(agg_map).reset_index()

        return result
