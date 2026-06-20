"""
Loading Table (טבלת טעינה) — manufactured report.

Transforms the wide center file (one row per employee, columns keyed by
CONCAT component codes) into the thin long-format loading table: one row
per (employee × payroll component) that carries a non-zero rate or
quantity.

Pipeline (mirrors the original Excel חישובי הכנה engine):

  spine  = the CONCAT codes present on the center (positive int columns of
           center.coded_lineageFrame). Codes that start with digit 9 are
           record-type-91 HELPER codes — they never emit a row of their
           own, they only feed a quantity into the real component they map
           to (strip the leading 9 → real CONCAT).

  per (employee, concat):
      B = raw center value for that cell
      record type = first digit of the (9-stripped) concat
      code        = remaining digits
      - record types 1/2/3 are AMOUNT components → rate = B, quantity = 1
      - record type 4 is a COUNT component       → rate = 0, quantity = B
      - record type 91 (helper) → contributes B into the quantity channel
        of its mapped real component (rate = 0, never emitted)

  final quantity H for a real component:
      H = sum of every quantity-channel value (its own, for record-4, plus
          any 9-helper values) whose stripped concat matches it, for the
          same employee. If that sum is 0 but the component carries a rate,
          H falls back to 1 (so amount components load as "rate × 1").

  keep only rows where rate + quantity > 0.

Every output cell carries tight per-cell lineage: rate/quantity refs point
at the exact center cells whose values entered the calculation (freeze
flattens them through the translucent coded center frame to the raw cells).
The record-type / component-code / month cells are structural constants and
carry no refs.
"""
from Reports.Report import Report
from Headers import Helpers
from Axiology import Axiology
from Files import Files
from LineageFrame.frame import LineageFrame


