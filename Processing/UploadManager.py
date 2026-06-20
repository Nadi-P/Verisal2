"""
UploadManager — single owner of all state derived from one folder upload.

Atomic lifecycle: each new upload produces a fresh UploadManager via the
`from_files(...)` factory. The old one is garbage-collected when the api
swaps it out.

The manager OWNS:
  - a LineageManager (the per-session report-frame registry)
  - a dict of Report instances keyed by their stable id
  - global metadata (company_name, min/max month+year)

Phase 1b: ALL 10 user-facing reports are wired through —
  raw inputs  → center, components, providents, income, deductions,
                costing, absences
  derived     → social_analysis, months_comparison, reports_against_center

The legacy `Files` singleton is populated alongside for backward compat
during the transition; phase 2 will lift the Files dependency entirely.

Build pipeline (in `from_files`):
  1. Classify uploaded files by keyword.
  2. Parse each into a pandas DataFrame.
  3. Stash parsed DFs in Files.* (legacy backward compat).
  4. Wrap each as a Report subclass instance (raw inputs first).
  5. Compute global metadata (company_name, current_year/month, min/max).
  6. Build derived Reports (each declares its dependencies; if any are
     missing or in error, the derived report is marked 'skipped').
  7. Call `manager.freeze()` — exercises the freeze API (no-op when no
     translucent frames are in play, which is the case for Phase 1b).
"""
import os
import traceback
from typing import List

from Files import Files
from Constants import KEYWORDS, DISPLAY_NAMES
from Loading import GetFileFromObject, _load_center_sheets
from LineageFrame.manager import LineageManager

from Reports.Center               import Center
from Reports.Components           import Components
from Reports.Providents           import Providents
from Reports.Income               import Income
from Reports.Deductions           import Deductions
from Reports.Costing              import Costing
from Reports.Absences             import Absences
from Reports.SocialAnalysis       import SocialAnalysis
from Reports.MonthsComparison     import MonthsComparison
from Reports.ReportsAgainstCenter import ReportsAgainstCenter
from Reports.LoadingTable         import LoadingTable


# ----------------------------------------------------------------------
#  Local helper used by the test harness in Processing/main.py
# ----------------------------------------------------------------------
class _LocalFileShim:
    """Wraps a local file path so it quacks like a FastAPI UploadFile."""
    def __init__(self, path: str):
        self._path = path
        self.filename = os.path.basename(path)
        self._handle = None

    @property
    def file(self):
        if self._handle is None:
            self._handle = open(self._path, "rb")
        return self._handle

    def close(self):
        if self._handle is not None:
            self._handle.close()
            self._handle = None


