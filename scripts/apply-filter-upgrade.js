const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'monitoring', 'monitoring-table.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update imports - add Filter, ArrowUpDown, ArrowUp, ArrowDown, Check, ChevronsUpDown
content = content.replace(
  `import {
  Plus, Trash2, Search, Lock, Unlock, Settings,
  Download, X, Save, FileSpreadsheet, MapPin, ChevronDown, ChevronRight
} from 'lucide-react';`,
  `import {
  Plus, Trash2, Search, Lock, Unlock, Settings,
  Download, X, Save, FileSpreadsheet, MapPin, ChevronDown, ChevronRight,
  Filter, ArrowUpDown, ArrowUp, ArrowDown, Check, ChevronsUpDown
} from 'lucide-react';`
);

// 2. Add new state variables after existing state declarations
const filterStateCode = `  // Column filter state
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [tempFilterValues, setTempFilterValues] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setActiveFilterCol(null);
        setFilterSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Get unique values for a column
  const getUniqueValues = useCallback((colKey: string): string[] => {
    const vals = new Set<string>();
    for (const row of rows) {
      const v = getCellValue(row, colKey);
      if (v) vals.add(v);
    }
    return Array.from(vals).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [rows]);

  // Open filter dropdown for a column
  const openFilter = (colKey: string) => {
    setActiveFilterCol(colKey);
    setFilterSearch('');
    setTempFilterValues(columnFilters[colKey] || getUniqueValues(colKey));
  };

  // Apply filter from temp values
  const applyFilter = () => {
    if (!activeFilterCol) return;
    const allVals = getUniqueValues(activeFilterCol);
    if (tempFilterValues.length === allVals.length) {
      setColumnFilters(prev => { const n = { ...prev }; delete n[activeFilterCol]; return n; });
    } else {
      setColumnFilters(prev => ({ ...prev, [activeFilterCol]: tempFilterValues }));
    }
    setActiveFilterCol(null);
    setFilterSearch('');
  };

  // Clear filter for a column
  const clearFilter = (colKey: string) => {
    setColumnFilters(prev => { const n = { ...prev }; delete n[colKey]; return n; });
    setSortConfig(prev => prev?.key === colKey ? null : prev);
    setActiveFilterCol(null);
  };

  // Toggle sort on a column
  const toggleSort = (colKey: string) => {
    setSortConfig(prev => {
      if (prev?.key !== colKey) return { key: colKey, direction: 'asc' };
      if (prev.direction === 'asc') return { key: colKey, direction: 'desc' };
      return null;
    });
  };

  // Toggle a single value in temp filter
  const toggleTempValue = (val: string) => {
    setTempFilterValues(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  };

  // Toggle select all in temp filter
  const toggleSelectAll = (allVals: string[]) => {
    if (tempFilterValues.length === allVals.length) {
      setTempFilterValues([]);
    } else {
      setTempFilterValues([...allVals]);
    }
  };
`;

content = content.replace(
  '  const editRef = useRef<HTMLInputElement>(null);',
  filterStateCode + '\n  const editRef = useRef<HTMLInputElement>(null);'
);

// 3. Replace filteredRows to include column filters and sort
const oldFiltered = `  const filteredRows = rows.filter(row => {
    if (!search) return true;
    const s = search.toLowerCase();
    return [
      row.provinsi, row.kabupaten, row.kecamatan, row.kelurahan,
      row.kelRwSiteName, row.desaPerum, row.remarksTsa, row.klasifikasiTsa,
      row.picTsa, row.remarksJlm, row.customData,
    ].some(v => String(v).toLowerCase().includes(s));
  });`;

const newFiltered = `  const searchedRows = rows.filter(row => {
    if (!search) return true;
    const s = search.toLowerCase();
    return [
      row.provinsi, row.kabupaten, row.kecamatan, row.kelurahan,
      row.kelRwSiteName, row.desaPerum, row.remarksTsa, row.klasifikasiTsa,
      row.picTsa, row.remarksJlm, row.customData,
    ].some(v => String(v).toLowerCase().includes(s));
  });

  // Apply column filters
  const filteredRows = searchedRows.filter(row => {
    for (const [colKey, allowedVals] of Object.entries(columnFilters)) {
      const cellVal = getCellValue(row, colKey);
      if (!allowedVals.includes(cellVal)) return false;
    }
    return true;
  });

  // Apply sort
  const displayRows = [...filteredRows];
  if (sortConfig) {
    displayRows.sort((a, b) => {
      const va = getCellValue(a, sortConfig.key);
      const vb = getCellValue(b, sortConfig.key);
      const na = parseFloat(va);
      const nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb)) {
        return sortConfig.direction === 'asc' ? na - nb : nb - na;
      }
      return sortConfig.direction === 'asc'
        ? va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' })
        : vb.localeCompare(va, undefined, { numeric: true, sensitivity: 'base' });
    });
  }
  const activeFilterCount = Object.keys(columnFilters).length;`;

