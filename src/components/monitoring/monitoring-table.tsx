'use client';
import { apiFetch } from '@/lib/api';

import { useState, useEffect, useCallback, useRef, useMemo, useDeferredValue } from 'react';
import { useAppStore } from '@/store/app-store';
import {
  Plus, Trash2, Search, Lock, Unlock, Settings,
  Download, X, Save, FileSpreadsheet, MapPin, ChevronDown,
  Filter, ArrowUp, ArrowDown, Check, ChevronsUpDown, Upload, FileUp, Loader2, AlertCircle, Eraser, TriangleAlert, Pencil
} from 'lucide-react';
import { FormBuilder } from '@/components/forms/form-builder';
import { TableVirtuoso } from 'react-virtuoso';

// No more hardcoded base columns — all columns come from Excel imports as custom columns.

interface MonitoringRow {
  id: string;
  orderNum: number;
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
  const activeProject = useAppStore((s) => s.projects.find(p => p.id === s.activeProjectId));
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
  const [editingRow, setEditingRow] = useState<MonitoringRow | null>(null);
  const [editRowData, setEditRowData] = useState<Record<string, string>>({});

  // Column filter & sort state
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [tempFilterValues, setTempFilterValues] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const editRef = useRef<HTMLTextAreaElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  // Track which cell is currently being saved — prevents race condition
  // where finishing an async save closes a DIFFERENT cell's editor
  const savingCellRef = useRef<{ rowId: string; colKey: string } | null>(null);

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

  // ═══ PERFORMANCE: Cache parsed customData — avoid 200k+ JSON.parse calls ═══
  const parsedCache = useMemo(() => {
    const cache = new Map<string, Record<string, string>>();
    for (const row of rows) {
      try { cache.set(row.id, JSON.parse(row.customData || '{}')); }
      catch { cache.set(row.id, {}); }
    }
    return cache;
  }, [rows]);

