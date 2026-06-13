"""
Wire-format serializer for UploadManager.

Produces the JSON payload the frontend hydrates from:

  {
    "registry": {
      "<report_idx>": { "id", "display_label", "is_input" },
      ...
    },
    "metadata": { "company_name", "min_month", "min_year",
                  "max_month", "max_year" },
    "unrecognized": [...],
    "duplicates":   [...],
    "reports": {
      "<report_id>": {
        ...full Report.to_dict() block...,
        "lineageFrame": {
          "columns": [
            { "name", "formula"?, "cells": [
              { "value": ..., "references"?: [{"r","c","i","v"}, ...] },
              ...
            ] },
            ...
          ],
          "rows_count": N
        } | None
      },
      ...
    }
  }

Translucent frames are skipped defensively (they should already be dropped
by `manager.freeze()` but the serializer never assumes that).

Value normalization:
  - NaN floats → None  (JSON-safe)
  - pandas NA / NaT  → None
  - everything else passes through as-is (json module handles ints, floats,
    strings, bools, None natively)
"""
from typing import Any, Optional


def _normalize_value(v: Any):
    if v is None:
        return None
    # NaN float — Python json would emit `NaN` which isn't valid JSON.
    if isinstance(v, float) and v != v:
        return None
    # pandas Timestamp / Timedelta etc. → str fallback
    try:
        # Common pandas NA detection
        import pandas as pd  # local — keep top-level import light
        if pd.isna(v):
            return None
        if isinstance(v, (pd.Timestamp,)):
            return v.isoformat()
    except Exception:
        pass
    # Anything else native to JSON.
    if isinstance(v, (int, float, bool, str)):
        return v
    # Last-resort string-ify for exotic objects.
    return str(v)


def _serialize_cell(cell):
    """A single cell → wire dict."""
    out = {"value": _normalize_value(cell.self_ref.value)}
    refs = getattr(cell, "references", None)
    if refs:
        out["references"] = [
            {
                "r": ref.report_idx,
                "c": ref.column_idx,
                "i": ref.row_idx,
                "v": _normalize_value(ref.value),
            }
            for ref in refs
        ]
    return out


def _serialize_column(col):
    """A single column → wire dict."""
    out = {
        "name":  col.name,
        "cells": [_serialize_cell(c) for c in col.cells],
    }
    if col.formula:
        out["formula"] = col.formula
    return out


def _serialize_frame(frame) -> Optional[dict]:
    if frame is None:
        return None
    if getattr(frame, "translucent", False):
        # Defensive — freeze() should have already dropped translucent
        # frames. If one slipped through (bug or unfrozen UploadManager),
        # we refuse to ship it.
        return None
    return {
        "columns":    [_serialize_column(c) for c in frame.columns],
        "rows_count": frame.row_count() if hasattr(frame, "row_count") else 0,
    }


def serialize_upload_manager(upload_manager) -> dict:
    """
    Build the full top-level payload. See module docstring for the shape.
    """
    # ---- registry: report_idx → { id, display_label, is_input } -------
    registry = {}
    for report in upload_manager.list_reports():
        frame = getattr(report, "lineageFrame", None)
        if frame is None or getattr(frame, "translucent", False):
            continue
        registry[str(frame.report_idx)] = {
            "id":            report.id,
            "display_label": report.display_label,
            "is_input":      report.is_input,
        }

    # ---- reports: each Report's metadata block + serialized frame -----
    reports_payload = {}
    for report in upload_manager.list_reports():
        block = report.to_dict()
        block["lineageFrame"] = _serialize_frame(
            getattr(report, "lineageFrame", None)
        )
        reports_payload[report.id] = block

    return {
        "registry":     registry,
        "metadata":     dict(upload_manager.metadata),
        "unrecognized": list(upload_manager.unrecognized),
        "duplicates":   list(upload_manager.duplicates),
        "reports":      reports_payload,
    }
