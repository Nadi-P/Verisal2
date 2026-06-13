"""
LineageManager — owns the registry of LineageFrames for ONE upload session.

Every LineageFrame self-registers here on construction. The manager hands
out report indices, lets cells resolve their CellReferences across frames,
and owns the `freeze()` pass that finalises the manufactured-report
pipeline before the data goes out on the wire.

Translucent frames (intermediates) are tracked separately. They participate
in computation during the build but are removed from the registries during
`freeze()` after their cells' references and formulas have been flattened
through to their non-translucent ancestors.
"""
from typing import Dict, List

from LineageFrame.formula import substitute_formula, topological_substitution_order


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

    def opaque_reports(self) -> list:
        """All NON-translucent registered frames, ordered by report_idx."""
        return [
            self.frames_by_idx[i]
            for i in sorted(self.frames_by_idx.keys())
            if not getattr(self.frames_by_idx[i], "translucent", False)
        ]

    def translucent_reports(self) -> list:
        """All translucent registered frames, ordered by report_idx."""
        return [
            self.frames_by_idx[i]
            for i in sorted(self.frames_by_idx.keys())
            if getattr(self.frames_by_idx[i], "translucent", False)
        ]

    # ==================================================================
    #  Freeze — finalise the build, flatten through translucent frames
    # ==================================================================
    def freeze(self) -> None:
        """
        Run after all manufactured-report constructors finish.

        Two passes per non-translucent frame:
          1. References:  every cell's `references` list is walked through
             translucent ancestors transitively until each ref lands on a
             non-translucent cell.
          2. Formulas:    every column's `formula` string is substituted
             with the (already-flattened) formula strings of any
             translucent columns it references by name, in topological
             order.

        After both passes, translucent frames are dropped from the
        registries — no live ref points at them anymore, and the wire
        serializer should never see them.
        """
        self._flatten_all_references()
        self._flatten_all_formulas()
        self._drop_translucent_frames()

    # ------------------------------------------------------------------
    #  Pass 1 — flatten references through translucent ancestors
    # ------------------------------------------------------------------
    def _is_translucent_idx(self, report_idx: int) -> bool:
        frame = self.frames_by_idx.get(report_idx)
        return bool(frame and getattr(frame, "translucent", False))

    def _flatten_ref_list(self, refs: list) -> list:
        """
        Transitive walk: for each ref, if its target is a non-translucent
        cell, keep it; if its target is a translucent cell, recurse into
        that cell's own references and substitute them in place.

        Defends against cycles via a visited set keyed on
        (report_idx, column_idx, row_idx) so a bug in lineage authoring
        can't infinite-loop the freeze pass.
        """
        # Lazy import — Cell types live in a sibling module that imports
        # frame.py, which imports column.py, which lazily imports us in
        # other helpers. Keeping the import inside the method avoids the
        # circular at import time.
        from LineageFrame.cell import CellReference

        out: List[CellReference] = []
        stack = list(refs)
        visited = set()

        while stack:
            ref = stack.pop(0)
            key = (ref.report_idx, ref.column_idx, ref.row_idx)
            if key in visited:
                continue
            visited.add(key)

            if not self._is_translucent_idx(ref.report_idx):
                # Already opaque — keep as-is.
                out.append(ref)
                continue

            # Translucent: resolve to the live cell and recurse.
            target_cell = self.resolve_cell(ref)
            if target_cell is None:
                # Dangling ref (target frame was already dropped, or
                # author-error). Drop silently — better than a crash.
                continue

            # Translucent cells should themselves be ReferencingTableCells
            # (built by a manufactured-report op). If the author marked a
            # raw `from_pandas` frame as translucent, target_cell may be a
            # plain TableCell with no references — we drop those refs.
            sub_refs = getattr(target_cell, "references", None)
            if not sub_refs:
                continue
            stack.extend(sub_refs)

        return out

    def _flatten_all_references(self) -> None:
        for frame in self.opaque_reports():
            for column in frame.columns:
                for cell in column.cells:
                    refs = getattr(cell, "references", None)
                    if not refs:
                        continue
                    cell.references = self._flatten_ref_list(refs)

    # ------------------------------------------------------------------
    #  Pass 2 — flatten formula strings via token substitution
    # ------------------------------------------------------------------
    def _flatten_all_formulas(self) -> None:
        """
        Build a {translucent_column_name -> formula_string} map across
        ALL translucent columns, then substitute in topological order so
        each translucent formula is itself fully flattened before being
        used as a replacement in another formula.
        """
        # Collect translucent columns' formulas (one global namespace).
        translucent_formulas: Dict[str, str] = {}
        for frame in self.translucent_reports():
            for col in frame.columns:
                if col.formula:
                    # Authors must use distinct names if multiple
                    # translucent frames coexist; last write wins on
                    # collision (defensible behavior — rare in practice).
                    translucent_formulas[col.name] = col.formula

        if not translucent_formulas:
            return

        # Topologically sort so each translucent formula sees its own
        # substitutions before being substituted into someone else.
        order = topological_substitution_order(
            translucent_formulas.keys(), translucent_formulas
        )
        flattened: Dict[str, str] = {}
        for key in order:
            flattened[key] = substitute_formula(
                translucent_formulas[key], flattened
            )

        # Now substitute into every opaque column's formula.
        for frame in self.opaque_reports():
            for col in frame.columns:
                if col.formula:
                    col.formula = substitute_formula(col.formula, flattened)

    # ------------------------------------------------------------------
    #  Pass 3 — drop translucent frames from the registries
    # ------------------------------------------------------------------
    def _drop_translucent_frames(self) -> None:
        translucent_idxs = [
            idx for idx, frame in self.frames_by_idx.items()
            if getattr(frame, "translucent", False)
        ]
        for idx in translucent_idxs:
            frame = self.frames_by_idx.pop(idx, None)
            if frame is None:
                continue
            self.frames_by_id.pop(frame.report_id, None)
