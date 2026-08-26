'use client';
import { apiFetch } from '@/lib/api';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppStore } from '@/store/app-store';
import {
  Plus, Trash2, Search, Lock, Unlock, Settings,
  Download, X, Save, FileSpreadsheet, MapPin, ChevronDown, ChevronRight,
  Filter, ArrowUp, ArrowDown, Check, ChevronsUpDown, Upload, FileUp, Loader2, AlertCircle, Eraser, TriangleAlert, Pencil
} from 'lucide-react';
import { FormBuilder } from '@/components/forms/form-builder';

const BASE_COLUMNS = [
  { key: 'orderNum', label: 'No', width: 60, editable: false },
  { key: 'categoryBak', label: 'Category BAK', width: 120, editable: false },
  { key: 'provinsi', label: 'Provinsi', width: 120, editable: false },
  { key: 'kabupaten', label: 'Kabupaten', width: 120, editable: false },
  { key: 'kecamatan', label: 'Kecamatan', width: 130, editable: false },
  { key: 'kelurahan', label: 'Kelurahan', width: 130, editable: false },
  { key: 'kelRwSiteName', label: 'Kel RW/Site Name', width: 180, editable: false },
  { key: 'desaPerum', label: 'Desa/Perum', width: 180, editable: false },
  { key: 'indexNum', label: 'Index', width: 80, editable: false },
  { key: 'homepass', label: 'Homepass', width: 100, editable: false },
  { key: 'odp', label: 'ODP', width: 80, editable: false },
  { key: 'remarksTsa', label: 'Remarks TSA', width: 200, editable: true },
  { key: 'klasifikasiTsa', label: 'Klasifikasi TSA', width: 150, editable: true },
  { key: 'picTsa', label: 'PIC TSA', width: 120, editable: true },
  { key: 'remarksJlm', label: 'Remarks JLM', width: 200, editable: false },
];

interface MonitoringRow {
  id: string;
  orderNum: number;
  categoryBak: string;
  provinsi: string;
  kabupaten: string;
  kecamatan: string;
  kelurahan: string;
  kelRwSiteName: string;
  desaPerum: string;
  indexNum: number;
  homepass: number;
  odp: number;
  remarksTsa: string;
  klasifikasiTsa: string;
  picTsa: string;
  remarksJlm: string;
  customData: string;
}

interface CustomColumn {
  id: string;
  name: string;
  label: string;
  order: number;
  isLocked: boolean;
  divisionId: string | null;
  division?: { id: string; name: string; color: string } | null;
}

