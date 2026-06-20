"""
Axiology — single source of truth for payroll component codes.

Replaces the old hardcoded `Headers.PayrollCodes` class. Everything is read
from `JSON/axiology.json`, whose shape is:

    {
      "recordTypes": { "<rt>": "<hebrew label>", ... },
      "codes": {
        "<rt>": [ { "code": N, "name": "...", "key"?: "<stable_key>" }, ... ],
        ...
      },
      "system": [
        { "key": "employee_id", "code": -1, "name": "מספר עובד" }, ...
      ]
    }

A component's CONCAT code is record-type digits followed by code digits
(record 1 + code 31 → 131; record 91 + code 52 → 9152). The `system`
entries are fixed structural columns (negative codes) that are never shown
or edited on the axiology page.

`Axiology.code("base_salary")` returns the CONCAT int (11). `code()` for a
system key returns its negative code (-1). Lookups are resilient: a missing
key raises KeyError, but callers that build masks should use `codes(...)`
which silently skips unknown keys.
"""
import json
from pathlib import Path

_AXIOLOGY_PATH = Path(__file__).parent / "JSON" / "axiology.json"


class _AxiologyData:
    """Loaded, indexed view of axiology.json. Rebuilt on reload()."""

    def __init__(self, raw: dict):
        self.raw = raw or {}
        self._by_key:        dict = {}   # stable key -> concat int
        self._name_by_concat: dict = {}  # concat int -> hebrew name
        self._build()

    @staticmethod
    def _concat(record_type, code) -> int:
        """record-type digits + code digits → CONCAT int (e.g. '1',31 → 131)."""
        return int(f"{record_type}{code}")

    def _build(self) -> None:
        codes = self.raw.get("codes") or {}
        for rt, entries in codes.items():
            for e in entries or []:
                try:
                    code = int(e["code"])
                except (KeyError, TypeError, ValueError):
                    continue
                concat = self._concat(rt, code)
                name = e.get("name")
                if name is not None:
                    self._name_by_concat[concat] = name
                key = e.get("key")
                if key:
                    self._by_key[key] = concat

        # System (fixed, negative) codes — the concat IS the negative code.
        for e in self.raw.get("system") or []:
            try:
                code = int(e["code"])
            except (KeyError, TypeError, ValueError):
                continue
            key = e.get("key")
            if key:
                self._by_key[key] = code
            name = e.get("name")
            if name is not None:
                self._name_by_concat[code] = name


class Axiology:
    """Process-wide accessor. Cached; call reload() after editing the file."""

    _data: "_AxiologyData | None" = None

    # ------------------------------------------------------------------
    @classmethod
    def _get(cls) -> _AxiologyData:
        if cls._data is None:
            cls.reload()
        return cls._data

    @classmethod
    def reload(cls) -> None:
        """Re-read axiology.json from disk (call after an upsert/delete)."""
        try:
            raw = json.loads(_AXIOLOGY_PATH.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            raw = {}
        cls._data = _AxiologyData(raw)

    # ------------------------------------------------------------------
    @classmethod
    def code(cls, key: str) -> int:
        """CONCAT int for a stable key. Raises KeyError if unknown."""
        return cls._get()._by_key[key]

    @classmethod
    def codes(cls, keys) -> list:
        """CONCAT ints for an iterable of keys; unknown keys are skipped."""
        by_key = cls._get()._by_key
        return [by_key[k] for k in keys if k in by_key]

    @classmethod
    def name(cls, concat: int):
        """Hebrew name for a CONCAT/system code, or None if unknown."""
        return cls._get()._name_by_concat.get(concat)

    @classmethod
    def has(cls, key: str) -> bool:
        return key in cls._get()._by_key