content = content.replace(oldFiltered, newFiltered);

// 4. Replace filteredRows.map with displayRows.map in table body
content = content.replace(
  '              {filteredRows.map((row) => (',
  '              {displayRows.map((row) => ('
};

// 5. Add FilterDropdown component before the return statement
const filterDropdownCode = `
  // Column Filter Dropdown Component
  const FilterDropdown = ({ colKey, colLabel }: { colKey: string; colLabel: string }) => {
    if (activeFilterCol !== colKey) return null;
    const allVals = getUniqueValues(colKey);
    const filteredVals = filterSearch
      ? allVals.filter(v => v.toLowerCase().includes(filterSearch.toLowerCase()))
      : allVals;
    const allSelected = tempFilterValues.length === allVals.length;
    const hasFilter = columnFilters[colKey] !== undefined;
    const sortDir = sortConfig?.key === colKey ? sortConfig.direction : null;

    return (
      <div ref={filterDropdownRef} className="absolute top-full left-0 mt-1 w-64 glass-card rounded-lg shadow-2xl z-50 border border-white/15"
        style={{ background: 'rgba(13, 27, 42, 0.97)' }}>
        {/* Sort options */}
        <div className="p-1.5 border-b border-white/10 flex flex-col gap-0.5">
          <button onClick={() => toggleSort(colKey)}
            className={\`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors w-full text-left \${
              sortDir === 'asc' ? 'bg-[#64b5f6]/20 text-[#64b5f6]' : 'text-[#b0bec5] hover:bg-white/10 hover:text-white'
            }\`}>
            <ArrowUp className="w-3.5 h-3.5" /> Sort A → Z {sortDir === 'asc' && <Check className="w-3 h-3 ml-auto" />}
          </button>
          <button onClick={() => toggleSort(colKey)}
            className={\`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors w-full text-left \${
              sortDir === 'desc' ? 'bg-[#64b5f6]/20 text-[#64b5f6]' : 'text-[#b0bec5] hover:bg-white/10 hover:text-white'
            }\`}>
            <ArrowDown className="w-3.5 h-3.5" /> Sort Z → A {sortDir === 'desc' && <Check className="w-3 h-3 ml-auto" />}
          </button>
        </div>

        {/* Clear filter */}
        {hasFilter && (
          <button onClick={() => clearFilter(colKey)}
            className="flex items-center gap-2 px-3 py-2 text-xs text-[#ef9a9a] hover:bg-[#ef5350]/10 border-b border-white/10 w-full text-left">
            <X className="w-3.5 h-3.5" /> Hapus Filter dari '{colLabel}'
          </button>
        )}

        {/* Search within values */}
        <div className="p-2 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#546e7a]" />
            <input type="text" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Cari..." className="w-full pl-8 pr-3 py-1.5 glass-input rounded-md text-xs" autoFocus />
          </div>
        </div>

        {/* Checkbox list */}
        <div className="max-h-48 overflow-y-auto aero-scroll p-1.5">
          <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer text-xs">
            <input type="checkbox" checked={allSelected} onChange={() => toggleSelectAll(allVals)}
              className="rounded border-white/20 bg-white/5" />
            <span className="text-[#90caf9] font-medium">(Pilih Semua)</span>
          </label>
          {filteredVals.map(val => (
            <label key={val} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer text-xs">
              <input type="checkbox" checked={tempFilterValues.includes(val)}
                onChange={() => toggleTempValue(val)}
                className="rounded border-white/20 bg-white/5" />
              <span className="text-[#b0bec5] truncate" title={val}>{val}</span>
            </label>
          ))}
          {filteredVals.length === 0 && (
            <p className="text-xs text-[#546e7a] text-center py-3">Tidak ditemukan</p>
          )}
        </div>

        {/* OK / Cancel */}
        <div className="flex items-center justify-end gap-2 p-2 border-t border-white/10">
          <button onClick={() => { setActiveFilterCol(null); setFilterSearch(''); }}
            className="px-3 py-1.5 rounded-md text-xs text-[#78909c] hover:bg-white/5 hover:text-white transition-colors">
            Batal
          </button>
          <button onClick={applyFilter}
            className="px-3 py-1.5 rounded-md text-xs glass-btn">
            OK
          </button>
        </div>
      </div>
    );
  };\n`;

