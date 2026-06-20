"""
GroupBy — intermediate produced by `LineageFrame.groupby(by)`.

Supports `.agg(spec)` where `spec` is a dict of `{col_name: agg_name}` or
a single agg name applied to every non-key column. Supported agg names:
'sum', 'mean', 'min', 'max', 'count', 'first', 'last'.

Each aggregated cell is a ReferencingTableCell whose `references` list
contains the source cells that were grouped together for that output row.
Group-key cells become ReferencingTableCells pointing at the first source
cell in the group.
"""
from typing import Dict, List, Tuple, Union

from LineageFrame.cell   import CellReference, ReferencingTableCell, TableCell
from LineageFrame.column import Column


class GroupBy:
    def __init__(self, frame, by: List[str], dropna: bool = True):
        self.frame  = frame
        self.by     = list(by)
        self.dropna = dropna
        self._groups: Dict[Tuple, List[int]] = self._build_groups()

    # ------------------------------------------------------------------
    def _build_groups(self) -> Dict[Tuple, List[int]]:
        key_cols = [self.frame[name] for name in self.by]
        groups: Dict[Tuple, List[int]] = {}
        n_rows = len(self.frame)
        for row_idx in range(n_rows):
            key = tuple(c.cells[row_idx].value for c in key_cols)
            if self.dropna and any(v is None or (isinstance(v, float) and v != v) for v in key):
                continue
            groups.setdefault(key, []).append(row_idx)
        return groups

    # ------------------------------------------------------------------
    def agg(self, spec: Union[str, Dict[str, str]]):
        """
        Run an aggregation. Returns a new LineageFrame whose rows are the
        groups (in insertion order) and whose columns are the group keys
        followed by the aggregated columns.
        """
        from LineageFrame.frame import LineageFrame

        # Normalize spec to dict.
        if isinstance(spec, str):
            spec_dict = {c.name: spec for c in self.frame.columns if c.name not in self.by}
        else:
            spec_dict = dict(spec)

        # Build output frame, ungrouped first.
        out_id = f"{self.frame.report_id}.groupby({','.join(self.by)})"
        out_frame = LineageFrame(out_id, self.frame.manager, translucent=True)

        # Build columns in this order: keys first, then agg columns.
        agg_col_names = list(spec_dict.keys())

        # Output rows per group.
        group_keys = list(self._groups.keys())
        n_out = len(group_keys)

        # Resolve source Column objects up front.
        key_source_cols = [self.frame[name] for name in self.by]
        agg_source_cols = [self.frame[name] for name in agg_col_names]

        # --- Build key columns -------------------------------------------------
        for k_idx, key_name in enumerate(self.by):
            src = key_source_cols[k_idx]
            per_row_refs = []
            row_values   = []
            for g_idx, key_tuple in enumerate(group_keys):
                first_row = self._groups[key_tuple][0]
                row_values.append(key_tuple[k_idx])
                per_row_refs.append(src.cells[first_row].contrib_refs())
            out_frame[key_name] = src._make_unattached_column(
                name=key_name, row_values=row_values, per_row_refs=per_row_refs,
            )

        # --- Build agg columns -------------------------------------------------
        for a_idx, agg_name in enumerate(agg_col_names):
            src = agg_source_cols[a_idx]
            kind = spec_dict[agg_name]
            row_values = []
            per_row_refs = []
            for g_idx, key_tuple in enumerate(group_keys):
                rows = self._groups[key_tuple]
                values = [src.cells[r].value for r in rows]
                refs   = []
                for r in rows:
                    refs.extend(src.cells[r].contrib_refs())
                row_values.append(self._reduce(values, kind))
                per_row_refs.append(refs)
            out_frame[agg_name] = src._make_unattached_column(
                name=agg_name, row_values=row_values, per_row_refs=per_row_refs,
            )

        return out_frame

    # ------------------------------------------------------------------
    @staticmethod
    def _reduce(values: list, kind: str):
        nums = [v for v in values if isinstance(v, (int, float)) and v == v]
        if kind == "sum":
            return sum(nums)
        if kind == "mean":
            return (sum(nums) / len(nums)) if nums else None
        if kind == "min":
            return min(nums) if nums else None
        if kind == "max":
            return max(nums) if nums else None
        if kind == "count":
            return len([v for v in values if v is not None and not (isinstance(v, float) and v != v)])
        if kind == "first":
            return values[0] if values else None
        if kind == "last":
            return values[-1] if values else None
        raise ValueError(f"Unknown aggregation: {kind!r}")

    # ------------------------------------------------------------------
    # Convenience direct accessors so you can write
    #   frame.groupby("x").sum()
    # ------------------------------------------------------------------
    def sum(self):   return self.agg("sum")
    def mean(self):  return self.agg("mean")
    def min(self):   return self.agg("min")
    def max(self):   return self.agg("max")
    def count(self): return self.agg("count")
    def first(self): return self.agg("first")
    def last(self):  return self.agg("last")
