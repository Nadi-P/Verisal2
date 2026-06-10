import numpy as np
import pandas as pd

from Reports.Report import Report
from Headers import Headers, Helpers
from Constants import GROUP_LIST


class Absences(Report):
    def __init__(self, df):
        super().__init__()
        self.id = "absences"
        self.display_label = "היעדרויות"
        self.is_input = True
        self.dependencies = []


        if df is not None:
            self.df = df
            self.aggregated = self.aggregate_absences(df)
            self.rows_count = len(df)
            self.columns_count = len(df.columns)
            self.extract_metadata()

    # ------------------------------------------------------------------
    @staticmethod
    def aggregate_absences(df):
        abs_h = Headers.InputFiles.Absences
        base  = Helpers.AbsencesComponentsBase

        df = Report.standarize_df(df)

        OUT_ID            = base.id              # קוד
        OUT_NAME          = base.name            # שם
        OUT_OPENING       = base.opening_balance   # יתרת פתיחה
        OUT_ONE_TIME      = base.one_time_input    # קליטה חד פעמית
        OUT_PREVIOUS      = base.previous_balance  # יתרה קודמת
        OUT_LAST          = base.last_balance      # יתרה אחרונה
        OUT_MONTHLY_ACC   = base.monthly_accrual   # צבירה חודשית
        OUT_MONTHLY_USAGE = base.monthly_usage     # ניצול חודשי
        OUT_MONTHLY_BAL   = base.monthly_balance   # יתרה חודשית

        TYPE_COL = "סוג היעדרות"

        METRIC_COLS = [
            OUT_ID, OUT_NAME, OUT_OPENING, OUT_ONE_TIME, OUT_PREVIOUS, OUT_LAST,
            OUT_MONTHLY_ACC, OUT_MONTHLY_USAGE, OUT_MONTHLY_BAL,
        ]

        # --- Per-type column maps {source column : output column} -----------
        vacation_map = {
            abs_h.vacation_code:             OUT_ID,
            abs_h.vacation_name:             OUT_NAME,
            abs_h.vacation_opening_balance:  OUT_OPENING,
            abs_h.vacation_one_time_input:   OUT_ONE_TIME,
            abs_h.vacation_previous_balance: OUT_PREVIOUS,
            abs_h.vacation_last_balance:     OUT_LAST,
            abs_h.vacation_monthly_accrual:  OUT_MONTHLY_ACC,
            abs_h.vacation_monthly_usage:    OUT_MONTHLY_USAGE,
            abs_h.vacation_monthly_balance:  OUT_MONTHLY_BAL,
        }
        sick_map = {
            abs_h.sick_code:             OUT_ID,
            abs_h.sick_name:             OUT_NAME,
            abs_h.sick_opening_balance:  OUT_OPENING,
            abs_h.sick_one_time_input:   OUT_ONE_TIME,
            abs_h.sick_previous_balance: OUT_PREVIOUS,
            abs_h.sick_last_balance:     OUT_LAST,
            abs_h.sick_monthly_accrual:  OUT_MONTHLY_ACC,
            abs_h.sick_monthly_usage:    OUT_MONTHLY_USAGE,
            abs_h.sick_monthly_balance:  OUT_MONTHLY_BAL,
        }
        convalescence_map = {
            abs_h.convalescence_code:             OUT_ID,
            abs_h.convalescence_name:             OUT_NAME,
            abs_h.convalescence_opening_balance:  OUT_OPENING,
            abs_h.convalescence_one_time_input:   OUT_ONE_TIME,
            abs_h.convalescence_previous_balance: OUT_PREVIOUS,
            abs_h.convalescence_last_balance:     OUT_LAST,
            abs_h.convalescence_monthly_accrual:  OUT_MONTHLY_ACC,
            abs_h.convalescence_monthly_usage:    OUT_MONTHLY_USAGE,
            abs_h.convalescence_monthly_balance:  OUT_MONTHLY_BAL,
        }
        reserve_map = {
            abs_h.reserve_monthly_usage: OUT_MONTHLY_USAGE,
        }

        NON_NUMERIC = {OUT_ID, OUT_NAME}

        target_dtypes = {
            OUT_ID:            'Int64',    # nullable integer (supports NaN)
            OUT_NAME:          'object',   # strings + NaN coexist
            OUT_OPENING:       'float64',
            OUT_ONE_TIME:      'float64',
            OUT_PREVIOUS:      'float64',
            OUT_LAST:          'float64',
            OUT_MONTHLY_ACC:   'float64',
            OUT_MONTHLY_USAGE: 'float64',
            OUT_MONTHLY_BAL:   'float64',
        }
        # --- Per-type slice: select → rename → aggregate → tag with type ----
        def slice_type(type_label, col_map):
            # Defend against the source file lacking a column for this type.
            present = [c for c in col_map if c in df.columns]
            if not present:
                return None

            subset = df[GROUP_LIST + present].copy()
            subset = subset.rename(columns={c: col_map[c] for c in present})

            agg_map = {
                col_map[c]: ('first' if col_map[c] in NON_NUMERIC else 'sum')
                for c in present
            }
            result = subset.groupby(GROUP_LIST, dropna=False).agg(agg_map).reset_index()

            for m in METRIC_COLS:
                if m not in result.columns:
                    result[m] = np.nan

            result[TYPE_COL] = type_label
            return result[GROUP_LIST + [TYPE_COL] + METRIC_COLS]

        pieces = [
            slice_type(base.vacation,      vacation_map),
            slice_type(base.sick,          sick_map),
            slice_type(base.convalescence, convalescence_map),
            slice_type(base.reserve,       reserve_map),
        ]
        
        if not pieces:
            return pd.DataFrame(columns=GROUP_LIST + [TYPE_COL] + METRIC_COLS)

        target_cols = GROUP_LIST + [TYPE_COL] + METRIC_COLS
        aligned = [p.reindex(columns=target_cols) for p in pieces]

        for i, p in enumerate(aligned):
            for col, dtype in target_dtypes.items():
                if col not in p.columns:
                    continue
                try:
                    if dtype == 'Int64':
                        # via to_numeric so a float-or-object NaN column
                        # converts cleanly to nullable Int64.
                        p[col] = pd.to_numeric(p[col], errors='coerce').astype('Int64')
                    elif dtype == 'float64':
                        p[col] = pd.to_numeric(p[col], errors='coerce')
                    else:
                        p[col] = p[col].astype(dtype)
                except (ValueError, TypeError):
                    pass
            aligned[i] = p

        # sort=False keeps the column order we just locked in.
        result = pd.concat(aligned, axis=0, ignore_index=True, sort=False)
        return result