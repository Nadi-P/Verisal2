/**
 * TopBar has no real state — it just routes button clicks to the orchestrator.
 * Kept here for symmetry with every other component's logic file.
 */
export function useTopBarLogic({ onReset, onManage, onSave, onClose, onBack }) {
  return {
    handleReset:  () => onReset?.(),
    handleManage: () => onManage?.(),
    handleSave:   () => onSave?.(),
    handleClose:  () => onClose?.(),
    handleBack:   () => onBack?.(),
  };
}
