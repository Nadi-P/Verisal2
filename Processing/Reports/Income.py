from Reports.Report import Report
from Headers import Headers, Masks
from Constants import GROUP_LIST
from LineageFrame.frame import LineageFrame


class Income(Report):
    """Raw income input wrapped as a Report + LineageFrame."""

    def __init__(self, df, manager=None):
        super().__init__()
        self.id = "income"
        self.display_label = "הכנסות זקופות"
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
    def aggregate_income(frame):
        inc_h = Headers.InputFiles.Income
        AGG   = Headers.AggregatedFiles.IncomeAGG
        mask  = Masks.MealsAndGiftsIncomeMask.mask

        std = Report.standardize_lineage(frame)

        # Total: every income row contributes to total.
        total_agg = std.groupby(GROUP_LIST).agg({inc_h.total_amount: "sum"})
        total_agg = total_agg.rename(columns={inc_h.total_amount: AGG.total})

        # Meals & gifts: only the mask-matching rows.
        mg_filtered = std[std[inc_h.component_name].isin(mask)]
        mg_agg = mg_filtered.groupby(GROUP_LIST).agg({inc_h.total_amount: "sum"})
        mg_agg = mg_agg.rename(columns={inc_h.total_amount: "meals_gifts_total"})

        result = total_agg.merge(mg_agg, on=GROUP_LIST, how="left")
        return result.fillna(0)
