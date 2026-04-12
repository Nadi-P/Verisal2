import { useEffect, useCallback, useMemo } from 'react';

export function useTopStatusBarLogic(metadata, onRunComparison, compData, setCompData) {
  
  // Always sync comparison inputs to the latest metadata defaults whenever
  // the underlying date range changes (e.g. new folder uploaded).
  useEffect(() => {
    if (metadata.minMonth && metadata.maxMonth) {
      setCompData({
        m1: String(metadata.maxMonth), y1: String(metadata.maxYear),
        m2: String(metadata.minMonth), y2: String(metadata.minYear)
      });
    }
  }, [metadata.minMonth, metadata.maxMonth, metadata.minYear, metadata.maxYear, setCompData]);

  const handleCompChange = (e) => {
    const { name, value } = e.target;
    const cleanValue = value.replace(/\D/g, '');
    setCompData(prev => ({ ...prev, [name]: cleanValue }));
  };

  const isComparisonValid = useMemo(() => {
    const { m1, y1, m2, y2 } = compData;
    if (!m1 || !y1 || !m2 || !y2) return false;
    if (m1 === m2 && y1 === y2) return false;

    const valM1 = parseInt(m1);
    const valM2 = parseInt(m2);
    if (valM1 < 1 || valM1 > 12 || valM2 < 1 || valM2 > 12) return false;
    
    return true;
  }, [compData]);

  const handleRunComparison = () => {
    if (isComparisonValid && typeof onRunComparison === 'function') {
      onRunComparison({
        m1: parseInt(compData.m1),
        y1: parseInt(compData.y1),
        m2: parseInt(compData.m2),
        y2: parseInt(compData.y2)
      });
    } else {
        console.error("onRunComparison is not a function or form invalid");
    }
  };

  return {
    compData,
    handleCompChange,
    isComparisonValid,
    handleRunComparison
  };
}