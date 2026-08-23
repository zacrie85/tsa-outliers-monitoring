'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/store/app-store';
import {
  Plus, Trash2, Search, Lock, Unlock, Settings, ChevronLeft, ChevronRight,
  Download, ArrowUpDown, X, Save
} from 'lucide-react';

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

export function MonitoringTable() {
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
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRow, setNewRow] = useState<any>({});
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const editRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [rowsRes, colsRes, divRes] = await Promise.all([
        fetch('/api/monitoring'),
        fetch('/api/columns'),
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

// eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    if (editingCell && editRef.current) {
      editRef.current.focus();
    }
  }, [editingCell]);

  const canEditCell = (colKey: string, col: CustomColumn | null) => {
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
          rowId,
          colKey,
          value,
          colLabel: col?.label || BASE_COLUMNS.find(c => c.key === colKey)?.label,
          isCustomCol: isCustom,
          isLocked: col?.isLocked || false,
          colDivisionId: col?.divisionId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error);
        return;
      }

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
    } catch (err) {
      console.error('Save error:', err);
    }
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
      if (res.ok) {
        setNewColName('');
        setNewColLabel('');
        setNewColDivision('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleLock = async (col: CustomColumn) => {
    try {
      await fetch('/api/columns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: col.id,
          label: col.label,
          divisionId: col.divisionId,
          isLocked: !col.isLocked,
          order: col.order,
        }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteColumn = async (colId: string) => {
    if (!confirm('Hapus kolom ini?')) return;
    try {
      await fetch(`/api/columns?id=${colId}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRow = async () => {
    try {
      const res = await fetch('/api/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRow),
      });
      if (res.ok) {
        setNewRow({});
        setShowAddRow(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!confirm('Hapus baris ini?')) return;
    try {
      await fetch(`/api/monitoring/rows/${rowId}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
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

  const filteredRows = rows.filter(row => {
    if (!search) return true;
    const s = search.toLowerCase();
    return [
      row.provinsi, row.kabupaten, row.kecamatan, row.kelurahan,
      row.kelRwSiteName, row.desaPerum, row.remarksTsa, row.klasifikasiTsa,
      row.picTsa, row.remarksJlm, row.customData,
    ].some(v => String(v).toLowerCase().includes(s));
  });

  const pagedRows = filteredRows.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredRows.length / pageSize);

  const exportCSV = () => {
    const allCols = [...BASE_COLUMNS, ...customCols.map(c => ({ key: c.id, label: c.label, width: 150, editable: false }))];
    const header = allCols.map(c => `"${c.label}"`).join(',');
    const csvRows = filteredRows.map(row =>
      allCols.map(c => `"${getCellValue(row, c.key).replace(/"/g, '""')}"`).join(',')
    );
    const csv = [header, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tsa_outliers_monitoring.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="glass-card rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#546e7a]" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Cari data..."
            className="w-full pl-10 pr-4 py-2.5 glass-input rounded-lg text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 glass-btn rounded-lg text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          {user?.role === 'ADMIN' && (
            <>
              <button onClick={() => setShowColManager(!showColManager)} className="flex items-center gap-2 px-4 py-2.5 glass-btn rounded-lg text-sm">
                <Settings className="w-4 h-4" /> Kelola Kolom
              </button>
              <button onClick={() => setShowAddRow(!showAddRow)} className="flex items-center gap-2 px-4 py-2.5 glass-btn-success rounded-lg text-sm">
                <Plus className="w-4 h-4" /> Tambah Baris
              </button>
            </>
          )}
        </div>
      </div>

      {/* Column Manager Panel */}
      {showColManager && user?.role === 'ADMIN' && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#e3f2fd]">Kelola Kolom Kustom</h3>
            <button onClick={() => setShowColManager(false)} className="text-[#546e7a] hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Add column form */}
          <div className="flex flex-wrap items-end gap-3 mb-5 p-4 rounded-lg bg-white/5">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-[#78909c] mb-1">Nama Kolom (Key)</label>
              <input value={newColName} onChange={(e) => setNewColName(e.target.value)}
                className="w-full px-3 py-2 glass-input rounded-lg text-sm" placeholder="progress_status" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-[#78909c] mb-1">Label Tampilan</label>
              <input value={newColLabel} onChange={(e) => setNewColLabel(e.target.value)}
                className="w-full px-3 py-2 glass-input rounded-lg text-sm" placeholder="Progress Status" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-[#78909c] mb-1">Divisi</label>
              <select value={newColDivision} onChange={(e) => setNewColDivision(e.target.value)}
                className="w-full px-3 py-2 glass-input rounded-lg text-sm">
                <option value="">Tanpa Divisi (Admin Only)</option>
                {divisions.map(d => (
                  <option key={d.id} value={d.id} style={{ background: '#1a1a2e' }}>{d.name}</option>
                ))}
              </select>
            </div>
            <button onClick={handleAddColumn} className="flex items-center gap-2 px-4 py-2 glass-btn rounded-lg text-sm">
              <Plus className="w-4 h-4" /> Tambah
            </button>
          </div>

          {/* Existing custom columns */}
          {customCols.length === 0 ? (
            <p className="text-sm text-[#546e7a] text-center py-4">Belum ada kolom kustom</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto aero-scroll">
              {customCols.map(col => (
                <div key={col.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 group">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getDivisionColor(col.divisionId) }}
                    />
                    <span className="text-sm text-[#e0e0e0]">{col.label}</span>
                    {col.division && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full badge-division"
                        style={{ borderColor: col.division.color, color: col.division.color, backgroundColor: col.division.color + '15' }}
                      >
                        {col.division.name}
                      </span>
                    )}
                    {col.isLocked && (
                      <span className="badge-locked text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Terkunci
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleToggleLock(col)} className="p-1.5 rounded-md hover:bg-white/10 text-[#78909c] hover:text-white">
                      {col.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => handleDeleteColumn(col.id)} className="p-1.5 rounded-md hover:bg-[#ef5350]/10 text-[#78909c] hover:text-[#ef5350]">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
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
              <button onClick={handleAddRow} className="flex items-center gap-1 px-3 py-1.5 glass-btn-success rounded-lg text-xs">
                <Save className="w-3.5 h-3.5" /> Simpan
              </button>
              <button onClick={() => { setShowAddRow(false); setNewRow({}); }} className="p-1.5 rounded-md hover:bg-white/10 text-[#546e7a]">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {BASE_COLUMNS.filter(c => c.key !== 'orderNum').map(col => (
              <div key={col.key}>
                <label className="block text-[10px] text-[#546e7a] mb-1">{col.label}</label>
                <input
                  value={(newRow as any)[col.key] || ''}
                  onChange={(e) => setNewRow(prev => ({ ...prev, [col.key]: e.target.value }))}
                  className="w-full px-2.5 py-1.5 glass-input rounded-md text-xs"
                  placeholder={col.label}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="glass-card rounded-xl flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex-1 overflow-auto aero-scroll">
          <table className="aero-table">
            <thead>
              <tr>
                {BASE_COLUMNS.map(col => (
                  <th key={col.key} style={{ minWidth: col.width }}>
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.editable && user?.role !== 'ADMIN' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#81c784]" title="Bisa diedit" />
                      )}
                    </div>
                  </th>
                ))}
                {customCols.map(col => (
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
                ))}
                {user?.role === 'ADMIN' && (
                  <th style={{ minWidth: 50 }}>Aksi</th>
                )}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
                <tr key={row.id}>
                  {BASE_COLUMNS.map(col => {
                    const val = getCellValue(row, col.key);
                    const canEdit = canEditCell(col.key, null);
                    const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === col.key;

                    return (
                      <td key={col.key}>
                        {isEditing ? (
                          <input
                            ref={editRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleCellSave(row.id, col.key, editValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave(row.id, col.key, editValue);
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-full px-2 py-1 glass-input rounded text-xs"
                            style={{ minWidth: col.width - 24 }}
                          />
                        ) : (
                          <div
                            className={`editable-cell text-xs ${!canEdit ? 'cursor-default' : ''}`}
                            onClick={() => {
                              if (canEdit) { setEditingCell({ rowId: row.id, colKey: col.key }); setEditValue(val); }
                            }}
                            title={val}
                          >
                            {val || <span className="text-[#37474f]">-</span>}
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
                          <input
                            ref={editRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleCellSave(row.id, col.id, editValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave(row.id, col.id, editValue);
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-full px-2 py-1 glass-input rounded text-xs"
                          />
                        ) : (
                          <div
                            className={`editable-cell text-xs ${!canEdit ? 'cursor-default' : ''} ${col.isLocked ? 'locked-cell' : ''}`}
                            onClick={() => {
                              if (!canEdit) return;
                              setEditingCell({ rowId: row.id, colKey: col.id });
                              setEditValue(val);
                            }}
                            title={col.isLocked ? 'Kolom terkunci' : val}
                          >
                            {val || <span className="text-[#37474f]">-</span>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {user?.role === 'ADMIN' && (
                    <td>
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1.5 rounded-md hover:bg-[#ef5350]/10 text-[#546e7a] hover:text-[#ef5350] transition-colors"
                        title="Hapus baris"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-3 border-t border-white/5">
          <p className="text-xs text-[#546e7a]">
            Menampilkan {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filteredRows.length)} dari {filteredRows.length} data
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-md glass-btn disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = page <= 2 ? i : page >= totalPages - 3 ? totalPages - 5 + i : page - 2 + i;
              if (p < 0 || p >= totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-md text-xs transition-all ${p === page
                    ? 'glass-btn text-[#64b5f6]'
                    : 'text-[#78909c] hover:bg-white/5'
                    }`}
                >
                  {p + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-md glass-btn disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}