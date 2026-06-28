import { useState, useMemo, useCallback, useEffect } from 'react';

/**
 * Filters the preset list, tracks which item the actions menu is anchored to.
 */
export function useManagePresetsScreenLogic({ savedPresets }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);     // name or null
  const [menu, setMenu] = useState(null);             // { name, x, y, anchor }

  const names = useMemo(() => Object.keys(savedPresets), [savedPresets]);

  const filteredNames = useMemo(() => {
    const lower = query.toLowerCase();
    return names.filter((n) => n.toLowerCase().includes(lower));
  }, [names, query]);

  // anchor: 'top' (menu's top-start at xy) or 'bottom' (menu's bottom-start at xy)
  const openMenu  = useCallback((name, x, y, anchor = 'top') => setMenu({ name, x, y, anchor }), []);
  const closeMenu = useCallback(() => setMenu(null), []);

  /* Auto-close on outside click / Esc */
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  return {
    query, setQuery,
    selected, setSelected,
    menu, openMenu, closeMenu,
    filteredNames,
    totalCount: names.length,
  };
}
