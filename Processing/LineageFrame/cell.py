"""
Cell primitives for the LineageFrame stack.

Three classes, all `__slots__`:

  CellReference          — (report_idx, column_idx, row_idx, value) snapshot.
  TableCell              — wraps one CellReference, exposing .value.
  ReferencingTableCell   — TableCell + a list of upstream CellReferences.

Every class also has a `pretty()` method that returns a fully-decorated
multi-line string showing all of its data (Hebrew values are flipped via
[::-1] so the Windows console renders them in the correct reading order).
`__str__` delegates to `pretty()`, so `print(cell)` Just Works.
"""

from typing import List


# ANSI colors — same palette as Column / LineageFrame.
_TURQUOISE = "\033[96m"
_RESET     = "\033[0m"


def _has_hebrew(s: str) -> bool:
    for ch in s:
        if '֐' <= ch <= '׿':
            return True
    return False


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
    return s[::-1] if _has_hebrew(s) else s


# ---------------------------------------------------------------------------
# CellReference
# ---------------------------------------------------------------------------

class CellReference:
    __slots__ = ("report_idx", "column_idx", "row_idx", "value")

    def __init__(self, report_idx: int, column_idx: int, row_idx: int, value):
        self.report_idx = report_idx
        self.column_idx = column_idx
        self.row_idx    = row_idx
        self.value      = value

    # -- pretty-printing -------------------------------------------------

    def pretty(self) -> str:
        """One-line, fully labeled, colored. Used inline by the cell classes."""
        T, R = _TURQUOISE, _RESET
        return (
            f"{T}r={R}{self.report_idx}  "
            f"{T}c={R}{self.column_idx}  "
            f"{T}i={R}{self.row_idx}  "
            f"{T}v={R}{_fmt_value(self.value)}"
        )

    def __str__(self) -> str:
        return self.pretty()

    def __repr__(self) -> str:
        return (
            f"CellRef(r={self.report_idx}, c={self.column_idx}, "
            f"i={self.row_idx}, v={self.value!r})"
        )


# ---------------------------------------------------------------------------
# TableCell
# ---------------------------------------------------------------------------

class TableCell:
    __slots__ = ("self_ref",)

    def __init__(self, self_ref: CellReference):
        self.self_ref = self_ref

    @property
    def value(self):
        return self.self_ref.value

    @value.setter
    def value(self, new_value):
        self.self_ref.value = new_value

    def contrib_refs(self):
        """
        The lineage-cells whose values entered THIS cell's value, ready
        to be embedded in a downstream cell's `references` list.

        - Attached cell (in a frame with a real report_idx): returns
          `[self.self_ref]` — this cell IS the source.
        - Unattached cell (intermediate from an op chain whose frame is
          not yet a registered LineageFrame): returns the existing
          `references` list, transitively bypassing the intermediate so
          downstream refs never point at unresolvable (-1, -1) cells.

        Plain TableCells have no `references`, so unattached TableCells
        return [] — but that's fine; arithmetic helpers always produce
        ReferencingTableCells, so this branch is only hit by raw inputs.
        """
        if self.self_ref.report_idx >= 0:
            return [self.self_ref]
        return list(getattr(self, "references", []) or [])

    # -- pretty-printing -------------------------------------------------

    def pretty(self) -> str:
        """
        Multi-line dump of the cell:
          TableCell
            self_ref: r=… c=… i=… v=…
            value:    <value>
        """
        T, R = _TURQUOISE, _RESET
        return (
            f"{T}TableCell{R}\n"
            f"  {T}self_ref:{R} {self.self_ref.pretty()}\n"
            f"  {T}value:{R}    {_fmt_value(self.value)}"
        )

    def __str__(self) -> str:
        return self.pretty()

    def __repr__(self) -> str:
        return f"TableCell({self.self_ref!r})"


# ---------------------------------------------------------------------------
# ReferencingTableCell
# ---------------------------------------------------------------------------

class ReferencingTableCell(TableCell):
    __slots__ = ("references",)

    def __init__(self, self_ref: CellReference, references: List[CellReference]):
        super().__init__(self_ref)
        self.references = references

    # -- pretty-printing -------------------------------------------------

    def pretty(self) -> str:
        """
        Multi-line dump of the cell, INCLUDING every upstream reference:

          ReferencingTableCell
            self_ref:   r=… c=… i=… v=…
            value:      <value>
            references (N):
              [0]  r=… c=… i=… v=…
              [1]  r=… c=… i=… v=…
              ...
        """
        T, R = _TURQUOISE, _RESET
        lines = [
            f"{T}ReferencingTableCell{R}",
            f"  {T}self_ref:{R}   {self.self_ref.pretty()}",
            f"  {T}value:{R}      {_fmt_value(self.value)}",
            f"  {T}references{R} ({len(self.references)}):",
        ]
        if not self.references:
            lines.append("    <none>")
        else:
            width = len(str(len(self.references) - 1))
            for i, ref in enumerate(self.references):
                idx_str = str(i).rjust(width)
                lines.append(f"    {T}[{idx_str}]{R}  {ref.pretty()}")
        return "\n".join(lines)

    def __str__(self) -> str:
        return self.pretty()

    def __repr__(self) -> str:
        return (
            f"ReferencingTableCell({self.self_ref!r}, "
            f"refs={len(self.references)})"
        )
