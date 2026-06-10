"""
LineageFrame — pandas-mimic DataFrame analog with cell-level lineage.

Public surface:

  Core types
    CellReference         — pointer with value snapshot.
    TableCell             — minimal cell.
    ReferencingTableCell  — cell that carries upstream references.
    Column                — one named column with cells + dependency graph.
    LineageFrame          — set of Columns belonging to one report.
    LineageManager        — owns the per-session frame registry.

  Accessors / intermediates
    GroupBy               — result of frame.groupby(...).
    StringAccessor        — exposed via column.str.

  Module-level helpers (mirror pandas / numpy free functions)
    concat(frames, axis=0, ignore_index=True)
    to_numeric(column, errors='coerce')
    where(condition, true_val, false_val)

Example
-------
    from LineageFrame import LineageFrame, LineageManager, concat, to_numeric, where

    manager = LineageManager()
    frame   = LineageFrame.from_pandas(df, "components", manager)
    col     = frame["סה\\\"כ"]
    col.apply_value_change(lambda v: v * 1.5)   # cascades through dependents
"""
from LineageFrame.cell import (
    CellReference,
    TableCell,
    ReferencingTableCell,
)
from LineageFrame.column          import Column
from LineageFrame.frame           import LineageFrame
from LineageFrame.manager         import LineageManager
from LineageFrame.groupby         import GroupBy
from LineageFrame.string_accessor import StringAccessor
from LineageFrame.operations      import concat, to_numeric, where

__all__ = [
    # Core types
    "CellReference",
    "TableCell",
    "ReferencingTableCell",
    "Column",
    "LineageFrame",
    "LineageManager",
    # Accessors / intermediates
    "GroupBy",
    "StringAccessor",
    # Helpers
    "concat",
    "to_numeric",
    "where",
]
