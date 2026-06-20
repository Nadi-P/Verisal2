import pandas as pd

from Headers import Helpers
from Axiology import Axiology
from Constants import JOIN_KEY


class Report:
    def __init__(self):
        self.id = None
        self.display_label = None
        self.is_input = None
        self.dependencies = []

        self.company_name = None
        self.min_month = None
        self.min_year = None
        self.max_month = None
        self.max_year = None

        self.rows_count = 0
        self.columns_count = 0

        self.exceptions = []
        self.status = None
        self.missing_dependencies = []
        self.skipped_steps = []
        self.lineageFrame = None

        # ---- Card / consistency fields (computed by UploadManager) ----
        # disabled        : report cannot be viewed (missing file or a
        #                   missing/disabled dependency). Greyed + unclickable.
        # card_status     : "ok" | "missing" | "missing_dependency" | "inconsistent"
        # inconsistency_reasons        : Hebrew lines describing each mismatch
        # dependencies_display         : dep display names (not ids)
        # missing_dependencies_display : missing-dep display names (not ids)
        self.disabled = False
        self.card_status = "ok"
        self.inconsistency_reasons = []
        self.dependencies_display = []
        self.missing_dependencies_display = []

        # Legacy fields kept for callers that haven't migrated.
        self.tracebacks_map = {}
        self.df = None
        self.aggregated = None

    # ------------------------------------------------------------------
    #  Serialization (metadata block — consumed by UploadManager.to_wire)
    # ------------------------------------------------------------------
    def to_dict(self) -> dict:
        return {
            "id":                   self.id,
            "display_label":        self.display_label,
            "is_input":             self.is_input,
            "dependencies":         list(self.dependencies or []),
            "company_name":         self.company_name,
            "min_month":            self.min_month,
            "min_year":             self.min_year,
            "max_month":            self.max_month,
            "max_year":             self.max_year,
            "rows_count":           self.rows_count,
            "columns_count":        self.columns_count,
            "exceptions":           list(self.exceptions or []),
            "status":               self.status,
            "missing_dependencies": list(self.missing_dependencies or []),
            "skipped_steps":        list(self.skipped_steps or []),
            "disabled":                     bool(self.disabled),
            "card_status":                  self.card_status,
            "inconsistency_reasons":        list(self.inconsistency_reasons or []),
            "dependencies_display":         list(self.dependencies_display or []),
            "missing_dependencies_display": list(self.missing_dependencies_display or []),
        }

    # ------------------------------------------------------------------
    #  Standardization helpers
    #  Moved here from Functions.Aggregations so every report subclass
    #  can call them as Report.extract_month(...) etc.
    # ------------------------------------------------------------------

    @staticmethod
    def extract_month(val):
        try:
            return int(str(val).split('/')[1])
        except (IndexError, ValueError, AttributeError):
            return None

    @staticmethod
    def extract_year(val):
        try:
            return int(str(val).split('/')[0])
        except (IndexError, ValueError, AttributeError):
            return None

    @staticmethod
    def standardize_lineage(frame, is_center: bool = False):
        """
        LineageFrame-native standardize: builds a translucent intermediate
        with (a) the work_month column replaced by its extracted-month
        form, (b) a JOIN_KEY column added (`"<id>-<month>-<year>"`), and
        (c) fillna(0) applied. Numeric ids are normalized so `1.0` and
        `1` form the same join key.
        """
        from LineageFrame.frame import LineageFrame
        id_col    = Helpers.SystemReportsBase.employee_id if not is_center else Axiology.code("employee_id")
        month_col = Helpers.SystemReportsBase.work_month  if not is_center else Axiology.code("work_month")
        year_col  = Helpers.SystemReportsBase.work_year   if not is_center else Axiology.code("work_year")

        out = LineageFrame(f"{frame.report_id}.std", frame.manager, translucent=True)

        for col in frame.columns:
            if col.name == month_col:
                out[col.name] = col.apply(Report.extract_month)
            else:
                out[col.name] = col.copy()

        def _norm(v):
            if v is None:
                return ""
            if isinstance(v, float):
                if v != v:
                    return ""
                if v.is_integer():
                    return str(int(v))
                return str(v).strip()
            if isinstance(v, int):
                return str(v)
            s = str(v).strip()
            try:
                f = float(s)
                if f.is_integer():
                    return str(int(f))
            except (TypeError, ValueError):
                pass
            return s

        ids    = frame[id_col].apply(_norm)
        months = out[month_col].apply(_norm)
        years  = frame[year_col].apply(_norm)
        out[JOIN_KEY] = ids + "-" + months + "-" + years

        return out.fillna(0)

    @staticmethod
    def standarize_df(df, is_center=False):
        id_col    = Helpers.SystemReportsBase.employee_id if not is_center else Axiology.code("employee_id")
        month_col = Helpers.SystemReportsBase.work_month  if not is_center else Axiology.code("work_month")
        year_col  = Helpers.SystemReportsBase.work_year   if not is_center else Axiology.code("work_year")
        df = df.copy()

        df[month_col] = df[month_col].apply(Report.extract_month)

        # Standardize the month part
        ids    = df[id_col].astype(str).str.strip()
        months = df[month_col].astype(str).str.strip()
        years  = df[year_col].astype(str).str.strip()

        df[JOIN_KEY] = ids + "-" + months + "-" + years
        return df.fillna(0)

    def extract_metadata(self):
        """
        Extracts uniform company name and calculates the earliest (min) 
        and latest (max) chronological periods from the provided columns.
        """
        company_name_col = Helpers.SystemReportsBase.company_name
        month_col = Helpers.SystemReportsBase.work_month
        # 1. Extract the uniform company name (takes the first valid non-null value)
        first_valid_company = company_name_col.dropna().first_valid_index()
        if first_valid_company is not None:
            self.company_name = str(company_name_col.loc[first_valid_company]).strip()
        else:
            self.company_name = None

        # 2. Extract years and months into a temporary DataFrame for tracking pairs
        temp_df = pd.DataFrame({
            'year': month_col.apply(self.extract_year),
            'month': month_col.apply(self.extract_month)
        }).dropna(subset=['year', 'month'])

        if temp_df.empty:
            self.min_year = self.min_month = self.max_year = self.max_month = None
            return

        # 3. Convert the year/month pairs into actual datetime objects for chronological tracking
        temp_df['date'] = pd.to_datetime(
            temp_df['year'].astype(str) + '-' + temp_df['month'].astype(str) + '-01',
            errors='coerce'
        ).dropna(subset=['date'])
        

        if temp_df.empty:
            self.min_year = self.min_month = self.max_year = self.max_month = None
            return

        earliest_row = temp_df.loc[temp_df['date'].idxmin()]
        latest_row = temp_df.loc[temp_df['date'].idxmax()]

        self.min_year = int(earliest_row['year'])
        self.min_month = int(earliest_row['month'])
        self.max_year = int(latest_row['year'])
        self.max_month = int(latest_row['month'])
