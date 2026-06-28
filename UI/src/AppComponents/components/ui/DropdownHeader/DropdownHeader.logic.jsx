import { useCallback } from 'react';

export function useDropdownHeaderLogic({ isOpen, onToggle }) {
  const handleClick = useCallback(() => {
    if (onToggle) onToggle();
  }, [onToggle]);

  return { handleClick, isOpen };
}
