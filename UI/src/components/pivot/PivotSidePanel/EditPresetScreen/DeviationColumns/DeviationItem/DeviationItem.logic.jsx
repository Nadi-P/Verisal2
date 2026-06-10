import { useCallback } from 'react';

/**
 * Per-item handlers. Pure pass-throughs that bundle the deviation's id with
 * each change so the parent can route updates back into config.deviations.
 */
export function useDeviationItemLogic({ deviation, onChange, onDelete }) {
  const update = useCallback((patch) => {
    onChange?.({ ...deviation, ...patch });
  }, [deviation, onChange]);

  const swap = useCallback(() => {
    onChange?.({ ...deviation, sourceA: deviation.sourceB, sourceB: deviation.sourceA });
  }, [deviation, onChange]);

  const remove = useCallback(() => onDelete?.(deviation.id), [deviation.id, onDelete]);

  return { update, swap, remove };
}
