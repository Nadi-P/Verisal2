"""
All FastAPI endpoints for Verisal, organized as a class.

Usage in main.py:
    app = FastAPI()
    api = Api()
    app.include_router(api.router)
"""
import json
import os
from io import BytesIO
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from Files import Files
from Loading import InitializeFromFiles, GetFileFromObject, _load_center_sheets
from Constants import KEYWORDS
from UploadManager import UploadManager
from paths import JSON_DIR


FX_PATH = JSON_DIR / "fx_conversions.json"
AXIOLOGY_PATH = JSON_DIR / "axiology.json"


# ----------------------------------------------------------------------
# FX migration helpers
# ----------------------------------------------------------------------
def _is_legacy_fx_shape(data) -> bool:
    """
    Detect the old `{fx_xxx: {currency, year, month, rate}}` shape so we
    can transparently migrate it. The new shape's top-level keys are ISO
    currency codes whose values are dicts of dicts of numbers.
    """
    if not isinstance(data, dict) or not data:
        return False
    for v in data.values():
        if isinstance(v, dict) and "currency" in v and "rate" in v:
            return True
    return False


def _migrate_fx_legacy(flat: dict) -> dict:
    """Reshape `{id: {currency, year, month, rate}}` → nested form."""
    out: dict = {}
    for entry in flat.values():
        if not isinstance(entry, dict):
            continue
        code = str(entry.get("currency", "")).upper().strip()
        try:
            year  = int(entry["year"])
            month = int(entry["month"])
            rate  = float(entry["rate"])
        except (KeyError, TypeError, ValueError):
            continue
        if not code or not year or month < 1 or month > 12:
            continue
        out.setdefault(code, {}).setdefault(str(year), {})[str(month)] = rate
    return out
TABLE_PRESETS_PATH = JSON_DIR / "tables_presets.json"
DISPLAY_SETTINGS_PATH = JSON_DIR / "display_settings.json"
DISPLAY_SETTINGS_DEFAULT = {"mode": "pivot", "zoom": 100, "exportFormat": "ask"}
EXPORT_FORMATS = ("ask", "custom", "original")


# ---- Pydantic request bodies ----
class FolderPayload(BaseModel):
    path: str


class TablePresetPayload(BaseModel):
    name: str
    preset: dict