export function MonitoringTable({ viewer = false }: { viewer?: boolean }) {
  const user = useAppStore((s) => s.user);
  const [rows, setRows] = useState<MonitoringRow[]>([]);
  const [customCols, setCustomCols] = useState<CustomColumn[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showColManager, setShowColManager] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColLabel, setNewColLabel] = useState('');
  const [newColDivision, setNewColDivision] = useState('');
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [editColName, setEditColName] = useState('');
  const [editColLabel, setEditColLabel] = useState('');
  const [editColDivision, setEditColDivision] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRow, setNewRow] = useState<any>({});

  // Column filter & sort state
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [tempFilterValues, setTempFilterValues] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const editRef = useRef<HTMLTextAreaElement>(null);
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const [scrollInfo, setScrollInfo] = useState({ top: false, bottom: true, left: false, right: true });
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setActiveFilterCol(null);
        setFilterSearch('');
      }
    };
    if (activeFilterCol) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [activeFilterCol]);

  const fetchData = useCallback(async () => {
    try {
      const [rowsRes, colsRes, divRes] = await Promise.all([
        apiFetch('/api/monitoring'),
        apiFetch('/api/columns'),
        fetch('/api/divisions'),
      ]);
      const rowsData = await rowsRes.json();
      const colsData = await colsRes.json();
      const divData = await divRes.json();
      setRows(rowsData.rows);
      setCustomCols(colsData.columns);
      setDivisions(divData.divisions);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    if (editingCell && editRef.current) {
      editRef.current.focus();
      const len = editRef.current.value.length;
      editRef.current.setSelectionRange(len, len);
    }
  }, [editingCell]);

  const canEditCell = (colKey: string, col: CustomColumn | null) => {
    if (viewer) return false;
    if (user?.role === 'ADMIN') return true;
    if (!col) {
      return BASE_COLUMNS.find(c => c.key === colKey)?.editable || false;
    }
    if (col.isLocked) return false;
    if (!col.divisionId) return false;
    return col.divisionId === user?.divisionId;
  };

  const handleCellSave = async (rowId: string, colKey: string, value: string) => {
    const col = customCols.find(c => c.id === colKey);
    const isCustom = !!col;
    try {
      const res = await fetch('/api/monitoring/cells', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowId, colKey, value,
          colLabel: col?.label || BASE_COLUMNS.find(c => c.key === colKey)?.label,
          isCustomCol: isCustom,
          isLocked: col?.isLocked || false,
          colDivisionId: col?.divisionId || null,
        }),
      });
      if (!res.ok) { const data = await res.json(); alert(data.error); return; }
      setRows(prev => prev.map(r => {
        if (r.id !== rowId) return r;
        if (isCustom) {
          const cd = JSON.parse(r.customData || '{}');
          cd[colKey] = value;
          return { ...r, customData: JSON.stringify(cd) };
        }
        const update: any = { ...r };
        if (colKey === 'indexNum' || colKey === 'homepass' || colKey === 'odp') {
          update[colKey] = parseInt(value) || 0;
        } else {
          (update as any)[colKey] = value;
        }
        return update;
      }));
    } catch (err) { console.error('Save error:', err); }
    setEditingCell(null);
  };

  const handleAddColumn = async () => {
    if (!newColName.trim() || !newColLabel.trim()) return;
    try {
      const res = await fetch('/api/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newColName.toLowerCase().replace(/\s+/g, '_'),
          label: newColLabel,
          divisionId: newColDivision || null,
        }),
      });
      if (res.ok) { setNewColName(''); setNewColLabel(''); setNewColDivision(''); fetchData(); }
    } catch (err) { console.error(err); }
  };

  const handleToggleLock = async (col: CustomColumn) => {
    try {
      await fetch('/api/columns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: col.id, label: col.label, divisionId: col.divisionId, isLocked: !col.isLocked, order: col.order }),
      });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteColumn = async (colId: string) => {
    if (!confirm('Hapus kolom ini?')) return;
    try {
      await fetch(`/api/columns?id=${colId}`, { method: 'DELETE' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const startEditColumn = (col: CustomColumn) => {
    setEditingCol(col.id);
    setEditColName(col.name);
    setEditColLabel(col.label);
    setEditColDivision(col.divisionId || '');
  };

  const cancelEditColumn = () => {
    setEditingCol(null);
    setEditColName('');
    setEditColLabel('');
    setEditColDivision('');
  };

  const handleEditColumn = async () => {
    if (!editingCol || !editColName.trim() || !editColLabel.trim()) return;
    const col = customCols.find(c => c.id === editingCol);
    if (!col) return;
    try {
      const res = await fetch('/api/columns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCol,
          name: editColName.toLowerCase().replace(/\s+/g, '_'),
          label: editColLabel,
          divisionId: editColDivision || null,
          isLocked: col.isLocked,
          order: col.order,
        }),
      });
      if (res.ok) { cancelEditColumn(); fetchData(); }
    } catch (err) { console.error(err); }
  };

  const handleAddRow = async () => {
    try {
      const res = await apiFetch('/api/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRow),
      });
      if (res.ok) { setNewRow({}); setShowAddRow(false); fetchData(); }
    } catch (err) { console.error(err); }
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!confirm('Hapus baris ini?')) return;
    try {
      await fetch(`/api/monitoring/rows/${rowId}`, { method: 'DELETE' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const getCellValue = (row: MonitoringRow, colKey: string) => {
    const customData = JSON.parse(row.customData || '{}');
    if (colKey in customData) return String(customData[colKey]);
    const val = (row as any)[colKey];
    return val !== undefined && val !== null ? String(val) : '';
  };

  const getDivisionColor = (divId: string | null) => {
    if (!divId) return '#90a4ae';
    return divisions.find(d => d.id === divId)?.color || '#90a4ae';
  };

  // --- FILTER & SORT LOGIC ---

  const getUniqueValues = useCallback((colKey: string): string[] => {
    const vals = new Set<string>();
    for (const row of rows) {
      const v = getCellValue(row, colKey);
      if (v) vals.add(v);
    }
    return Array.from(vals).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [rows]);

  const openFilter = (colKey: string) => {
    setActiveFilterCol(colKey);
    setFilterSearch('');
    setTempFilterValues(columnFilters[colKey] || getUniqueValues(colKey));
  };

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

  const clearFilter = (colKey: string) => {
    setColumnFilters(prev => { const n = { ...prev }; delete n[colKey]; return n; });
    if (sortConfig?.key === colKey) setSortConfig(null);
    setActiveFilterCol(null);
  };

  const toggleSort = (colKey: string) => {
    setSortConfig(prev => {
      if (prev?.key !== colKey) return { key: colKey, direction: 'asc' };
      if (prev.direction === 'asc') return { key: colKey, direction: 'desc' };
      return null;
    });
  };

  const toggleTempValue = (val: string) => {
    setTempFilterValues(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const toggleSelectAll = (allVals: string[]) => {
    setTempFilterValues(prev => prev.length === allVals.length ? [] : [...allVals]);
  };

  // Search filter
  const searchedRows = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter(row =>
      [row.provinsi, row.kabupaten, row.kecamatan, row.kelurahan,
        row.kelRwSiteName, row.desaPerum, row.remarksTsa, row.klasifikasiTsa,
        row.picTsa, row.remarksJlm, row.customData,
      ].some(v => String(v).toLowerCase().includes(s))
    );
  }, [rows, search]);

  // Column filters
  const filteredRows = useMemo(() => {
    let result = searchedRows;
    for (const [colKey, allowedVals] of Object.entries(columnFilters)) {
      result = result.filter(row => allowedVals.includes(getCellValue(row, colKey)));
    }
    return result;
  }, [searchedRows, columnFilters]);

  // Sort
  const displayRows = useMemo(() => {
    if (!sortConfig) return filteredRows;
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      const va = getCellValue(a, sortConfig.key);
      const vb = getCellValue(b, sortConfig.key);
      const na = parseFloat(va); const nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb)) return sortConfig.direction === 'asc' ? na - nb : nb - na;
      return sortConfig.direction === 'asc'
        ? va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' })
        : vb.localeCompare(va, undefined, { numeric: true, sensitivity: 'base' });
    });
    return sorted;
  }, [filteredRows, sortConfig]);

  const activeFilterCount = Object.keys(columnFilters).length;

  const updateScrollInfo = () => {
    const el = tableBodyRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = el;
    setScrollInfo({
      top: scrollTop > 5, bottom: scrollTop + clientHeight < scrollHeight - 5,
      left: scrollLeft > 5, right: scrollLeft + clientWidth < scrollWidth - 5,
    });
  };

  const exportCSV = () => {
    const allCols = [...BASE_COLUMNS, ...customCols.map(c => ({ key: c.id, label: c.label, width: 150, editable: false }))];
    const header = allCols.map(c => `"${c.label}"`).join(',');
    const csvRows = displayRows.map(row => allCols.map(c => `"${getCellValue(row, c.key).replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'tsa_outliers_monitoring.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const [showKmzDialog, setShowKmzDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<any>(null);
  const [kmzCoordCol, setKmzCoordCol] = useState('');
  const [kmzNameCols, setKmzNameCols] = useState<string[]>(['kelRwSiteName', 'desaPerum']);
  const [kmzDescCols, setKmzDescCols] = useState<string[]>([]);

  const getAllColumns = () => [
    ...BASE_COLUMNS.map(c => ({ key: c.key, label: c.label })),
    ...customCols.map(c => ({ key: c.id, label: c.label })),
  ];

  const parseCoord = (val: string): { lat: number; lng: number } | null => {
    const cleaned = val.replace(/[()\s]/g, '');
    const parts = cleaned.split(',');
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]); const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
    return null;
  };

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const allCols = getAllColumns();
    const data = displayRows.map(row => allCols.reduce((acc, c) => { acc[c.label] = getCellValue(row, c.key); return acc; }, {} as Record<string, string>));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TSA Outliers');
    XLSX.writeFile(wb, 'tsa_outliers_monitoring.xlsx');
  };

  const exportKmz = async () => {
    if (!kmzCoordCol) { alert('Pilih kolom koordinat terlebih dahulu'); return; }
    const JSZip = (await import('jszip')).default;
    const allCols = getAllColumns();
    const nameColLabels = allCols.filter(c => kmzNameCols.includes(c.key)).map(c => c.label);
    const descColLabels = allCols.filter(c => kmzDescCols.includes(c.key)).map(c => c.label);
    let placemarks = ''; let count = 0;
    for (const row of displayRows) {
      const coordVal = getCellValue(row, kmzCoordCol);
      const coord = parseCoord(coordVal);
      if (!coord) continue;
      const nameParts = kmzNameCols.map(k => getCellValue(row, k)).filter(Boolean);
      const descParts = descColLabels.map((label, i) => { const key = kmzDescCols[i]; return '<b>' + label + ':</b> ' + getCellValue(row, key); });
      placemarks += '<Placemark><name>' + (nameParts.join(' - ') || 'Point ' + (count + 1)) + '</name><description><![CDATA[' + (descParts.join('<br/>') || 'Tidak ada keterangan') + ']]></description><Point><coordinates>' + coord.lng + ',' + coord.lat + ',0</coordinates></Point></Placemark>';
      count++;
    }
    if (count === 0) { alert('Tidak ada data dengan koordinat valid. Pastikan format: (-6.994292,110.429400)'); return; }
    const kml = '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>TSA Outliers Monitoring</name><description>Exported ' + count + ' points</description><Style id="defaultStyle"><IconStyle><Icon><href>http://maps.google.com/mapfiles/ms/micons/red-dot.png</href></Icon></IconStyle></Style>' + placemarks + '</Document></kml>';
    const zip = new JSZip();
    zip.file('doc.kml', kml);
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'tsa_outliers.kmz'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportError('');
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      fd.append('mode', importMode);
      fd.append('projectId', useAppStore.getState().activeProjectId);
      const res = await fetch('/api/monitoring/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setImportError(data.error); return; }
      setImportResult(data);
      fetchData();
    } catch (err: any) { setImportError(err.message || 'Gagal import'); }
    finally { setImporting(false); }
  };

  const closeImport = () => {
    setShowImportDialog(false);
    setImportFile(null);
    setImportError('');
    setImportResult(null);
    setImportMode('replace');
  };

  const handleClearAll = async () => {
    setClearing(true);
    setClearResult(null);
    try {
      const res = await apiFetch('/api/monitoring/clear', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setClearResult(data);
      fetchData();
    } catch (err: any) { alert('Gagal menghapus data: ' + (err.message || 'Unknown error')); }
    finally { setClearing(false); }
  };

  const closeClearConfirm = () => {
    setShowClearConfirm(false);
    setClearResult(null);
  };

  // --- FILTER DROPDOWN COMPONENT ---
  const FilterDropdown = ({ colKey, colLabel }: { colKey: string; colLabel: string }) => {
    if (activeFilterCol !== colKey) return null;
    const allVals = getUniqueValues(colKey);
    const filteredVals = filterSearch ? allVals.filter(v => v.toLowerCase().includes(filterSearch.toLowerCase())) : allVals;
    const allSelected = tempFilterValues.length === allVals.length;
    const hasFilter = columnFilters[colKey] !== undefined;
    const sortDir = sortConfig?.key === colKey ? sortConfig.direction : null;

    return (
      <div ref={filterDropdownRef} className="absolute top-full left-0 mt-1 w-64 rounded-lg shadow-2xl z-50 border border-white/15"
        style={{ background: 'rgba(13, 27, 42, 0.97)', backdropFilter: 'blur(20px)' }}>
        {/* Sort */}
        <div className="p-1.5 border-b border-white/10 flex flex-col gap-0.5">
          <button onClick={() => toggleSort(colKey)}
            className={'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors w-full text-left ' + (sortDir === 'asc' ? 'bg-[#64b5f6]/20 text-[#64b5f6]' : 'text-[#b0bec5] hover:bg-white/10 hover:text-white')}>
            <ArrowUp className="w-3.5 h-3.5" /> Sort A to Z {sortDir === 'asc' && <Check className="w-3 h-3 ml-auto" />}
          </button>
          <button onClick={() => toggleSort(colKey)}
            className={'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors w-full text-left ' + (sortDir === 'desc' ? 'bg-[#64b5f6]/20 text-[#64b5f6]' : 'text-[#b0bec5] hover:bg-white/10 hover:text-white')}>
            <ArrowDown className="w-3.5 h-3.5" /> Sort Z to A {sortDir === 'desc' && <Check className="w-3 h-3 ml-auto" />}
          </button>
        </div>
        {hasFilter && (
          <button onClick={() => clearFilter(colKey)}
            className="flex items-center gap-2 px-3 py-2 text-xs text-[#ef9a9a] hover:bg-[#ef5350]/10 border-b border-white/10 w-full text-left">
            <X className="w-3.5 h-3.5" /> Hapus Filter dari &apos;{colLabel}&apos;
          </button>
        )}
        {/* Search */}
        <div className="p-2 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#546e7a]" />
            <input type="text" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Cari..." className="w-full pl-8 pr-3 py-1.5 glass-input rounded-md text-xs" autoFocus />
          </div>
        </div>
        {/* Checkboxes */}
        <div className="max-h-48 overflow-y-auto aero-scroll p-1.5">
          <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer text-xs">
            <input type="checkbox" checked={allSelected} onChange={() => toggleSelectAll(allVals)} className="rounded border-white/20 bg-white/5" />
            <span className="text-[#90caf9] font-medium">(Pilih Semua)</span>
          </label>
          {filteredVals.map(val => (
            <label key={val} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer text-xs">
              <input type="checkbox" checked={tempFilterValues.includes(val)} onChange={() => toggleTempValue(val)} className="rounded border-white/20 bg-white/5" />
              <span className="text-[#b0bec5] truncate" title={val}>{val}</span>
            </label>
          ))}
          {filteredVals.length === 0 && <p className="text-xs text-[#546e7a] text-center py-3">Tidak ditemukan</p>}
        </div>
        {/* OK / Cancel */}
        <div className="flex items-center justify-end gap-2 p-2 border-t border-white/10">
          <button onClick={() => { setActiveFilterCol(null); setFilterSearch(''); }} className="px-3 py-1.5 rounded-md text-xs text-[#78909c] hover:bg-white/5 hover:text-white transition-colors">Batal</button>
          <button onClick={applyFilter} className="px-3 py-1.5 rounded-md text-xs glass-btn">OK</button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Import Dialog */}
      {showImportDialog && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#ffb74d]" />
              <h3 className="text-sm font-semibold text-[#e3f2fd]">Import Data (Excel / CSV)</h3>
            </div>
            <button onClick={closeImport} className="text-[#546e7a] hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          {!importResult ? (
            <>
              {/* Drop zone */}
              <div
                onClick={() => importInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) setImportFile(f); }}
                className="border-2 border-dashed border-white/15 rounded-xl p-8 text-center cursor-pointer hover:border-[#ffb74d]/50 hover:bg-white/5 transition-all"
              >
                <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setImportFile(f); }} />
                {importFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileUp className="w-8 h-8 text-[#ffb74d]" />
                    <p className="text-sm text-[#e0e0e0] font-medium">{importFile.name}</p>
                    <p className="text-xs text-[#546e7a]">{(importFile.size / 1024).toFixed(1)} KB</p>
                    <button onClick={(e) => { e.stopPropagation(); setImportFile(null); }} className="text-xs text-[#ef5350] hover:text-[#ff8a80]">Ganti file</button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-[#546e7a]" />
                    <p className="text-sm text-[#b0bec5]">Klik atau drag & drop file di sini</p>
                    <p className="text-xs text-[#546e7a]">Mendukung .xlsx, .xls, .csv</p>
                  </div>
                )}
              </div>

              {/* Mode selection */}
              <div className="flex items-center gap-4 mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="importMode" value="replace" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} className="accent-[#64b5f6]" />
                  <div>
                    <span className="text-sm text-[#e0e0e0]">Ganti Semua Data</span>
                    <p className="text-[10px] text-[#546e7a]">Data lama akan dihapus, diganti data baru</p>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="importMode" value="append" checked={importMode === 'append'} onChange={() => setImportMode('append')} className="accent-[#64b5f6]" />
                  <div>
                    <span className="text-sm text-[#e0e0e0]">Tambahkan ke Data</span>
                    <p className="text-[10px] text-[#546e7a]">Data baru ditambahkan, duplikat otomatis dilewati</p>
                  </div>
                </label>
              </div>

              {/* Error */}
              {importError && (
                <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-[#ef5350]/10 border border-[#ef5350]/20">
                  <AlertCircle className="w-4 h-4 text-[#ef5350] mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-[#ef9a9a]">{importError}</p>
                </div>
              )}

              {/* Import button */}
              <div className="flex justify-end mt-4">
                <button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{background:'linear-gradient(135deg, rgba(255,183,77,0.3), rgba(255,138,101,0.3))', border:'1px solid rgba(255,183,77,0.4)', color:'#ffb74d'}}
                >
                  {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengimport...</> : <><Upload className="w-4 h-4" /> Import Sekarang</>}
                </button>
              </div>
            </>
          ) : (
            /* Success result */
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-[#81c784]/20 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-[#81c784]" />
              </div>
              <h4 className="text-sm font-semibold text-[#e0e0e0] mb-1">Import Berhasil!</h4>
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-[#81c784]">{importResult.inserted}</p>
                  <p className="text-[10px] text-[#78909c]">Data Baru</p>
                </div>
                {importResult.mode === 'append' && importResult.skipped > 0 && (
                  <>
                    <div className="w-px h-8 bg-white/10" />
                    <div className="text-center">
                      <p className="text-lg font-bold text-[#ffb74d]">{importResult.skipped}</p>
                      <p className="text-[10px] text-[#78909c]">Duplikat Dilewati</p>
                    </div>
                  </>
                )}
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-lg font-bold text-[#90caf9]">{importResult.totalInFile ?? importResult.inserted}</p>
                  <p className="text-[10px] text-[#78909c]">Total di File</p>
                </div>
              </div>
              <p className="text-[10px] text-[#546e7a] mb-3">Mode: {importResult.mode === 'replace' ? 'Ganti Semua' : 'Tambahkan (auto-dedup)'}</p>
              <div className="text-left p-3 rounded-lg bg-white/5 mb-4 max-h-48 overflow-y-auto aero-scroll">
                <p className="text-[10px] text-[#78909c] mb-1 font-medium">Kolom Terdeteksi Otomatis:</p>
                {Object.entries(importResult.mapping.baseColumns as Record<string, string>).map(([src, field]) => (
                  <div key={src} className="flex items-center gap-2 text-xs py-0.5">
                    <span className="text-[#b0bec5]">{src}</span>
                    <span className="text-[#546e7a]">&rarr;</span>
                    <span className="text-[#90caf9]">{field}</span>
                  </div>
                ))}
                {Object.entries(importResult.mapping.customColumns as Record<string, string>).map(([src, colId]) => (
                  <div key={src} className="flex items-center gap-2 text-xs py-0.5">
                    <span className="text-[#b0bec5]">{src}</span>
                    <span className="text-[#546e7a]">&rarr;</span>
                    <span className="text-[#ffb74d]">Kolom Baru</span>
                  </div>
                ))}
              </div>
              <button onClick={closeImport} className="px-4 py-2 glass-btn rounded-lg text-sm">Tutup</button>
            </div>
          )}
        </div>
      )}

      {/* Clear Data Confirmation Dialog */}
      {showClearConfirm && (
        <div className="glass-card rounded-xl p-5 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Eraser className="w-5 h-5 text-[#ef5350]" />
              <h3 className="text-sm font-semibold text-[#e3f2fd]">Clear Semua Data</h3>
            </div>
            <button onClick={closeClearConfirm} className="text-[#546e7a] hover:text-white" disabled={clearing}><X className="w-4 h-4" /></button>
          </div>

          {!clearResult ? (
            <>
              <div className="flex items-start gap-3 mb-4 p-3 rounded-lg bg-[#ef5350]/10 border border-[#ef5350]/20">
                <TriangleAlert className="w-5 h-5 text-[#ef5350] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-[#ef9a9a] font-medium">Peringatan! Tindakan ini tidak bisa dibatalkan.</p>
                  <p className="text-xs text-[#78909c] mt-1">Semua data baris ({rows.length} baris) dan kolom kustom ({customCols.length} kolom) akan dihapus secara permanen dari database.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={closeClearConfirm} className="px-4 py-2 glass-btn rounded-lg text-sm" disabled={clearing}>Batal</button>
                <button
                  onClick={handleClearAll}
                  disabled={clearing || rows.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{background:'linear-gradient(135deg, rgba(239,83,80,0.3), rgba(229,57,53,0.3))', border:'1px solid rgba(239,83,80,0.4)', color:'#ef5350'}}
                >
                  {clearing ? <><Loader2 className="w-4 h-4 animate-spin" /> Menghapus...</> : <><Eraser className="w-4 h-4" /> Ya, Hapus Semua</>}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-3">
              <div className="w-12 h-12 rounded-full bg-[#81c784]/20 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-[#81c784]" />
              </div>
              <h4 className="text-sm font-semibold text-[#e0e0e0] mb-1">Data Berhasil Dihapus!</h4>
              <p className="text-xs text-[#90caf9] mb-4">{clearResult.message}</p>
              <button onClick={closeClearConfirm} className="px-4 py-2 glass-btn rounded-lg text-sm">Tutup</button>
            </div>
          )}
        </div>
      )}

      {/* KMZ Export Dialog */}
      {showKmzDialog && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#ffb74d]" />
              <h3 className="text-sm font-semibold text-[#e3f2fd]">Export KMZ</h3>
            </div>
            <button onClick={() => setShowKmzDialog(false)} className="text-[#546e7a] hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-[#78909c] mb-1">Kolom Koordinat <span className="text-[#ef5350]">*</span></label>
              <select value={kmzCoordCol} onChange={(e) => setKmzCoordCol(e.target.value)} className="w-full px-3 py-2 glass-input rounded-lg text-sm">
                <option value="" style={{ background: '#1a1a2e' }}>-- Pilih Kolom --</option>
                {getAllColumns().map(c => (<option key={c.key} value={c.key} style={{ background: '#1a1a2e' }}>{c.label}</option>))}
              </select>
              <p className="text-[10px] text-[#546e7a] mt-1">Format: (-6.994292,110.429400)</p>
            </div>
            <div>
              <label className="block text-xs text-[#78909c] mb-1">Kolom Nama (Placemark)</label>
              <div className="max-h-28 overflow-y-auto aero-scroll space-y-1 p-2 rounded-lg bg-white/5">
                {getAllColumns().map(c => (
                  <label key={c.key} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={kmzNameCols.includes(c.key)} onChange={(e) => setKmzNameCols(prev => e.target.checked ? [...prev, c.key] : prev.filter(k => k !== c.key))} className="rounded" />
                    <span className="text-[#b0bec5]">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-[#78909c] mb-1">Kolom Deskripsi (opsional)</label>
              <div className="max-h-28 overflow-y-auto aero-scroll space-y-1 p-2 rounded-lg bg-white/5">
                {getAllColumns().map(c => (
                  <label key={c.key} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={kmzDescCols.includes(c.key)} onChange={(e) => setKmzDescCols(prev => e.target.checked ? [...prev, c.key] : prev.filter(k => k !== c.key))} className="rounded" />
                    <span className="text-[#b0bec5]">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button onClick={exportKmz} className="flex items-center gap-2 px-4 py-2.5 glass-btn rounded-lg text-sm"><MapPin className="w-4 h-4" /> Download KMZ</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="glass-card rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#546e7a]" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari data..." className="w-full pl-10 pr-4 py-2.5 glass-input rounded-lg text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2.5 glass-btn rounded-lg text-sm"><FileSpreadsheet className="w-4 h-4" /> Export Excel</button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 glass-btn rounded-lg text-sm"><Download className="w-4 h-4" /> Export CSV</button>
          <button onClick={() => setShowKmzDialog(!showKmzDialog)} className="flex items-center gap-2 px-4 py-2.5 glass-btn rounded-lg text-sm"><MapPin className="w-4 h-4" /> Export KMZ</button>
          {!viewer && user?.role === 'ADMIN' && (
            <>
              <button onClick={() => setShowImportDialog(true)} className="flex items-center gap-2 px-4 py-2.5 glass-btn rounded-lg text-sm" style={{background:'linear-gradient(135deg, rgba(255,183,77,0.2), rgba(255,138,101,0.2))', border:'1px solid rgba(255,183,77,0.3)'}}><Upload className="w-4 h-4" style={{color:'#ffb74d'}}/> <span style={{color:'#ffb74d'}}>Import Data</span></button>
              <button onClick={() => setShowClearConfirm(true)} className="flex items-center gap-2 px-4 py-2.5 glass-btn rounded-lg text-sm" style={{background:'linear-gradient(135deg, rgba(239,83,80,0.15), rgba(229,57,53,0.15))', border:'1px solid rgba(239,83,80,0.25)'}}><Eraser className="w-4 h-4" style={{color:'#ef5350'}}/> <span style={{color:'#ef5350'}}>Clear Data</span></button>
              <button onClick={() => setShowColManager(!showColManager)} className="flex items-center gap-2 px-4 py-2.5 glass-btn rounded-lg text-sm"><Settings className="w-4 h-4" /> Kelola Kolom</button>
              <button onClick={() => setShowAddRow(!showAddRow)} className="flex items-center gap-2 px-4 py-2.5 glass-btn-success rounded-lg text-sm"><Plus className="w-4 h-4" /> Tambah Baris</button>
              <FormBuilder customCols={customCols.map(c => ({ id: c.id, name: c.name, label: c.label }))} />
            </>
          )}
        </div>
      </div>

      {/* Column Manager */}
      {showColManager && user?.role === 'ADMIN' && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#e3f2fd]">Kelola Kolom Kustom</h3>
            <button onClick={() => setShowColManager(false)} className="text-[#546e7a] hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-wrap items-end gap-3 mb-5 p-4 rounded-lg bg-white/5">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-[#78909c] mb-1">Nama Kolom (Key)</label>
              <input value={newColName} onChange={(e) => setNewColName(e.target.value)} className="w-full px-3 py-2 glass-input rounded-lg text-sm" placeholder="progress_status" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-[#78909c] mb-1">Label Tampilan</label>
              <input value={newColLabel} onChange={(e) => setNewColLabel(e.target.value)} className="w-full px-3 py-2 glass-input rounded-lg text-sm" placeholder="Progress Status" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-[#78909c] mb-1">Divisi</label>
              <select value={newColDivision} onChange={(e) => setNewColDivision(e.target.value)} className="w-full px-3 py-2 glass-input rounded-lg text-sm">
                <option value="">Tanpa Divisi (Admin Only)</option>
                {divisions.map(d => (<option key={d.id} value={d.id} style={{ background: '#1a1a2e' }}>{d.name}</option>))}
              </select>
            </div>
            <button onClick={handleAddColumn} className="flex items-center gap-2 px-4 py-2 glass-btn rounded-lg text-sm"><Plus className="w-4 h-4" /> Tambah</button>
          </div>
          {customCols.length === 0 ? (
            <p className="text-sm text-[#546e7a] text-center py-4">Belum ada kolom kustom</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto aero-scroll">
              {customCols.map(col => (
                editingCol === col.id ? (
                  <div key={col.id} className="p-3 rounded-lg bg-white/10 border border-[#42a5f5]/30 space-y-2">
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-[10px] text-[#78909c] mb-1">Nama Kolom (Key)</label>
                        <input value={editColName} onChange={(e) => setEditColName(e.target.value)} className="w-full px-2.5 py-1.5 glass-input rounded-md text-xs" />
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-[10px] text-[#78909c] mb-1">Label Tampilan</label>
                        <input value={editColLabel} onChange={(e) => setEditColLabel(e.target.value)} className="w-full px-2.5 py-1.5 glass-input rounded-md text-xs" />
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-[10px] text-[#78909c] mb-1">Divisi</label>
                        <select value={editColDivision} onChange={(e) => setEditColDivision(e.target.value)} className="w-full px-2.5 py-1.5 glass-input rounded-md text-xs">
                          <option value="">Tanpa Divisi (Admin Only)</option>
                          {divisions.map(d => (<option key={d.id} value={d.id} style={{ background: '#1a1a2e' }}>{d.name}</option>))}
                        </select>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={handleEditColumn} className="p-1.5 rounded-md hover:bg-[#66bb6a]/20 text-[#66bb6a]"><Check className="w-4 h-4" /></button>
                        <button onClick={cancelEditColumn} className="p-1.5 rounded-md hover:bg-[#ef5350]/10 text-[#ef5350]"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={col.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 group">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getDivisionColor(col.divisionId) }} />
                      <span className="text-sm text-[#e0e0e0]">{col.label}</span>
                      {col.division && (<span className="text-[10px] px-2 py-0.5 rounded-full badge-division" style={{ borderColor: col.division.color, color: col.division.color, backgroundColor: col.division.color + '15' }}>{col.division.name}</span>)}
                      {col.isLocked && (<span className="badge-locked text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"><Lock className="w-3 h-3" /> Terkunci</span>)}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEditColumn(col)} className="p-1.5 rounded-md hover:bg-[#42a5f5]/10 text-[#78909c] hover:text-[#42a5f5]" title="Edit kolom"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleToggleLock(col)} className="p-1.5 rounded-md hover:bg-white/10 text-[#78909c] hover:text-white">{col.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}</button>
                      <button onClick={() => handleDeleteColumn(col.id)} className="p-1.5 rounded-md hover:bg-[#ef5350]/10 text-[#78909c] hover:text-[#ef5350]"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Row Form */}
      {showAddRow && user?.role === 'ADMIN' && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#e3f2fd]">Tambah Baris Baru</h3>
            <div className="flex gap-2">
              <button onClick={handleAddRow} className="flex items-center gap-1 px-3 py-1.5 glass-btn-success rounded-lg text-xs"><Save className="w-3.5 h-3.5" /> Simpan</button>
              <button onClick={() => { setShowAddRow(false); setNewRow({}); }} className="p-1.5 rounded-md hover:bg-white/10 text-[#546e7a]"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {BASE_COLUMNS.filter(c => c.key !== 'orderNum').map(col => (
              <div key={col.key}>
                <label className="block text-[10px] text-[#546e7a] mb-1">{col.label}</label>
                <input value={(newRow as any)[col.key] || ''} onChange={(e) => setNewRow(prev => ({ ...prev, [col.key]: e.target.value }))} className="w-full px-2.5 py-1.5 glass-input rounded-md text-xs" placeholder={col.label} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="glass-card rounded-xl flex-1 flex flex-col overflow-hidden min-h-0 relative">
        {scrollInfo.top && (
          <div className="absolute top-11 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-0.5 opacity-40 animate-pulse">
              <ChevronDown className="w-4 h-4 text-[#64b5f6] rotate-180" />
              <span className="text-[9px] text-[#64b5f6]">scroll atas</span>
            </div>
          </div>
        )}
        {scrollInfo.left && (
          <div className="absolute top-1/2 left-2 -translate-y-1/2 z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-0.5 opacity-40 animate-pulse">
              <ChevronRight className="w-4 h-4 text-[#64b5f6] rotate-180" />
              <span className="text-[9px] text-[#64b5f6]" style={{writingMode:'vertical-lr'}}>scroll</span>
            </div>
          </div>
        )}
        <div ref={tableBodyRef} onScroll={updateScrollInfo}
          className="overflow-auto aero-scroll"
          style={{ maxHeight: 'calc(20 * 2.4rem + 2.6rem)' }}>
          <table className="aero-table">
            <thead>
              <tr>
                {BASE_COLUMNS.map(col => {
                  const hasFilter = columnFilters[col.key] !== undefined;
                  const sortDir = sortConfig?.key === col.key ? sortConfig.direction : null;
                  return (
                    <th key={col.key} style={{ minWidth: col.width }} className="relative group">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openFilter(col.key)} className="flex items-center gap-1 hover:text-white transition-colors">
                          {sortDir === 'asc' && <ArrowUp className="w-3 h-3 text-[#64b5f6]" />}
                          {sortDir === 'desc' && <ArrowDown className="w-3 h-3 text-[#64b5f6]" />}
                          {!sortDir && hasFilter && <Filter className="w-3 h-3 text-[#ffb74d]" />}
                          {!sortDir && !hasFilter && <ChevronsUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />}
                          {col.label}
                        </button>
                        {col.editable && user?.role !== 'ADMIN' && (<span className="w-1.5 h-1.5 rounded-full bg-[#81c784]" title="Bisa diedit" />)}
                        <button onClick={() => openFilter(col.key)} className={'p-0.5 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all ' + (hasFilter ? '!opacity-100' : '')}>
                          <ChevronDown className="w-3 h-3 text-[#78909c]" />
                        </button>
                      </div>
                      <FilterDropdown colKey={col.key} colLabel={col.label} />
                    </th>
                  );
                })}
                {customCols.map(col => {
                  const hasFilter = columnFilters[col.id] !== undefined;
                  const sortDir = sortConfig?.key === col.id ? sortConfig.direction : null;
                  return (
                    <th key={col.id} style={{ minWidth: 150 }} className="relative group">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openFilter(col.id)} className="flex items-center gap-1.5 hover:text-white transition-colors">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: getDivisionColor(col.divisionId) }} />
                          {sortDir === 'asc' && <ArrowUp className="w-3 h-3 text-[#64b5f6]" />}
                          {sortDir === 'desc' && <ArrowDown className="w-3 h-3 text-[#64b5f6]" />}
                          {!sortDir && hasFilter && <Filter className="w-3 h-3 text-[#ffb74d]" />}
                          {!sortDir && !hasFilter && <ChevronsUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />}
                          {col.label}
                        </button>
                        {col.isLocked && <Lock className="w-3 h-3 text-[#ef9a9a]" />}
                        <button onClick={() => openFilter(col.id)} className={'p-0.5 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all ' + (hasFilter ? '!opacity-100' : '')}>
                          <ChevronDown className="w-3 h-3 text-[#78909c]" />
                        </button>
                      </div>
                      <FilterDropdown colKey={col.id} colLabel={col.label} />
                    </th>
                  );
                })}
                {user?.role === 'ADMIN' && (<th style={{ minWidth: 50 }}>Aksi</th>)}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => (
                <tr key={row.id}>
                  {BASE_COLUMNS.map(col => {
                    const val = getCellValue(row, col.key);
                    const canEdit = canEditCell(col.key, null);
                    const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === col.key;
                    return (
                      <td key={col.key}>
                        {isEditing ? (
                          <textarea ref={editRef} value={editValue} onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleCellSave(row.id, col.key, editValue)}
                            onKeyDown={(e) => { if (e.key === 'Escape') setEditingCell(null); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleCellSave(row.id, col.key, editValue); } }}
                            className="w-full px-2 py-1 glass-input rounded text-xs resize-y" rows={2}
                            style={{ minWidth: col.width - 24, minHeight: 40 }} />
                        ) : (
                          <div className={'editable-cell text-xs ' + (!canEdit ? 'cursor-default' : '')}
                            onClick={() => { if (canEdit) { setEditingCell({ rowId: row.id, colKey: col.key }); setEditValue(val); } }}
                            title={val}>
                            {val ? val.split('\n').map((line, i) => <span key={i}>{line}{i < val.split('\n').length - 1 && <br />}</span>) : <span className="text-[#37474f]">-</span>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {customCols.map(col => {
                    const val = getCellValue(row, col.id);
                    const canEdit = canEditCell(col.id, col);
                    const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === col.id;
                    return (
                      <td key={col.id}>
                        {isEditing ? (
                          <textarea ref={editRef} value={editValue} onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleCellSave(row.id, col.id, editValue)}
                            onKeyDown={(e) => { if (e.key === 'Escape') setEditingCell(null); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleCellSave(row.id, col.id, editValue); } }}
                            className="w-full px-2 py-1 glass-input rounded text-xs resize-y" rows={2}
                            style={{ minHeight: 40 }} />
                        ) : (
                          <div className={'editable-cell text-xs ' + (!canEdit ? 'cursor-default' : '') + (col.isLocked ? ' locked-cell' : '')}
                            onClick={() => { if (!canEdit) return; setEditingCell({ rowId: row.id, colKey: col.id }); setEditValue(val); }}
                            title={col.isLocked ? 'Kolom terkunci' : val}>
                            {val ? val.split('\n').map((line, i) => <span key={i}>{line}{i < val.split('\n').length - 1 && <br />}</span>) : <span className="text-[#37474f]">-</span>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {user?.role === 'ADMIN' && (
                    <td>
                      <button onClick={() => handleDeleteRow(row.id)} className="p-1.5 rounded-md hover:bg-[#ef5350]/10 text-[#546e7a] hover:text-[#ef5350] transition-colors" title="Hapus baris">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Info bar */}
        <div className="flex items-center justify-between p-3 border-t border-white/5">
          <p className="text-xs text-[#546e7a]">
            Total {displayRows.length} data{displayRows.length !== rows.length ? ' (filter dari ' + rows.length + ')' : ''}
            {activeFilterCount > 0 && (
              <button onClick={() => setColumnFilters({})}
                className="ml-2 text-[#ffb74d] hover:text-[#ffcc80] underline decoration-dotted">
                {activeFilterCount} filter aktif (klik untuk hapus semua)
              </button>
            )}
          </p>
          <div className="flex items-center gap-3 text-[10px] text-[#546e7a]">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
              scroll atas/bawah
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>
              scroll kiri/kanan
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
