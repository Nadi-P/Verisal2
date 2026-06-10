import pandas as pd

from Headers import Helpers, PayrollCodes
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
        self.tracebacks_map = {}
        self.df = None
        self.aggregated = None

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
    def standarize_df(df, is_center=False):
        id_col    = Helpers.SystemReportsBase.employee_id if not is_center else PayrollCodes.employee_id
        month_col = Helpers.SystemReportsBase.work_month  if not is_center else PayrollCodes.work_month
        year_col  = Helpers.SystemReportsBase.work_year   if not is_center else PayrollCodes.work_year
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
