"""
Column — one named column of a LineageFrame.

Every method that produces a NEW Column from existing data builds it via
`_make_unattached_column(...)`, which creates `ReferencingTableCell`s whose
`references` list points at the source cells that fed each value. The
result Column carries `source_columns` (a list of (report_idx, column_idx)
pairs) and a `calculate` callable that knows how to recompute its cells
when its sources change, so cascading mutations flow naturally.

A column can be either:
  - A raw leaf column: cells are TableCells, no source_columns, no calculate.
  - A derived column: cells are ReferencingTableCells, source_columns lists
    the upstream columns that fed each cell, calculate is the recompute fn.

Cascade
-------
When `apply_value_change(fn)` runs, every cell in this column has its value
replaced by `fn(old_value)`. After that, every column listed in
`dependent_columns` is resolved via the manager and recalculated, which in
turn cascades to ITS dependents.
"""
from typing import Callable, List, Optional, Tuple

from LineageFrame.cell import CellReference, ReferencingTableCell, TableCell


# ANSI colors — same palette LineageFrame uses for headers + row indices.
_TURQUOISE = "\033[96m"
_RESET     = "\033[0m"


def _has_hebrew(s: str) -> bool:
    for ch in s:
        if '֐' <= ch <= '׿':
            return True
    return False


def _flip_if_hebrew(s: str) -> str:
    return s[::-1] if _has_hebrew(s) else s


def _fmt_value(v) -> str:
    """Pandas-style scalar formatting + Hebrew flip for strings."""
    if v is None:
        return "NaN"
    if isinstance(v, float):
        if v != v:
            return "NaN"
        if v == int(v):
            return f"{int(v)}.0"
        return f"{v:.6g}"
    s = str(v)
    return _flip_if_hebrew(s)


# Sentinel for "no value passed".
class _Missing:
    def __repr__(self):
        return "<missing>"
_MISSING = _Missing()