content = content.replace(
  '  return (',
  filterDropdownCode + '\n  return ('
);

// 6. Replace BASE_COLUMNS header cells to include filter button
const oldBaseHeader = `                {BASE_COLUMNS.map(col => (
                  <th key={col.key} style={{ minWidth: col.width }}>
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.editable && user?.role !== 'ADMIN' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#81c784]" title="Bisa diedit" />
                      )}
                    </div>
                  </th>
                ))}`;

const newBaseHeader = `                {BASE_COLUMNS.map(col => {
                  const hasFilter = columnFilters[col.key] !== undefined;
                  const sortDir = sortConfig?.key === col.key ? sortConfig.direction : null;
                  return (
                    <th key={col.key} style={{ minWidth: col.width }} className="relative group">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openFilter(col.key)} className="flex items-center gap-1 hover:text-white transition-colors">
                          {sortDir && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-[#64b5f6]" /> : <ArrowDown className="w-3 h-3 text-[#64b5f6]" />)}
                          {!sortDir && hasFilter && <Filter className="w-3 h-3 text-[#ffb74d]" />}
                          {!sortDir && !hasFilter && <ChevronsUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />}
                          {col.label}
                        </button>
                        {col.editable && user?.role !== 'ADMIN' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#81c784]" title="Bisa diedit" />
                        )}
                        <button onClick={() => openFilter(col.key)}
                          className={\`p-0.5 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all \${hasFilter ? '!opacity-100' : ''}\`}>
                          <ChevronDown className="w-3 h-3 text-[#78909c]" />
                        </button>
                      </div>
                      <FilterDropdown colKey={col.key} colLabel={col.label} />
                    </th>
                  );
                })}`;

content = content.replace(oldBaseHeader, newBaseHeader);

// 7. Replace custom columns header cells to include filter button
const oldCustomHeader = `                {customCols.map(col => (
                  <th key={col.id} style={{ minWidth: 150 }}>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getDivisionColor(col.divisionId) }}
                      />
                      {col.label}
                      {col.isLocked && <Lock className="w-3 h-3 text-[#ef9a9a]" />}
                    </div>
                  </th>
                ))}`;

const newCustomHeader = `                {customCols.map(col => {
                  const hasFilter = columnFilters[col.id] !== undefined;
                  const sortDir = sortConfig?.key === col.id ? sortConfig.direction : null;
                  return (
                    <th key={col.id} style={{ minWidth: 150 }} className="relative group">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openFilter(col.id)} className="flex items-center gap-1.5 hover:text-white transition-colors">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getDivisionColor(col.divisionId) }} />
                          {sortDir && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-[#64b5f6]" /> : <ArrowDown className="w-3 h-3 text-[#64b5f6]" />)}
                          {!sortDir && hasFilter && <Filter className="w-3 h-3 text-[#ffb74d]" />}
                          {!sortDir && !hasFilter && <ChevronsUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />}
                          {col.label}
                        </button>
                        {col.isLocked && <Lock className="w-3 h-3 text-[#ef9a9a]" />}
                        <button onClick={() => openFilter(col.id)}
                          className={\`p-0.5 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all \${hasFilter ? '!opacity-100' : ''}\`}>
                          <ChevronDown className="w-3 h-3 text-[#78909c]" />
                        </button>
                      </div>
                      <FilterDropdown colKey={col.id} colLabel={col.label} />
                    </th>
                  );
                })}`;

content = content.replace(oldCustomHeader, newCustomHeader);

// 8. Update info bar to show active filter count
const oldInfoBar = `          <p className="text-xs text-[#546e7a]">
            Total {filteredRows.length} data{filteredRows.length !== rows.length ? ` (filter dari {rows.length})` : ''}
          </p>`;

const newInfoBar = `          <p className="text-xs text-[#546e7a]">
            Total {displayRows.length} data{displayRows.length !== rows.length ? ` (filter dari {rows.length})` : ''}
            {activeFilterCount > 0 && (
              <button onClick={() => setColumnFilters({})}
                className="ml-2 text-[#ffb74d] hover:text-[#ffcc80] underline decoration-dotted">
                {activeFilterCount} filter aktif (klik untuk hapus semua)
              </button>
            )}
          </p>`;

content = content.replace(oldInfoBar, newInfoBar);

// Write the updated file
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Column filter upgrade applied successfully!');
console.log('Changes made:');
console.log('  - Added Excel-style column filters to all headers');
console.log('  - Added Sort A→Z / Z→A per column');
console.log('  - Added checkbox filter with search');
console.log('  - Added filter count indicator in info bar');
console.log('  - Close dropdown on outside click');
