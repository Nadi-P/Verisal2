from Reports.Report import Report
from Headers import Headers
from Constants import GROUP_LIST
from LineageFrame.frame import LineageFrame


class Providents(Report):
    """Raw providents input wrapped as a Report + LineageFrame."""

    def __init__(self, df, manager=None):
        super().__init__()
        self.id = "providents"
        self.display_label = "קופות גמל"
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
    def aggregate_providents(frame):
        ph    = Headers.InputFiles.Providents
        AGG   = Headers.AggregatedFiles.ProvidentsAGG

        std = Report.standardize_lineage(frame)

        # Total sums across all rows.
        total_agg = std.groupby(GROUP_LIST).agg({
            ph.employee_pension:    "sum",
            ph.employer_pension:    "sum",
            ph.severance_pay:       "sum",
            ph.employee_disability: "sum",
            ph.employer_disability: "sum",
        })
        total_agg = total_agg.rename(columns={
            ph.employee_pension:    AGG.employee_pension_total,
            ph.employer_pension:    AGG.employer_pension_total,
            ph.severance_pay:       AGG.severance_total,
            ph.employee_disability: AGG.employee_disability_total,
            ph.employer_disability: AGG.employer_disability_total,
        })

        # Study-fund (קה"ל) totals: only rows whose fund_type is 'קה"ל'.
        kahal_rows = std[std[ph.fund_type] == "קה\"ל"]
        kahal_agg  = kahal_rows.groupby(GROUP_LIST).agg({
            ph.employee_pension:   "sum",
            ph.employer_pension:   "sum",
            ph.salary_for_pension: "sum",
        })
        kahal_agg = kahal_agg.rename(columns={
            ph.employee_pension:   AGG.employee_study_fund_total,
            ph.employer_pension:   AGG.employer_study_fund_total,
            ph.salary_for_pension: AGG.total_study_fund_base,
        })

        result = total_agg.merge(kahal_agg, on=GROUP_LIST, how="left")
        return result.fillna(0)
