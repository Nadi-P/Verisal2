import { useCallback } from 'react';

export function useDropdownItemLogic({ id, onClick }) {
  const handleClick = useCallback(() => {
    if (onClick) onClick(id);
  }, [id, onClick]);

  return { handleClick };
}
