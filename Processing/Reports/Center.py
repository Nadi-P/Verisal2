from Reports.Report import Report
from Files import Files
from Headers import Masks
from Axiology import Axiology
from LineageFrame.frame import LineageFrame


class Center(Report):
    """
    Raw center input wrapped as a Report + LineageFrame.

    The center file is special: it carries TWO logical projections of the
    same underlying cells:
      - `self.lineageFrame` — the user-visible frame using Hebrew column
                              headers. This is what the trace UI surfaces.
      - `self.coded_lineageFrame` — a TRANSLUCENT projection where the
                              same cells live under integer PayrollCodes
                              keys. Manufactured-report constructors
                              consume this; at freeze time every ref into
                              it gets rewritten to the matching raw cell.
    """

    def __init__(self, df, manager=None, code_map=None):
        super().__init__()
        self.id = "center"
        self.display_label = "קובץ מרכז שכר"
        self.is_input = True
        self.dependencies = []
        self.status = "error"

        self.coded_lineageFrame = None

        if df is None:
            self.status = "skipped"
            return

        try:
            self.rows_count    = len(df)
            self.columns_count = len(df.columns)

            if manager is not None:
                self.lineageFrame = LineageFrame.from_pandas(df, self.id, manager)

                # Build the coded translucent projection. `code_map` is
                # {raw_col_name -> int_code}. We rename + project on a
                # COPY of the raw frame so the resulting cells carry refs
                # back to the raw cells. Freeze flattens through.
                if code_map:
                    rename_map = {n: c for n, c in code_map.items()
                                  if n in self.lineageFrame}
                    if rename_map:
                        renamed = self.lineageFrame.rename(columns=rename_map)
                        renamed.translucent = True
                        renamed.report_id = f"{self.id}.coded"
                        kept_codes = [c for c in rename_map.values()]
                        # Project to ONLY the coded columns.
                        self.coded_lineageFrame = renamed[kept_codes]
                        self.coded_lineageFrame.translucent = True
                        self.coded_lineageFrame.report_id = f"{self.id}.codedProj"

            self.status = "loaded"

        except Exception as e:
            self.exceptions.append(f"{type(e).__name__}: {e}")

    @staticmethod
    def aggregate_center(coded_frame):
        """
        Center-specific aggregation operating on the coded LineageFrame:
          1. Drop rows missing employee_id.
          2. Overwrite work_year + work_month with the CURRENT period
             (constants — empty refs).
          3. Standardize (build JOIN_KEY + extracted month).
          4. Add total_salary = row-wise sum across the mask columns
             (each cell's refs = the mask cells in the same row).
        Returns a translucent LineageFrame.
        """
        emp_id_code     = Axiology.code("employee_id")
        work_year_code  = Axiology.code("work_year")
        work_month_code = Axiology.code("work_month")
        total_salary_code = Axiology.code("total_salary")

        # 1. Drop rows missing employee_id.
        with_emp_id = coded_frame.dropna(subset=[emp_id_code])

        # 2. Synthesize the period columns. These are HARDCODED — every
        #    cell carries the current period and an empty refs list (no
        #    source cell contributed). Every other column is carried
        #    through via copy() so its lineage refs survive.
        period = LineageFrame(f"{coded_frame.report_id}.withPeriod",
                              coded_frame.manager, translucent=True)
        cur_year  = Files.current_year  if Files.current_year  is not None else 0
        cur_month = Files.current_month if Files.current_month is not None else 0
        current_period = f"{cur_year}/{cur_month:02}"
        n = with_emp_id.row_count()
        for col in with_emp_id.columns:
            if col.name in (work_year_code, work_month_code):
                continue  # we'll add fresh constants below
            period[col.name] = col.copy()
        period[work_year_code]  = [Files.current_year] * n
        period[work_month_code] = [current_period] * n

        # 3. Standardize (builds JOIN_KEY + extracts numeric month).
        std = Report.standardize_lineage(period, is_center=True)

        # 4. total_salary = sum of mask columns row-wise. The Column +
        #    operator combines refs from both operands per cell — so
        #    each output cell's refs are exactly the mask cells that
        #    summed into it.
        mask_codes = Axiology.codes(Masks.TotalSalaryCenterMask.keys)
        present = [c for c in mask_codes if c in std]
        if not present:
            std[total_salary_code] = [0] * std.row_count()
            return std

        # Numeric-coerce each contributing column, then sum.
        from LineageFrame.operations import to_numeric
        running = to_numeric(std[present[0]], errors="coerce").fillna(0)
        for code in present[1:]:
            running = running + to_numeric(std[code], errors="coerce").fillna(0)
        std[total_salary_code] = running

        return std