  // ═══ PERFORMANCE: Deferred search — don't block UI on every keystroke ═══
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    if (editingCell && editRef.current) {
      editRef.current.focus();
      const len = editRef.current.value.length;
      editRef.current.setSelectionRange(len, len);
    }
  }, [editingCell]);

  // ═══ VIRTUAL SCROLL SAFETY: When react-virtuoso scrolls the editing
  // row out of the viewport, it unmounts the textarea WITHOUT firing
  // React's onBlur. Detect this by checking whether the textarea ref
  // is still attached to the DOM. If not, flush the save immediately.
  const editCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (editingCell) {
      // Poll every 200ms while editing — if textarea is unmounted by virtual scroll,
      // the ref goes null and we save
      editCheckInterval.current = setInterval(() => {
        if (editingCell && editRef.current && !document.body.contains(editRef.current)) {
          // Textarea was removed from DOM by virtual scroll — save immediately
          handleCellSave(editingCell.rowId, editingCell.colKey, editValue);
        }
      }, 200);
    } else {
      if (editCheckInterval.current) { clearInterval(editCheckInterval.current); editCheckInterval.current = null; }
    }
    return () => { if (editCheckInterval.current) { clearInterval(editCheckInterval.current); editCheckInterval.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCell]);

  const canEditOrDelete = viewer ? false : (user?.role === 'ADMIN' || user?.role === 'EDITOR');

  const canEditCell = (colKey: string, col: CustomColumn | null) => {
    if (viewer) return false;
    if (user?.role === 'ADMIN') return true;
    if (user?.role === 'EDITOR') return true;
    if (!col) return false;
    if (col.isLocked) return false;
    return false;
  };

  const handleCellSave = async (rowId: string, colKey: string, value: string) => {
    // Mark this cell as the one being saved (race-condition guard)
    savingCellRef.current = { rowId, colKey };
    const col = customCols.find(c => c.name === colKey);
    try {
      const res = await fetch('/api/monitoring/cells', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowId, colKey, value,
          colLabel: col?.label || colKey,
          isCustomCol: true,
          isLocked: col?.isLocked || false,
          colDivisionId: col?.divisionId || null,
        }),
      });
      if (!res.ok) { const data = await res.json(); alert(data.error); savingCellRef.current = null; return; }
      setRows(prev => prev.map(r => {
        if (r.id !== rowId) return r;
        const cd = JSON.parse(r.customData || '{}');
        cd[colKey] = value;
        return { ...r, customData: JSON.stringify(cd) };
      }));
    } catch (err) { console.error('Save error:', err); }
    // Only clear editingCell if the user hasn't already moved to a different cell
    if (savingCellRef.current?.rowId === rowId && savingCellRef.current?.colKey === colKey) {
      setEditingCell(null);
    }
    savingCellRef.current = null;
  };

  const handleAddColumn = async () => {
    if (!newColName.trim() || !newColLabel.trim()) return;
    try {
      const res = await apiFetch('/api/columns', {
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
      await apiFetch('/api/columns', {
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
      await apiFetch(`/api/columns?id=${colId}`, { method: 'DELETE' });
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
      const res = await apiFetch('/api/columns', {
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
      const res = await apiFetch(`/api/monitoring/rows/${rowId}`, { method: 'DELETE' });
      if (!res.ok) { const data = await res.json(); alert(data.error || 'Gagal menghapus baris'); return; }
      fetchData();
    } catch (err) { console.error('Delete error:', err); alert('Gagal menghapus baris'); }
  };

  const handleEditRow = (row: MonitoringRow) => {
    const data = parsedCache.get(row.id) || {};
    setEditRowData({ ...data });
    setEditingRow(row);
  };

  const handleSaveEditRow = async () => {
    if (!editingRow) return;
    try {
      const res = await apiFetch(`/api/monitoring/rows/${editingRow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customData: JSON.stringify(editRowData) }),
      });
      if (!res.ok) { const data = await res.json(); alert(data.error || 'Gagal menyimpan'); return; }
      setEditingRow(null);
      setEditRowData({});
      fetchData();
    } catch (err) { console.error(err); }
  };

  const getCellValue = useCallback((row: MonitoringRow, colKey: string) => {
    const data = parsedCache.get(row.id);
    if (!data) return '';
    const v = data[colKey];
    return v !== undefined ? String(v) : '';
  }, [parsedCache]);

  // Fast lookup by rowId (for virtual scroll itemContent)
  const getCellValueById = useCallback((rowId: string, colKey: string) => {
    const data = parsedCache.get(rowId);
    if (!data) return '';
    const v = data[colKey];
    return v !== undefined ? String(v) : '';
  }, [parsedCache]);

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

  // Search filter (uses deferredSearch for non-blocking UI)
  const searchedRows = useMemo(() => {
    if (!deferredSearch) return rows;
    const s = deferredSearch.toLowerCase();
    return rows.filter(row =>
      (row.customData || '').toLowerCase().includes(s)
    );
  }, [rows, deferredSearch]);

  // Column filters (uses parsedCache for fast lookup)
  const filteredRows = useMemo(() => {
    let result = searchedRows;
    for (const [colKey, allowedVals] of Object.entries(columnFilters)) {
      const allowed = new Set(allowedVals);
      result = result.filter(row => {
        const data = parsedCache.get(row.id);
        return data ? allowed.has(data[colKey] ?? '') : false;
      });
    }
    return result;
  }, [searchedRows, columnFilters, parsedCache]);

  // Sort (uses parsedCache for fast lookup)
  const displayRows = useMemo(() => {
    if (!sortConfig) return filteredRows;
    const sorted = [...filteredRows];
    const key = sortConfig.key;
    const dir = sortConfig.direction;
    sorted.sort((a, b) => {
      const va = parsedCache.get(a.id)?.[key] ?? '';
      const vb = parsedCache.get(b.id)?.[key] ?? '';
      const na = parseFloat(va); const nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb)) return dir === 'asc' ? na - nb : nb - na;
      return dir === 'asc'
        ? va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' })
        : vb.localeCompare(va, undefined, { numeric: true, sensitivity: 'base' });
    });
    return sorted;
  }, [filteredRows, sortConfig, parsedCache]);

  const activeFilterCount = Object.keys(columnFilters).length;

  const exportCSV = () => {
    const allCols = getAllColumns();
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
  const [kmzNameCols, setKmzNameCols] = useState<string[]>([]);
  const [kmzDescCols, setKmzDescCols] = useState<string[]>([]);

  // Parse columnOrder from project (saved during import to preserve original Excel order)
  const columnOrderKeys: string[] = useMemo(() => {
    try {
      const raw = activeProject?.columnOrder;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [activeProject?.columnOrder]);

  const getAllColumns = useCallback(() => {
    const customColMap = new Map(customCols.map(c => [c.name, c]));

    // If we have a saved column order from import, use it
    if (columnOrderKeys.length > 0) {
      const ordered: { key: string; label: string; width?: number; editable?: boolean }[] = [];
      const seen = new Set<string>();
      for (const key of columnOrderKeys) {
        if (seen.has(key)) continue;
        seen.add(key);
        if (customColMap.has(key)) {
          const cc = customColMap.get(key)!;
          ordered.push({ key: cc.name, label: cc.label, width: 150, editable: false });
        }
      }
      // Append any columns not in the saved order (e.g. manually added later)
      for (const c of customCols) {
        if (!seen.has(c.name)) {
          ordered.push({ key: c.name, label: c.label, width: 150, editable: false });
          seen.add(c.name);
        }
      }
      return ordered;
    }

    // Fallback: no saved order — show custom columns in DB order
    return customCols.map(c => ({ key: c.name, label: c.label, width: 150, editable: false }));
  }, [customCols, columnOrderKeys]);

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
      const projectId = useAppStore.getState().activeProjectId;
      const fileName = importFile.name;
      const mode = importMode;

      // ═══ Client-side file parsing (bypasses Vercel 4.5MB body limit) ═══
      const buffer = await importFile.arrayBuffer();
      const fileLower = fileName.toLowerCase();
      let parsedRows: Record<string, any>[] = [];

      if (fileLower.endsWith('.csv') || fileLower.endsWith('.txt')) {
        const text = new TextDecoder().decode(buffer);
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { setImportError('File CSV kosong atau hanya 1 baris'); return; }
        const firstLine = lines[0];
        const commaCount = (firstLine.match(/,/g) || []).length;
        const semiCount = (firstLine.match(/;/g) || []).length;
        const tabCount = (firstLine.match(/\t/g) || []).length;
        let sep = ',';
        if (semiCount > commaCount && semiCount > tabCount) sep = ';';
        else if (tabCount > commaCount) sep = '\t';
        function parseCSVLine(line: string, separator: string): string[] {
          const result: string[] = []; let current = ''; let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) { if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; } else if (ch === '"') { inQuotes = false; } else { current += ch; } }
            else { if (ch === '"') { inQuotes = true; } else if (ch === separator) { result.push(current.trim()); current = ''; } else { current += ch; } }
          }
          result.push(current.trim()); return result;
        }
        const headers = parseCSVLine(lines[0], sep);
        for (let i = 1; i < lines.length; i++) {
          const vals = parseCSVLine(lines[i], sep);
          if (vals.every(v => v === '')) continue;
          const obj: Record<string, any> = {};
          headers.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
          parsedRows.push(obj);
        }
      } else if (fileLower.endsWith('.xlsx') || fileLower.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (allRows.length < 2) { setImportError('File Excel kosong atau hanya 1 baris'); return; }
        const headers = allRows[0].map(h => String(h).trim());
        for (let i = 1; i < allRows.length; i++) {
          const vals = allRows[i];
          if (!vals || vals.every(v => String(v).trim() === '')) continue;
          const obj: Record<string, any> = {};
          headers.forEach((h, idx) => { obj[h] = vals[idx] ?? ''; });
          parsedRows.push(obj);
        }
      } else {
        setImportError('Format file tidak didukung. Gunakan .csv, .xlsx, atau .xls');
        return;
      }

      if (parsedRows.length === 0) { setImportError('Tidak ada data ditemukan dalam file'); return; }

      // ═══ Chunked upload: split rows into chunks under 3.5MB each ═══
      const CHUNK_MAX_BYTES = 3.5 * 1024 * 1024; // 3.5MB safe limit per chunk
      const chunks: Record<string, any>[][] = [];
      let currentChunk: Record<string, any>[] = [];
      let currentSize = 0;
      let chunkIndex = 0;

      for (const row of parsedRows) {
        const rowJson = JSON.stringify(row);
        const rowSize = new Blob([rowJson]).size;

        // If adding this row would exceed chunk limit, start new chunk
        if (currentChunk.length > 0 && currentSize + rowSize > CHUNK_MAX_BYTES) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentSize = 0;
        }
        currentChunk.push(row);
        currentSize += rowSize;
      }
      if (currentChunk.length > 0) chunks.push(currentChunk);

      const totalChunks = chunks.length;
      let totalInserted = 0;
      let totalSkipped = 0;
      let colMapping: Record<string, string> = {};
      let totalColsCreated = 0;

      for (let ci = 0; ci < chunks.length; ci++) {
        const isLast = ci === chunks.length - 1;
        const res = await fetch('/api/monitoring/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: chunks[ci],
            mode: ci === 0 ? mode : 'append', // First chunk handles mode, rest always append
            projectId,
            fileName: `${fileName} (chunk ${ci + 1}/${totalChunks})`,
            chunkIndex: ci,
            totalChunks,
          }),
        });

        const text = await res.text();
        let data: any;
        try { data = JSON.parse(text); } catch {
          setImportError(`Server error: ${text.slice(0, 200)}`);
          return;
        }

        if (!res.ok) { setImportError(data.error); return; }

        totalInserted += data.inserted || 0;
        totalSkipped += data.skipped || 0;
        if (Object.keys(colMapping).length === 0) colMapping = data.mapping || {};
        totalColsCreated = data.totalCustomColsCreated || 0;
      }

      setImportResult({
        success: true,
        inserted: totalInserted,
        skipped: totalSkipped,
        totalInFile: parsedRows.length,
        mode,
        mapping: colMapping,
        totalCustomColsCreated: totalColsCreated,
        chunks: totalChunks,
      });
      fetchData();
    } catch (err: any) {
      setImportError(err.message || 'Gagal import');
    }
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
    <div className="flex flex-col h-full gap-4 min-h-0">
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
                    <p className="text-xs text-[#546e7a]">{importFile.size > 1024 * 1024 ? (importFile.size / 1024 / 1024).toFixed(1) + ' MB' : (importFile.size / 1024).toFixed(1) + ' KB'}{importFile.size > 50 * 1024 * 1024 ? ' — <span className="text-[#90caf9]">File besar, proses import mungkin memakan waktu</span>' : ''}</p>
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
                <p className="text-[10px] text-[#78909c] mb-1 font-medium">Kolom Terdeteksi:</p>
                {Object.entries(importResult.mapping as Record<string, string>).map(([src, colName]) => (
                  <div key={src} className="flex items-center gap-2 text-xs py-0.5">
                    <span className="text-[#b0bec5]">{src}</span>
                    <span className="text-[#546e7a]">&rarr;</span>
                    <span className="text-[#90caf9]">{colName}</span>
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
          {!viewer && user?.role === 'EDITOR' && (
            <button onClick={() => setShowAddRow(!showAddRow)} className="flex items-center gap-2 px-4 py-2.5 glass-btn-success rounded-lg text-sm"><Plus className="w-4 h-4" /> Tambah Baris</button>
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
            {customCols.map(col => (
              <div key={col.name}>
                <label className="block text-[10px] text-[#546e7a] mb-1">{col.label}</label>
                <input value={(newRow as any)[col.name] || ''} onChange={(e) => setNewRow(prev => ({ ...prev, [col.name]: e.target.value }))} className="w-full px-2.5 py-1.5 glass-input rounded-md text-xs" placeholder={col.label} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Data Table — VIRTUAL SCROLLING for 30k+ rows ═══ */}
      <div className="glass-card rounded-xl flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex-1 min-h-0">
          <TableVirtuoso
            data={displayRows}
            style={{ height: '100%' }}
            className="aero-scroll"
          components={{
            Table: ({ style, ...props }) => (
              <table {...props} className="aero-table" style={style} />
            ),
            TableHead: ({ style, ...props }) => (
              <thead {...props} className="sticky top-0 z-20" style={{ ...style, background: 'rgba(13, 27, 42, 0.98)', backdropFilter: 'blur(12px)' }} />
            ),
            TableBody: (props: any) => <tbody {...props} />,
          }}
          fixedHeaderContent={() => (
            <tr>
              {getAllColumns().map(col => {
                const colKey = col.key;
                const customCol = customCols.find(c => c.name === colKey);
                const hasFilter = columnFilters[colKey] !== undefined;
                const sortDir = sortConfig?.key === colKey ? sortConfig.direction : null;
                return (
                  <th key={colKey} style={{ minWidth: col.width || 150 }} className="relative group">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openFilter(colKey)} className="flex items-center gap-1 hover:text-white transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: getDivisionColor(customCol?.divisionId || null) }} />
                        {sortDir === 'asc' && <ArrowUp className="w-3 h-3 text-[#64b5f6]" />}
                        {sortDir === 'desc' && <ArrowDown className="w-3 h-3 text-[#64b5f6]" />}
                        {!sortDir && hasFilter && <Filter className="w-3 h-3 text-[#ffb74d]" />}
                        {!sortDir && !hasFilter && <ChevronsUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />}
                        {col.label}
                      </button>
                      {customCol?.isLocked && <Lock className="w-3 h-3 text-[#ef9a9a]" />}
                      <button onClick={() => openFilter(colKey)} className={'p-0.5 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all ' + (hasFilter ? '!opacity-100' : '')}>
                        <ChevronDown className="w-3 h-3 text-[#78909c]" />
                      </button>
                    </div>
                    <FilterDropdown colKey={colKey} colLabel={col.label} />
                  </th>
                );
              })}
              {canEditOrDelete && (<th style={{ minWidth: 60 }}>Aksi</th>)}
            </tr>
          )}
          itemContent={(index, row) => {
            const cols = getAllColumns();
            return (<>
              {cols.map(col => {
                const colKey = col.key;
                const customCol = customCols.find(c => c.name === colKey) || null;
                const val = getCellValueById(row.id, colKey);
                const canEdit = canEditCell(colKey, customCol);
                const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === colKey;
                return (
                  <td key={colKey}>
                    {isEditing ? (
                      <textarea ref={editRef} value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleCellSave(row.id, colKey, editValue)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') { setEditingCell(null); return; }
                          // Enter saves (like Excel). Shift+Enter for newline.
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleCellSave(row.id, colKey, editValue);
                          }
                          // Tab moves to next cell (save current first)
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            handleCellSave(row.id, colKey, editValue);
                          }
                        }}
                        className="w-full px-2 py-1 glass-input rounded text-xs resize-y" rows={2}
                        style={{ minWidth: (col.width || 150) - 24, minHeight: 40 }} />
                    ) : (
                      <div className={'editable-cell text-xs ' + (!canEdit ? 'cursor-default' : 'cursor-text hover:bg-white/5') + (customCol?.isLocked ? ' locked-cell' : '')}
                        onClick={() => {
                          if (!canEdit) return;
                          // If a save is in flight for another cell, let it finish — don't let it close this new editor
                          savingCellRef.current = null;
                          setEditingCell({ rowId: row.id, colKey });
                          setEditValue(val);
                        }}
                        title={customCol?.isLocked ? 'Kolom terkunci' : (canEdit ? 'Klik untuk edit' : val)}>
                        {val ? val.split('\n').map((line, i) => <span key={i}>{line}{i < val.split('\n').length - 1 && <br />}</span>) : <span className="text-[#37474f]">-</span>}
                      </div>
                    )}
                  </td>
                );
              })}
              {canEditOrDelete && (
                <td>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => handleEditRow(row)} className="p-1.5 rounded-md hover:bg-[#64b5f6]/10 text-[#546e7a] hover:text-[#64b5f6] transition-colors" title="Edit baris">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteRow(row.id)} className="p-1.5 rounded-md hover:bg-[#ef5350]/10 text-[#546e7a] hover:text-[#ef5350] transition-colors" title="Hapus baris">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              )}
            </>);
          }}
        />
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

      {/* Edit Row Modal */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditingRow(null)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><Pencil className="w-4 h-4 text-[#64b5f6]" /> Edit Baris #{editingRow.orderNum}</h3>
              <button onClick={() => setEditingRow(null)} className="text-[#546e7a] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto aero-scroll space-y-3 pr-1">
              {customCols.map(col => (
                <div key={col.name}>
                  <label className="block text-xs text-[#78909c] mb-1">{col.label}</label>
                  <input
                    value={editRowData[col.name] || ''}
                    onChange={(e) => setEditRowData(prev => ({ ...prev, [col.name]: e.target.value }))}
                    className="w-full px-3 py-2 glass-input rounded-lg text-sm"
                    placeholder={col.label}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-white/5">
              <button onClick={() => setEditingRow(null)} className="px-4 py-2 rounded-lg text-xs text-[#78909c] hover:text-white hover:bg-white/5 transition-all">Batal</button>
              <button onClick={handleSaveEditRow} className="px-4 py-2 rounded-lg text-xs font-bold transition-all" style={{ background: 'rgba(100,181,246,0.2)', color: '#64b5f6', border: '1px solid rgba(100,181,246,0.3)' }}>
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
