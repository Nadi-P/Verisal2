from Reports.Report import Report
from Headers import Headers
from Constants import GROUP_LIST
from LineageFrame.frame import LineageFrame


class Deductions(Report):
    """Raw deductions input wrapped as a Report + LineageFrame."""

    def __init__(self, df, manager=None):
        super().__init__()
        self.id = "deductions"
        self.display_label = "ניכויי רשות"
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
    def aggregate_deductions(frame):
        ded_h = Headers.InputFiles.Deductions
        std = Report.standardize_lineage(frame)
        result = std.groupby(GROUP_LIST).agg({
            ded_h.total_sum:      "sum",
            ded_h.component_code: "count",
        })
        result = result.rename(columns={
            ded_h.total_sum:      'סה"כ ניכויי רשות',
            ded_h.component_code: 'מספר רכיבים שונים',
        })
        return result
