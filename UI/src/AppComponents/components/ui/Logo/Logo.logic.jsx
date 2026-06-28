import { useCallback } from 'react';

export function useLogoLogic({ onClick } = {}) {
  const handleClick = useCallback(() => {
    if (onClick) onClick();
  }, [onClick]);

  return { handleClick };
}
