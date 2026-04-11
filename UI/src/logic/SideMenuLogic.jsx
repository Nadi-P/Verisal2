import { useState, useCallback } from 'react';

export function useSideMenu(setTableData, setIsLoading, setMetadata, setColumns, setCheckupData) {

  const [sharedSelectedItem, setSharedSelectedItem] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);

  const toggleDropdown = useCallback((title) => {
    setOpenDropdown((prev) => (prev === title ? null : title));
  }, []);

  const handleSelect = useCallback(async (categoryTitle, itemData) => {
    setSharedSelectedItem({ category: categoryTitle, item: itemData.file_name });
    setIsLoading(true);

    try {
      const response = await fetch(`http://localhost:8000/api/get_report?report_name=${itemData.file_name}`);
      const result = await response.json();

      if (result.status === 'success') {
        setTableData(result.data);

        setMetadata({
          companyName: result.metadata.company_name,
          dateRange: `${result.metadata.min_month}/${result.metadata.min_year} - ${result.metadata.max_month}/${result.metadata.max_year}`,
          reportTitle: itemData.display_title,
          minMonth: result.metadata.min_month,
          minYear: result.metadata.min_year,
          maxMonth: result.metadata.max_month,
          maxYear: result.metadata.max_year
        });

        // Build columns array from the first row keys
        if (result.data.length > 0) {
          const keys = Object.keys(result.data[0]);
          setCheckupData(result.checkup || {});
          setColumns(keys.map((k) => ({ id: k, visible: true, pinned: false })));
        } else {
          setColumns([]);
        }
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setTableData, setIsLoading, setMetadata, setColumns, setCheckupData]);

  return { sharedSelectedItem, openDropdown, toggleDropdown, handleSelect };
}
