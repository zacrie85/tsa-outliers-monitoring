'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  X, Filter, Search, GripVertical, Sigma, ArrowUpDown,
  TableProperties, LayoutGrid, Download, FileSpreadsheet, Image as ImageIcon,
  ChevronDown, ChevronRight, RotateCcw, PanelRightOpen, PanelRightClose,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

interface MonitoringRow {
  id: string;
  provinsi: string; kabupaten: string; kecamatan: string; kelurahan: string;
  categoryBak: string; klasifikasiTsa: string; picTsa: string;
  homepass: number; odp: number; customData: string;
}

interface FieldDef {
  key: string;
  label: string;
  isNumeric: boolean;
}

interface ValueAgg {
  fieldKey: string;
  aggType: 'count' | 'sum' | 'avg' | 'min' | 'max';
  label: string;
}

type ZoneName = 'rows' | 'columns' | 'values' | 'filters';

const AGG_OPTIONS: { value: ValueAgg['aggType']; label: string }[] = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
];

const BASE_FIELDS: FieldDef[] = [
  { key: 'provinsi', label: 'Provinsi', isNumeric: false },
  { key: 'kabupaten', label: 'Kabupaten', isNumeric: false },
  { key: 'kecamatan', label: 'Kecamatan', isNumeric: false },
  { key: 'kelurahan', label: 'Kelurahan', isNumeric: false },
  { key: 'categoryBak', label: 'Category BAK', isNumeric: false },
  { key: 'klasifikasiTsa', label: 'Klasifikasi TSA', isNumeric: false },
  { key: 'picTsa', label: 'PIC TSA', isNumeric: false },
  { key: 'homepass', label: 'Homepass', isNumeric: true },
  { key: 'odp', label: 'ODP', isNumeric: true },
];

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */

function getFieldValue(row: MonitoringRow, key: string): string {
  if (key in row) return String((row as any)[key] ?? 'Lainnya');
  try { return String(JSON.parse(row.customData || '{}')[key] ?? 'Lainnya'); } catch { return 'Lainnya'; }
}

function computeValueAgg(items: MonitoringRow[], va: ValueAgg): number {
  if (items.length === 0) return 0;
  if (va.aggType === 'count') {
    return items.filter(r => {
      const v = getFieldValue(r, va.fieldKey);
      return v && v !== 'Lainnya';
    }).length;
  }
  const nums = items.map(r => {
    if (va.fieldKey === 'homepass') return r.homepass || 0;
    if (va.fieldKey === 'odp') return r.odp || 0;
    return parseFloat(getFieldValue(r, va.fieldKey)) || 0;
  });
  if (nums.length === 0) return 0;
  switch (va.aggType) {
    case 'sum': return nums.reduce((s, v) => s + v, 0);
    case 'avg': return Math.round(nums.reduce((s, v) => s + v, 0) / nums.length);
    case 'min': return Math.min(...nums);
    case 'max': return Math.max(...nums);
    default: return items.length;
  }
}

function makeAggLabel(fieldLabel: string, aggType: ValueAgg['aggType']): string {
  const aggLabel = AGG_OPTIONS.find(a => a.value === aggType)?.label || aggType;
  return `${aggLabel} of ${fieldLabel}`;
}

/* ═══════════════════════════════════════════════════
   Zone Chip Component
   ═══════════════════════════════════════════════════ */

