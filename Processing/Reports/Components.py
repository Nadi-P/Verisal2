import pandas as pd

from Reports.Report import Report
from Headers import Headers, Masks
from Constants import GROUP_LIST
from LineageFrame.frame import LineageFrame


class Components(Report):
    """
    Raw components input. Wraps the parsed pandas DataFrame into a
    LineageFrame whose cells carry no upstream references — they're
    leaf cells of the ingest pipeline.
    """

    def __init__(self, df, manager=None):
        super().__init__()
        self.id = "components"
        self.display_label = "רכיבי שכר"
        self.is_input = True
        self.dependencies = []
        self.status = "error"           # flipped to "loaded" once we wrap successfully

        if df is None:
            self.status = "skipped"
            return

        try:
            self.df            = df                           # legacy field for transition
            self.rows_count    = len(df)
            self.columns_count = len(df.columns)
            self.aggregated    = self.aggregate_components(df)

            # The LineageFrame mirrors the standardized form — the same
            # shape downstream manufactured reports will reference. We
            # build it from the standardized DF so refs land on the
            # correct row indices.
            if manager is not None:
                standardized = Report.standarize_df(df)
                self.lineageFrame = LineageFrame.from_pandas(
                    standardized, self.id, manager
                )
            self.status = "loaded"

        except Exception as e:
            self.exceptions.append(f"{type(e).__name__}: {e}")
            # status already set to 'error' above

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
