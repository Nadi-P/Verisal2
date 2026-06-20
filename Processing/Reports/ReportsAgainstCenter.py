from Reports.Report     import Report
from Reports.Center     import Center
from Reports.Costing    import Costing
from Reports.Absences   import Absences
from Reports.Income     import Income
from Reports.Providents import Providents
from Files import Files
from Headers import Headers
from Axiology import Axiology
from Constants import JOIN_KEY
from LineageFrame.frame import LineageFrame


class ReportsAgainstCenter(Report):
    """
    Cross-check: per (employee × check), compare center's value vs the
    matching aggregated reports' value. Each output cell points at the
    exact raw input cells whose values entered the computation.
    """

    def __init__(self, deps_report_map, manager=None):
        super().__init__()
        self.id = "reports_against_center"
        self.display_label = "דוחות מול מרכז שכר"
        self.is_input = False
        self.dependencies = ["center", "costing", "income", "absences", "providents"]
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

            self.lineageFrame  = final
            self.rows_count    = final.row_count()
            self.columns_count = len(final.columns)
            self.status        = "loaded"

        except Exception as e:
            import traceback
            self.exceptions.append(f"{type(e).__name__}: {e}")
            traceback.print_exc()

    # ------------------------------------------------------------------
    @classmethod
    def _build(cls, deps_report_map):
        cost_h = Headers.InputFiles.Costing
        inc_h  = Headers.AggregatedFiles.IncomeAGG
        abs_h  = Headers.AggregatedFiles.AbsencesAGG
        prov_h = Headers.AggregatedFiles.ProvidentsAGG
        fac_h  = Headers.ReportsAgainstCenter

        # Center CONCAT/system codes (resolved from axiology.json).
        c_employee_id          = Axiology.code("employee_id")
        c_employee_name        = Axiology.code("employee_name")
        c_work_year            = Axiology.code("work_year")
        c_work_month           = Axiology.code("work_month")
        c_total_salary         = Axiology.code("total_salary")
        c_is_study_fund_exist  = Axiology.code("is_study_fund_exist")
        c_shovi_meals_value    = Axiology.code("shovi_meals_value")
        c_shovi_gifts          = Axiology.code("shovi_gifts")
        c_expense_reimb        = Axiology.code("expense_reimbursement")
        c_expense_reimb_charge = Axiology.code("expense_reimbursement_charge")
        c_abroad_expense_reimb = Axiology.code("abroad_expense_reimbursement")
        c_vacation_usage       = Axiology.code("vacation_usage")
        c_sick_usage           = Axiology.code("sick_usage")

        # 1. Build translucent aggregations.
        ctr_agg  = Center.aggregate_center(deps_report_map["center"].coded_lineageFrame)
        cost_agg = Costing.aggregate_costing(deps_report_map["costing"].lineageFrame)
        inc_agg  = Income.aggregate_income(deps_report_map["income"].lineageFrame)
        abs_agg  = Absences.aggregate_absences(deps_report_map["absences"].lineageFrame)
        prov_agg = Providents.aggregate_providents(deps_report_map["providents"].lineageFrame)

        # 2. Filter center to the current period only.
        ctr = ctr_agg[(ctr_agg[c_work_year]  == Files.current_year) &
                      (ctr_agg[c_work_month] == Files.current_month)]
        if ctr.row_count() == 0:
            return LineageFrame.from_rows(
                f"{cls.__name__}.empty", deps_report_map["center"].lineageFrame.manager,
                column_names=[fac_h.employee_id, fac_h.employee_name, fac_h.month,
                              fac_h.check, fac_h.center_input,
                              fac_h.external_reports_output],
                rows=[], translucent=True,
            )

        # 3. Wide audit frame: center + each aggregator merged on JOIN_KEY.
        audit = ctr.merge(
            cost_agg[[JOIN_KEY, cost_h.gross_salary, cost_h.voluntary_deductions]]
                if cost_h.gross_salary in cost_agg else cost_agg[[JOIN_KEY]],
            on=JOIN_KEY, how="left",
        )
        if inc_h.total in inc_agg or "meals_gifts_total" in inc_agg:
            inc_cols = [JOIN_KEY]
            if inc_h.total in inc_agg: inc_cols.append(inc_h.total)
            if "meals_gifts_total" in inc_agg: inc_cols.append("meals_gifts_total")
            audit = audit.merge(inc_agg[inc_cols], on=JOIN_KEY, how="left")
        if abs_h.vacation_monthly_usage in abs_agg or abs_h.sick_monthly_usage in abs_agg:
            abs_cols = [JOIN_KEY]
            if abs_h.vacation_monthly_usage in abs_agg: abs_cols.append(abs_h.vacation_monthly_usage)
            if abs_h.sick_monthly_usage     in abs_agg: abs_cols.append(abs_h.sick_monthly_usage)
            audit = audit.merge(abs_agg[abs_cols], on=JOIN_KEY, how="left")
        prov_cols = [JOIN_KEY]
        if prov_h.employee_study_fund_total in prov_agg: prov_cols.append(prov_h.employee_study_fund_total)
        if prov_h.employer_study_fund_total in prov_agg: prov_cols.append(prov_h.employer_study_fund_total)
        if prov_h.total_study_fund_base     in prov_agg: prov_cols.append(prov_h.total_study_fund_base)
        if len(prov_cols) > 1:
            audit = audit.merge(prov_agg[prov_cols], on=JOIN_KEY, how="left")

        # 4. Per (employee × check), build output rows with explicit refs.
        # For each check, the source cells are exactly:
        #   - center_input  : ONE cell on the center side
        #   - external_reports_output : ZERO/ONE cell on the agg side
        #   - offset, offset_pct      : both of the above
        def _cell(name, i):
            return audit[name].cells[i] if name in audit else None

        def _v(cell):
            if cell is None: return 0
            v = cell.value
            if v is None or (isinstance(v, float) and v != v): return 0
            return v

        def _r(cell):
            return cell.contrib_refs() if cell is not None else []

        rows = []
        for i in range(audit.row_count()):
            emp_id_cell   = _cell(c_employee_id, i)
            emp_name_cell = _cell(c_employee_name, i)

            # Numeric checks: list of (check, category, center_side_col, agg_side_cols_summed)
            numeric_checks = [
                ("שכר ברוטו",           "תשלומים",     [c_total_salary],
                                                        [cost_h.gross_salary]),
                ("שווי (ארוחות/מתנות)", "זקיפות",      [c_shovi_meals_value, c_shovi_gifts],
                                                        ["meals_gifts_total"]),
                ("ניכויי רשות",         "ניכויים",     [c_expense_reimb,
                                                        c_expense_reimb_charge,
                                                        c_abroad_expense_reimb],
                                                        [cost_h.voluntary_deductions]),
                ("ניצול חופשה",         "היעדרויות",   [c_vacation_usage],
                                                        [abs_h.vacation_monthly_usage]),
                ("ניצול מחלה",          "היעדרויות",   [c_sick_usage],
                                                        [abs_h.sick_monthly_usage]),
            ]
            for name, _category, ctr_cols, agg_cols in numeric_checks:
                # Sum center-side contributions for this row.
                ctr_cells = [_cell(c, i) for c in ctr_cols if c in audit]
                ctr_val   = sum(_v(c) for c in ctr_cells)
                ctr_refs  = [r for c in ctr_cells if c is not None for r in _r(c)]

                agg_cells = [_cell(c, i) for c in agg_cols if c in audit]
                agg_val   = sum(_v(c) for c in agg_cells)
                agg_refs  = [r for c in agg_cells if c is not None for r in _r(c)]

                rows.append({
                    fac_h.employee_id:             (emp_id_cell.value if emp_id_cell else None,
                                                    _r(emp_id_cell)),
                    fac_h.employee_name:           (emp_name_cell.value if emp_name_cell else None,
                                                    _r(emp_name_cell)),
                    fac_h.month:                   Files.current_month,
                    fac_h.check:                   name,
                    fac_h.center_input:            (ctr_val, ctr_refs),
                    fac_h.external_reports_output: (agg_val, agg_refs),
                })

            # Kahal eligibility row — center side is a string flag, agg
            # side is the study-fund base.
            kahal_eligible_cell = _cell(c_is_study_fund_exist, i)
            kahal_raw = str(kahal_eligible_cell.value).strip() if kahal_eligible_cell else ""
            kahal_eligible = "כן" if "כן" in kahal_raw else "ללא קה\"ל"
            kahal_sum_cell = _cell(prov_h.total_study_fund_base, i)
            kahal_sum = _v(kahal_sum_cell)
            rows.append({
                fac_h.employee_id:             (emp_id_cell.value if emp_id_cell else None,
                                                _r(emp_id_cell)),
                fac_h.employee_name:           (emp_name_cell.value if emp_name_cell else None,
                                                _r(emp_name_cell)),
                fac_h.month:                   Files.current_month,
                fac_h.check:                   'קה"ל (בסיס להפקדה)',
                fac_h.center_input:            (kahal_eligible, _r(kahal_eligible_cell)),
                fac_h.external_reports_output: (kahal_sum,      _r(kahal_sum_cell)),
            })

        out = LineageFrame.from_rows(
            f"{cls.__name__}.body",
            deps_report_map["center"].lineageFrame.manager,
            column_names=[fac_h.employee_id, fac_h.employee_name, fac_h.month,
                          fac_h.check, fac_h.center_input,
                          fac_h.external_reports_output],
            rows=rows, translucent=True,
        )

        out[fac_h.employee_id].formula             = f"first({c_employee_id})"
        out[fac_h.employee_name].formula           = f"first({c_employee_name})"
        out[fac_h.month].formula                   = "חודש נוכחי (קבוע)"
        out[fac_h.check].formula                   = "שם הבדיקה (קבוע)"
        out[fac_h.center_input].formula            = "ערך צד מרכז שכר"
        out[fac_h.external_reports_output].formula = "ערך צד דוחות מצרפיים"

        return out
