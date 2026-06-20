from Reports.Report import Report
from LineageFrame.frame import LineageFrame


class Costing(Report):
    """Raw costing input wrapped as a Report + LineageFrame."""

    def __init__(self, df, manager=None):
        super().__init__()
        self.id = "costing"
        self.display_label = "דוח תמחיר"
        self.is_input = True
        self.dependencies = []
        self.status = "error"

        if df is None:
            self.status = "skipped"
            return

        try:
            self.rows_count    = len(df)
            self.columns_count = len(df.columns)

            if manager is not None:
                self.lineageFrame = LineageFrame.from_pandas(
                    df, self.id, manager
                )
            self.status = "loaded"

        except Exception as e:
            self.exceptions.append(f"{type(e).__name__}: {e}")

    @staticmethod
    def aggregate_costing(frame):
        """
        Costing aggregation is just a standardize pass — no group-by, no
        derivations. Returns a translucent LineageFrame.
        """
        return Report.standardize_lineage(frame)
