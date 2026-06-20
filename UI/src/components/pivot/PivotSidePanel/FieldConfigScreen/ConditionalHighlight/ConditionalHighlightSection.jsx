import React from 'react';
import SectionShell        from '../SectionShell.jsx';
import ConditionalHighlight from './ConditionalHighlight.jsx';

/**
 * Self-contained Conditional Highlighting section. Owns the shell so
 * activate/deactivate clears BOTH threshold AND stat slots atomically
 * (via the `clearConditional` setter on the per-screen logic hook).
 *
 * Props:
 *   threshold, statHighlight
 *   onChangeThreshold, onChangeStat
 *   clearConditional   — single-shot clear of both slots
 */
export default function ConditionalHighlightSection({
  threshold, statHighlight,
  onChangeThreshold, onChangeStat,
  clearConditional,
}) {
  const active = !!threshold || !!statHighlight;
  const onToggle = () => {
    if (active) clearConditional();
    else onChangeThreshold({ operator: '>', value1: 0 });
  };

  return (
    <SectionShell title="הדגשה מותנית" active={active} onToggle={onToggle}>
      <ConditionalHighlight
        threshold={threshold}
        statHighlight={statHighlight}
        onChangeThreshold={onChangeThreshold}
        onChangeStat={onChangeStat}
      />
    </SectionShell>
  );
}
