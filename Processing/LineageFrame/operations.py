"""
Module-level helpers that mirror pandas / numpy functions whose pandas
counterparts are functions, not methods:

  concat(frames, axis=0, ignore_index=True)   — pd.concat
  to_numeric(column, errors='coerce')         — pd.to_numeric
  where(condition, true_val, false_val)       — np.where
"""
from typing import List, Union

from LineageFrame.cell   import CellReference, ReferencingTableCell, TableCell
from LineageFrame.column import Column


# ---------------------------------------------------------------------------
# concat
# ---------------------------------------------------------------------------

def concat(frames: List, axis: int = 0, ignore_index: bool = True, sort: bool = False):
    """
    Stack LineageFrames vertically (axis=0) and return a new frame.

    The result is registered in the manager of the FIRST frame in the list.
    Columns are unioned by name; missing values become None. Each output
    cell carries a reference back to the source cell it came from.
    """
    from LineageFrame.frame import LineageFrame

    if not frames:
        raise ValueError("concat() needs at least one frame")
    if axis != 0:
        raise NotImplementedError("Only axis=0 (vertical) concat is implemented")

    manager = frames[0].manager
    out = LineageFrame(f"concat({len(frames)})", manager)

    # Union of column names, preserving first-seen order.
    seen = set()
    all_cols: List[str] = []
    for f in frames:
        for name in f.column_names():
            if name not in seen:
                seen.add(name)
                all_cols.append(name)
    if sort:
        all_cols = sorted(all_cols)

    for col_name in all_cols:
        row_values = []
        per_row_refs = []
        for f in frames:
            if col_name in f:
                src = f[col_name]
                for cell in src.cells:
                    row_values.append(cell.value)
                    per_row_refs.append(cell.contrib_refs())
            else:
                # column absent in this frame → emit Nones for its row count
                pad = f.row_count()
                row_values.extend([None] * pad)
                per_row_refs.extend([[] for _ in range(pad)])
        # Use the first frame's first column as a vehicle for the helper.
        vehicle = frames[0].columns[0] if frames[0].columns else None
        if vehicle is None:
            # build manually
            new_col = _build_unattached(col_name, row_values, per_row_refs)
        else:
            new_col = vehicle._make_unattached_column(
                name=col_name, row_values=row_values, per_row_refs=per_row_refs,
            )
        out[col_name] = new_col

    return out


# ---------------------------------------------------------------------------
# to_numeric
# ---------------------------------------------------------------------------

def to_numeric(column: Column, errors: str = "raise") -> Column:
    """
    pd.to_numeric(column, errors='coerce' | 'raise' | 'ignore').

    Returns a new (unattached) Column. Each cell's value is converted to
    int/float; on failure: 'coerce' → None, 'raise' → raise, 'ignore' →
    keep original.
    """
    def _conv(v):
        if v is None:
            return None
        if isinstance(v, (int, float)) and not (isinstance(v, float) and v != v):
            return v
        try:
            s = str(v).replace(",", "")
            return float(s) if "." in s else int(s)
        except (TypeError, ValueError):
            if errors == "raise":
                raise
            if errors == "ignore":
                return v
            return None

    out_values = [_conv(c.value) for c in column.cells]
    return column._make_unattached_column(
        name=column.name, row_values=out_values,
        per_row_refs=[c.contrib_refs() for c in column.cells],
    )


# ---------------------------------------------------------------------------
# where (np.where)
# ---------------------------------------------------------------------------

def where(condition: Column, true_val, false_val) -> Column:
    """
    np.where(condition, true_val, false_val) → Column.

    `condition` must be a Column.
    `true_val` and `false_val` can each be a Column or a scalar.
    """
    n = len(condition.cells)
    is_t_col = isinstance(true_val,  Column)
    is_f_col = isinstance(false_val, Column)
    t_vals = true_val.values()  if is_t_col else [true_val]  * n
    f_vals = false_val.values() if is_f_col else [false_val] * n
    out, refs = [], []
    for i in range(n):
        # Condition cells are NOT refs — they determine which BRANCH the
        # value comes from, they don't contribute to the value itself.
        if bool(condition.cells[i].value):
            out.append(t_vals[i])
            r = list(true_val.cells[i].contrib_refs()) if is_t_col else []
            refs.append(r)
        else:
            out.append(f_vals[i])
            r = list(false_val.cells[i].contrib_refs()) if is_f_col else []
            refs.append(r)
    return condition._make_unattached_column(
        name=f"where({condition.name})", row_values=out, per_row_refs=refs,
    )


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

def _build_unattached(name: str, values: list, per_row_refs: List[list]) -> Column:
    cells = []
    for row_idx, value in enumerate(values):
        sr = CellReference(-1, -1, row_idx, value)
        refs = per_row_refs[row_idx] if row_idx < len(per_row_refs) else []
        if refs:
            cells.append(ReferencingTableCell(sr, list(refs)))
        else:
            cells.append(TableCell(sr))
    return Column(name=name, index=-1, cells=cells)