class Column:
    __slots__ = (
        "name", "index", "cells",
        "source_columns", "dependent_columns",
        "calculate",
        "frame",
        "formula",
    )

    def __init__(
        self,
        name: str,
        index: int = -1,
        cells: Optional[List[TableCell]] = None,
        source_columns: Optional[List[Tuple[int, int]]] = None,
        dependent_columns: Optional[List[Tuple[int, int]]] = None,
        calculate: Optional[Callable] = None,
        frame=None,
        formula: Optional[str] = None,
    ):
        self.name              = name
        self.index             = index
        self.cells             = cells if cells is not None else []
        self.source_columns    = source_columns if source_columns is not None else []
        self.dependent_columns = dependent_columns if dependent_columns is not None else []
        self.calculate         = calculate
        self.frame             = frame
        # Display-only formula string (e.g. "sum(total_amount)", "A + B").
        # Set by manufactured-report constructors. Substituted through
        # translucent ancestors at manager.freeze() time.
        self.formula           = formula

    # ------------------------------------------------------------------
    #  Cascade core
    # ------------------------------------------------------------------

    def apply_value_change(self, fn: Callable):
        for cell in self.cells:
            cell.value = fn(cell.value)
        self._cascade()

    def recalculate(self):
        if self.calculate is None or self.frame is None:
            return
        manager = self.frame.manager
        sources = [manager.resolve_column(r, c) for r, c in self.source_columns]
        for row_idx, cell in enumerate(self.cells):
            cell.value = self.calculate(sources, row_idx)
        self._cascade()

    def _cascade(self):
        if self.frame is None:
            return
        manager = self.frame.manager
        for report_idx, column_idx in self.dependent_columns:
            dependent = manager.resolve_column(report_idx, column_idx)
            if dependent is not None and dependent.calculate is not None:
                dependent.recalculate()

    # ------------------------------------------------------------------
    #  Helpers
    # ------------------------------------------------------------------

    def values(self) -> list:
        return [c.value for c in self.cells]

    def tolist(self) -> list:
        return self.values()

    def _self_source_ref(self) -> Optional[Tuple[int, int]]:
        """(report_idx, column_idx) tuple identifying this column, or None if unattached."""
        if self.frame is None or self.index < 0:
            return None
        return (self.frame.report_idx, self.index)

    def _make_unattached_column(
        self,
        name: str,
        row_values: list,
        per_row_refs: List[List[CellReference]],
        source_columns: Optional[List[Tuple[int, int]]] = None,
        calculate: Optional[Callable] = None,
    ) -> "Column":
        """
        Build a NEW unattached Column from explicit per-row values + per-row
        source references. Every cell becomes a ReferencingTableCell.
        """
        cells: List[TableCell] = []
        for row_idx, value in enumerate(row_values):
            self_ref = CellReference(-1, -1, row_idx, value)
            refs = per_row_refs[row_idx] if row_idx < len(per_row_refs) else []
            cells.append(ReferencingTableCell(self_ref, list(refs)))
        return Column(
            name=name, index=-1, cells=cells,
            source_columns=source_columns or [],
            calculate=calculate,
        )

    @property
    def str(self):
        from LineageFrame.string_accessor import StringAccessor
        return StringAccessor(self)

    # ------------------------------------------------------------------
    #  Pandas-mimic methods that PRODUCE new Columns
    # ------------------------------------------------------------------

    def copy(self) -> "Column":
        """Independent Column with a one-to-one reference back to self's cells."""
        src_ref = self._self_source_ref()
        sources = [src_ref] if src_ref else []
        return self._make_unattached_column(
            name=self.name,
            row_values=[c.value for c in self.cells],
            per_row_refs=[[c.self_ref] for c in self.cells],
            source_columns=sources,
            calculate=(lambda srcs, i: srcs[0].cells[i].value) if src_ref else None,
        )

    def apply(self, fn: Callable, *, new_name: Optional[str] = None) -> "Column":
        out_values = [fn(c.value) for c in self.cells]
        per_row_refs = [[c.self_ref] for c in self.cells]
        src_ref = self._self_source_ref()
        sources = [src_ref] if src_ref else []
        calculate = (lambda srcs, i: fn(srcs[0].cells[i].value)) if src_ref else None
        return self._make_unattached_column(
            name=new_name or self.name,
            row_values=out_values,
            per_row_refs=per_row_refs,
            source_columns=sources,
            calculate=calculate,
        )

    def where(self, condition, other=_MISSING) -> "Column":
        cond_vals  = self._coerce_cond(condition)
        other_vals = self._coerce_other(other)
        out, refs  = [], []
        for i, cell in enumerate(self.cells):
            keep = bool(cond_vals[i])
            out.append(cell.value if keep else other_vals[i])
            r = [cell.self_ref]
            if isinstance(condition, Column):
                r.append(condition.cells[i].self_ref)
            if isinstance(other, Column):
                r.append(other.cells[i].self_ref)
            refs.append(r)
        sources = self._collect_sources(self, condition, other)
        return self._make_unattached_column(
            name=self.name, row_values=out, per_row_refs=refs,
            source_columns=sources,
        )

    def isin(self, values) -> "Column":
        value_set = set(values) if not isinstance(values, set) else values
        out = [v in value_set for v in self.values()]
        src_ref = self._self_source_ref()
        return self._make_unattached_column(
            name=f"{self.name}.isin", row_values=out,
            per_row_refs=[[c.self_ref] for c in self.cells],
            source_columns=[src_ref] if src_ref else [],
            calculate=(lambda srcs, i: srcs[0].cells[i].value in value_set) if src_ref else None,
        )

    def notna(self) -> "Column":
        out = [self._is_not_na(v) for v in self.values()]
        src_ref = self._self_source_ref()
        return self._make_unattached_column(
            name=f"{self.name}.notna", row_values=out,
            per_row_refs=[[c.self_ref] for c in self.cells],
            source_columns=[src_ref] if src_ref else [],
            calculate=(lambda srcs, i: Column._is_not_na(srcs[0].cells[i].value)) if src_ref else None,
        )

    def isna(self) -> "Column":
        out = [not self._is_not_na(v) for v in self.values()]
        src_ref = self._self_source_ref()
        return self._make_unattached_column(
            name=f"{self.name}.isna", row_values=out,
            per_row_refs=[[c.self_ref] for c in self.cells],
            source_columns=[src_ref] if src_ref else [],
            calculate=(lambda srcs, i: not Column._is_not_na(srcs[0].cells[i].value)) if src_ref else None,
        )

    def fillna(self, value) -> "Column":
        out = [(value if not self._is_not_na(v) else v) for v in self.values()]
        src_ref = self._self_source_ref()
        return self._make_unattached_column(
            name=self.name, row_values=out,
            per_row_refs=[[c.self_ref] for c in self.cells],
            source_columns=[src_ref] if src_ref else [],
            calculate=(lambda srcs, i, _v=value: _v if not Column._is_not_na(srcs[0].cells[i].value) else srcs[0].cells[i].value) if src_ref else None,
        )

    def astype(self, dtype) -> "Column":
        def _cast(v):
            if v is None:
                return None
            try:
                return dtype(v)
            except (TypeError, ValueError):
                return None
        out = [_cast(v) for v in self.values()]
        src_ref = self._self_source_ref()
        return self._make_unattached_column(
            name=self.name, row_values=out,
            per_row_refs=[[c.self_ref] for c in self.cells],
            source_columns=[src_ref] if src_ref else [],
            calculate=(lambda srcs, i: _cast(srcs[0].cells[i].value)) if src_ref else None,
        )

    def dropna(self) -> "Column":
        kept_values, kept_refs = [], []
        for cell in self.cells:
            if self._is_not_na(cell.value):
                kept_values.append(cell.value)
                kept_refs.append([cell.self_ref])
        src_ref = self._self_source_ref()
        return self._make_unattached_column(
            name=self.name, row_values=kept_values, per_row_refs=kept_refs,
            source_columns=[src_ref] if src_ref else [],
            # calculate is None — row count changes on rebuild, doesn't fit row-wise model
        )

    def clip(self, lower=None, upper=None) -> "Column":
        def _clip(v):
            if v is None or not isinstance(v, (int, float)):
                return v
            if lower is not None and v < lower:
                return lower
            if upper is not None and v > upper:
                return upper
            return v
        out = [_clip(v) for v in self.values()]
        src_ref = self._self_source_ref()
        return self._make_unattached_column(
            name=self.name, row_values=out,
            per_row_refs=[[c.self_ref] for c in self.cells],
            source_columns=[src_ref] if src_ref else [],
            calculate=(lambda srcs, i: _clip(srcs[0].cells[i].value)) if src_ref else None,
        )

    # ------------------------------------------------------------------
    #  Arithmetic / comparison / logical dunders
    # ------------------------------------------------------------------

    def __add__(self, other):       return self._binop(other, lambda a, b: a + b, "+")
    def __sub__(self, other):       return self._binop(other, lambda a, b: a - b, "-")
    def __mul__(self, other):       return self._binop(other, lambda a, b: a * b, "*")
    def __truediv__(self, other):   return self._binop(other, lambda a, b: (a / b) if b not in (0, None) else None, "/")
    def __floordiv__(self, other):  return self._binop(other, lambda a, b: (a // b) if b not in (0, None) else None, "//")
    def __mod__(self, other):       return self._binop(other, lambda a, b: (a % b) if b not in (0, None) else None, "%")
    def __pow__(self, other):       return self._binop(other, lambda a, b: a ** b, "**")

    def __radd__(self, other):      return self._binop(other, lambda a, b: b + a, "+",  reflected=True)
    def __rsub__(self, other):      return self._binop(other, lambda a, b: b - a, "-",  reflected=True)
    def __rmul__(self, other):      return self._binop(other, lambda a, b: b * a, "*",  reflected=True)
    def __rtruediv__(self, other):  return self._binop(other, lambda a, b: (b / a) if a not in (0, None) else None, "/", reflected=True)

    def __eq__(self, other):        return self._binop(other, lambda a, b: a == b, "==")
    def __ne__(self, other):        return self._binop(other, lambda a, b: a != b, "!=")
    def __lt__(self, other):        return self._binop(other, lambda a, b: (a is not None and b is not None and a <  b), "<")
    def __le__(self, other):        return self._binop(other, lambda a, b: (a is not None and b is not None and a <= b), "<=")
    def __gt__(self, other):        return self._binop(other, lambda a, b: (a is not None and b is not None and a >  b), ">")
    def __ge__(self, other):        return self._binop(other, lambda a, b: (a is not None and b is not None and a >= b), ">=")

    def __and__(self, other):       return self._binop(other, lambda a, b: bool(a) and bool(b), "&")
    def __or__(self, other):        return self._binop(other, lambda a, b: bool(a) or  bool(b), "|")

    def __invert__(self) -> "Column":
        out = [not bool(v) for v in self.values()]
        src_ref = self._self_source_ref()
        return self._make_unattached_column(
            name=f"~{self.name}", row_values=out,
            per_row_refs=[[c.self_ref] for c in self.cells],
            source_columns=[src_ref] if src_ref else [],
            calculate=(lambda srcs, i: not bool(srcs[0].cells[i].value)) if src_ref else None,
        )

    # Sets are unhashable to match Series semantics (so `col == val` returns a Column).
    __hash__ = None

    # ------------------------------------------------------------------
    #  Convenience
    # ------------------------------------------------------------------

    def __getitem__(self, row_idx: int) -> TableCell:
        return self.cells[row_idx]

    def __len__(self) -> int:
        return len(self.cells)

    def __iter__(self):
        for cell in self.cells:
            yield cell.value

    # ------------------------------------------------------------------
    #  Pretty-printing — same visual language as LineageFrame
    # ------------------------------------------------------------------

    def metadata(self) -> str:
        """
        Multi-line metadata block describing this column. Labels are
        colored turquoise. No trailing newline.
        """
        T, R = _TURQUOISE, _RESET
        frame_label = self.frame.report_id if self.frame is not None else "<unattached>"
        if self.cells and isinstance(self.cells[0], ReferencingTableCell):
            cell_kind = "ReferencingTableCell"
        elif self.cells:
            cell_kind = "TableCell"
        else:
            cell_kind = "<empty>"
        return (
            f"{T}Column:{R}     {self.name}\n"
            f"{T}Frame:{R}      {frame_label}\n"
            f"{T}Index:{R}      {self.index}\n"
            f"{T}Rows:{R}       {len(self.cells)}\n"
            f"{T}Cell type:{R}  {cell_kind}\n"
            f"{T}Sources:{R}    {len(self.source_columns)}    "
            f"{T}Dependents:{R} {len(self.dependent_columns)}    "
            f"{T}Calculate:{R}  {'yes' if self.calculate else 'no'}"
        )

    def to_string(self, max_rows: Optional[int] = None) -> str:
        """
        Render the column as a vertical list, pandas-Series style:
        metadata block at the top, blank separator, header row with the
        column name, blank separator, then row-indexed values. Hebrew
        cell values + the header are flipped via [::-1] so they render
        correctly in left-to-right consoles.
        """
        n_rows    = len(self.cells)
        show_rows = n_rows if max_rows is None else min(max_rows, n_rows)

        formatted = [_fmt_value(self.cells[i].value) for i in range(show_rows)]
        header    = _flip_if_hebrew(self.name)
        width     = len(header)
        for s in formatted:
            if len(s) > width:
                width = len(s)
        idx_width = max(len(str(show_rows - 1)) if show_rows > 0 else 1, 1)

        sep = "  "
        lines: List[str] = [self.metadata(), ""]

        # Header row.
        lines.append(sep.join([
            " " * idx_width,
            f"{_TURQUOISE}{header.rjust(width)}{_RESET}",
        ]))
        lines.append("")

        for i in range(show_rows):
            idx_str = str(i).rjust(idx_width)
            lines.append(sep.join([
                f"{_TURQUOISE}{idx_str}{_RESET}",
                formatted[i].rjust(width),
            ]))

        if max_rows is not None and n_rows > show_rows:
            lines.append(f"\n[showing first {show_rows} of {n_rows} rows]")

        return "\n".join(lines)

    def head(self, n: int = 5) -> str:
        """First `n` rows of the column, formatted via `to_string`."""
        return self.to_string(max_rows=n)

    def __str__(self) -> str:
        return self.to_string()

    def __repr__(self):
        return (
            f"Column(name={self.name!r}, index={self.index}, "
            f"rows={len(self.cells)}, "
            f"sources={len(self.source_columns)}, "
            f"dependents={len(self.dependent_columns)})"
        )

    # ------------------------------------------------------------------
    #  Internals
    # ------------------------------------------------------------------

    def _binop(self, other, op, op_name: str, reflected: bool = False) -> "Column":
        n = len(self.cells)
        is_col = isinstance(other, Column)
        other_vals = other.values() if is_col else [other] * n
        if is_col and len(other_vals) != n:
            raise ValueError(f"Length mismatch in {op_name}: {n} vs {len(other_vals)}")
        out, refs = [], []
        for i in range(n):
            a, b = self.cells[i].value, other_vals[i]
            try:
                out.append(op(a, b))
            except (TypeError, ZeroDivisionError):
                out.append(None)
            r = [self.cells[i].self_ref]
            if is_col:
                r.append(other.cells[i].self_ref)
            refs.append(r)

        # Source columns + calculate (only when sources are attached).
        sources: List[Tuple[int, int]] = []
        self_ref  = self._self_source_ref()
        other_ref = other._self_source_ref() if is_col else None
        if self_ref:
            sources.append(self_ref)
        if is_col and other_ref:
            sources.append(other_ref)

        calculate = None
        if is_col and self_ref and other_ref:
            calculate = lambda srcs, i, _op=op: _op(srcs[0].cells[i].value, srcs[1].cells[i].value)
        elif (not is_col) and self_ref:
            _b = other
            calculate = lambda srcs, i, _op=op, _b=_b: _op(srcs[0].cells[i].value, _b)

        other_label = getattr(other, "name", other)
        return self._make_unattached_column(
            name=f"({self.name}{op_name}{other_label})",
            row_values=out, per_row_refs=refs,
            source_columns=sources, calculate=calculate,
        )

    def _coerce_cond(self, condition) -> list:
        if isinstance(condition, Column):
            return condition.values()
        if callable(condition):
            return [bool(condition(c.value)) for c in self.cells]
        return [bool(condition)] * len(self.cells)

    def _coerce_other(self, other) -> list:
        if isinstance(other, _Missing):
            return [None] * len(self.cells)
        if isinstance(other, Column):
            return other.values()
        return [other] * len(self.cells)

    @staticmethod
    def _is_not_na(v) -> bool:
        if v is None:
            return False
        try:
            return not (isinstance(v, float) and v != v)
        except TypeError:
            return True

    @staticmethod
    def _collect_sources(*candidates) -> List[Tuple[int, int]]:
        sources = []
        for c in candidates:
            if isinstance(c, Column):
                ref = c._self_source_ref()
                if ref:
                    sources.append(ref)
        return sources
