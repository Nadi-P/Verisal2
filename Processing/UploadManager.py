"""
UploadManager — single owner of all state that comes from one folder upload.

Atomic lifecycle: each new upload produces a fresh UploadManager via the
`from_files(...)` factory. The old one is garbage-collected when the api
swaps it out. This replaces the legacy `Files` singleton + the ad-hoc
state scattered across api.py's `_load_from_files`.

The manager OWNS:
  - a LineageManager (the per-session report-frame registry)
  - a dict of Report instances keyed by their stable id
  - global metadata extracted from the inputs (company_name, min/max month+year)

Build order (in `from_files`):
  1. Classify uploaded files by keyword.
  2. Parse each into a pandas DataFrame (delegates to Loading.GetFileFromObject /
     Loading._load_center_sheets).
  3. Wrap each parsed DF as a Report subclass instance, passing the manager.
     Each Report subclass constructs its own LineageFrame internally.
  4. Build manufactured (aggregation / derived) reports in dependency order;
     a report whose dependencies aren't satisfied is marked status='skipped'
     with `missing_dependencies` populated.
  5. Extract global metadata (best-effort — failures don't abort the upload).
  6. Call `manager.freeze()` to perform the translucent flattening pass.

PHASE 1a scope: only `components` and `componentsAgg` are wired through.
The other 6 raw inputs + 6 aggregations + 3 derived reports come in Phase 1b.
"""
import os
from typing import List, Optional

from fastapi import UploadFile

from Constants import KEYWORDS, DISPLAY_NAMES
from Loading import GetFileFromObject, _load_center_sheets
from LineageFrame.manager import LineageManager

from Reports.Components    import Components
from Reports.ComponentsAgg import ComponentsAgg


class _LocalFileShim:
    """
    Wraps a local file path so it quacks like a FastAPI UploadFile —
    GetFileFromObject only needs .filename and .file (with .seek/.read).
    Used by the test harness in `Processing/main.py`.
    """
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
        self.reports: dict = {}          # report_id -> Report instance
        self.metadata: dict = {           # global aggregated metadata
            "company_name": None,
            "min_month":    None,
            "min_year":     None,
            "max_month":    None,
            "max_year":     None,
        }
        # Bookkeeping for the upload result the frontend renders today.
        self.unrecognized: List[str] = []
        self.duplicates:   List[str] = []

    # ------------------------------------------------------------------
    #  Factory: build everything from a list of UploadFile-likes
    # ------------------------------------------------------------------
    @classmethod
    def from_files(cls, file_list) -> "UploadManager":
        """
        Run the full build pipeline. Returns a populated UploadManager
        even if some inputs fail — failures land on the relevant Report's
        `exceptions` list and `status` field rather than aborting.
        """
        um = cls()

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
        # Phase 1a wires only `components`. Other keys are parsed but
        # not wrapped into Reports yet (Phase 1b adds the rest).
        parsed_dfs: dict = {}
        for key, file_obj in file_map.items():
            try:
                if key == "center":
                    center_df, center_coded = _load_center_sheets(file_obj)
                    parsed_dfs["center"]        = center_df
                    parsed_dfs["center_coded"]  = center_coded
                else:
                    parsed_dfs[key] = GetFileFromObject(file_obj, key)
            except Exception as e:
                # Stash the error on the upload-result level for now; the
                # corresponding Report (when its subclass exists) will pick
                # up the failure via its own exception path.
                um._record_parse_error(key, e)

        # ---- 3. Wrap raw inputs as Report instances -------------------
        if "components" in parsed_dfs:
            um.reports["components"] = Components(
                parsed_dfs["components"], manager=um.manager,
            )

        # ---- 4. Build manufactured (aggregation / derived) reports ----
        comp = um.reports.get("components")
        if comp is not None and getattr(comp, "lineageFrame", None) is not None:
            um.reports["componentsAgg"] = ComponentsAgg(comp, um.manager)
        else:
            agg = ComponentsAgg(None, um.manager)
            agg.missing_dependencies = ["components"]
            um.reports["componentsAgg"] = agg

        # ---- 5. Extract global metadata (best-effort) -----------------
        um._extract_global_metadata()

        # ---- 6. Freeze: flatten translucent ancestors + drop them -----
        um.manager.freeze()

        return um

    # ------------------------------------------------------------------
    #  Helpers
    # ------------------------------------------------------------------
    def _record_parse_error(self, key: str, exc: Exception) -> None:
        # Store the error against the report id (even if no Report
        # instance exists yet, the frontend can render the failure).
        report = self.reports.get(key)
        if report is None:
            # Lightweight placeholder so the wire payload mentions the
            # failure. Full Report wiring for non-components inputs is
            # Phase 1b; for now we just store the error message.
            self.reports[key] = _ErrorReport(key, DISPLAY_NAMES.get(key, key), exc)
        else:
            report.exceptions.append(f"{type(exc).__name__}: {exc}")
            report.status = "error"

    def _extract_global_metadata(self) -> None:
        """
        Use the components Report's extract_metadata helper to populate
        the global company name + min/max month+year. Best-effort:
        failures leave the metadata fields as None.
        """
        comp = self.reports.get("components")
        if comp is None or comp.df is None:
            return
        try:
            # The existing extract_metadata reads Headers.SystemReportsBase
            # column references — those are *unbound* Series, not df
            # accessors. Keep the call path as-is; fall back silently.
            comp.extract_metadata()
            self.metadata["company_name"] = comp.company_name
            self.metadata["min_month"]    = comp.min_month
            self.metadata["min_year"]     = comp.min_year
            self.metadata["max_month"]    = comp.max_month
            self.metadata["max_year"]     = comp.max_year
        except Exception:
            # Don't let metadata extraction failures kill the upload.
            pass

    # ------------------------------------------------------------------
    #  Accessors
    # ------------------------------------------------------------------
    def get(self, report_id: str):
        return self.reports.get(report_id)

    def list_reports(self) -> list:
        return list(self.reports.values())

    # ------------------------------------------------------------------
    #  Wire serialization
    # ------------------------------------------------------------------
    def to_wire(self) -> dict:
        """Produce the full JSON payload the frontend hydrates from."""
        from UploadManager_serialize import serialize_upload_manager
        return serialize_upload_manager(self)


# ----------------------------------------------------------------------
#  Placeholder Report used when a parse error happens for a key we
#  haven't wired up to a Report subclass yet.
# ----------------------------------------------------------------------
class _ErrorReport:
    def __init__(self, key: str, display_label: str, exc: Exception):
        self.id            = key
        self.display_label = display_label
        self.is_input      = True
        self.dependencies  = []
        self.company_name  = None
        self.min_month     = None
        self.min_year      = None
        self.max_month     = None
        self.max_year      = None
        self.rows_count    = 0
        self.columns_count = 0
        self.exceptions    = [f"{type(exc).__name__}: {exc}"]
        self.status        = "error"
        self.missing_dependencies = []
        self.skipped_steps        = []
        self.lineageFrame  = None

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
        }
