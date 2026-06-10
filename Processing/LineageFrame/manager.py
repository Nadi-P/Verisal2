
class LineageManager:


    def __init__(self):
        self.frames_by_idx: dict = {}
        self.frames_by_id:  dict = {}
        self._next_idx: int = 0

    # ------------------------------------------------------------------
    #  Registration
    # ------------------------------------------------------------------

    def register(self, frame) -> int:
        """
        Assign a fresh report_idx to `frame`, set frame.report_idx in
        place, and store it in both registries.

        Returns the assigned report_idx for convenience.
        """
        idx = self._next_idx
        self._next_idx += 1

        frame.report_idx = idx
        self.frames_by_idx[idx]            = frame
        self.frames_by_id[frame.report_id] = frame
        return idx

    # ------------------------------------------------------------------
    #  Lookups
    # ------------------------------------------------------------------

    def resolve_report(self, report_idx: int):
        return self.frames_by_idx.get(report_idx)

    def resolve_report_by_id(self, report_id: str):
        return self.frames_by_id.get(report_id)

    def resolve_column(self, report_idx: int, column_idx: int):
        frame = self.frames_by_idx.get(report_idx)
        if frame is None:
            return None
        if column_idx < 0 or column_idx >= len(frame.columns):
            return None
        return frame.columns[column_idx]

    def resolve_cell(self, ref):
        """Resolve a CellReference → TableCell, or None on miss."""
        column = self.resolve_column(ref.report_idx, ref.column_idx)
        if column is None:
            return None
        if ref.row_idx < 0 or ref.row_idx >= len(column.cells):
            return None
        return column.cells[ref.row_idx]

    # ------------------------------------------------------------------
    def reset(self) -> None:
        """Clear everything. Call when a new folder is being processed."""
        self.frames_by_idx.clear()
        self.frames_by_id.clear()
        self._next_idx = 0

    def registered_reports(self) -> list:
        """All registered frames, ordered by report_idx."""
        return [self.frames_by_idx[i] for i in sorted(self.frames_by_idx.keys())]