class LoadingTable(Report):
    """Manufactured loading-table report built from the center file alone."""

    def __init__(self, center_report, manager=None):
        super().__init__()
        self.id = "loading_table"
        self.display_label = "טבלת טעינה"
        self.is_input = False
        self.dependencies = ["center"]
        self.status = "error"

        if (center_report is None
                or getattr(center_report, "coded_lineageFrame", None) is None):
            self.missing_dependencies = ["center"]
            self.status = "skipped"
            return

        try:
            final = self._build(center_report.coded_lineageFrame, manager)
            final.report_id   = self.id
            final.translucent = False

            self.lineageFrame  = final
            self.rows_count    = final.row_count()
            self.columns_count = len(final.columns)
            self.status        = "loaded"

        except Exception as e:
            import traceback
            self.exceptions.append(f"{type(e).__name__}: {e}")
            traceback.print_exc()

    # ------------------------------------------------------------------
    #  Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _to_num(v) -> float:
        """Coerce a cell value to float; blanks / NaN / non-numeric → 0.0."""
        if v is None or isinstance(v, bool):
            return 0.0
        if isinstance(v, (int, float)):
            return 0.0 if (isinstance(v, float) and v != v) else float(v)
        s = str(v).strip().replace(",", "")
        if not s:
            return 0.0
        try:
            return float(s)
        except ValueError:
            return 0.0

    @staticmethod
    def _clean(v: float):
        """Render whole floats as ints (14968.0 → 14968) for tidy output."""
        f = float(v)
        if f != f:
            return 0
        return int(f) if f.is_integer() else f

    # ------------------------------------------------------------------
    #  Build
    # ------------------------------------------------------------------
    @classmethod
    def _build(cls, coded, manager):
        H_month = Helpers.SystemReportsBase.work_month              # חודש עבודה
        H_emp   = Helpers.SystemReportsBase.employee_id             # מספר עובד
        H_rec   = r"סוג רשומה"
        H_code  = Helpers.ComponentsTypeReportsBase.component_code  # קוד רכיב
        H_rate  = Helpers.ComponentsTypeReportsBase.tarriff         # תעריף
        H_qty   = Helpers.ComponentsTypeReportsBase.quantity        # כמות

        month_value = Files.current_month

        emp_col = coded[Axiology.code("employee_id")]  # fake code -1 = employee number
        n_rows  = coded.row_count()

        # Spine: unique positive integer concat codes present on the center.
        concat_keys = []
        seen = set()
        for col in coded.columns:
            k = col.name
            if isinstance(k, int) and k > 0 and k not in seen:
                seen.add(k)
                concat_keys.append(k)

        out_rows = []   # tuples: (emp, recType, code, emp_cell, rate, rate_refs, qty, qty_refs)

        for r in range(n_rows):
            emp_cell = emp_col.cells[r]
            emp_val  = cls._to_num(emp_cell.value)
            if emp_val == 0:                 # blank / padding row → skip
                continue
            emp_int = int(emp_val)

            # ---- pass 1: per-concat rate (G) + quantity-channel (I) -----
            rate_map   = {}    # concat -> (rate_value, rate_refs)
            i_by_norm  = {}    # normalized concat -> list[(value, refs)]
            meta_map   = {}    # concat -> (recType, code, isHelper)

            for K in concat_keys:
                cell  = coded[K].cells[r]
                B     = cls._to_num(cell.value)
                refsB = cell.contrib_refs()

                ks       = str(K)
                isHelper = ks.startswith("9")
                C        = int(ks[1:]) if isHelper else K
                cs       = str(C)
                recType  = int(cs[0])
                code     = int(cs[1:]) if len(cs) > 1 else 0
                meta_map[K] = (recType, code, isHelper)

                if isHelper or recType == 4:
                    # Quantity component: feeds the qty channel of its
                    # (stripped) real concat. Helpers never carry a rate.
                    rate_map[K] = (0.0, [])
                    i_by_norm.setdefault(C, []).append((B, refsB))
                else:
                    # Amount component (record types 1/2/3): rate = B.
                    rate_map[K] = (B, refsB if B != 0 else [])

            # ---- pass 2: emit one row per real (non-helper) component ---
            for K in concat_keys:
                recType, code, isHelper = meta_map[K]
                if isHelper:
                    continue                 # helpers never emit their own row

                rate_val, rate_refs = rate_map[K]

                contribs = i_by_norm.get(K, [])     # K is its own normalized concat
                qty_val  = sum(v for v, _ in contribs)
                qty_refs = []
                for _v, rf in contribs:
                    qty_refs.extend(rf)

                # Amount components with no quantity channel load as "rate × 1".
                if qty_val == 0 and rate_val > 0:
                    qty_val  = 1.0
                    qty_refs = []

                if rate_val + qty_val <= 0:
                    continue                 # zero component → dropped

                out_rows.append((
                    emp_int, recType, code, emp_cell,
                    rate_val, rate_refs, qty_val, qty_refs,
                ))

        # Group by employee, then record type, then component code.
        out_rows.sort(key=lambda x: (x[0], x[1], x[2]))

        col_names = [H_month, H_emp, H_rec, H_code, H_rate, H_qty]
        rows = []
        for (emp_int, recType, code, emp_cell,
             rate_val, rate_refs, qty_val, qty_refs) in out_rows:
            rows.append({
                H_month: month_value,                              # constant
                H_emp:   (emp_int, emp_cell.contrib_refs()),       # ← center emp cell
                H_rec:   recType,                                  # constant
                H_code:  code,                                     # constant
                H_rate:  (cls._clean(rate_val), list(rate_refs)),
                H_qty:   (cls._clean(qty_val),  list(qty_refs)),
            })

        frame = LineageFrame.from_rows(
            cls.__name__, manager, col_names, rows, translucent=False,
        )

        # Display-only formula strings.
        frame[H_month].formula = H_month
        frame[H_emp].formula   = H_emp
        frame[H_rec].formula   = "ספרת סוג הרשומה מקוד הרכיב"
        frame[H_code].formula  = "קוד הרכיב ללא ספרת סוג הרשומה"
        frame[H_rate].formula  = "ערך הרכיב (רכיבי שכר/זקופות/ניכויים)"
        frame[H_qty].formula   = "כמות הרכיב (היעדרויות + רשומות עזר)"

        return frame
