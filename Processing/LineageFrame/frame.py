"""
LineageFrame — the DataFrame analog that owns a set of Columns and registers
itself with a LineageManager so cross-frame CellReferences can resolve.

Typical lifecycle:
  1. Aggregation/derived constructor produces a pandas DataFrame.
  2. `LineageFrame.from_pandas(df, report_id, manager)` wraps it: every cell
     becomes a raw TableCell, and the frame self-registers in `manager`
     (acquiring a report_idx).
  3. For derived reports, the constructor then walks the columns and
     attaches `source_columns` + `calculate` callables to convert raw
     TableCells into ReferencingTableCells, threading the lineage chain.
  4. The owning Report instance drops its pandas DataFrame.
"""
from typing import Dict, List, Optional, Tuple

import pandas as pd

from LineageFrame.cell   import CellReference, TableCell
from LineageFrame.column import Column


# ANSI colors used by to_string / metadata for header + row-index emphasis.
_TURQUOISE = "\033[96m"      # bright cyan ≈ turquoise on most terminals
_RESET     = "\033[0m"


class LineageFrame:
    def __init__(self, report_id: str, manager):
        self.report_id      = report_id
        self.report_idx     = -1            # set by manager.register
        self.manager        = manager       # LineageManager (single source of truth)
        self.columns        = []            # list[Column]
        self._name_to_index = {}            # dict[str, int]
        manager.register(self)              # populates self.report_idx


    @classmethod
    def from_pandas(cls, df: pd.DataFrame, report_id: str, manager) -> "LineageFrame":
        """
        Build a LineageFrame from a pandas DataFrame.

        Every cell becomes a raw TableCell — no upstream lineage, no
        recompute callable. The frame self-registers in `manager`, so its
        `report_idx` is valid by the time this returns.
        """
        frame = cls(report_id, manager)

        for column_idx, column_name in enumerate(df.columns):
            series = df[column_name].tolist()
            cells = [
                TableCell(
                    CellReference(frame.report_idx, column_idx, row_idx, value))
                for row_idx, value in enumerate(series)
            ]
            frame.add_column(Column(
                name=str(column_name),
                index=column_idx,
                cells=cells,
                frame=frame,
            ))

        return frame

    # ------------------------------------------------------------------
    #  Column management
    # ------------------------------------------------------------------

    def add_column(self, column: Column) -> None:
        """Append a Column. Caller is responsible for setting column.index correctly."""
        column.frame = self
        self.columns.append(column)
        self._name_to_index[column.name] = column.index

    def get_column(self, name: str) -> Column:
        idx = self._name_to_index[name]
        return self.columns[idx]

    def __getitem__(self, key):
        """
        Three accessor modes (pandas-style):
          - string         → Column
          - list of strings → projection sub-frame
          - boolean Column → row-filtered sub-frame
        """
        if isinstance(key, str):
            return self.get_column(key)
        if isinstance(key, list) and all(isinstance(k, str) for k in key):
            return self._project(key)
        if isinstance(key, Column):
            keep_rows = [i for i, v in enumerate(key.values()) if bool(v)]
            return self._slice_rows(keep_rows, "filter")
        raise TypeError(f"LineageFrame[]: unsupported key {type(key)}")

    def __setitem__(self, name: str, column_or_values) -> None:
        """
        Assign a column. Accepts:
          - a Column (lineage flows through),
          - a list / pandas Series / tuple (raw values → leaf TableCells),
          - a scalar (broadcast).

        Rewires self_refs on the new cells, then registers this column as
        a dependent of each of its source columns so cascade flows correctly.
        """
        if isinstance(column_or_values, Column):
            col = column_or_values
        elif hasattr(column_or_values, "tolist"):
            col = self._column_from_list(name, list(column_or_values.tolist()))
        elif isinstance(column_or_values, (list, tuple)):
            col = self._column_from_list(name, list(column_or_values))
        else:
            n = self.row_count() if self.columns else 0
            col = self._column_from_list(name, [column_or_values] * n)

        col.name = name
        if name in self._name_to_index:
            existing_idx = self._name_to_index[name]
            col.index = existing_idx
            self._rewrite_self_refs(col, existing_idx)
            col.frame = self
            self.columns[existing_idx] = col
        else:
            new_idx = len(self.columns)
            col.index = new_idx
            self._rewrite_self_refs(col, new_idx)
            col.frame = self
            self.columns.append(col)
            self._name_to_index[name] = new_idx

        # Register dependency edges on the source columns so that mutations
        # cascade FROM source TO this new column.
        for src_report_idx, src_col_idx in col.source_columns:
            src_col = self.manager.resolve_column(src_report_idx, src_col_idx)
            if src_col is None:
                continue
            edge = (self.report_idx, col.index)
            if edge not in src_col.dependent_columns:
                src_col.dependent_columns.append(edge)

        # Table invariant: every column in the frame must have the same
        # number of cells. If this assignment introduced a mismatch (the
        # new column is shorter or longer than the existing ones), pad
        # the short side with empty-reference cells up to the new max.
        self._normalize_row_count()

    def __contains__(self, name: str) -> bool:
        return name in self._name_to_index

    def column_names(self) -> List[str]:
        return [c.name for c in self.columns]

    def row_count(self) -> int:
        return len(self.columns[0].cells) if self.columns else 0

    def __len__(self) -> int:
        return self.row_count()

    @property
    def shape(self) -> Tuple[int, int]:
        return (self.row_count(), len(self.columns))

    @property
    def empty(self) -> bool:
        return self.row_count() == 0

    # ------------------------------------------------------------------
    #  Pandas-mimic mutations (all produce ReferencingTableCells via Column._make_unattached_column)
    # ------------------------------------------------------------------

    def copy(self) -> "LineageFrame":
        new = LineageFrame(f"{self.report_id}.copy", self.manager)
        for col in self.columns:
            new[col.name] = col.copy()
        return new

    def assign(self, **kwargs) -> "LineageFrame":
        new = self.copy()
        for name, value in kwargs.items():
            new[name] = value
        return new

    def drop(self, columns: Optional[List[str]] = None) -> "LineageFrame":
        cols = columns or []
        keep = [c.name for c in self.columns if c.name not in cols]
        return self._project(keep)

    def rename(self, columns: Optional[Dict[str, str]] = None, inplace: bool = False) -> "LineageFrame":
        renames = columns or {}
        target = self if inplace else self.copy()
        new_map: Dict[str, int] = {}
        for col in target.columns:
            new_name = renames.get(col.name, col.name)
            col.name = new_name
            new_map[new_name] = col.index
        target._name_to_index = new_map
        return target

    def dropna(self, subset: Optional[List[str]] = None) -> "LineageFrame":
        cols_to_check = subset or self.column_names()
        keep_rows = []
        for i in range(self.row_count()):
            ok = True
            for name in cols_to_check:
                v = self[name].cells[i].value
                if v is None or (isinstance(v, float) and v != v):
                    ok = False
                    break
            if ok:
                keep_rows.append(i)
        return self._slice_rows(keep_rows, "dropna")

    def drop_duplicates(self, subset: Optional[List[str]] = None) -> "LineageFrame":
        cols_to_check = subset or self.column_names()
        seen = set()
        keep_rows = []
        for i in range(self.row_count()):
            key = tuple(self[name].cells[i].value for name in cols_to_check)
            if key not in seen:
                seen.add(key)
                keep_rows.append(i)
        return self._slice_rows(keep_rows, "drop_duplicates")

    def fillna(self, value) -> "LineageFrame":
        new = self.copy()
        for col in new.columns:
            new[col.name] = col.fillna(value)
        return new

    def where(self, condition: Column, other=None) -> "LineageFrame":
        new = self.copy()
        for col in new.columns:
            new[col.name] = col.where(condition, other if other is not None else None)
        return new

    def iterrows(self):
        for i in range(self.row_count()):
            yield i, {c.name: c.cells[i].value for c in self.columns}

    # ------------------------------------------------------------------
    #  Groupby / merge
    # ------------------------------------------------------------------

    def groupby(self, by, dropna: bool = True):
        from LineageFrame.groupby import GroupBy
        by_list = [by] if isinstance(by, str) else list(by)
        return GroupBy(self, by_list, dropna=dropna)

    def merge(
        self,
        other: "LineageFrame",
        on=None,
        left_on=None,
        right_on=None,
        how: str = "inner",
        suffixes: Tuple[str, str] = ("_x", "_y"),
    ) -> "LineageFrame":
        if on is not None:
            left_keys  = [on] if isinstance(on, str) else list(on)
            right_keys = list(left_keys)
        else:
            left_keys  = [left_on]  if isinstance(left_on,  str) else list(left_on  or [])
            right_keys = [right_on] if isinstance(right_on, str) else list(right_on or [])
        if not left_keys or len(left_keys) != len(right_keys):
            raise ValueError("merge: must pass `on` or matching left_on/right_on")

        # Right-side index for fast lookup.
        right_idx: Dict[Tuple, List[int]] = {}
        for i in range(other.row_count()):
            key = tuple(other[k].cells[i].value for k in right_keys)
            right_idx.setdefault(key, []).append(i)

        right_only_cols = [c for c in other.column_names() if c not in right_keys]
        overlap = set(self.column_names()) & set(right_only_cols)
        sx, sy = suffixes

        out = LineageFrame(f"{self.report_id}.merge({other.report_id})", self.manager)

        plan: List[Tuple[str, str, str]] = []
        for c in self.column_names():
            out_name = c + sx if c in overlap else c
            plan.append((out_name, "left",  c))
        for c in right_only_cols:
            out_name = c + sy if c in overlap else c
            plan.append((out_name, "right", c))

        out_rows: List[Tuple[Optional[int], Optional[int]]] = []
        for l in range(self.row_count()):
            key = tuple(self[k].cells[l].value for k in left_keys)
            matches = right_idx.get(key, [])
            if matches:
                for r in matches:
                    out_rows.append((l, r))
            elif how in ("left", "outer"):
                out_rows.append((l, None))
        if how in ("right", "outer"):
            seen_right = {r for _, r in out_rows if r is not None}
            for _, idxs in right_idx.items():
                for r in idxs:
                    if r not in seen_right:
                        out_rows.append((None, r))

        for out_name, side, src_name in plan:
            row_values, per_row_refs = [], []
            for l, r in out_rows:
                if side == "left":
                    if l is None:
                        row_values.append(None); per_row_refs.append([])
                    else:
                        cell = self[src_name].cells[l]
                        row_values.append(cell.value); per_row_refs.append([cell.self_ref])
                else:
                    if r is None:
                        row_values.append(None); per_row_refs.append([])
                    else:
                        cell = other[src_name].cells[r]
                        row_values.append(cell.value); per_row_refs.append([cell.self_ref])
            vehicle = self.columns[0] if self.columns else other.columns[0]
            out[out_name] = vehicle._make_unattached_column(
                name=out_name, row_values=row_values, per_row_refs=per_row_refs,
            )

        return out

    # ------------------------------------------------------------------
    #  Internals
    # ------------------------------------------------------------------

    def _project(self, col_names: List[str]) -> "LineageFrame":
        sub = LineageFrame(f"{self.report_id}.proj", self.manager)
        for name in col_names:
            sub[name] = self[name].copy()
        return sub

    def _slice_rows(self, row_indices: List[int], label: str) -> "LineageFrame":
        new = LineageFrame(f"{self.report_id}.{label}", self.manager)
        for col in self.columns:
            row_values   = [col.cells[i].value for i in row_indices]
            per_row_refs = [[col.cells[i].self_ref] for i in row_indices]
            new[col.name] = col._make_unattached_column(
                name=col.name, row_values=row_values, per_row_refs=per_row_refs,
            )
        return new

    def _column_from_list(self, name: str, values: list) -> Column:
        """Build a leaf Column (TableCells, no lineage) from raw values."""
        cells = []
        for row_idx, value in enumerate(values):
            sr = CellReference(-1, -1, row_idx, value)
            cells.append(TableCell(sr))
        return Column(name=name, index=-1, cells=cells)

    def _rewrite_self_refs(self, col: Column, column_idx: int) -> None:
        """Rewrite every cell's self_ref so report_idx/column_idx point here."""
        for row_idx, cell in enumerate(col.cells):
            sr = cell.self_ref
            sr.report_idx = self.report_idx
            sr.column_idx = column_idx
            sr.row_idx    = row_idx

    # ------------------------------------------------------------------
    #  Table-shape invariant
    # ------------------------------------------------------------------

    def _pad_column(self, col: Column, target_len: int) -> None:
        """
        Append empty-reference padding cells to `col` until it reaches
        `target_len`. Padding cells are `ReferencingTableCell`s with a
        None value and an empty `references` list — they were synthesized
        by a size-changing op, not provided by the user.
        """
        from LineageFrame.cell import ReferencingTableCell  # local: avoid cycles
        current = len(col.cells)
        if current >= target_len:
            return
        for row_idx in range(current, target_len):
            sr = CellReference(self.report_idx, col.index, row_idx, None)
            col.cells.append(ReferencingTableCell(sr, []))

    def _normalize_row_count(self) -> None:
        """
        Enforce the table invariant: every column has the same number of
        cells. Pads every short column up to the longest column's length.
        """
        if not self.columns:
            return
        target = max(len(c.cells) for c in self.columns)
        for col in self.columns:
            self._pad_column(col, target)

    # ------------------------------------------------------------------
    #  Pretty-printing — pandas-style
    # ------------------------------------------------------------------

    def metadata(self) -> str:
        """
        Return a four-line metadata block describing this frame.

        Labels (`Report:`, `Index:`, `Columns:`, `Rows:`) are colored
        turquoise. The block does NOT end with a trailing newline so it
        composes cleanly into any larger output.
        """
        T = _TURQUOISE
        R = _RESET
        return (
            f"{T}Report:{R}  {self.report_id}\n"
            f"{T}Index:{R}   {self.report_idx}\n"
            f"{T}Columns:{R} {len(self.columns)}\n"
            f"{T}Rows:{R}    {self.row_count()}"
        )

    def to_string(self, max_rows=None) -> str:
        """
        Render the whole frame as a formatted string, pandas-style:
        row indices on the left, column names as a header row,
        every cell right-aligned within its column.

        Strings containing Hebrew characters are reversed via [::-1] so
        the Windows console (which renders bytes left-to-right) shows
        them in the correct reading order.

        If `max_rows` is given, only the first that many rows are shown
        and a trailing summary line reports how many were truncated.
        """
        if not self.columns:
            return (
                f"Empty LineageFrame\n"
                f"Columns: []\n"
                f"Index: []"
            )

        n_rows = self.row_count()
        show_rows = n_rows if max_rows is None else min(max_rows, n_rows)

        # Hebrew detection: any character in the Hebrew Unicode block
        # (U+0590..U+05FF) triggers a flip for terminal display.
        def _has_hebrew(s: str) -> bool:
            for ch in s:
                if '֐' <= ch <= '׿':
                    return True
            return False

        def _flip_if_hebrew(s: str) -> str:
            return s[::-1] if _has_hebrew(s) else s

        # Format every cell value into a string for measurement + display.
        def _fmt(v):
            if v is None:
                return "NaN"
            if isinstance(v, float):
                if v != v:                  # NaN
                    return "NaN"
                if v == int(v):             # whole number → "1.0" style
                    return f"{int(v)}.0"
                return f"{v:.6g}"
            s = str(v)
            return _flip_if_hebrew(s)

        # Per-column: collect the formatted string for each row + the header.
        # Compute the column width as max(header, widest value).
        # Reversed strings have the same length as originals, so the widths
        # we compute are still correct after flipping.
        col_strings: List[List[str]] = []
        col_widths:  List[int]       = []
        col_headers: List[str]       = []
        for col in self.columns:
            formatted    = [_fmt(col.cells[i].value) for i in range(show_rows)]
            header_label = _flip_if_hebrew(col.name)
            col_strings.append(formatted)
            col_headers.append(header_label)
            width = len(header_label)
            for s in formatted:
                if len(s) > width:
                    width = len(s)
            col_widths.append(width)

        # Row-index column width: enough digits to hold the largest index.
        idx_width = max(len(str(show_rows - 1)) if show_rows > 0 else 1, 1)

        # Start the output with the metadata block + a blank separator line.
        sep = "  "
        lines: List[str] = [self.metadata(), ""]

        # Build header line — left padding for the row-index column.
        # Color the column-name cells turquoise (apply AFTER rjust so the
        # width math doesn't get fooled by the ANSI escape characters).
        header_cells = [" " * idx_width]
        for header_label, width in zip(col_headers, col_widths):
            padded = header_label.rjust(width)
            header_cells.append(f"{_TURQUOISE}{padded}{_RESET}")
        lines.append(sep.join(header_cells))

        # One-row gap between the header and the data rows.
        lines.append("")

        # Build each data row. Row indices are colored turquoise too.
        for i in range(show_rows):
            idx_str = str(i).rjust(idx_width)
            row_cells = [f"{_TURQUOISE}{idx_str}{_RESET}"]
            for formatted, width in zip(col_strings, col_widths):
                row_cells.append(formatted[i].rjust(width))
            lines.append(sep.join(row_cells))

        # Trailing notice ONLY when we truncated; otherwise the metadata
        # block already conveys the full row/column count.
        if max_rows is not None and n_rows > show_rows:
            lines.append(
                f"\n[showing first {show_rows} of {n_rows} rows]"
            )

        return "\n".join(lines)

    def head(self, n: int = 5) -> str:
        """
        Return a formatted string of the first `n` rows of the frame
        (defaults to 5, same as pandas). Same layout as `to_string`.

        Call `print(frame.head())` to see it in the console.
        """
        return self.to_string(max_rows=n)

    def __str__(self) -> str:
        return self.to_string()

    def __repr__(self):
        return (
            f"LineageFrame(report_id={self.report_id!r}, "
            f"report_idx={self.report_idx}, "
            f"columns={len(self.columns)}, "
            f"rows={self.row_count()})"
        )
