from Reports.Report     import Report
from Reports.Center     import Center
from Reports.Components import Components
from Reports.Providents import Providents
from Headers import Headers
from Axiology import Axiology
from Constants import JOIN_KEY
from LineageFrame.frame import LineageFrame
from LineageFrame.operations import to_numeric, where as lf_where


class SocialAnalysis(Report):
    """
    Manufactured social-analysis report.

    Joins componentsAgg + providentsAgg + center (translucent intermediate
    aggregations) into one wide table per (year, month, emp_id) and adds
    three derived percentage / capped columns.

    Every cell in the final LineageFrame carries a tight per-cell lineage:
    references point at the SPECIFIC source cells (raw input cells, after
    freeze flattens through the translucent intermediates) that entered
    its calculation.
    """

    def __init__(self, center_report, components_report, providents_report, manager=None):
        super().__init__()
        self.id = "social_analysis"
        self.display_label = "אנליזה סוציאלית"
        self.is_input = False
        self.dependencies = ["center", "components", "providents"]
        self.status = "error"

        missing = []
        if components_report is None or components_report.lineageFrame is None: missing.append("components")
        if providents_report is None or providents_report.lineageFrame is None: missing.append("providents")
        if center_report     is None or getattr(center_report, "coded_lineageFrame", None) is None: missing.append("center")
        if missing:
            self.missing_dependencies = missing
            self.status = "skipped"
            return

        try:
            comp_h     = Headers.InputFiles.Components
            prov_in_h  = Headers.InputFiles.Providents
            prov_agg_h = Headers.AggregatedFiles.ProvidentsAGG
            social_h   = Headers.SocialAnalysisFile

            # 1. Build translucent aggregations.
            comp_agg = Components.aggregate_components(components_report.lineageFrame)
            prov_agg = Providents.aggregate_providents(providents_report.lineageFrame)
            ctr_agg  = Center.aggregate_center(center_report.coded_lineageFrame)

            # 2. Project the columns we need from each.
            base = comp_agg[[
                JOIN_KEY,
                comp_h.work_month,
                comp_h.work_year,
                comp_h.employee_id,
                comp_h.employee_name,
                comp_h.social_total,
            ]]

            prov_proj = prov_agg[[
                JOIN_KEY,
                prov_agg_h.employee_pension_total,
                prov_agg_h.employer_pension_total,
                prov_agg_h.severance_total,
                prov_agg_h.employer_study_fund_total,
            ]]

            ctr_emp_id_code   = Axiology.code("employee_id")
            ctr_kahal_code    = Axiology.code("is_study_fund_exist")
            ctr_proj = ctr_agg[[
                ctr_emp_id_code,
                ctr_kahal_code,
            ]].drop_duplicates(subset=[ctr_emp_id_code])

            # 3. Merge base + providents on JOIN_KEY (left, fill nulls).
            merged = base.merge(prov_proj, on=JOIN_KEY, how="left").fillna(0)

            # 4. Merge with center on employee_id to bring in is_study_fund_exist.
            merged = merged.merge(
                ctr_proj,
                left_on=comp_h.employee_id,
                right_on=ctr_emp_id_code,
                how="left",
            )

            # 4c. Format work_month as zero-padded "MM/YYYY". The standardize
            #     pass reduced it to a bare month integer; rebuild the display
            #     string from the month + the carried-through work_year (each
            #     cell keeps refs to both source cells).
            def _fmt_month(m):
                try:
                    return f"{int(float(m)):02d}"
                except (TypeError, ValueError):
                    return "" if m is None or str(m).strip() == "" else str(m)

            def _fmt_year(y):
                try:
                    return str(int(float(y)))
                except (TypeError, ValueError):
                    return "" if y is None or str(y).strip() == "" else str(y)

            month_fmt = merged[comp_h.work_month].apply(_fmt_month)
            year_fmt  = merged[comp_h.work_year].apply(_fmt_year)
            merged[comp_h.work_month] = month_fmt + "/" + year_fmt

            # 5. Derived columns. Each output cell's refs come naturally
            #    from the Column operations that produced it.
            social_base = to_numeric(merged[comp_h.social_total],    errors="coerce").fillna(0)
            ee_pension  = to_numeric(merged[prov_agg_h.employee_pension_total], errors="coerce").fillna(0)
            er_pension  = to_numeric(merged[prov_agg_h.employer_pension_total], errors="coerce").fillna(0)

            ee_pct_num = (ee_pension / social_base) * 100
            er_pct_num = (er_pension / social_base) * 100
            ee_pct_str = ee_pct_num.apply(lambda v: f"{v:.2f}%" if isinstance(v, (int, float)) else "0.00%")
            er_pct_str = er_pct_num.apply(lambda v: f"{v:.2f}%" if isinstance(v, (int, float)) else "0.00%")

            merged[social_h.ee_prov_pct] = ee_pct_str
            merged[social_h.er_prov_pct] = er_pct_str

            # capped_val: when is_study_fund_exist == "כן", min(social_base, 15712); else 0.
            social_clipped = social_base.clip(upper=15712)
            kahal_match    = merged[ctr_kahal_code] == "כן"
            capped         = lf_where(kahal_match, social_clipped, 0)
            merged[social_h.capped_val] = capped

            # 6. Project final column order.
            final = merged[[
                JOIN_KEY,
                comp_h.employee_name,
                comp_h.employee_id,
                comp_h.work_month,
                comp_h.social_total,
                prov_agg_h.employee_pension_total,
                prov_agg_h.employer_pension_total,
                prov_agg_h.severance_total,
                prov_agg_h.employer_study_fund_total,
                social_h.ee_prov_pct,
                social_h.er_prov_pct,
                social_h.capped_val,
            ]]
            final.report_id    = self.id
            final.translucent  = False  # this is the user-visible manufactured frame

            # 7. Formula strings (display-only).
            final[JOIN_KEY].formula                                  = JOIN_KEY
            final[comp_h.employee_name].formula                      = f"first({comp_h.employee_name})"
            final[comp_h.employee_id].formula                        = f"first({comp_h.employee_id})"
            final[comp_h.work_month].formula                         = f"{comp_h.work_month} בפורמט MM/YYYY"
            final[comp_h.social_total].formula                       = f"sum({comp_h.total_amount}) where {comp_h.component_name} ב-רשימת רכיבים סוציאליים"
            final[prov_agg_h.employee_pension_total].formula         = f"sum({prov_in_h.employee_pension})"
            final[prov_agg_h.employer_pension_total].formula         = f"sum({prov_in_h.employer_pension})"
            final[prov_agg_h.severance_total].formula                = f"sum({prov_in_h.severance_pay})"
            final[prov_agg_h.employer_study_fund_total].formula      = f"sum({prov_in_h.employer_pension}) where {prov_in_h.fund_type} = \"קה\"ל\""
            final[social_h.ee_prov_pct].formula                      = f"sum({prov_in_h.employee_pension}) / sum({comp_h.total_amount}) * 100"
            final[social_h.er_prov_pct].formula                      = f"sum({prov_in_h.employer_pension}) / sum({comp_h.total_amount}) * 100"
            final[social_h.capped_val].formula                       = f"min(sum({comp_h.total_amount}), 15712) כאשר קה\"ל קיימת"

            self.lineageFrame   = final
            self.rows_count     = final.row_count()
            self.columns_count  = len(final.columns)
            self.status         = "loaded"

        except Exception as e:
            import traceback
            self.exceptions.append(f"{type(e).__name__}: {e}")
            traceback.print_exc()
