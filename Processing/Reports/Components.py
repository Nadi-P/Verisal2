from Reports.Report import Report
from Headers import Headers, Masks
from Constants import GROUP_LIST
from LineageFrame.frame import LineageFrame


class Components(Report):
    """Raw components input wrapped as a Report + LineageFrame."""

    def __init__(self, df, manager=None):
        super().__init__()
        self.id = "components"
        self.display_label = "רכיבי שכר"
        self.is_input = True
        self.dependencies = []
        self.status = "error"

        if df is None:
            self.status = "skipped"
            return

        try:
            self.df            = df  # kept for legacy metadata extraction
            self.rows_count    = len(df)
            self.columns_count = len(df.columns)

            if manager is not None:
                self.lineageFrame = LineageFrame.from_pandas(
                    df, self.id, manager
                )
            self.status = "loaded"

        except Exception as e:
            self.exceptions.append(f"{type(e).__name__}: {e}")

    # ------------------------------------------------------------------
    @staticmethod
    def aggregate_components(frame):
        """
        Aggregate raw components into one row per (year, month, emp_id):
          - total_amount  ← sum of all component rows in the group
          - employee_name ← first matching cell
          - social_total  ← sum of total_amount ONLY over rows whose
                            component_name is in the social mask. Refs
                            on the resulting cell are EXACTLY the
                            mask-matching total_amount cells — group_by
                            and mask-filter columns contribute no refs.

        Returns a translucent LineageFrame.
        """
        comp_h     = Headers.InputFiles.Components
        social_set = Masks.SocialAnalaysisComponentsMask.mask

        std = Report.standardize_lineage(frame)

        # ------- total + name agg over EVERY row -------------------
        total_agg = std.groupby(GROUP_LIST).agg({
            comp_h.total_amount:  "sum",
            comp_h.employee_name: "first",
        })
        total_agg.translucent = True
        total_agg.report_id = f"{frame.report_id}.totalAgg"

        # ------- social_total: filter to mask rows, then group sum --
        # The boolean mask Column is used for filtering — its cells do
        # NOT enter the calculation, so they're NOT refs on the output.
        # `_slice_rows` (called via boolean indexing) only carries
        # source-cell refs per kept row.
        mask_col   = std[comp_h.component_name].isin(social_set)
        social_std = std[mask_col]
        social_agg = social_std.groupby(GROUP_LIST).agg({
            comp_h.total_amount: "sum",
        })
        social_agg.translucent = True
        social_agg.report_id = f"{frame.report_id}.socialAgg"
        social_agg = social_agg.rename(columns={
            comp_h.total_amount: comp_h.social_total,
        })

        # ------- merge to align per (year, month, emp_id) ----------
        merged = total_agg.merge(social_agg, on=GROUP_LIST, how="left")
        merged.translucent = True
        merged.report_id = f"{frame.report_id}.agg"
        merged = merged.fillna(0)

        return merged