class _LocalFileShim:
    """
    Wraps a local file path so it quacks like a FastAPI UploadFile —
    InitializeFromFiles only needs .filename and .file (with .seek/.read).
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


class Api:
    """All FastAPI routes live as methods on this class."""

    def __init__(self):
        self.router = APIRouter()
        self.selected_folder: str | None = None
        # Live UploadManager — replaced atomically on each successful upload.
        # Phase 1a foundation; downstream endpoints will migrate to read from
        # this in Phase 2.
        self.upload_manager: UploadManager | None = None
        self._register_routes()

    # ------------------------------------------------------------------
    # Route registration
    # ------------------------------------------------------------------
    def _register_routes(self):
        r = self.router

        # Reports
        r.add_api_route("/api/get_report", self.get_report, methods=["GET"])
        r.add_api_route("/api/update-months-comparison", self.update_months_comparison, methods=["GET"])
        r.add_api_route("/api/export_report", self.export_report, methods=["GET"])
        r.add_api_route("/api/reports/{report_id}/columns", self.get_report_columns, methods=["GET"])
        r.add_api_route("/api/reports/{report_id}/data", self.get_report_data, methods=["GET"])

        # File ingestion
        r.add_api_route("/api/upload_reports", self.upload_reports, methods=["POST"])
        r.add_api_route("/api/folder/set", self.set_folder, methods=["POST"])
        r.add_api_route("/api/folder/get", self.get_folder, methods=["GET"])

        # UploadManager — re-fetch on page refresh (Phase 1a wire format).
        r.add_api_route("/api/upload_manager", self.get_upload_manager, methods=["GET"])

        # FX configuration
        r.add_api_route("/api/config/fx", self.get_fx, methods=["GET"])
        r.add_api_route("/api/config/fx", self.save_fx, methods=["POST"])
        # FX appliances (which columns in which reports' default presets
        # currently carry an FX conversion).
        r.add_api_route("/api/fx-appliances", self.list_fx_appliances, methods=["GET"])
        r.add_api_route("/api/fx-appliances", self.upsert_fx_appliance, methods=["POST"])
        r.add_api_route("/api/fx-appliances/{report_id}/{field}", self.delete_fx_appliance, methods=["DELETE"])
        # Axiology — component-code catalog (record_type, code, name).
        r.add_api_route("/api/axiology", self.get_axiology, methods=["GET"])
        r.add_api_route("/api/axiology", self.upsert_axiology, methods=["POST"])
        r.add_api_route("/api/axiology/{record_type}/{code}", self.delete_axiology, methods=["DELETE"])

        # Display settings (global mode + zoom — persisted across app sessions)
        r.add_api_route("/api/config/display-settings", self.get_display_settings, methods=["GET"])
        r.add_api_route("/api/config/display-settings", self.save_display_settings, methods=["POST"])

        # Table presets
        r.add_api_route("/api/table-presets/{report_id}", self.get_table_presets, methods=["GET"])
        # Per-report "draft" — the live state the user is currently
        # editing. Persists across navigations so leaving a report
        # doesn't lose their unsaved edits.
        r.add_api_route("/api/table-presets/{report_id}/draft", self.get_draft_table_preset, methods=["GET"])
        r.add_api_route("/api/table-presets/{report_id}/draft", self.save_draft_table_preset, methods=["POST"])
        r.add_api_route("/api/table-presets/{report_id}/draft", self.delete_draft_table_preset, methods=["DELETE"])
        r.add_api_route("/api/table-presets/{report_id}/default", self.save_default_table_preset, methods=["POST"])
        r.add_api_route("/api/table-presets/{report_id}/save", self.save_named_table_preset, methods=["POST"])
        r.add_api_route("/api/table-presets/{report_id}/saved/{preset_name}", self.delete_named_table_preset, methods=["DELETE"])

        # System
        r.add_api_route("/api/shutdown", self.shutdown, methods=["POST"])

    # ------------------------------------------------------------------
    # JSON helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _read_json(path: Path) -> dict:
        if not path.exists():
            return {}
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def _write_json(path: Path, data: dict) -> None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

    @staticmethod
    def _report_df_map() -> dict:
        return {
            "center": Files.centerDF,
            "costing": Files.costingDF,
            "income": Files.incomeDF,
            "absences": Files.absencesDF,
            "deductions": Files.deductionsDF,
            "providents": Files.providentsDF,
            "components": Files.componentsDF,
            "social_analysis": Files.socialAnalysisDF,
            "months_comparison": Files.monthsComparisonDF,
            "reports_against_center": Files.reportsAgainstCenterDF,
        }

    # ------------------------------------------------------------------
    # Report endpoints
    # ------------------------------------------------------------------
    def get_report(self, report_name: str):
        report_mapping = self._report_df_map()
        checkup_mapping = {
            "social_analysis": Files.socialAnalysisCheckupColumns,
            "months_comparison": Files.monthsComparisonCheckupColumns,
            "reports_against_center": Files.reportsAgainstCenterCheckupColumns,
        }

        df = report_mapping.get(report_name)
        if df is None:
            return {"error": f"Report '{report_name}' not found"}

        df = df.fillna(0)
        if df.empty:
            return []

        checkup_results = {}
        condition = lambda x: x > 0
        checkup_cols = checkup_mapping.get(report_name, {}) or {}
        for col_name in checkup_cols:
            if col_name in df.columns:
                results = []
                for val in df[col_name]:
                    if isinstance(val, str):
                        results.append(condition(float(val.replace("%", ""))))
                    else:
                        results.append(condition(val))
                checkup_results[col_name] = results

        return {
            "status": "success",
            "data": df.to_dict(orient="records"),
            "checkup": checkup_results,
            "metadata": {
                "company_name": Files.company_name,
                "min_month": Files.min_month,
                "min_year": Files.min_year,
                "max_month": Files.max_month,
                "max_year": Files.max_year,
            },
        }

    def update_months_comparison(
        self,
        m1: int = Query(...),
        y1: int = Query(...),
        m2: int = Query(...),
        y2: int = Query(...),
    ):
        # TODO: re-wire to the new Report-subclass pipeline.
        # The legacy `Functions.get_months_comparison(...)` entry point was
        # removed in the aggregation refactor — derived reports now live on
        # their owning Report subclass.
        raise HTTPException(
            status_code=501,
            detail="update_months_comparison: not wired to the new Report-subclass pipeline yet",
        )

    def export_report(self, report_name: str):
        df = self._report_df_map().get(report_name)
        if df is None or df.empty:
            raise HTTPException(status_code=404, detail=f"Report '{report_name}' not found")

        buffer = BytesIO()
        df.fillna(0).to_excel(buffer, index=False, engine="openpyxl")
        buffer.seek(0)
        return StreamingResponse(
            iter([buffer.getvalue()]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={report_name}.xlsx"},
        )

    def get_report_columns(self, report_id: str):
        report_map = self._report_df_map()
        if report_id not in report_map:
            raise HTTPException(status_code=404, detail=f"Unknown report id '{report_id}'")
        df = report_map[report_id]
        if df is None:
            return {"loaded": False, "columns": []}
        return {"loaded": True, "columns": list(df.columns)}

    def get_report_data(self, report_id: str, page: int = Query(0, ge=0), size: int = Query(500, gt=0, le=10000)):
        report_map = self._report_df_map()
        if report_id not in report_map:
            raise HTTPException(status_code=404, detail=f"Unknown report id '{report_id}'")
        df = report_map[report_id]

        metadata = {
            "company_name": Files.company_name,
            "min_month":    Files.min_month,
            "min_year":     Files.min_year,
            "max_month":    Files.max_month,
            "max_year":     Files.max_year,
        }

        if df is None:
            return {
                "loaded":   False,
                "total":    0,
                "page":     page,
                "size":     size,
                "columns":  [],
                "rows":     [],
                "metadata": metadata,
            }
        df = df.fillna(0)
        total = len(df)
        start = page * size
        end = start + size
        return {
            "loaded":   True,
            "total":    total,
            "page":     page,
            "size":     size,
            "columns":  list(df.columns),
            "rows":     df.iloc[start:end].to_dict(orient="records"),
            "metadata": metadata,
        }

    # ------------------------------------------------------------------
    # File ingestion / folder selection
    # ------------------------------------------------------------------
    async def upload_reports(self, files: List[UploadFile] = File(...)):
        """Permissive multi-file upload — loads whatever recognizable files are present.

        Two pipelines run in parallel during the Phase 1a transition:
          (a) the legacy `_load_from_files` populating the `Files` singleton
              (kept so the existing frontend pages keep working)
          (b) the new `UploadManager.from_files` building Report instances
              with LineageFrames + returning a column-major rich-cell payload.

        Both results ship in the response under `legacy` / `uploadManager`
        so the frontend can adopt the new path incrementally.
        """
        # Need to read each UploadFile twice (once per pipeline); buffer
        # the bytes locally so the second read isn't on an exhausted stream.
        buffered = []
        for f in files:
            try:
                f.file.seek(0)
            except Exception:
                pass
            buffered.append(f)

        # Pipeline A — legacy (Files singleton). Kept for transition.
        legacy_result = self._load_from_files(buffered)
        legacy_result["status"] = "success"

        # Pipeline B — UploadManager. Atomic swap into self.upload_manager.
        for f in buffered:
            try:
                f.file.seek(0)
            except Exception:
                pass
        try:
            self.upload_manager = UploadManager.from_files(buffered)
            upload_payload = self.upload_manager.to_wire()
        except Exception as e:
            upload_payload = {"error": f"{type(e).__name__}: {e}"}

        return {
            "status":        "success",
            "legacy":        legacy_result,
            "uploadManager": upload_payload,
        }

    def get_upload_manager(self):
        """Re-fetch the current UploadManager payload — used by the frontend
        on page refresh to re-hydrate state without re-uploading."""
        if self.upload_manager is None:
            return {"loaded": False}
        return {"loaded": True, "uploadManager": self.upload_manager.to_wire()}

    def set_folder(self, payload: FolderPayload):
        """
        Permissive folder ingestion. Loads whatever recognizable Excel files
        exist in the folder; missing files are reported but don't fail the call.
        """
        path = payload.path
        if not os.path.isdir(path):
            raise HTTPException(status_code=400, detail=f"Folder does not exist: {path}")
        self.selected_folder = path

        result = self._load_folder_permissive(path)
        result["status"] = "success"
        result["path"] = path
        return result

    def get_folder(self):
        return {"path": self.selected_folder}

    # ------------------------------------------------------------------
    # Permissive folder loading
    # ------------------------------------------------------------------
    @staticmethod
    def _reset_files_state():
        """Clear any previously loaded data so missing files don't appear loaded."""
        Files.centerDF = None
        Files.center_df_coded = None
        Files.componentsDF = None
        Files.providentsDF = None
        Files.incomeDF = None
        Files.deductionsDF = None
        Files.costingDF = None
        Files.absencesDF = None
        Files.socialAnalysisDF = None
        Files.monthsComparisonDF = None
        Files.reportsAgainstCenterDF = None
        Files.company_name = None
        Files.current_year = None
        Files.current_month = None
        Files.min_year = None
        Files.max_year = None
        Files.min_month = None
        Files.max_month = None

    def _load_folder_permissive(self, folder_path: str) -> dict:
        """Wrap a folder's Excel files as local shims and run permissive ingestion."""
        shims = []
        for entry in sorted(os.listdir(folder_path)):
            full = os.path.join(folder_path, entry)
            if not os.path.isfile(full) or not entry.lower().endswith((".xlsx", ".xls")):
                continue
            shims.append(_LocalFileShim(full))
        return self._load_from_files(shims)

    def _load_from_files(self, file_list) -> dict:
        """
        Match each file to a report key by keyword and load whatever exists.
        Accepts anything with .filename + .file (UploadFile or _LocalFileShim).
        Returns:
            {
              loaded:        [report_id, ...],
              missing:       [report_id, ...],
              unrecognized:  [filename, ...],
              duplicates:    [filename, ...],
              errors:        { report_id: "error message" },
              derived:       { report_id: "loaded" | "skipped" | "error msg" },
              metadata:      { company_name, min/max month+year } | null,
            }
        """
        self._reset_files_state()

        # ---- 1. Classify each file by keyword ----
        file_map: dict = {}
        unrecognized: list[str] = []
        duplicates: list[str] = []

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
                unrecognized.append(name)
            elif matched in file_map:
                duplicates.append(name)
            else:
                file_map[matched] = f

        # ---- 2. Load each input file independently ----
        loaded: list[str] = []
        errors: dict[str, str] = {}

        # Center has its own loader (returns two DFs)
        if "center" in file_map:
            try:
                Files.centerDF, Files.center_df_coded, _code_map = _load_center_sheets(file_map["center"])
                loaded.append("center")
            except Exception as e:
                errors["center"] = str(e)

        input_targets = {
            "components": "componentsDF",
            "providents": "providentsDF",
            "income":     "incomeDF",
            "deductions": "deductionsDF",
            "costing":    "costingDF",
            "absences":   "absencesDF",
        }
        for key, attr in input_targets.items():
            if key not in file_map:
                continue
            try:
                df = GetFileFromObject(file_map[key], key)
                setattr(Files, attr, df)
                loaded.append(key)
            except Exception as e:
                errors[key] = str(e)

        # ---- 3. Metadata extraction ----
        # TODO: re-wire to the new Report-subclass pipeline.
        # The legacy `Functions.extract_data_from_files(...)` helpers were
        # removed in the aggregation refactor. Metadata is left empty for now.
        metadata = None

        # ---- 4. Derived reports ----
        # TODO: re-wire to the new Report-subclass pipeline.
        # `Functions.get_social_analysis / get_months_comparison /
        # get_reports_against_center` no longer exist — derived reports are
        # produced by their owning Report subclass now.
        derived: dict[str, str] = {
            "social_analysis":        "skipped (not wired to new pipeline yet)",
            "months_comparison":      "skipped (not wired to new pipeline yet)",
            "reports_against_center": "skipped (not wired to new pipeline yet)",
        }

        missing = [k for k in KEYWORDS if k not in file_map]

        return {
            "loaded": loaded,
            "missing": missing,
            "unrecognized": unrecognized,
            "duplicates": duplicates,
            "errors": errors,
            "derived": derived,
            "metadata": metadata,
        }

    # ------------------------------------------------------------------
    # FX configuration
    # ------------------------------------------------------------------
    # The persisted shape is nested:
    #     { "<CODE>": { "<year>": { "<month>": <rate> } } }
    # Older versions stored a flat {id: {currency, year, month, rate}} map.
    # `get_fx` auto-migrates legacy files on read and rewrites them in the
    # new shape, so the frontend never has to deal with the old form.
    def get_fx(self):
        data = self._read_json(FX_PATH) or {}
        if _is_legacy_fx_shape(data):
            data = _migrate_fx_legacy(data)
            try:
                self._write_json(FX_PATH, data)
            except Exception:
                pass    # best-effort migration; non-fatal
        return data

    def save_fx(self, payload: dict):
        self._write_json(FX_PATH, payload or {})
        return {"status": "success"}

    # ------------------------------------------------------------------
    # FX appliances — every (report, column) pair that currently carries
    # an FX conversion in the LIVE state. Live = draft if present, else
    # the default preset. Reads + writes use the same draft surface so
    # changes made in the side panel show up here and vice versa.
    # ------------------------------------------------------------------
    def list_fx_appliances(self):
        all_presets = self._load_table_presets() or {}
        out = []
        for report_id in all_presets.keys():
            preset = self._live_report_config(all_presets, report_id)
            fx_map = preset.get("fxConversions") or {}
            for field, fx in fx_map.items():
                if not isinstance(fx, dict): continue
                out.append({
                    "reportId":  report_id,
                    "field":     field,
                    "fxConfig":  fx,
                })
        return out

    def upsert_fx_appliance(self, payload: dict):
        """
        Write an FX-conversion entry into the report's DRAFT (the live
        state). Bootstraps an empty draft when none exists yet. Payload:
        `{ reportId, field, fxConfig }`.
        """
        report_id = (payload or {}).get("reportId")
        field     = (payload or {}).get("field")
        fx        = (payload or {}).get("fxConfig")
        if not report_id or not field or not isinstance(fx, dict):
            raise HTTPException(status_code=400, detail="reportId, field, fxConfig required")

        all_presets = self._load_table_presets() or {}
        block = all_presets.setdefault(report_id, self._empty_report_presets())
        # Seed the draft from the currently-LIVE config so we don't
        # accidentally drop the user's other tweaks.
        if not isinstance(block.get("draft"), dict):
            block["draft"] = dict(self._live_report_config(all_presets, report_id))
        draft = block["draft"]
        fxc = draft.setdefault("fxConversions", {})
        fxc[field] = fx
        self._save_table_presets(all_presets)
        return {"status": "success"}

    def delete_fx_appliance(self, report_id: str, field: str):
        all_presets = self._load_table_presets() or {}
        block = all_presets.setdefault(report_id, self._empty_report_presets())
        if not isinstance(block.get("draft"), dict):
            block["draft"] = dict(self._live_report_config(all_presets, report_id))
        draft = block["draft"]
        fxc = draft.get("fxConversions") or {}
        if field in fxc:
            fxc.pop(field, None)
            draft["fxConversions"] = fxc
        self._save_table_presets(all_presets)
        return {"status": "success"}

    # ------------------------------------------------------------------
    # Axiology — component-code catalog. Persisted as:
    #   {
    #     "recordTypes": { "<recordType>": "<Hebrew label>", ... },
    #     "codes": { "<recordType>": [{ "code": N, "name": "..." }, ...] }
    #   }
    # Uniqueness is enforced on (recordType, code) — same code may exist
    # in two different record types and refer to different things.
    # ------------------------------------------------------------------
    def _load_axiology(self) -> dict:
        data = self._read_json(AXIOLOGY_PATH) or {}
        if not isinstance(data.get("recordTypes"), dict): data["recordTypes"] = {}
        if not isinstance(data.get("codes"), dict):       data["codes"] = {}
        return data

    def _save_axiology(self, data: dict) -> None:
        self._write_json(AXIOLOGY_PATH, data)

    def get_axiology(self):
        return self._load_axiology()

    def upsert_axiology(self, payload: dict):
        """
        Add a new code or rename / renumber an existing one.

        Payload (add):
            { recordType: "1", code: 5, name: "..." }
        Payload (edit):
            { recordType: "1", oldCode: 5, code: 7, name: "..." }

        Rejects payloads that would create a (recordType, code) collision.
        """
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="payload must be an object")
        rt = str(payload.get("recordType") or "").strip()
        name = (payload.get("name") or "").strip()
        try:
            code = int(payload.get("code"))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="code must be a positive integer")
        if not rt or not name or code <= 0:
            raise HTTPException(status_code=400, detail="recordType, code (>0), name required")

        data = self._load_axiology()
        if rt not in data["recordTypes"]:
            raise HTTPException(status_code=400, detail=f"unknown recordType '{rt}'")

        entries = data["codes"].setdefault(rt, [])
        old_code = payload.get("oldCode")
        if old_code is not None:
            try: old_code = int(old_code)
            except (TypeError, ValueError): old_code = None

        # Uniqueness — the target (rt, code) is free EXCEPT when it's the
        # row currently being edited.
        for e in entries:
            if int(e["code"]) == code and e["code"] != old_code:
                raise HTTPException(status_code=409, detail=f"code {code} already exists in record type {rt}")

        if old_code is None:
            entries.append({"code": code, "name": name})
        else:
            for e in entries:
                if int(e["code"]) == old_code:
                    e["code"] = code
                    e["name"] = name
                    break
            else:
                entries.append({"code": code, "name": name})

        entries.sort(key=lambda e: int(e["code"]))
        self._save_axiology(data)
        return {"status": "success"}

    def delete_axiology(self, record_type: str, code: str):
        try:
            code_int = int(code)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="code must be an integer")
        data = self._load_axiology()
        entries = data["codes"].get(record_type) or []
        next_entries = [e for e in entries if int(e["code"]) != code_int]
        data["codes"][record_type] = next_entries
        self._save_axiology(data)
        return {"status": "success", "removed": len(entries) - len(next_entries)}

    # ------------------------------------------------------------------
    # Display settings (global, persisted to JSON across app sessions)
    # ------------------------------------------------------------------
    def get_display_settings(self):
        """
        Return the persisted display settings. Falls back to defaults when
        the file is missing or malformed so the frontend always gets a
        usable shape.
        """
        data = self._read_json(DISPLAY_SETTINGS_PATH)
        merged = {**DISPLAY_SETTINGS_DEFAULT, **(data or {})}
        # Sanitize.
        mode = merged.get("mode")
        if mode not in ("pivot", "table"):
            merged["mode"] = "pivot"
        try:
            zoom = int(merged.get("zoom", 100))
        except (TypeError, ValueError):
            zoom = 100
        merged["zoom"] = max(50, min(200, zoom))
        if merged.get("exportFormat") not in EXPORT_FORMATS:
            merged["exportFormat"] = "ask"
        return merged

    def save_display_settings(self, payload: dict):
        """
        Persist display settings. Accepts a partial payload and merges into
        the existing on-disk settings — so the frontend can POST just `mode`
        or just `zoom` without clobbering the other field.
        """
        current = self.get_display_settings()
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="payload must be an object")
        if "mode" in payload:
            if payload["mode"] not in ("pivot", "table"):
                raise HTTPException(status_code=400, detail="mode must be 'pivot' or 'table'")
            current["mode"] = payload["mode"]
        if "zoom" in payload:
            try:
                z = int(payload["zoom"])
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="zoom must be an integer")
            current["zoom"] = max(50, min(200, z))
        if "exportFormat" in payload:
            if payload["exportFormat"] not in EXPORT_FORMATS:
                raise HTTPException(status_code=400, detail="exportFormat must be 'ask', 'custom', or 'original'")
            current["exportFormat"] = payload["exportFormat"]
        self._write_json(DISPLAY_SETTINGS_PATH, current)
        return {"status": "success", **current}

    # ------------------------------------------------------------------
    # Table presets
    # ------------------------------------------------------------------
    def _load_table_presets(self) -> dict:
        return self._read_json(TABLE_PRESETS_PATH)

    def _save_table_presets(self, data: dict) -> None:
        self._write_json(TABLE_PRESETS_PATH, data)

    @staticmethod
    def _empty_report_presets() -> dict:
        return {"defaultName": None, "saved": {}}

    def get_table_presets(self, report_id: str):
        all_presets = self._load_table_presets()
        return all_presets.get(report_id, self._empty_report_presets())

    # ------------------------------------------------------------------
    # Per-report DRAFT — the live state the user is editing. Survives
    # page navigation so leaving a report doesn't reset their pins,
    # FX conversions, etc. Distinct from saved presets.
    # ------------------------------------------------------------------
    def get_draft_table_preset(self, report_id: str):
        all_presets = self._load_table_presets()
        block = all_presets.get(report_id) or {}
        draft = block.get("draft")
        # Returning {} when no draft yet — caller falls back to the
        # default preset.
        return draft if isinstance(draft, dict) else {}

    def save_draft_table_preset(self, report_id: str, payload: dict):
        all_presets = self._load_table_presets()
        block = all_presets.setdefault(report_id, self._empty_report_presets())
        block["draft"] = payload if isinstance(payload, dict) else {}
        self._save_table_presets(all_presets)
        return {"status": "success"}

    def delete_draft_table_preset(self, report_id: str):
        all_presets = self._load_table_presets()
        block = all_presets.get(report_id) or {}
        block.pop("draft", None)
        if report_id in all_presets:
            all_presets[report_id] = block
            self._save_table_presets(all_presets)
        return {"status": "success"}

    def _live_report_config(self, all_presets: dict, report_id: str) -> dict:
        """
        Return the currently-LIVE config for a report:
          1. its draft if it has one
          2. else its default preset
          3. else {} (empty)
        Used by `list/upsert/delete_fx_appliance` so management-page
        edits and side-panel edits operate on the same surface.
        """
        block = all_presets.get(report_id) or {}
        draft = block.get("draft")
        if isinstance(draft, dict) and draft:
            return draft
        default_name = block.get("defaultName")
        saved = block.get("saved") or {}
        preset = saved.get(default_name) if default_name else None
        return preset if isinstance(preset, dict) else {}

    def save_default_table_preset(self, report_id: str, payload: dict):
        """
        Set which saved preset is the default for this report.
        Payload: {"name": "X" | null}. If null, default is cleared.
        If name is provided it must already exist in saved.
        """
        name = payload.get("name") if isinstance(payload, dict) else None
        all_presets = self._load_table_presets()
        if report_id not in all_presets:
            all_presets[report_id] = self._empty_report_presets()
        if name is not None and name not in all_presets[report_id].get("saved", {}):
            raise HTTPException(status_code=400, detail=f"Preset '{name}' is not in saved")
        all_presets[report_id]["defaultName"] = name
        self._save_table_presets(all_presets)
        return {"status": "success", "defaultName": name}

    def save_named_table_preset(self, report_id: str, payload: TablePresetPayload):
        """Add or overwrite a named preset under report_id.saved."""
        all_presets = self._load_table_presets()
        if report_id not in all_presets:
            all_presets[report_id] = self._empty_report_presets()
        all_presets[report_id].setdefault("saved", {})
        all_presets[report_id]["saved"][payload.name] = payload.preset
        self._save_table_presets(all_presets)
        return {"status": "success", "name": payload.name}

    def delete_named_table_preset(self, report_id: str, preset_name: str):
        all_presets = self._load_table_presets()
        report = all_presets.get(report_id)
        if not report or preset_name not in report.get("saved", {}):
            raise HTTPException(status_code=404, detail=f"Preset '{preset_name}' not found")
        del report["saved"][preset_name]
        # If the deleted preset was the default, clear the default reference.
        if report.get("defaultName") == preset_name:
            report["defaultName"] = None
        self._save_table_presets(all_presets)
        return {"status": "success"}

    # ------------------------------------------------------------------
    # System
    # ------------------------------------------------------------------
    async def shutdown(self):
        """Gracefully shut down the server. Called by the Electron app on close."""
        os.kill(os.getpid(), 15)
        return {"status": "shutdown initiated"}
