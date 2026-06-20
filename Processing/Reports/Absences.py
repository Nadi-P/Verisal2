from Reports.Report import Report
from Headers import Headers
from Constants import GROUP_LIST
from LineageFrame.frame import LineageFrame


class Absences(Report):
    """Raw absences input wrapped as a Report + LineageFrame."""

    def __init__(self, df, manager=None):
        super().__init__()
        self.id = "absences"
        self.display_label = "היעדרויות"
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
                self.lineageFrame = LineageFrame.from_pandas(df, self.id, manager)
            self.status = "loaded"

        except Exception as e:
            self.exceptions.append(f"{type(e).__name__}: {e}")

    # ------------------------------------------------------------------
    @staticmethod
    def aggregate_absences(frame):
        """
        Wide aggregation per (year, month, emp_id):
          - vacation_{previous_balance, monthly_accrual, monthly_usage, monthly_balance}
          - sick_{previous_balance, monthly_accrual, monthly_usage, monthly_balance}
        Each AGG cell's refs are exactly the raw absences cells that
        summed into its value (none of the group_by cells).
        """
        abs_h = Headers.InputFiles.Absences
        AGG   = Headers.AggregatedFiles.AbsencesAGG

        std = Report.standardize_lineage(frame)

        # Vacation outputs.
        vac_spec = {}
        if abs_h.vacation_previous_balance in std: vac_spec[abs_h.vacation_previous_balance] = "sum"
        if abs_h.vacation_monthly_accrual  in std: vac_spec[abs_h.vacation_monthly_accrual]  = "sum"
        if abs_h.vacation_monthly_usage    in std: vac_spec[abs_h.vacation_monthly_usage]    = "sum"
        if abs_h.vacation_monthly_balance  in std: vac_spec[abs_h.vacation_monthly_balance]  = "sum"
        vac_rename = {
            abs_h.vacation_previous_balance: AGG.vacation_previous_balance,
            abs_h.vacation_monthly_accrual:  AGG.vacation_monthly_accrual,
            abs_h.vacation_monthly_usage:    AGG.vacation_monthly_usage,
            abs_h.vacation_monthly_balance:  AGG.vacation_monthly_balance,
        }

        # Sick outputs.
        sick_spec = {}
        if abs_h.sick_previous_balance in std: sick_spec[abs_h.sick_previous_balance] = "sum"
        if abs_h.sick_monthly_accrual  in std: sick_spec[abs_h.sick_monthly_accrual]  = "sum"
        if abs_h.sick_monthly_usage    in std: sick_spec[abs_h.sick_monthly_usage]    = "sum"
        if abs_h.sick_monthly_balance  in std: sick_spec[abs_h.sick_monthly_balance]  = "sum"
        sick_rename = {
            abs_h.sick_previous_balance: AGG.sick_previous_balance,
            abs_h.sick_monthly_accrual:  AGG.sick_monthly_accrual,
            abs_h.sick_monthly_usage:    AGG.sick_monthly_usage,
            abs_h.sick_monthly_balance:  AGG.sick_monthly_balance,
        }

        result = None
        if vac_spec:
            vac = std.groupby(GROUP_LIST, dropna=False).agg(vac_spec).rename(columns=vac_rename)
            result = vac
        if sick_spec:
            sick = std.groupby(GROUP_LIST, dropna=False).agg(sick_spec).rename(columns=sick_rename)
            result = result.merge(sick, on=GROUP_LIST, how="outer") if result is not None else sick

        if result is None:
            # No usable columns at all — return an empty group-keyed frame.
            return std.groupby(GROUP_LIST).agg({})

        return result.fillna(0)
