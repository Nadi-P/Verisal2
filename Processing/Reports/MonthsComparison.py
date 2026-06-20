import re

from Reports.Report     import Report
from Reports.Center     import Center
from Reports.Components import Components
from Reports.Providents import Providents
from Reports.Income     import Income
from Reports.Deductions import Deductions
from Reports.Costing    import Costing
from Reports.Absences   import Absences
from Files import Files
from Headers import Headers, Helpers
from Constants import JOIN_KEY, KEY_REGEX
from LineageFrame.frame import LineageFrame


class MonthsComparison(Report):
    """
    Compares two work periods across 12 payroll checks.
    Every output cell's refs land on the exact raw input cells whose
    values entered the calculation (after freeze flattens through the
    translucent aggregations + merges).
    """

    def __init__(self, deps_report_map, manager=None):
        super().__init__()
        self.id = "months_comparison"
        self.display_label = "השוואת חודשים"
        self.is_input = False
        self.dependencies = [
            "center", "components", "providents",
            "income", "deductions", "costing", "absences",
        ]
        self.status = "error"

        missing = [
            d for d in self.dependencies
            if deps_report_map.get(d) is None
               or getattr(deps_report_map.get(d), "lineageFrame", None) is None
        ]
        if missing:
            self.missing_dependencies = missing
            self.status = "skipped"
            return

        try:
            final = self._build(deps_report_map)
            final.report_id   = self.id
            final.translucent = False

            self.lineageFrame   = final
            self.rows_count     = final.row_count()
            self.columns_count  = len(final.columns)
            self.status         = "loaded"

        except Exception as e:
            import traceback
            self.exceptions.append(f"{type(e).__name__}: {e}")
            traceback.print_exc()

    # ------------------------------------------------------------------
    @classmethod
    def _build(cls, deps_report_map):
        comparison_h = Headers.MonthsComparison
        emp_id_col   = Helpers.SystemReportsBase.employee_id
        emp_name_col = Helpers.SystemReportsBase.employee_name

        # 1. Wide source: every aggregation prefix-joined on JOIN_KEY.
        wide = cls._build_wide(deps_report_map)

        # 2. Discover every (year, month) period in the dataset.
        #    The costing aggregator keeps a row per (employee × period),
        #    so its prefixed work_year/work_month columns give us every
        #    period present anywhere in the data. Center's columns are
        #    NOT usable here — center is filtered to one period in
        #    aggregate_center.
        wide_year_col  = f"תמחיר_{Helpers.SystemReportsBase.work_year}"
        wide_month_col = f"תמחיר_{Helpers.SystemReportsBase.work_month}"
        seen = set()
        periods = []
        for i in range(wide.row_count()):
            y = wide[wide_year_col].cells[i].value  if wide_year_col  in wide else None
            m = wide[wide_month_col].cells[i].value if wide_month_col in wide else None
            if y is None or m is None: continue
            try:
                y_int = int(y); m_int = int(m)
            except (TypeError, ValueError):
                continue
            if (y_int, m_int) in seen: continue
            seen.add((y_int, m_int))
            periods.append((y_int, m_int))
        periods.sort(key=lambda p: (p[0], p[1]))
        if not periods:
            # No periods — return an empty frame with the static columns.
            return LineageFrame.from_rows(
                f"{cls.__name__}.empty", wide.manager,
                column_names=[comparison_h.employee_id, comparison_h.employee_name,
                              comparison_h.check, comparison_h.category],
                rows=[], translucent=True,
            )

        # Label each period like "08/2025"; preserve chronological order.
        period_labels = [f"{m:02d}/{y}" for (y, m) in periods]

        # 3. Per-period filtered sub-frames, indexed by (year, month).
        # MUST use the costing-prefixed period columns (same source we
        # discovered the periods with). The unprefixed PayrollCodes
        # columns come from center, which `aggregate_center` filters
        # down to a SINGLE period — using them here would silently
        # collapse every other period's frame to zero rows, leaving
        # every non-current month showing as 0 in the output.
        period_frames = {
            (y, m): wide[(wide[wide_year_col] == y) & (wide[wide_month_col] == m)]
            for (y, m) in periods
        }

        # 4. Build a per-employee lookup so we can stitch values across
        #    periods for the SAME employee. Key on emp_id (extracted from
        #    JOIN_KEY) → {(y, m): row_index_within_that_period_frame}.
        emp_idx = {}      # str -> {(y,m): row_idx}
        prefixed_emp_id   = f"תמחיר_{emp_id_col}"
        prefixed_emp_name = f"תמחיר_{emp_name_col}"

        def _normalize_id(v):
            if v is None: return ""
            if isinstance(v, float) and v.is_integer(): return str(int(v))
            return str(v).strip()

        for (y, m), pf in period_frames.items():
            for i in range(pf.row_count()):
                eid = _normalize_id(pf[prefixed_emp_id].cells[i].value)
                if not eid: continue
                emp_idx.setdefault(eid, {})[(y, m)] = i

        # 5. Define the check list (which prefixed column each check pulls).
        check_list = [
            {"check": "שכר ברוטו",          "category": "תשלומים",     "col": "תמחיר_ברוטו"},
            {"check": "שכר נטו",            "category": "תשלומים",     "col": "תמחיר_נטו לתשלום"},
            {"check": "עלות מעסיק",         "category": "עלויות",      "col": "תמחיר_עלות מעסיק"},
            {"check": "מס הכנסה",           "category": "ניכויי חובה", "col": "תמחיר_מס הכנסה"},
            {"check": "ב.ל עובד",           "category": "ניכויי חובה", "col": "תמחיר_ב.ל. עובד"},
            {"check": "ב.ל מעסיק",          "category": "עלויות",      "col": "תמחיר_ב.ל. מעסיק"},
            {"check": "גמל מעסיק",          "category": "סוציאליות",   "col": f'קופות_{Headers.AggregatedFiles.ProvidentsAGG.employer_pension_total}'},
            {"check": 'קה"ל מעסיק',         "category": "סוציאליות",   "col": f'קופות_{Headers.AggregatedFiles.ProvidentsAGG.employer_study_fund_total}'},
            {"check": "ניכויי רשות",        "category": "ניכויים",     "col": 'ניכויים_סה"כ ניכויי רשות'},
            {"check": "זקיפות שווי",        "category": "זקיפות",      "col": f"זקיפות_{Headers.AggregatedFiles.IncomeAGG.total}"},
            {"check": "רכיבים לסוציאליות", "category": "בסיס שכר",    "col": f"רכיבים_{Headers.InputFiles.Components.social_total}"},
            {"check": "ימי עבודה",          "category": "נוכחות",      "col": "תמחיר_כמות ימים"},
        ]

        def _num(v):
            if v is None or (isinstance(v, float) and v != v): return 0
            if isinstance(v, (int, float)): return v
            try: return float(v)
            except (TypeError, ValueError): return 0

        # 6. Walk every (employee × check), building one row whose value
        #    columns are the per-period values for THAT check.
        rows = []
        # Stable employee order: as encountered in the earliest period.
        ordered_emps = []
        for (y, m) in periods:
            pf = period_frames[(y, m)]
            for i in range(pf.row_count()):
                eid = _normalize_id(pf[prefixed_emp_id].cells[i].value)
                if eid and eid not in ordered_emps:
                    ordered_emps.append(eid)

        for eid in ordered_emps:
            # Pick a representative cell pair (id + name) — the earliest
            # period that has this employee, so its refs trace cleanly.
            rep_y_m = next(((y, m) for (y, m) in periods if (y, m) in emp_idx[eid]), None)
            if rep_y_m is None: continue
            rep_pf = period_frames[rep_y_m]
            rep_row = emp_idx[eid][rep_y_m]
            emp_id_cell   = rep_pf[prefixed_emp_id].cells[rep_row]
            emp_name_cell = rep_pf[prefixed_emp_name].cells[rep_row]

            for item in check_list:
                col_name = item["col"]
                row = {
                    comparison_h.employee_id:   (emp_id_cell.value,   emp_id_cell.contrib_refs()),
                    comparison_h.employee_name: (emp_name_cell.value, emp_name_cell.contrib_refs()),
                    comparison_h.check:         item["check"],
                    comparison_h.category:      item["category"],
                }
                for (y, m), label in zip(periods, period_labels):
                    pf = period_frames[(y, m)]
                    if col_name not in pf or (y, m) not in emp_idx.get(eid, {}):
                        row[label] = (0, [])
                        continue
                    src_row = emp_idx[eid][(y, m)]
                    cell = pf[col_name].cells[src_row]
                    row[label] = (_num(cell.value), cell.contrib_refs())
                rows.append(row)

        column_names = [
            comparison_h.employee_id,
            comparison_h.employee_name,
            comparison_h.check,
            comparison_h.category,
            *period_labels,
        ]
        out = LineageFrame.from_rows(
            f"{cls.__name__}.body", wide.manager,
            column_names=column_names, rows=rows, translucent=True,
        )

        # 7. Annotate formulas (display-only).
        out[comparison_h.employee_id].formula   = f"first({emp_id_col})"
        out[comparison_h.employee_name].formula = f"first({emp_name_col})"
        out[comparison_h.check].formula         = "שם הבדיקה (קבוע)"
        out[comparison_h.category].formula      = "סיווג (קבוע)"
        for label in period_labels:
            out[label].formula = f"ערך לחודש {label}"

        return out

    # ------------------------------------------------------------------
    @staticmethod
    def _build_wide(deps_report_map):
        """
        Build the wide source by prefix-renaming + merging each
        aggregator's output onto JOIN_KEY. Center is merged WITHOUT
        prefix so its coded columns (PayrollCodes.*) come through
        unchanged for the period filter and check-list lookups.
        """
        comp = Components.aggregate_components(deps_report_map["components"].lineageFrame)
        prov = Providents.aggregate_providents(deps_report_map["providents"].lineageFrame)
        inc  = Income.aggregate_income(deps_report_map["income"].lineageFrame)
        ded  = Deductions.aggregate_deductions(deps_report_map["deductions"].lineageFrame)
        cost = Costing.aggregate_costing(deps_report_map["costing"].lineageFrame)
        abs_ = Absences.aggregate_absences(deps_report_map["absences"].lineageFrame)
        ctr  = Center.aggregate_center(deps_report_map["center"].coded_lineageFrame)

        def prefixed(frame, p):
            renames = {c.name: f"{p}_{c.name}" for c in frame.columns if c.name != JOIN_KEY}
            return frame.rename(columns=renames)

        wide = prefixed(cost, "תמחיר")
        for nxt, p in [(comp, "רכיבים"), (prov, "קופות"), (inc, "זקיפות"),
                       (ded, "ניכויים"), (abs_, "היעדרויות")]:
            wide = wide.merge(prefixed(nxt, p), on=JOIN_KEY, how="left")
        wide = wide.merge(ctr, on=JOIN_KEY, how="left")
        return wide
