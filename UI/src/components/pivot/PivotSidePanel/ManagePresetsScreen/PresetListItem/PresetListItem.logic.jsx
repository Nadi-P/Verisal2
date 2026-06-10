import { useState, useCallback } from 'react';

/**
 * Hover state for the trailing dots button, plus a right-click handler that
 * opens the same menu the dots button does.
 */
export function usePresetListItemLogic({ onOpenMenu }) {
  const [hovered, setHovered] = useState(false);

  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    // Right-click: place the menu's bottom corner AT the click point.
    onOpenMenu?.(e.clientX, e.clientY, 'bottom');
  }, [onOpenMenu]);

  const handleDotsClick = useCallback((e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    // Dots button: drop the menu just below the button (top-anchored).
    onOpenMenu?.(rect.left, rect.bottom + 4, 'top');
  }, [onOpenMenu]);

  return { hovered, handleMouseEnter, handleMouseLeave, handleContextMenu, handleDotsClick };
}