class UploadManager:
    def __init__(self):
        self.manager  = LineageManager()
        self.reports: dict = {}
        self.metadata: dict = {
            "company_name": None,
            "min_month":    None,
            "min_year":     None,
            "max_month":    None,
            "max_year":     None,
        }
        self.unrecognized: List[str] = []
        self.duplicates:   List[str] = []

    # ==================================================================
    #  Factory
    # ==================================================================
    @classmethod
    def from_files(cls, file_list) -> "UploadManager":
        um = cls()

        # Pick up any axiology.json edits made since the last upload so the
        # component-code catalog (masks, center codes, loading table) is fresh.
        from Axiology import Axiology
        Axiology.reload()

        # ---- 1. Classify uploaded files by keyword --------------------
        file_map: dict = {}
        for f in file_list:
            name = getattr(f, "filename", None) or ""
            if not name.lower().endswith((".xlsx", ".xls")):
                continue
            matched = None
            for key, keyword in KEYWORDS.items():
                if keyword.lower() in name.lower():
                    matched = key
                    break
            if matched is None:
                um.unrecognized.append(name)
            elif matched in file_map:
                um.duplicates.append(name)
            else:
                file_map[matched] = f

        # ---- 2. Parse raw inputs into pandas DataFrames ----------------
        parsed: dict = {}
        for key, file_obj in file_map.items():
            try:
                if key == "center":
                    center_df, center_coded, code_map = _load_center_sheets(file_obj)
                    parsed["center"]        = center_df
                    parsed["center_coded"]  = center_coded
                    parsed["center_code_map"] = code_map
                else:
                    parsed[key] = GetFileFromObject(file_obj, key)
            except Exception as e:
                um._record_parse_error(key, e)

        # ---- 3. Legacy: populate Files singleton for backward compat ---
        Files.centerDF        = parsed.get("center")
        Files.center_df_coded = parsed.get("center_coded")
        Files.componentsDF    = parsed.get("components")
        Files.providentsDF    = parsed.get("providents")
        Files.incomeDF        = parsed.get("income")
        Files.deductionsDF    = parsed.get("deductions")
        Files.costingDF       = parsed.get("costing")
        Files.absencesDF      = parsed.get("absences")

        # ---- 4. Wrap raw inputs as Report instances -------------------
        if "center"     in parsed: um.reports["center"]     = Center    (parsed["center"],     manager=um.manager, code_map=parsed.get("center_code_map"))
        if "components" in parsed: um.reports["components"] = Components(parsed["components"], manager=um.manager)
        if "providents" in parsed: um.reports["providents"] = Providents(parsed["providents"], manager=um.manager)
        if "income"     in parsed: um.reports["income"]     = Income    (parsed["income"],     manager=um.manager)
        if "deductions" in parsed: um.reports["deductions"] = Deductions(parsed["deductions"], manager=um.manager)
        if "costing"    in parsed: um.reports["costing"]    = Costing   (parsed["costing"],    manager=um.manager)
        if "absences"   in parsed: um.reports["absences"]   = Absences  (parsed["absences"],   manager=um.manager)

        # ---- 4b. Per-input metadata (own company name + date range) ----
        # Each input report carries its OWN company name + min/max period,
        # extracted from its own DataFrame. The center is special: it has no
        # standard period columns — its single month/year comes from the
        # filename's trailing "MM.YYYY" token.
        for key in ("components", "providents", "income",
                    "deductions", "costing", "absences"):
            r = um.reports.get(key)
            if r is None or parsed.get(key) is None:
                continue
            company, mn_m, mn_y, mx_m, mx_y = cls._df_company_and_range(parsed[key])
            r.company_name = company
            r.min_month, r.min_year = mn_m, mn_y
            r.max_month, r.max_year = mx_m, mx_y

        center_rep = um.reports.get("center")
        center_month = center_year = None
        if center_rep is not None and "center" in file_map:
            center_month, center_year = cls._parse_center_date(
                getattr(file_map["center"], "filename", "") or "")
            if center_month is not None:
                center_rep.min_month = center_rep.max_month = center_month
                center_rep.min_year  = center_rep.max_year  = center_year

        # ---- 5. Global metadata + current_year/month -------------------
        um._extract_global_metadata()

        # The center represents a single payroll period taken from its
        # filename — prefer it as the current period (falls back to the
        # components-derived value set in _extract_global_metadata).
        if center_month is not None:
            Files.current_month = center_month
            Files.current_year  = center_year

        # ---- 6. Derived reports — each declares its deps --------------
        um.reports["social_analysis"]        = SocialAnalysis(
            um.reports.get("center"),
            um.reports.get("components"),
            um.reports.get("providents"),
            manager=um.manager,
        )
        um.reports["months_comparison"]      = MonthsComparison(
            um.reports, manager=um.manager,
        )
        um.reports["reports_against_center"] = ReportsAgainstCenter(
            um.reports, manager=um.manager,
        )
        um.reports["loading_table"]          = LoadingTable(
            um.reports.get("center"), manager=um.manager,
        )

        # ---- 7. Freeze ------------------------------------------------
        try:
            um.manager.freeze()
        except Exception:
            # Freeze should never raise on opaque-only graphs; if it does
            # (bug), we capture but still return the partial UploadManager
            # so the frontend can render what loaded.
            traceback.print_exc()

        # ---- 8. Cards: placeholders, ranges, truth-values, consistency -
        try:
            um._finalize_cards()
        except Exception:
            traceback.print_exc()

        return um

    # ==================================================================
    #  Internals
    # ==================================================================
    def _record_parse_error(self, key: str, exc: Exception) -> None:
        existing = self.reports.get(key)
        if existing is None:
            self.reports[key] = _ErrorReport(key, DISPLAY_NAMES.get(key, key), exc)
        else:
            existing.exceptions.append(f"{type(exc).__name__}: {exc}")
            existing.status = "error"

    def _extract_global_metadata(self) -> None:
        """
        Populate `self.metadata` + the legacy `Files` globals from the
        components report (company name + min/max period). Per-report ranges
        are set separately (step 4b) — this only owns the global fallback
        values (Files.current_year/month) consumed by Center.aggregate_center
        and ReportsAgainstCenter until the center-filename override applies.
        """
        comp = self.reports.get("components")
        if comp is None or comp.df is None:
            return
        try:
            company, min_m, min_y, max_m, max_y = self._df_company_and_range(comp.df)

            self.metadata["company_name"] = company
            self.metadata["min_month"] = min_m
            self.metadata["min_year"]  = min_y
            self.metadata["max_month"] = max_m
            self.metadata["max_year"]  = max_y

            # Legacy globals consumed by Center.aggregate_center + derived.
            Files.company_name  = company
            Files.min_month     = min_m
            Files.min_year      = min_y
            Files.max_month     = max_m
            Files.max_year      = max_y
            Files.current_month = max_m
            Files.current_year  = max_y
        except Exception:
            pass

    # ------------------------------------------------------------------
    #  Metadata helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _parse_period(month_raw, year_raw=None):
        """
        Resolve a single (year, month) pair from a work_month cell, falling
        back to a work_year cell only when the month cell has no embedded
        year. Handles every shape we've seen in the wild:

          - "YYYY/MM"  → ("2020/03")   the canonical שקלולית form
          - "MM/YYYY"  → ("03/2020")
          - a datetime / pandas Timestamp (Excel real date)
          - a plain month number ("3" / 3 / 3.0) + the work_year column

        Returns (year, month) with 1 <= month <= 12, or None if it can't be
        determined. The year is taken from the month cell itself whenever it
        carries one, so a blank work_year column never drops a valid row.
        """
        import re
        import pandas as pd

        if month_raw is None:
            return None
        # NaN floats / pandas NA.
        try:
            if pd.isna(month_raw):
                return None
        except (TypeError, ValueError):
            pass

        # Real datetime / Timestamp.
        if hasattr(month_raw, "year") and hasattr(month_raw, "month"):
            try:
                return int(month_raw.year), int(month_raw.month)
            except (TypeError, ValueError):
                return None

        s = str(month_raw).strip()
        if not s:
            return None

        # YYYY/MM  (also accepts - or . separators)
        m = re.match(r'^(\d{4})[/\-.](\d{1,2})$', s)
        if m:
            yy, mm = int(m.group(1)), int(m.group(2))
            return (yy, mm) if 1 <= mm <= 12 else None

        # MM/YYYY
        m = re.match(r'^(\d{1,2})[/\-.](\d{4})$', s)
        if m:
            mm, yy = int(m.group(1)), int(m.group(2))
            return (yy, mm) if 1 <= mm <= 12 else None

        # Plain month number — needs the year column.
        try:
            mm = int(float(s))
        except (TypeError, ValueError):
            return None
        if not (1 <= mm <= 12):
            return None
        try:
            if year_raw is None or pd.isna(year_raw) or str(year_raw).strip() == "":
                return None
            yy = int(float(year_raw))
        except (TypeError, ValueError):
            return None
        return yy, mm

    @staticmethod
    def _df_company_and_range(df):
        """
        Extract (company_name, min_month, min_year, max_month, max_year)
        from a system-report DataFrame using the standard Hebrew columns.
        Any field that can't be determined comes back None.

        The chronological range is derived per-row via `_parse_period`, which
        reads the year embedded in the work_month cell ("YYYY/MM") and only
        falls back to the work_year column for bare month numbers — so a
        blank/mismatched year column can no longer drop or mis-order a row.
        """
        from Headers import Helpers

        company = None
        min_y = min_m = max_y = max_m = None
        if df is None:
            return company, min_m, min_y, max_m, max_y

        company_col = Helpers.SystemReportsBase.company_name
        month_col   = Helpers.SystemReportsBase.work_month
        year_col    = Helpers.SystemReportsBase.work_year

        if company_col in df.columns:
            series = df[company_col].dropna()
            if not series.empty:
                company = str(series.iloc[0]).strip()

        if month_col in df.columns:
            months = df[month_col].tolist()
            years  = (df[year_col].tolist()
                      if year_col in df.columns else [None] * len(months))
            periods = []
            for mraw, yraw in zip(months, years):
                p = UploadManager._parse_period(mraw, yraw)
                if p is not None:
                    periods.append(p)
            if periods:
                periods.sort(key=lambda t: t[0] * 100 + t[1])
                min_y, min_m = periods[0]
                max_y, max_m = periods[-1]

        return company, min_m, min_y, max_m, max_y

    @staticmethod
    def _parse_center_date(filename: str):
        """
        Parse the trailing 'MM.YYYY' date token from a center filename.
        Month may be 1-2 digits; year 2 digits ('25'→2025) or 4 digits.
        The token must be preceded by whitespace and sit at the end of the
        name (before the extension). Returns (month, year) or (None, None).
        """
        import os, re
        if not filename:
            return None, None
        stem = os.path.splitext(str(filename))[0]
        m = re.search(r'\s(\d{1,2})\.(\d{2}|\d{4})\s*$', stem)
        if not m:
            return None, None
        month = int(m.group(1))
        yr = m.group(2)
        year = int(yr) if len(yr) == 4 else 2000 + int(yr)
        if not (1 <= month <= 12):
            return None, None
        return month, year

    @staticmethod
    def _majority(values):
        """Strict plurality of a list; None on empty or no strict winner."""
        from collections import Counter
        clean = [v for v in values if v is not None]
        if not clean:
            return None
        counts = Counter(clean).most_common()
        if len(counts) == 1:
            return counts[0][0]
        if counts[0][1] > counts[1][1]:
            return counts[0][0]
        return None

    # ------------------------------------------------------------------
    #  Card finalization — placeholders, ranges, truth-values, consistency
    # ------------------------------------------------------------------
    INPUT_IDS = ["center", "components", "providents",
                 "income", "deductions", "costing", "absences"]

    def _disp(self, rid: str) -> str:
        r = self.reports.get(rid)
        if r is not None and getattr(r, "display_label", None):
            return r.display_label
        return DISPLAY_NAMES.get(rid, rid)

    @staticmethod
    def _range_tuple(r):
        if None in (r.min_month, r.min_year, r.max_month, r.max_year):
            return None
        return (r.min_month, r.min_year, r.max_month, r.max_year)

    @staticmethod
    def _fmt_range(t) -> str:
        mn_m, mn_y, mx_m, mx_y = t
        return f"{mn_m}/{mn_y}–{mx_m}/{mx_y}"

    def _finalize_cards(self) -> None:
        # 1. Placeholders for input files that were never uploaded.
        for key in self.INPUT_IDS:
            if key not in self.reports:
                self.reports[key] = _StubReport(
                    key, DISPLAY_NAMES.get(key, key),
                    is_input=True, status="missing",
                )

        loaded = lambda r: r is not None and r.status == "loaded"

        # 2. Manufactured report ranges = union of present dependencies'.
        for r in self.reports.values():
            if r.is_input or not loaded(r):
                continue
            dep_ranges = [self._range_tuple(self.reports[d])
                          for d in r.dependencies
                          if loaded(self.reports.get(d))
                          and self._range_tuple(self.reports.get(d)) is not None]
            if dep_ranges:
                lo = min(dep_ranges, key=lambda t: t[1] * 100 + t[0])
                hi = max(dep_ranges, key=lambda t: t[3] * 100 + t[2])
                r.min_month, r.min_year = lo[0], lo[1]
                r.max_month, r.max_year = hi[2], hi[3]

        # 3. Truth values across present INPUT reports, excluding center.
        truth_pool = [self.reports[k] for k in self.INPUT_IDS
                      if k != "center" and loaded(self.reports.get(k))]
        truth_company = self._majority([r.company_name for r in truth_pool])
        truth_range   = self._majority([self._range_tuple(r) for r in truth_pool])

        # 4a. Disabled flags. Inputs: disabled unless loaded. Manufactured:
        #     disabled if any dependency is missing / not loaded.
        for r in self.reports.values():
            r.dependencies_display = [self._disp(d) for d in (r.dependencies or [])]
            if r.is_input:
                r.disabled = not loaded(r)
            else:
                missing = [d for d in (r.dependencies or [])
                           if not loaded(self.reports.get(d))]
                r.missing_dependencies = missing
                r.missing_dependencies_display = [self._disp(d) for d in missing]
                r.disabled = len(missing) > 0

        # 4b. Consistency for inputs (incl. center), then manufactured.
        for k in self.INPUT_IDS:
            r = self.reports.get(k)
            if not loaded(r):
                r.card_status = "missing"
                continue
            reasons = []
            if k == "center":
                # Company name is never checked for the center. Its single
                # period (from the filename) must sit inside the truth range.
                if r.min_month is None:
                    reasons.append('לא ניתן לקרוא תאריך משם הקובץ')
                elif truth_range is not None:
                    cy = r.min_year * 100 + r.min_month
                    lo = truth_range[1] * 100 + truth_range[0]
                    hi = truth_range[3] * 100 + truth_range[2]
                    if not (lo <= cy <= hi):
                        reasons.append(
                            f'תקופת המרכז {r.min_month}/{r.min_year} '
                            f'מחוץ לטווח {self._fmt_range(truth_range)}')
            else:
                if truth_company is not None and r.company_name != truth_company:
                    reasons.append(
                        f'שם חברה "{r.company_name}" שונה מהמוסכם "{truth_company}"')
                rng = self._range_tuple(r)
                if truth_range is not None and rng != truth_range:
                    shown = self._fmt_range(rng) if rng else "—"
                    reasons.append(
                        f'טווח תאריכים {shown} שונה מהמוסכם {self._fmt_range(truth_range)}')
            r.inconsistency_reasons = reasons
            r.card_status = "inconsistent" if reasons else "ok"

        for r in self.reports.values():
            if r.is_input:
                continue
            if r.disabled:
                r.card_status = "missing_dependency"
                continue
            bad = [self._disp(d) for d in (r.dependencies or [])
                   if self.reports.get(d) is not None
                   and self.reports[d].card_status == "inconsistent"]
            if bad:
                r.inconsistency_reasons = [f'תלויות לא עקביות: {", ".join(bad)}']
                r.card_status = "inconsistent"
            else:
                r.card_status = "ok"

    # ==================================================================
    #  Accessors
    # ==================================================================
    def get(self, report_id: str):
        return self.reports.get(report_id)

    def list_reports(self) -> list:
        return list(self.reports.values())

    def to_wire(self) -> dict:
        from UploadManager_serialize import serialize_upload_manager
        return serialize_upload_manager(self)


