"""
Formula substitution helper.

Manufactured-report columns may reference upstream columns whose own formula
strings need to be inlined when the upstream column lives in a translucent
(intermediate) frame. Example:

    translucent col `T` has formula  "col_x * 2"
    final col     `F` has formula  "T + col_y"
    after freeze, F's formula reads "(col_x * 2) + col_y"

We do this via TOKEN-based replacement keyed on a column identifier, NOT
naive substring replace, so identifiers that happen to share a substring
with another column's name don't collide. Authors are responsible for using
distinct, valid-identifier tokens for their translucent column names.

Final reports are immutable — the formula string is display-only. It never
drives computation. So this substitution is purely about producing a clean
human-readable label for the trace UI.
"""
import re
from typing import Dict, Iterable


# A formula "token" is an identifier-shaped run of letters/digits/underscore.
# This is what gets matched and (potentially) replaced. Anything else in the
# formula string (operators, parens, whitespace, numeric literals) is left
# alone.
_TOKEN_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def substitute_formula(target: str, replacements: Dict[str, str]) -> str:
    """
    Walk `target` and replace every identifier-shaped token that appears as a
    key in `replacements` with the corresponding replacement string. The
    replacement is wrapped in parentheses if it contains any of `+-*/%` (so
    operator precedence in the surrounding expression stays correct without
    requiring the caller to think about it).

    Returns the substituted string. Pure function — no side effects.
    """
    if not target or not replacements:
        return target

    def _replace(match: re.Match) -> str:
        tok = match.group(0)
        if tok not in replacements:
            return tok
        sub = replacements[tok]
        # Wrap in parens iff the substitution itself is a non-trivial
        # expression and not already parenthesized as a whole.
        if (
            any(op in sub for op in "+-*/%")
            and not (sub.startswith("(") and sub.endswith(")"))
        ):
            return f"({sub})"
        return sub

    return _TOKEN_RE.sub(_replace, target)


def topological_substitution_order(
    column_keys: Iterable[str],
    column_formulas: Dict[str, str],
) -> list:
    """
    Produce a topological ordering of `column_keys` such that any column
    whose formula references another column in the same set appears AFTER
    that referenced column. Used so each substitution sees an already-
    flattened replacement.

    Cycles can't legitimately occur in a DAG of derivations; if one does
    (bug), we fall back to insertion order rather than infinite-loop.
    """
    keys = list(column_keys)
    key_set = set(keys)
    visited = set()
    in_progress = set()
    order: list = []

    def _visit(k: str):
        if k in visited:
            return
        if k in in_progress:                # cycle detected; bail gracefully
            return
        in_progress.add(k)
        formula = column_formulas.get(k)
        if formula:
            # Each token in this formula that names another key needs to be
            # visited first so its substitution is ready when we use it.
            for tok in _TOKEN_RE.findall(formula):
                if tok in key_set and tok != k:
                    _visit(tok)
        in_progress.discard(k)
        visited.add(k)
        order.append(k)

    for k in keys:
        _visit(k)
    return order
