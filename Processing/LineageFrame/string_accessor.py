"""
StringAccessor — mimics pandas' `Series.str` namespace.

Lets you write `col.str.strip()`, `col.str.replace("a", "b")`, etc., and
get back a new Column whose lineage points at the source column's cells.
"""


class StringAccessor:
    """
    Thin wrapper around a Column that exposes string-ops as methods.

    Each method returns a new (unattached) Column produced by applying the
    corresponding Python string operation to every cell's value. Non-string
    values are coerced via `str(...)`.
    """

    def __init__(self, column):
        self._column = column

    # ------------------------------------------------------------------
    #  Helpers
    # ------------------------------------------------------------------

    def _map(self, fn, *, name_suffix: str):
        """Apply `fn` to each cell value; return a new Column via Column.apply."""
        col = self._column
        return col.apply(
            lambda v: fn(v if isinstance(v, str) else str(v)) if v is not None else v,
            new_name=f"{col.name}.str{name_suffix}",
        )

    # ------------------------------------------------------------------
    #  Common string ops
    # ------------------------------------------------------------------

    def strip(self):
        return self._map(lambda s: s.strip(), name_suffix=".strip()")

    def lstrip(self):
        return self._map(lambda s: s.lstrip(), name_suffix=".lstrip()")

    def rstrip(self):
        return self._map(lambda s: s.rstrip(), name_suffix=".rstrip()")

    def lower(self):
        return self._map(lambda s: s.lower(), name_suffix=".lower()")

    def upper(self):
        return self._map(lambda s: s.upper(), name_suffix=".upper()")

    def replace(self, old, new, n=-1):
        return self._map(
            lambda s: s.replace(old, new) if n < 0 else s.replace(old, new, n),
            name_suffix=f".replace({old!r},{new!r})",
        )

    def contains(self, substring, case=True):
        if case:
            return self._map(lambda s: substring in s, name_suffix=f".contains({substring!r})")
        return self._map(
            lambda s: substring.lower() in s.lower(),
            name_suffix=f".contains({substring!r},case=False)",
        )

    def startswith(self, prefix):
        return self._map(lambda s: s.startswith(prefix), name_suffix=f".startswith({prefix!r})")

    def endswith(self, suffix):
        return self._map(lambda s: s.endswith(suffix), name_suffix=f".endswith({suffix!r})")

    def split(self, sep=None, maxsplit=-1):
        return self._map(
            lambda s: s.split(sep, maxsplit) if maxsplit >= 0 else s.split(sep),
            name_suffix=f".split({sep!r})",
        )

    def len(self):
        return self._map(lambda s: len(s), name_suffix=".len()")

    def cat(self, others=None, sep=""):
        """Concatenate strings element-wise with another column or list."""
        col = self._column
        if others is None:
            return col
        # Treat `others` as a sequence of equal length
        out_cells = []
        for i, cell in enumerate(col.cells):
            left  = cell.value if isinstance(cell.value, str) else str(cell.value)
            right = others[i] if not hasattr(others, "cells") else others.cells[i].value
            right = right if isinstance(right, str) else str(right)
            out_cells.append(left + sep + right)
        return col._make_unattached_column(
            name=f"{col.name}.str.cat()",
            row_values=out_cells,
            per_row_refs=[cell.contrib_refs() for cell in col.cells],
        )
