from Reports.Report import Report
from Files import Files
from Headers import Headers, Helpers
from LineageFrame.frame import LineageFrame


class MonthsComparison(Report):
    """
    Annual salary summary ("ריכוז משכורות שנתי") — one stacked block per
    employee. Rows are payroll line items; columns are one per work period
    present in the data (MM/YYYY), plus a months-sum total column.

    Row sources (per the director's mapping sheet):
      - components (filter שם רכיב = label, take סה"כ): base salary, travel,
        gross-up, reserve diffs, bonus
      - income (filter שם רכיב = label, take סה"כ): meals / gifts values
      - "סה\"כ" (bruto)  = sum of every row above it
      - costing: מס הכנסה, ב.ל. עובד (already includes health)
      - "סה\"כ הכ.זקופות" = income total (all rows, unfiltered)
      - providents: ONE row per distinct fund (שם קופה), take גמל עובד
      - "שכר נטו" (neto) = bruto − (every deduction row between bruto + neto)
      - center (only the loaded center's own period column; 0 elsewhere):
        actual/paid hours, paid/actual days
      - absences: monthly usage of vacation / sick / reserve / convalescence

    Every output cell carries per-cell lineage: value cells ref the exact
    source input cells; the computed bruto/neto cells ref every cell that
    fed the sum. (Freeze flattens through the translucent standardize pass.)
    """

    def __init__(self, deps_report_map, manager=None):
        super().__init__()
        self.id = "months_comparison"
        self.display_label = "השוואת חודשים"
        self.is_input = False
        self.dependencies = [
            "center", "components", "providents",
            "income", "costing", "absences",
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
    #  Small value helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _norm_id(v):
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

    @staticmethod
    def _num(v):
        if v is None or (isinstance(v, float) and v != v):
            return 0.0
        if isinstance(v, (int, float)):
            return float(v)
        try:
            return float(str(v).strip().replace(",", ""))
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _to_int(v):
        try:
            f = float(v)
        except (TypeError, ValueError):
            return None
        if f != f:
            return None
        return int(f)

    @staticmethod
    def _clean(v):
        f = float(v)
        if f != f:
            return 0
        return int(f) if f.is_integer() else f

    # ------------------------------------------------------------------
    #  Build
    # ------------------------------------------------------------------
    @classmethod
    def _build(cls, deps):
        H        = Headers
        mc_h     = H.MonthsComparison
        comp_h   = H.InputFiles.Components
        inc_h    = H.InputFiles.Income
        cost_h   = H.InputFiles.Costing
        prov_h   = H.InputFiles.Providents
        abs_h    = H.InputFiles.Absences
        cen_h    = H.InputFiles.Center

        emp_id_col   = Helpers.SystemReportsBase.employee_id
        emp_name_col = Helpers.SystemReportsBase.employee_name
        year_col     = Helpers.SystemReportsBase.work_year
        month_col    = Helpers.SystemReportsBase.work_month

        manager = deps["components"].lineageFrame.manager

        # ---- Standardize the period-bearing inputs ---------------------
        comp_std = Report.standardize_lineage(deps["components"].lineageFrame)
        inc_std  = Report.standardize_lineage(deps["income"].lineageFrame)
        cost_std = Report.standardize_lineage(deps["costing"].lineageFrame)
        prov_std = Report.standardize_lineage(deps["providents"].lineageFrame)
        abs_std  = Report.standardize_lineage(deps["absences"].lineageFrame)

        def _vr(col, i):
            cell = col.cells[i]
            return cls._num(cell.value), list(cell.contrib_refs())

        def _iter(std):
            """Yield (emp, year, month, row_index) for a standardized frame."""
            if emp_id_col not in std or year_col not in std or month_col not in std:
                return
            idc, yc, mc = std[emp_id_col], std[year_col], std[month_col]
            for i in range(std.row_count()):
                emp = cls._norm_id(idc.cells[i].value)
                y = cls._to_int(yc.cells[i].value)
                m = cls._to_int(mc.cells[i].value)
                if emp and y is not None and m is not None:
                    yield emp, y, m, i

        # ---- components / income keyed by (emp, y, m) -> {name: [v, refs]}
        def _by_name(std):
            name_c = std[comp_h.component_name] if comp_h.component_name in std else None
            tot_c  = std[comp_h.total_amount]   if comp_h.total_amount   in std else None
            out, total = {}, {}
            if name_c is None or tot_c is None:
                return out, total
            for emp, y, m, i in _iter(std):
                v, refs = _vr(tot_c, i)
                name = str(name_c.cells[i].value).strip()
                slot = out.setdefault((emp, y, m), {}).setdefault(name, [0.0, []])
                slot[0] += v
                slot[1].extend(refs)
                t = total.setdefault((emp, y, m), [0.0, []])
                t[0] += v
                t[1].extend(refs)
            return out, total

        comp_by, _comp_total = _by_name(comp_std)
        inc_by,  inc_total   = _by_name(inc_std)

        # ---- costing keyed by (emp, y, m) -> {'tax':(v,refs),'ni':(v,refs)}
        cost_by = {}
        tax_c = cost_std[cost_h.income_tax] if cost_h.income_tax in cost_std else None
        ni_c  = cost_std[cost_h.employee_national_insurance] if cost_h.employee_national_insurance in cost_std else None
        for emp, y, m, i in _iter(cost_std):
            cost_by[(emp, y, m)] = {
                "tax": _vr(tax_c, i) if tax_c is not None else (0.0, []),
                "ni":  _vr(ni_c, i)  if ni_c  is not None else (0.0, []),
            }

        # ---- providents keyed by (emp,y,m) -> {fund:[v,refs]}; fund order
        prov_by, emp_funds = {}, {}
        fund_c = prov_std[prov_h.fund_name]       if prov_h.fund_name       in prov_std else None
        gmel_c = prov_std[prov_h.employee_pension] if prov_h.employee_pension in prov_std else None
        if fund_c is not None and gmel_c is not None:
            for emp, y, m, i in _iter(prov_std):
                fund = str(fund_c.cells[i].value).strip()
                if not fund:
                    continue
                v, refs = _vr(gmel_c, i)
                slot = prov_by.setdefault((emp, y, m), {}).setdefault(fund, [0.0, []])
                slot[0] += v
                slot[1].extend(refs)
                funds = emp_funds.setdefault(emp, [])
                if fund not in funds:
                    funds.append(fund)

        # ---- absences keyed by (emp,y,m) -> {key:(v,refs)} -------------
        abs_cols = {
            "vac":     abs_h.vacation_monthly_usage,
            "sick":    abs_h.sick_monthly_usage,
            "reserve": abs_h.reserve_monthly_usage,
            "conv":    abs_h.convalescence_monthly_usage,
        }
        abs_by = {}
        for emp, y, m, i in _iter(abs_std):
            d = {}
            for k, coln in abs_cols.items():
                d[k] = _vr(abs_std[coln], i) if coln in abs_std else (0.0, [])
            abs_by[(emp, y, m)] = d

        # ---- center: single period, raw Hebrew-header frame -----------
        center_frame = deps["center"].lineageFrame
        cen_emp_name = next(
            (c.name for c in center_frame.columns
             if isinstance(c.name, str) and "מספר" in c.name and "עובד" in c.name),
            None,
        )
        cen_cols = {
            "actual_hours": cen_h.actual_work_hours,
            "paid_hours":   cen_h.paid_work_hours,
            "paid_days":    cen_h.paid_work_days,
            "actual_days":  cen_h.actual_work_days,
        }
        center_by = {}
        if cen_emp_name is not None:
            idc = center_frame[cen_emp_name]
            for i in range(center_frame.row_count()):
                emp = cls._norm_id(idc.cells[i].value)
                if not emp:
                    continue
                d = {}
                for k, coln in cen_cols.items():
                    d[k] = _vr(center_frame[coln], i) if coln in center_frame else (0.0, [])
                center_by[emp] = d
        center_period = (Files.current_year, Files.current_month)

        # ---- employee meta (id + name cells) + stable order -----------
        emp_meta, emps = {}, []
        for std in (comp_std, cost_std, prov_std, abs_std, inc_std):
            if emp_id_col not in std:
                continue
            idc = std[emp_id_col]
            namec = std[emp_name_col] if emp_name_col in std else None
            for i in range(std.row_count()):
                emp = cls._norm_id(idc.cells[i].value)
                if not emp:
                    continue
                if emp not in emps:
                    emps.append(emp)
                if emp not in emp_meta:
                    idcell = idc.cells[i]
                    nm = ((namec.cells[i].value, list(namec.cells[i].contrib_refs()))
                          if namec is not None else (None, []))
                    emp_meta[emp] = {
                        "id":   (idcell.value, list(idcell.contrib_refs())),
                        "name": nm,
                    }
        for emp in center_by:
            if emp not in emps:
                emps.append(emp)
            emp_meta.setdefault(emp, {"id": (emp, []), "name": (None, [])})

        # ---- periods (chronological) ----------------------------------
        period_set = set()
        for by in (comp_by, inc_by, cost_by, prov_by, abs_by, inc_total):
            for (e, y, m) in by:
                period_set.add((y, m))
        if center_period[0] is not None and center_period[1] is not None:
            period_set.add(center_period)
        periods = sorted(period_set, key=lambda t: t[0] * 100 + t[1])
        period_labels = [f"{m:02d}/{y}" for (y, m) in periods]

        line_item_col = mc_h.line_item
        total_col     = mc_h.months_total
        column_names = [emp_id_col, emp_name_col, line_item_col, *period_labels, total_col]

        if not periods or not emps:
            return LineageFrame.from_rows(
                f"{cls.__name__}.empty", manager,
                column_names=column_names, rows=[], translucent=True,
            )

        # ---- per-period accessors -------------------------------------
        def named_pp(by, emp, name):
            pp = {}
            for (y, m) in periods:
                d = by.get((emp, y, m))
                if d and name in d:
                    pp[(y, m)] = (d[name][0], list(d[name][1]))
                else:
                    pp[(y, m)] = (0.0, [])
            return pp

        def cost_pp(emp, which):
            pp = {}
            for (y, m) in periods:
                d = cost_by.get((emp, y, m))
                pp[(y, m)] = (d[which][0], list(d[which][1])) if d else (0.0, [])
            return pp

        def inc_total_pp(emp):
            pp = {}
            for (y, m) in periods:
                t = inc_total.get((emp, y, m))
                pp[(y, m)] = (t[0], list(t[1])) if t else (0.0, [])
            return pp

        def abs_pp(emp, key):
            pp = {}
            for (y, m) in periods:
                d = abs_by.get((emp, y, m))
                pp[(y, m)] = (d[key][0], list(d[key][1])) if d else (0.0, [])
            return pp

        def center_pp(emp, key):
            pp = {}
            for (y, m) in periods:
                if (y, m) == center_period and emp in center_by:
                    v, refs = center_by[emp][key]
                    pp[(y, m)] = (v, list(refs))
                else:
                    pp[(y, m)] = (0.0, [])
            return pp

        COMP_NAMES = ["שכר יסוד", "נסיעות", "גילום זקופות ת.", "הפרשי מילואים", "בונוס"]
        INC_NAMES  = ["שווי ארוחות", "שווי מתנות מגולם", "שווי מתנות לחג"]

        rows = []
        for emp in emps:
            meta = emp_meta.get(emp, {"id": (emp, []), "name": (None, [])})
            id_v, id_r     = meta["id"]
            name_v, name_r = meta["name"]

            items = []   # (label, {period: (value, refs)})

            # 1. Earnings (components) + imputed income → feed the bruto.
            for name in COMP_NAMES:
                items.append((name, named_pp(comp_by, emp, name)))
            for name in INC_NAMES:
                items.append((name, named_pp(inc_by, emp, name)))

            # 2. Bruto = sum of every row above it.
            bruto = {}
            for p in periods:
                tot, refs = 0.0, []
                for _lbl, pp in items:
                    v, r = pp[p]
                    tot += v
                    refs.extend(r)
                bruto[p] = (tot, refs)
            items.append(('סה"כ', bruto))

            # 3. Deduction block (subtracted to get the neto).
            ded_start = len(items)
            items.append(("מס הכנסה", cost_pp(emp, "tax")))
            # Combined NI + health (the costing ב.ל. עובד column already
            # includes health).
            items.append(("ביטוח לאומי עובד + דמי בריאות", cost_pp(emp, "ni")))
            items.append(('סה"כ הכ.זקופות', inc_total_pp(emp)))
            for fund in emp_funds.get(emp, []):
                items.append((fund, named_pp(prov_by, emp, fund)))
            ded_end = len(items)

            # 4. Neto = bruto − every deduction row between bruto and neto.
            neto = {}
            for p in periods:
                bv, br = bruto[p]
                dtot, drefs = 0.0, list(br)
                for k in range(ded_start, ded_end):
                    v, r = items[k][1][p]
                    dtot += v
                    drefs.extend(r)
                neto[p] = (bv - dtot, drefs)
            items.append(("שכר נטו", neto))

            # 5. Quantities (center + absences).
            items.append(("שעות בפועל", center_pp(emp, "actual_hours")))
            items.append(("שעות משולמות", center_pp(emp, "paid_hours")))
            items.append(("ניצול ימי חופשה", abs_pp(emp, "vac")))
            items.append(("ניצול ימי מחלה", abs_pp(emp, "sick")))
            items.append(("ניצול ימי מילואים", abs_pp(emp, "reserve")))
            items.append(("ניצול ימי הבראה", abs_pp(emp, "conv")))
            items.append(("ימים לתלוש", center_pp(emp, "paid_days")))
            items.append(("ימי עבודה בפועל", center_pp(emp, "actual_days")))

            # 6. Emit one output row per line item.
            for label, pp in items:
                row = {
                    emp_id_col:    (id_v, list(id_r)),
                    emp_name_col:  (name_v, list(name_r)),
                    line_item_col: label,
                }
                tot, tot_refs = 0.0, []
                for p, plabel in zip(periods, period_labels):
                    v, r = pp[p]
                    row[plabel] = (cls._clean(v), list(r))
                    tot += v
                    tot_refs.extend(r)
                row[total_col] = (cls._clean(tot), tot_refs)
                rows.append(row)

        out = LineageFrame.from_rows(
            f"{cls.__name__}.body", manager,
            column_names=column_names, rows=rows, translucent=True,
        )

        out[emp_id_col].formula    = f"first({emp_id_col})"
        out[emp_name_col].formula  = f"first({emp_name_col})"
        out[line_item_col].formula = "תווית השורה (קבוע)"
        for plabel in period_labels:
            out[plabel].formula = f"ערך לחודש {plabel}"
        out[total_col].formula = "סכום כל החודשים"

        return out