function ZoneChip({ label, onRemove, onMove, showMoveMenu, setShowMoveMenu, accentColor, extra }:
  { label: string; onRemove: () => void; onMove?: (zone: ZoneName) => void; showMoveMenu: boolean; setShowMoveMenu: (v: boolean) => void; accentColor?: string; extra?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="relative inline-flex" ref={ref}>
      <div
        draggable
        onDragStart={(e) => { e.dataTransfer.setData('text/plain', label); e.dataTransfer.effectAllowed = 'move'; }}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border cursor-grab active:cursor-grabbing transition-all ${accentColor ? '' : 'bg-white/[0.04] border-white/[0.08] text-[#e0e0e0] hover:bg-white/[0.06]'}`}
        style={accentColor ? { background: `${accentColor}15`, borderColor: `${accentColor}30`, color: accentColor } : {}}
      >
        <GripVertical className="w-2.5 h-2.5 opacity-30" />
        {label}
        {extra}
        {onMove && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
            className="p-0.5 rounded hover:bg-white/10 opacity-40 hover:opacity-100 transition-all"
          >
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
        )}
        <button onClick={onRemove} className="p-0.5 rounded hover:bg-[#ef5350]/20 text-[#546e7a] hover:text-[#ef5350] transition-all">
          <X className="w-2.5 h-2.5" />
        </button>
      </div>
      {showMoveMenu && onMove && (
        <div className="absolute top-full left-0 z-50 mt-1 py-1 rounded-lg bg-[#1a1d29] border border-white/10 shadow-2xl min-w-[130px]">
          {([['rows', 'Rows', ArrowUpDown], ['columns', 'Columns', LayoutGrid], ['values', 'Values', Sigma], ['filters', 'Filters', Filter]] as [ZoneName, string, any][]).map(([zone, zoneLabel, Icon]) => (
            <button key={zone} onClick={() => { onMove(zone); setShowMoveMenu(false); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] text-[#78909c] hover:text-white hover:bg-white/5 transition-all">
              <Icon className="w-3 h-3" /> {zoneLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Drop Zone Component
   ═══════════════════════════════════════════════════ */

function DropZone({ icon: Icon, label, accentColor, children, onDrop, isEmpty }:
  { icon: any; label: string; accentColor: string; children: React.ReactNode; onDrop: (fieldKey: string) => void; isEmpty: boolean }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3" style={{ color: accentColor }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: accentColor }}>{label}</span>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
        onDrop={(e) => { e.preventDefault(); const key = e.dataTransfer.getData('text/plain'); if (key) onDrop(key); }}
        className={`min-h-[36px] rounded-lg border border-dashed p-1.5 flex flex-wrap gap-1 transition-all ${isEmpty ? 'border-white/[0.04]' : 'border-white/[0.06] bg-white/[0.01]'}`}
      >
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════ */

export function ExcelPivotTable({ rows, customCols }: { rows: MonitoringRow[]; customCols: any[] }) {
  const [showPanel, setShowPanel] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [rowFields, setRowFields] = useState<string[]>([]);
  const [colFields, setColFields] = useState<string[]>([]);
  const [valueFields, setValueFields] = useState<ValueAgg[]>([]);
  const [filterFields, setFilterFields] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [contextChip, setContextChip] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  /* ── Build all fields ── */
  const allFields: FieldDef[] = useMemo(() => {
    const customs: FieldDef[] = (customCols || []).map((c: any) => ({
      key: c.id, label: c.label, isNumeric: false,
    }));
    return [...BASE_FIELDS, ...customs];
  }, [customCols]);

  const fieldMap = useMemo(() => {
    const m: Record<string, FieldDef> = {};
    allFields.forEach(f => { m[f.key] = f; });
    return m;
  }, [allFields]);

  const filteredFieldList = useMemo(() => {
    if (!searchQuery) return allFields;
    const q = searchQuery.toLowerCase();
    return allFields.filter(f => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q));
  }, [allFields, searchQuery]);

  /* ── Zone helpers ── */
  const getFieldZone = useCallback((key: string): ZoneName | null => {
    if (rowFields.includes(key)) return 'rows';
    if (colFields.includes(key)) return 'columns';
    if (valueFields.some(v => v.fieldKey === key)) return 'values';
    if (filterFields.includes(key)) return 'filters';
    return null;
  }, [rowFields, colFields, valueFields, filterFields]);

  const isFieldUsed = useCallback((key: string) => getFieldZone(key) !== null, [getFieldZone]);

  const toggleField = useCallback((key: string) => {
    if (isFieldUsed(key)) {
      // Remove from current zone
      setRowFields(p => p.filter(k => k !== key));
      setColFields(p => p.filter(k => k !== key));
      setValueFields(p => p.filter(v => v.fieldKey !== key));
      setFilterFields(p => p.filter(k => k !== key));
      setActiveFilters(p => { const n = { ...p }; delete n[key]; return n; });
    } else {
      // Auto-assign based on type
      const field = fieldMap[key];
      if (field?.isNumeric) {
        setValueFields(p => [...p, { fieldKey: key, aggType: 'sum', label: makeAggLabel(field.label, 'sum') }]);
      } else {
        setRowFields(p => [...p, key]);
      }
    }
  }, [isFieldUsed, fieldMap]);

  const moveFieldToZone = useCallback((key: string, zone: ZoneName) => {
    const field = fieldMap[key];
    if (!field) return;
    // Remove from all zones first
    setRowFields(p => p.filter(k => k !== key));
    setColFields(p => p.filter(k => k !== key));
    setValueFields(p => p.filter(v => v.fieldKey !== key));
    setFilterFields(p => p.filter(k => k !== key));
    // Add to target zone
    if (zone === 'rows') setRowFields(p => [...p, key]);
    else if (zone === 'columns') setColFields(p => [...p, key]);
    else if (zone === 'values') {
      const agg = field.isNumeric ? 'sum' as const : 'count' as const;
      setValueFields(p => [...p, { fieldKey: key, aggType: agg, label: makeAggLabel(field.label, agg) }]);
    } else if (zone === 'filters') setFilterFields(p => [...p, key]);
  }, [fieldMap]);

  const removeField = useCallback((key: string) => { toggleField(key); }, [toggleField]);

  const updateValueAgg = useCallback((fieldKey: string, newAgg: ValueAgg['aggType']) => {
    setValueFields(p => p.map(v => {
      if (v.fieldKey !== fieldKey) return v;
      return { ...v, aggType: newAgg, label: makeAggLabel(fieldMap[fieldKey]?.label || fieldKey, newAgg) };
    }));
  }, [fieldMap]);

  /* ── Compute pivot data ── */
  const pivotResult = useMemo(() => {
    // 1. Filter data
    let filtered = rows;
    for (const [fKey, selected] of Object.entries(activeFilters)) {
      if (selected && selected.length > 0) {
        filtered = filtered.filter(r => selected.includes(getFieldValue(r, fKey)));
      }
    }

    if (rowFields.length === 0 || valueFields.length === 0 || filtered.length === 0) {
      return { headers: [] as string[], dataRows: [] as { label: string; values: number[]; isTotal?: boolean }[], filteredCount: filtered.length };
    }

    // 2. Get unique column values
    const colValues: string[] = [];
    if (colFields.length > 0) {
      const cSet = new Set(filtered.map(r => getFieldValue(r, colFields[0])));
      colValues.push(...[...cSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })));
    }

    // 3. Build headers
    const headers: string[] = ['Row Labels'];
    if (colFields.length > 0) {
      for (const cv of colValues) {
        for (const va of valueFields) {
          headers.push(`${cv} - ${va.label}`);
        }
      }
      for (const va of valueFields) {
        headers.push(`Total - ${va.label}`);
      }
    } else {
      for (const va of valueFields) {
        headers.push(va.label);
      }
      headers.push('Grand Total');
    }

    // 4. Group rows
    const groups: Record<string, MonitoringRow[]> = {};
    filtered.forEach(r => {
      const rk = rowFields.map(k => getFieldValue(r, k)).join(' | ');
      if (!groups[rk]) groups[rk] = [];
      groups[rk].push(r);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const dataRows: { label: string; values: number[]; isTotal?: boolean }[] = [];

    for (const rk of sortedKeys) {
      const items = groups[rk];
      const vals: number[] = [];

      if (colFields.length > 0) {
        for (const cv of colValues) {
          const sub = items.filter(r => getFieldValue(r, colFields[0]) === cv);
          for (const va of valueFields) vals.push(computeValueAgg(sub, va));
        }
        for (const va of valueFields) vals.push(computeValueAgg(items, va));
      } else {
        for (const va of valueFields) vals.push(computeValueAgg(items, va));
        vals.push(valueFields.reduce((s, va) => s + computeValueAgg(items, va), 0));
      }

      dataRows.push({ label: rk, values: vals });
    }

    // Grand Total row
    const gtVals: number[] = [];
    if (colFields.length > 0) {
      for (const cv of colValues) {
        const sub = filtered.filter(r => getFieldValue(r, colFields[0]) === cv);
        for (const va of valueFields) gtVals.push(computeValueAgg(sub, va));
      }
      for (const va of valueFields) gtVals.push(computeValueAgg(filtered, va));
    } else {
      for (const va of valueFields) gtVals.push(computeValueAgg(filtered, va));
      gtVals.push(valueFields.reduce((s, va) => s + computeValueAgg(filtered, va), 0));
    }
    dataRows.push({ label: 'Grand Total', values: gtVals, isTotal: true });

    return { headers, dataRows, filteredCount: filtered.length };
  }, [rows, rowFields, colFields, valueFields, activeFilters]);

  /* ── Filter options for filter zone ── */
  const getFilterOptions = useCallback((fKey: string): string[] => {
 return [...new Set(rows.map(r => getFieldValue(r, fKey)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [rows]);

  /* ── Downloads ── */
  const handleDownloadExcel = useCallback(async () => {
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
  }, [pivotResult]);

  const handleDownloadCSV = useCallback(() => {
    if (pivotResult.dataRows.length === 0) return;
    const csv = [pivotResult.headers.join(','), ...pivotResult.dataRows.map(dr => [dr.label, ...dr.values].join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pivot_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [pivotResult]);

  const handleDownloadPNG = useCallback(() => {
    if (pivotResult.dataRows.length === 0) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cp = 8, rh = 24, hh = 28, fs = 10, th = 32;
    ctx.font = `${fs}px sans-serif`;
    const cw: number[] = [];
    let mfc = 100;
    pivotResult.dataRows.forEach(dr => { mfc = Math.max(mfc, ctx.measureText(dr.label).width + cp * 2 + 4); });
    cw.push(mfc);
    pivotResult.headers.slice(1).forEach(h => { cw.push(Math.max(ctx.measureText(h).width + cp * 2, 48)); });
    const tw = cw.reduce((s, w) => s + w, 0);
    const tH = th + hh + pivotResult.dataRows.length * rh;
    canvas.width = tw * 2; canvas.height = tH * 2; ctx.scale(2, 2);
    const bg = ctx.createLinearGradient(0, 0, tw, tH);
    bg.addColorStop(0, '#0d1117'); bg.addColorStop(1, '#161b22');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, tw, tH);
    ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText('Pivot Table', cp, 20);
    ctx.font = `9px sans-serif`; ctx.fillStyle = '#546e7a';
    ctx.fillText(`Data: ${pivotResult.filteredCount} baris`, cp, 30);
    const hGrad = ctx.createLinearGradient(0, 0, tw, 0);
    hGrad.addColorStop(0, '#4a148c99'); hGrad.addColorStop(1, '#1a237e99');
    ctx.fillStyle = hGrad; ctx.fillRect(0, th, tw, hh);
    ctx.font = 'bold 9px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.9)';
    let x = 0;
    pivotResult.headers.forEach((h, i) => { ctx.fillText(h, x + cp, th + hh / 2 + 3); x += cw[i]; });
    ctx.font = '9px sans-serif';
    pivotResult.dataRows.forEach((dr, ri) => {
      const y = th + hh + ri * rh;
      if (dr.isTotal) { ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, y, tw, rh); }
      else if (ri % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fillRect(0, y, tw, rh); }
      x = 0;
      ctx.fillStyle = dr.isTotal ? '#fff' : '#e0e0e0';
      ctx.font = dr.isTotal ? 'bold 9px sans-serif' : '9px sans-serif';
      ctx.fillText(dr.label, x + cp, y + rh / 2 + 3); x += cw[0];
      dr.values.forEach((v, vi) => {
        ctx.fillStyle = v > 0 ? (dr.isTotal ? '#fff' : '#e0e0e0') : '#37474f';
        if (dr.isTotal) ctx.font = 'bold 9px monospace'; else ctx.font = '9px monospace';
        const t = v.toLocaleString('id-ID');
        ctx.fillText(t, x + cw[vi + 1] - cp - ctx.measureText(t).width, y + rh / 2 + 3);
        x += cw[vi + 1];
      });
    });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `pivot_${new Date().toISOString().slice(0, 10)}.png`; a.click();
  }, [pivotResult]);

  const resetAll = () => {
    setRowFields([]); setColFields([]); setValueFields([]);
    setFilterFields([]); setActiveFilters({});
  };

  const hasData = pivotResult.dataRows.length > 0;
  const activeFilterCount = Object.values(activeFilters).reduce((s, a) => s + a.length, 0);

  /* ═══════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════ */
  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-gradient-to-br from-[#111827]/80 to-[#0d1117]/90 backdrop-blur-xl">
      {/* Top accent */}
      <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #4dd0e1, #64b5f6, #ba68c8, transparent)' }} />

      {/* Header bar */}
      <div className="relative flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#4dd0e1]/20 to-[#ba68c8]/10 border border-[#4dd0e1]/20 flex items-center justify-center">
            <TableProperties className="w-4 h-4 text-[#4dd0e1]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Excel-Style Pivot Table</h3>
            <p className="text-[10px] text-[#546e7a]">PivotTable Fields — drag & drop atau pilih field untuk membuat pivot</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={handleDownloadExcel} disabled={!hasData || downloading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium hover:bg-white/5 text-[#37474f] hover:text-[#66bb6a] disabled:opacity-20 transition-all" title="Download Excel">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span className="hidden sm:inline">Excel</span>
          </button>
          <button onClick={handleDownloadPNG} disabled={!hasData}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium hover:bg-white/5 text-[#37474f] hover:text-[#4dd0e1] disabled:opacity-20 transition-all" title="Download PNG">
            <ImageIcon className="w-3.5 h-3.5" /><span className="hidden sm:inline">PNG</span>
          </button>
          <button onClick={handleDownloadCSV} disabled={!hasData}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium hover:bg-white/5 text-[#37474f] hover:text-[#ffb74d] disabled:opacity-20 transition-all" title="Download CSV">
            <Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">CSV</span>
          </button>
          <button onClick={() => setShowPanel(!showPanel)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium hover:bg-white/5 text-[#546e7a] hover:text-white transition-all" title={showPanel ? 'Sembunyikan Panel' : 'Tampilkan Panel'}>
            {showPanel ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
          </button>
          <button onClick={resetAll}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium hover:bg-white/5 text-[#546e7a] hover:text-[#ef5350] transition-all" title="Reset">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main content: two-panel layout */}
      <div className="flex gap-0 min-h-[400px]">
        {/* LEFT: Pivot Table Grid */}
        <div className="flex-1 px-4 pb-4 overflow-auto aero-scroll">
          {!hasData ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-[#37474f]">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-3">
                <TableProperties className="w-8 h-8 opacity-20" />
              </div>
              <p className="text-xs font-medium">Pilih field di panel kanan untuk memulai</p>
              <p className="text-[10px] mt-1 text-[#2a2a3a]">Centang field untuk menambahkan ke Rows, Columns, Values, atau Filters</p>
            </div>
          ) : (
            <div className="overflow-auto aero-scroll rounded-xl border border-white/[0.06]">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-gradient-to-r from-[#4a148c]/60 to-[#1a237e]/60">
                    {pivotResult.headers.map((h, hi) => (
                      <th key={hi} className={`px-3 py-2.5 text-white/90 font-semibold whitespace-nowrap ${hi === 0 ? 'text-left sticky left-0 z-10 min-w-[180px]' : 'text-center'}`}
                        style={hi === 0 ? { background: '#311b60e0', backdropFilter: 'blur(8px)' } : {}}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pivotResult.dataRows.map((dr, ri) => (
                    <tr key={ri} className={`${dr.isTotal ? 'border-t-2 border-white/10 bg-white/[0.04]' : ri % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                      <td className={`px-3 py-2 whitespace-nowrap sticky left-0 z-10 ${dr.isTotal ? 'text-white font-bold' : 'text-[#e0e0e0] font-medium'}`}
                        style={{ background: dr.isTotal ? '#ffffff0a' : (ri % 2 === 0 ? '#ffffff06' : '#ffffff03'), backdropFilter: 'blur(8px)' }}>
                        {dr.isTotal && <span className="mr-1.5 text-[#4dd0e1]">&#931;</span>}
                        {dr.label}
                      </td>
                      {dr.values.map((v, vi) => (
                        <td key={vi} className={`text-center px-3 py-2 font-mono whitespace-nowrap ${
                          dr.isTotal ? 'font-bold text-white' : v > 0 ? 'text-[#e0e0e0]' : 'text-[#37474f]'
                        }`}>
                          {v.toLocaleString('id-ID')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT: Field List Panel */}
        {showPanel && (
          <div className="w-72 flex-shrink-0 border-l border-white/[0.06] bg-white/[0.01]">
            {/* Search */}
            <div className="px-3 pt-3 pb-2">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <Search className="w-3 h-3 text-[#37474f]" />
                <input
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari field..." className="flex-1 bg-transparent text-[11px] text-[#e0e0e0] placeholder:text-[#37474f] focus:outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-[#37474f] hover:text-white"><X className="w-3 h-3" /></button>
                )}
              </div>
            </div>

            {/* Field list */}
            <div className="px-3 pb-2">
              <p className="text-[10px] text-[#546e7a] font-medium mb-1.5">Choose fields to add to report:</p>
              <div className="max-h-[180px] overflow-y-auto aero-scroll space-y-px">
                {filteredFieldList.map(f => {
                  const used = isFieldUsed(f.key);
                  const zone = getFieldZone(f.key);
                  return (
                    <label key={f.key}
                      className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-all ${used ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}`}
                    >
                      <input type="checkbox" checked={used} onChange={() => toggleField(f.key)}
                        className="w-3 h-3 rounded accent-[#4dd0e1]" />
                      <span className={`text-[11px] flex-1 truncate ${used ? 'text-[#e0e0e0] font-medium' : 'text-[#78909c]'}`}>{f.label}</span>
                      {zone && (
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-semibold ${
                          zone === 'rows' ? 'bg-[#64b5f6]/15 text-[#64b5f6]' :
                          zone === 'columns' ? 'bg-[#ba68c8]/15 text-[#ba68c8]' :
                          zone === 'values' ? 'bg-[#66bb6a]/15 text-[#66bb6a]' :
                          'bg-[#ffb74d]/15 text-[#ffb74d]'
                        }`}>
                          {zone === 'rows' ? 'Rows' : zone === 'columns' ? 'Cols' : zone === 'values' ? 'Values' : 'Filter'}
                        </span>
                      )}
                    </label>
                  );
                })}
                {filteredFieldList.length === 0 && (
                  <p className="text-[10px] text-[#37474f] italic px-2 py-2">Tidak ada field ditemukan</p>
                )}
              </div>
            </div>

            {/* Zone areas */}
            <div className="px-3 pb-3 border-t border-white/[0.04] pt-3 space-y-1">
              <p className="text-[10px] text-[#546e7a] font-medium mb-2">Drag fields between areas below:</p>

              {/* Filters zone */}
              <DropZone icon={Filter} label="Filters" accentColor="#ffb74d"
                isEmpty={filterFields.length === 0}
                onDrop={(key) => moveFieldToZone(key, 'filters')}>
                {filterFields.map(fk => {
                  const opts = getFilterOptions(fk);
                  const selected = activeFilters[fk] || [];
                  return (
                    <div key={fk} className="w-full">
                      <ZoneChip label={fieldMap[fk]?.label || fk}
                        onRemove={() => removeField(fk)}
                        onMove={(z) => moveFieldToZone(fk, z)}
                        showMoveMenu={contextChip === `filter-${fk}`}
                        setShowMoveMenu={(v) => setContextChip(v ? `filter-${fk}` : null)}
                        accentColor="#ffb74d" />
                      <div className="mt-1 ml-1">
                        <select
                          multiple value={selected}
                          onChange={(e) => {
                            const vals = [...e.target.selectedOptions].map(o => o.value);
                            setActiveFilters(p => ({ ...p, [fk]: vals }));
                          }}
                          className="w-full h-[60px] text-[10px] bg-white/[0.03] border border-white/[0.06] rounded-md text-[#e0e0e0] focus:outline-none focus:border-white/[0.12] aero-scroll"
                          style={{ background: '#1a1d29' }}
                        >
                          {opts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        {selected.length > 0 && (
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[9px] text-[#ffb74d]">{selected.length} terpilih</span>
                            <button onClick={() => setActiveFilters(p => ({ ...p, [fk]: [] }))} className="text-[9px] text-[#37474f] hover:text-[#ef5350]">Reset</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </DropZone>

              {/* Columns zone */}
              <DropZone icon={LayoutGrid} label="Columns" accentColor="#ba68c8"
                isEmpty={colFields.length === 0}
                onDrop={(key) => moveFieldToZone(key, 'columns')}>
                {colFields.map(fk => (
                  <ZoneChip key={fk} label={fieldMap[fk]?.label || fk}
                    onRemove={() => removeField(fk)}
                    onMove={(z) => moveFieldToZone(fk, z)}
                    showMoveMenu={contextChip === `col-${fk}`}
                    setShowMoveMenu={(v) => setContextChip(v ? `col-${fk}` : null)}
                    accentColor="#ba68c8" />
                ))}
              </DropZone>

              {/* Rows zone */}
              <DropZone icon={ArrowUpDown} label="Rows" accentColor="#64b5f6"
                isEmpty={rowFields.length === 0}
                onDrop={(key) => moveFieldToZone(key, 'rows')}>
                {rowFields.map(fk => (
                  <ZoneChip key={fk} label={fieldMap[fk]?.label || fk}
                    onRemove={() => removeField(fk)}
                    onMove={(z) => moveFieldToZone(fk, z)}
                    showMoveMenu={contextChip === `row-${fk}`}
                    setShowMoveMenu={(v) => setContextChip(v ? `row-${fk}` : null)}
                    accentColor="#64b5f6" />
                ))}
              </DropZone>

              {/* Values zone */}
              <DropZone icon={Sigma} label="Values" accentColor="#66bb6a"
                isEmpty={valueFields.length === 0}
                onDrop={(key) => moveFieldToZone(key, 'values')}>
                {valueFields.map((va, vi) => (
                  <div key={va.fieldKey} className="inline-flex">
                    <ZoneChip label={va.label}
                      onRemove={() => removeField(va.fieldKey)}
                      onMove={(z) => moveFieldToZone(va.fieldKey, z)}
                      showMoveMenu={contextChip === `val-${va.fieldKey}`}
                      setShowMoveMenu={(v) => setContextChip(v ? `val-${va.fieldKey}` : null)}
                      accentColor="#66bb6a"
                      extra={(
                        <select value={va.aggType}
                          onChange={(e) => updateValueAgg(va.fieldKey, e.target.value as ValueAgg['aggType'])}
                          className="bg-transparent text-[9px] text-[#66bb6a] border-none focus:outline-none cursor-pointer"
                          style={{ background: 'transparent' }}
                        >
                          {AGG_OPTIONS.map(ao => <option key={ao.value} value={ao.value} style={{ background: '#1a1d29' }}>{ao.label}</option>)}
                        </select>
                      )} />
                  </div>
                ))}
              </DropZone>
            </div>

            {/* Filter summary */}
            {activeFilterCount > 0 && (
              <div className="px-3 pb-3 border-t border-white/[0.04] pt-2">
                <span className="text-[10px] text-[#546e7a]">
                  Data terfilter: <span className="font-bold text-[#90caf9]">{pivotResult.filteredCount}</span> dari <span className="text-[#78909c]">{rows.length}</span> baris
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}