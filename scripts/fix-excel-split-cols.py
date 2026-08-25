filepath = '/home/z/my-project/src/components/pivot/excel-pivot-table.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# === 1. Fix handleDownloadExcel ===
old_excel = '''  const handleDownloadExcel = useCallback(async () => {
    if (pivotResult.dataRows.length === 0) return;
    setDownloading(true);
    try {
      const XLSX = await import('xlsx');
      const data: (string | number)[][] = [pivotResult.headers];
      pivotResult.dataRows.forEach(dr => {
        data.push([dr.label, ...dr.values] as (string | number)[]);
      });
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 24 }, ...pivotResult.headers.slice(1).map(() => ({ wch: 16 }))];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pivot Table');
      XLSX.writeFile(wb, `pivot_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { console.error(e); }
    setDownloading(false);
  }, [pivotResult]);'''

new_excel = '''  const handleDownloadExcel = useCallback(async () => {
    if (pivotResult.dataRows.length === 0) return;
    setDownloading(true);
    try {
      const XLSX = await import('xlsx');
      // Build header: split 'Row Labels' into individual field names
      const rowFieldLabels = rowFields.map(k => fieldMap[k]?.label || k);
      const headerRow: (string | number)[] = [
        ...(rowFieldLabels.length > 1 ? rowFieldLabels : ['Row Labels']),
        ...pivotResult.headers.slice(1)
      ];
      const data: (string | number)[][] = [headerRow];
      pivotResult.dataRows.forEach(dr => {
        if (dr.isTotal) {
          // Grand Total row: label in first col, rest empty
          const row: (string | number)[] = rowFieldLabels.length > 1
            ? ['Grand Total', ...Array(rowFieldLabels.length - 1).fill(''), ...dr.values]
            : [dr.label, ...dr.values];
          data.push(row);
        } else {
          // Split 'Banten | Tangerang | Cikupa' into separate columns
          const parts = dr.label.split(' | ');
          const row: (string | number)[] = [
            ...(rowFieldLabels.length > 1 ? parts : [dr.label]),
            ...dr.values
          ];
          data.push(row);
        }
      });
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [
        ...rowFieldLabels.map(() => ({ wch: 20 })),
        ...pivotResult.headers.slice(1).map(() => ({ wch: 16 }))
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pivot Table');
      XLSX.writeFile(wb, `pivot_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { console.error(e); }
    setDownloading(false);
  }, [pivotResult, rowFields, fieldMap]);'''

content = content.replace(old_excel, new_excel)

# === 2. Fix handleDownloadCSV ===
old_csv = '''  const handleDownloadCSV = useCallback(() => {
    if (pivotResult.dataRows.length === 0) return;
    const csv = [pivotResult.headers.join(','), ...pivotResult.dataRows.map(dr => [dr.label, ...dr.values].join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pivot_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [pivotResult]);'''

new_csv = '''  const handleDownloadCSV = useCallback(() => {
    if (pivotResult.dataRows.length === 0) return;
    const rowFieldLabels = rowFields.map(k => fieldMap[k]?.label || k);
    const headerLine = [
      ...(rowFieldLabels.length > 1 ? rowFieldLabels : ['Row Labels']),
      ...pivotResult.headers.slice(1)
    ].join(',');
    const dataLines = pivotResult.dataRows.map(dr => {
      if (dr.isTotal) {
        const cols = rowFieldLabels.length > 1
          ? ['Grand Total', ...Array(rowFieldLabels.length - 1).fill('')]
          : [dr.label];
        return [...cols, ...dr.values].join(',');
      }
      const parts = dr.label.split(' | ');
      const cols = rowFieldLabels.length > 1 ? parts : [dr.label];
      return [...cols, ...dr.values].join(',');
    });
    const csv = [headerLine, ...dataLines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pivot_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [pivotResult, rowFields, fieldMap]);'''

content = content.replace(old_csv, new_csv)

with open(filepath, 'w') as f:
    f.write(content)

print('Done! Excel/CSV export now splits row labels into separate columns.')