# ----------------------------------------------------------------------
#  Placeholder Report used when a parse error fires for a key we
#  haven't fully wired up yet.
# ----------------------------------------------------------------------
class _StubReport:
    """
    Lightweight stand-in for a report that has no LineageFrame — either an
    input file that failed to parse (status 'error') or one that was never
    uploaded (status 'missing'). Carries the same wire shape as Report so
    the frontend renders a card for it.
    """
    def __init__(self, key: str, display_label: str, *, is_input: bool,
                 status: str, dependencies=None, exceptions=None):
        self.id            = key
        self.display_label = display_label
        self.is_input      = is_input
        self.dependencies  = list(dependencies or [])
        self.company_name  = None
        self.min_month     = None
        self.min_year      = None
        self.max_month     = None
        self.max_year      = None
        self.rows_count    = 0
        self.columns_count = 0
        self.exceptions    = list(exceptions or [])
        self.status        = status
        self.missing_dependencies = []
        self.skipped_steps        = []
        self.lineageFrame  = None
        self.df            = None

        self.disabled = True
        self.card_status = "missing"
        self.inconsistency_reasons = []
        self.dependencies_display = []
        self.missing_dependencies_display = []

    def to_dict(self) -> dict:
        return {
            "id":                   self.id,
            "display_label":        self.display_label,
            "is_input":             self.is_input,
            "dependencies":         list(self.dependencies),
            "company_name":         self.company_name,
            "min_month":            self.min_month,
            "min_year":             self.min_year,
            "max_month":            self.max_month,
            "max_year":             self.max_year,
            "rows_count":           self.rows_count,
            "columns_count":        self.columns_count,
            "exceptions":           list(self.exceptions),
            "status":               self.status,
            "missing_dependencies": list(self.missing_dependencies),
            "skipped_steps":        list(self.skipped_steps),
            "disabled":                     bool(self.disabled),
            "card_status":                  self.card_status,
            "inconsistency_reasons":        list(self.inconsistency_reasons),
            "dependencies_display":         list(self.dependencies_display),
            "missing_dependencies_display": list(self.missing_dependencies_display),
        }


def _ErrorReport(key: str, display_label: str, exc: Exception) -> _StubReport:
    """Back-compat factory: a parse-error stub."""
    return _StubReport(
        key, display_label, is_input=True, status="error",
        exceptions=[f"{type(exc).__name__}: {exc}"],
    )
