#!/usr/bin/env python3
"""Upgrade pivot-charts.tsx: add download buttons + cascading filter to PivotTableSection"""

import re

FILE = '/home/z/my-project/src/components/pivot/pivot-charts.tsx'

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 1. Add useMemo to React imports ───
content = content.replace(
    "import { useState, useRef, useCallback, useEffect } from 'react';",
    "import { useState, useRef, useCallback, useEffect, useMemo } from 'react';"
)

# ─── 2. Add icons to lucide imports ───
content = content.replace(
    "Download, Plus, X, BarChart3, LineChart as LineChartIcon,",
    "Download, Plus, X, BarChart3, LineChart as LineChartIcon, Filter, ChevronDown, ChevronRight,"
)
content = content.replace(
    "ArrowUp, ArrowDown, TrendingUp, Minus, Hash, RefreshCw, FileSpreadsheet, CornerDownRight,",
    "ArrowUp, ArrowDown, TrendingUp, Minus, Hash, RefreshCw, FileSpreadsheet, CornerDownRight, Image as ImageIcon,"
)

# ─── 3. Add HIERARCHY constant after AGGREGATIONS ───
hierarchy_const = '''

const HIERARCHY = [
  { key: 'provinsi', label: 'Provinsi' },
  { key: 'kabupaten', label: 'Kabupaten' },
  { key: 'kecamatan', label: 'Kecamatan' },
  { key: 'kelurahan', label: 'Kelurahan' },
];
'''
content = content.replace(
    "  { value: 'avg_odp', label: 'Rata-rata ODP' },\n];",
    "  { value: 'avg_odp', label: 'Rata-rata ODP' },\n];" + hierarchy_const
)

# ─── 4. Replace entire PivotTableSection function ───
new_pivot_section = '''/* ─── Cascading Filter Hierarchy ─── */

function PivotTableSection({ rows, allColOptions, defaultRowField = 'provinsi', defaultColField = 'klasifikasiTsa', tableTitle, accentFrom = '#ba68c8', accentTo = '#64b5f6', iconColor: iconClr = '#ba68c8', onRemove }: {
  rows: MonitoringRow[];
  allColOptions: { key: string; label: string }[];
  defaultRowField?: string;
  defaultColField?: string;
  tableTitle?: string;
  accentFrom?: string;
  accentTo?: string;
  iconColor?: string;
  onRemove?: () => void;
}) {
  const [rowField, setRowField] = useState(defaultRowField);
  const [colField, setColField] = useState(defaultColField);
  const [aggMethod, setAggMethod] = useState('count');
  const [showTable, setShowTable] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [downloading, setDownloading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const optStyle = { background: '#1a1a2e' };
  const selCls = 'px-3 py-2 rounded-lg text-xs bg-white/[0.04] border border-white/[0.06] text-[#e0e0e0] focus:outline-none focus:border-white/[0.12] transition-all cursor-pointer';

  /* ── Cascading Filter Logic ── */
  const toggleFilter = (levelKey: string, value: string) => {
    setFilters(prev => {
      const current = prev[levelKey] || [];
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      const newFilters = { ...prev, [levelKey]: next };
      const idx = HIERARCHY.findIndex(h => h.key === levelKey);
      for (let i = idx + 1; i < HIERARCHY.length; i++) {
        newFilters[HIERARCHY[i].key] = [];
      }
      return newFilters;
    });
  };

  const clearFilters = () => setFilters({});

  const hasActiveFilter = HIERARCHY.some(h => (filters[h.key] || []).length > 0);
  const activeFilterCount = HIERARCHY.reduce((s, h) => s + (filters[h.key] || []).length, 0);

  const getOptionsForLevel = useCallback((levelKey: string): string[] => {
    const idx = HIERARCHY.findIndex(h => h.key === levelKey);
    let filtered = rows;
    for (let i = 0; i < idx; i++) {
      const parentKey = HIERARCHY[i].key;
      const selected = filters[parentKey];
      if (selected && selected.length > 0) {
        filtered = filtered.filter(r => selected.includes(getRowValue(r, parentKey)));
      }
    }
    return [...new Set(filtered.map(r => getRowValue(r, levelKey)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [rows, filters]);

  const filteredRows = useMemo(() => {
    let result = rows;
    HIERARCHY.forEach(h => {
      const selected = filters[h.key];
      if (selected && selected.length > 0) {
        result = result.filter(r => selected.includes(getRowValue(r, h.key)));
      }
    });
    return result;
  }, [rows, filters]);

  /* ── Build cross-tabulation from filteredRows ── */
  const { colLabels, rowLabels, matrix, rowTotals, colTotals, grandTotal } = (() => {
    if (!rowField || !colField || filteredRows.length === 0)
      return { colLabels: [], rowLabels: [], matrix: {} as Record<string, Record<string, number>>, rowTotals: {} as Record<string, number>, colTotals: {} as Record<string, number>, grandTotal: 0 };

    const buckets: Record<string, Record<string, MonitoringRow[]>> = {};
    const rowSet = new Set<string>();
    const colSet = new Set<string>();

    filteredRows.forEach(row => {
      const rv = getRowValue(row, rowField);
      const cv = getRowValue(row, colField);
      rowSet.add(rv);
      colSet.add(cv);
      if (!buckets[rv]) buckets[rv] = {};
      if (!buckets[rv][cv]) buckets[rv][cv] = [];
      buckets[rv][cv].push(row);
    });

    const rLabels = [...rowSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    const cLabels = [...colSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const mtx: Record<string, Record<string, number>> = {};
    const rTotals: Record<string, number> = {};
    const cTotals: Record<string, number> = {};
    let gt = 0;

    rLabels.forEach(rl => {
      mtx[rl] = {};
      let rt = 0;
      cLabels.forEach(cl => {
        const items = buckets[rl]?.[cl] || [];
        const v = computeAgg(items, aggMethod);
        mtx[rl][cl] = v;
        rt += v;
        cTotals[cl] = (cTotals[cl] || 0) + v;
      });
      rTotals[rl] = rt;
      gt += rt;
    });

    return { colLabels: cLabels, rowLabels: rLabels, matrix: mtx, rowTotals: rTotals, colTotals: cTotals, grandTotal: gt };
  })();

  /* ── Download Functions ── */
  const handleDownloadCSV = () => {
    if (!hasData) return;
    const header = ['Row Labels', ...colLabels, 'Grand Total'].join(',');
    const body = rowLabels.map(rl => {
      const vals = colLabels.map(cl => matrix[rl]?.[cl] ?? 0);
      return [rl, ...vals, rowTotals[rl] ?? 0].join(',');
    });
    const totalRow = ['Grand Total', ...colLabels.map(cl => colTotals[cl] ?? 0), grandTotal].join(',');
    const csv = [header, ...body, totalRow].join('\\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pivot_${(tableTitle || 'table').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadExcel = useCallback(async () => {
    if (!hasData) return;
    setDownloading(true);
    try {
      const XLSX = await import('xlsx');
      const data: (string | number)[][] = [
        ['Row Labels', ...colLabels, 'Grand Total'],
        ...rowLabels.map(rl => [rl, ...colLabels.map(cl => matrix[rl]?.[cl] ?? 0), rowTotals[rl] ?? 0] as (string | number)[]),
        ['Grand Total', ...colLabels.map(cl => colTotals[cl] ?? 0), grandTotal],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      // Auto column widths
      ws['!cols'] = [{ wch: 20 }, ...colLabels.map(() => ({ wch: 14 })), { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pivot Table');
      XLSX.writeFile(wb, `pivot_${(tableTitle || 'table').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { console.error(e); }
    setDownloading(false);
  }, [hasData, colLabels, rowLabels, matrix, rowTotals, colTotals, grandTotal, tableTitle]);

  const handleDownloadPNG = useCallback(() => {
    if (!hasData) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cp = 10, rh = 26, hh = 30, fs = 11, th = 36;
    ctx.font = `${fs}px Inter, sans-serif`;
    const cw: number[] = [];
    let mfc = 110;
    rowLabels.forEach(rl => { mfc = Math.max(mfc, ctx.measureText(rl).width + cp * 2 + 4); });
    cw.push(mfc);
    colLabels.forEach(cl => { cw.push(Math.max(ctx.measureText(cl).width + cp * 2, 48)); });
    cw.push(Math.max(ctx.measureText('Grand Total').width + cp * 2, 76));
    const tw = cw.reduce((s, w) => s + w, 0);
    const tH = th + hh + rowLabels.length * rh + rh;
    canvas.width = tw * 2; canvas.height = tH * 2; ctx.scale(2, 2);
    const bg = ctx.createLinearGradient(0, 0, tw, tH);
    bg.addColorStop(0, '#0d1117'); bg.addColorStop(1, '#161b22');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, tw, tH);
    ctx.font = 'bold 13px Inter, sans-serif'; ctx.fillStyle = '#ffffff';
    ctx.fillText(tableTitle || 'Pivot Table', cp, 22);
    ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#546e7a';
    ctx.fillText(`Data: ${filteredRows.length} baris | Agregasi: ${aggMethod}`, cp, 33);
    const hGrad = ctx.createLinearGradient(0, 0, tw, 0);
    hGrad.addColorStop(0, '#4a148c99'); hGrad.addColorStop(1, '#1a237e99');
    ctx.fillStyle = hGrad; ctx.fillRect(0, th, tw, hh);
    ctx.font = 'bold 10px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.9)';
    let x = 0;
    ctx.fillText('Row Labels', x + cp, th + hh / 2 + 4); x += cw[0];
    colLabels.forEach((cl, ci) => { ctx.fillText(cl, x + cp, th + hh / 2 + 4); x += cw[ci + 1]; });
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px Inter, sans-serif';
    ctx.fillText('Grand Total', x + cp, th + hh / 2 + 4);
    ctx.font = '10px Inter, sans-serif';
    rowLabels.forEach((rl, ri) => {
      const y = th + hh + ri * rh;
      if (ri % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fillRect(0, y, tw, rh); }
      x = 0; ctx.fillStyle = '#e0e0e0'; ctx.font = '10px Inter, sans-serif';
      ctx.fillText(rl, x + cp, y + rh / 2 + 4); x += cw[0];
      colLabels.forEach((cl, ci) => {
        const v = matrix[rl]?.[cl] ?? 0;
        ctx.fillStyle = v > 0 ? '#e0e0e0' : '#37474f'; ctx.font = '10px monospace';
        const t = v.toLocaleString('id-ID'); ctx.fillText(t, x + cw[ci + 1] - cp - ctx.measureText(t).width, y + rh / 2 + 4);
        x += cw[ci + 1];
      });
      ctx.fillStyle = '#90caf9'; ctx.font = 'bold 10px monospace';
      const rt = (rowTotals[rl] ?? 0).toLocaleString('id-ID');
      ctx.fillText(rt, x + cw[cw.length - 1] - cp - ctx.measureText(rt).width, y + rh / 2 + 4);
    });
    const fy = th + hh + rowLabels.length * rh;
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, fy, tw, rh);
    x = 0; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px Inter, sans-serif';
    ctx.fillText('Grand Total', x + cp, fy + rh / 2 + 4); x += cw[0];
    colLabels.forEach((cl, ci) => {
      ctx.fillStyle = '#ce93d8'; ctx.font = 'bold 10px monospace';
      const t = (colTotals[cl] ?? 0).toLocaleString('id-ID');
      ctx.fillText(t, x + cw[ci + 1] - cp - ctx.measureText(t).width, fy + rh / 2 + 4); x += cw[ci + 1];
    });
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px monospace';
    const gt = grandTotal.toLocaleString('id-ID');
    ctx.fillText(gt, x + cw[cw.length - 1] - cp - ctx.measureText(gt).width, fy + rh / 2 + 4);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `pivot_${(tableTitle || 'table').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  }, [hasData, colLabels, rowLabels, matrix, rowTotals, colTotals, grandTotal, tableTitle, filteredRows.length, aggMethod]);

  const hasData = rowLabels.length > 0 && colLabels.length > 0;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-gradient-to-br from-[#111827]/80 to-[#0d1117]/90 backdrop-blur-xl">
      <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${accentFrom}, ${accentTo}, transparent)` }} />
      {/* Header */}
      <div className="relative px-5 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-xl border flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${accentFrom}20, ${accentTo}10)`, borderColor: `${accentFrom}33` }}>
            <CornerDownRight className="w-4 h-4" style={{ color: iconClr }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{tableTitle || 'Pivot Table'}</h3>
            <p className="text-[10px] text-[#546e7a]">Cross-tabulation — Row x Column dengan agregasi</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Download buttons - always visible */}
            <button onClick={handleDownloadExcel} disabled={!hasData || downloading}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium hover:bg-white/5 text-[#37474f] hover:text-[#66bb6a] disabled:opacity-20 transition-all" title="Download Excel">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button onClick={handleDownloadPNG} disabled={!hasData}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium hover:bg-white/5 text-[#37474f] hover:text-[#4dd0e1] disabled:opacity-20 transition-all" title="Download PNG">
              <ImageIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PNG</span>
            </button>
            <button onClick={handleDownloadCSV} disabled={!hasData}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium hover:bg-white/5 text-[#37474f] hover:text-[#ffb74d] disabled:opacity-20 transition-all" title="Download CSV">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            {onRemove && (
              <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-white/5 text-[#37474f] hover:text-[#ef5350] transition-all" title="Hapus Pivot Table">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Selector row + Filter toggle */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <label className="block text-[10px] text-[#546e7a] mb-1">Row Labels (Baris)</label>
            <select value={rowField} onChange={(e) => setRowField(e.target.value)} className={selCls}>
              {allColOptions.map(co => <option key={co.key} value={co.key} style={optStyle}>{co.label}</option>)}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="block text-[10px] text-[#546e7a] mb-1">Column Labels (Kolom)</label>
            <select value={colField} onChange={(e) => setColField(e.target.value)} className={selCls}>
              {allColOptions.map(co => <option key={co.key} value={co.key} style={optStyle}>{co.label}</option>)}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="block text-[10px] text-[#546e7a] mb-1">Agregasi</label>
            <select value={aggMethod} onChange={(e) => setAggMethod(e.target.value)} className={selCls}>
              {AGGREGATIONS.map(ag => <option key={ag.value} value={ag.value} style={optStyle}>{ag.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={() => setShowTable(!showTable)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border transition-all"
              style={{ background: `linear-gradient(to right, ${accentFrom}20, ${accentTo}10)`, borderColor: `${accentFrom}33`, color: accentFrom }}>
              {showTable ? 'Tutup Tabel' : 'Tampilkan Pivot'}
            </button>
            {/* Filter Berlapis toggle */}
            <button onClick={() => setShowFilter(!showFilter)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${hasActiveFilter ? 'border-[#64b5f6]/30 text-[#90caf9]' : 'border-white/[0.06] text-[#546e7a] hover:text-[#90caf9]'}`}
              style={hasActiveFilter ? { background: '#64b5f610' } : {}}>
              <Filter className="w-3.5 h-3.5" />
              <span>Filter Berlapis</span>
              {hasActiveFilter && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#64b5f6]/20 text-[#64b5f6]">{activeFilterCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Cascading Filter Panel */}
      {showFilter && (
        <div className="px-5 pb-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-[#546e7a]" />
                <span className="text-[11px] font-semibold text-[#78909c]">Filter Berlapis</span>
                <span className="text-[10px] text-[#37474f]">— pilih hierarki untuk memfilter data</span>
              </div>
              {hasActiveFilter && (
                <button onClick={clearFilters}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium text-[#ef5350] hover:bg-[#ef5350]/10 transition-all">
                  <X className="w-3 h-3" /> Reset Semua
                </button>
              )}
            </div>

            {HIERARCHY.map((level, li) => {
              const options = getOptionsForLevel(level.key);
              const selected = filters[level.key] || [];
              const parentSelected = li > 0 && (filters[HIERARCHY[li - 1].key] || []).length > 0;
              const isDisabled = li > 0 && !parentSelected;

              return (
                <div key={level.key} className={`${isDisabled ? 'opacity-30 pointer-events-none' : ''} transition-opacity`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {showFilter && <ChevronRight className="w-3 h-3 text-[#37474f]" />}
                    <span className="text-[10px] font-semibold text-[#78909c] uppercase tracking-wider">{level.label}</span>
                    {selected.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: `${accentFrom}20`, color: accentFrom }}>
                        {selected.length} terpilih
                      </span>
                    )}
                    <button onClick={() => {
                      // Select all at this level
                      setFilters(prev => ({ ...prev, [level.key]: options }));
                    }}
                      className="text-[9px] text-[#37474f] hover:text-[#90caf9] transition-colors">
                        Semua
                    </button>
                    {selected.length > 0 && (
                      <button onClick={() => {
                        setFilters(prev => {
                          const nf = { ...prev, [level.key]: [] };
                          const idx = HIERARCHY.findIndex(h => h.key === level.key);
                          for (let i = idx + 1; i < HIERARCHY.length; i++) { nf[HIERARCHY[i].key] = []; }
                          return nf;
                        });
                      }} className="text-[9px] text-[#37474f] hover:text-[#ef5350] transition-colors">
                        Hapus
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto aero-scroll">
                    {options.length === 0 ? (
                      <span className="text-[10px] text-[#37474f] italic">{isDisabled ? 'Pilih level sebelumnya terlebih dahulu' : 'Tidak ada data'}</span>
                    ) : (
                      options.map(opt => {
                        const isActive = selected.includes(opt);
                        return (
                          <button key={opt} onClick={() => toggleFilter(level.key, opt)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all whitespace-nowrap ${
                              isActive
                                ? ''
                                : 'border-white/[0.04] text-[#546e7a] hover:text-[#78909c] hover:border-white/[0.08] hover:bg-white/[0.02]'
                            }`}
                            style={isActive ? { background: `${accentFrom}20`, borderColor: `${accentFrom}40`, color: accentFrom } : {}}>
                            {opt}
                            {isActive && <span className="ml-1.5 text-[8px]">\u2713</span>}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}

            {/* Filter summary */}
            {hasActiveFilter && (
              <div className="pt-2 border-t border-white/[0.04]">
                <span className="text-[10px] text-[#546e7a]">
                  Data terfilter: <span className="font-bold text-[#90caf9]">{filteredRows.length}</span> dari <span className="text-[#78909c]">{rows.length}</span> baris
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {showTable && (
        <div className="px-4 pb-4" ref={tableRef}>
          {!hasData ? (
            <div className="flex items-center justify-center h-24 rounded-xl border border-dashed border-white/[0.06] text-[#37474f] text-xs">
              {hasActiveFilter ? `Tidak ada data untuk filter yang dipilih (${filteredRows.length} baris)` : 'Tidak ada data untuk ditampilkan'}
            </div>
          ) : (
            <div className="overflow-auto aero-scroll rounded-xl border border-white/[0.06] max-h-[400px]">
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ background: `linear-gradient(to right, ${accentFrom}40, ${accentTo}30)` }}>
                    <th className="text-left px-3 py-2.5 text-white/90 font-semibold sticky left-0 z-10 min-w-[140px]" style={{ background: `${accentFrom}30`, backdropFilter: 'blur(8px)' }}>Row Labels</th>
                    {colLabels.map(cl => (
                      <th key={cl} className="text-center px-3 py-2.5 text-white/90 font-semibold whitespace-nowrap">{cl}</th>
                    ))}
                    <th className="text-center px-3 py-2.5 text-white font-bold whitespace-nowrap border-l border-white/10">Grand Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rowLabels.map((rl, ri) => (
                    <tr key={rl} className={ri % 2 === 0 ? 'bg-white/[0.02]' : ''}>
                      <td className="px-3 py-2 text-[#e0e0e0] font-medium sticky left-0 whitespace-nowrap" style={{ background: ri % 2 === 0 ? '#ffffff06' : '#ffffff03', backdropFilter: 'blur(8px)' }}>{rl}</td>
                      {colLabels.map(cl => {
                        const v = matrix[rl]?.[cl] ?? 0;
                        return (
                          <td key={cl} className={`text-center px-3 py-2 font-mono whitespace-nowrap ${v > 0 ? 'text-[#e0e0e0]' : 'text-[#37474f]'}`}>{v.toLocaleString('id-ID')}</td>
                        );
                      })}
                      <td className="text-center px-3 py-2 font-mono font-bold text-[#90caf9] border-l border-white/[0.06] whitespace-nowrap">{(rowTotals[rl] ?? 0).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-white/10 bg-white/[0.04]">
                    <td className="px-3 py-2.5 text-white font-bold sticky left-0" style={{ background: '#ffffff0a', backdropFilter: 'blur(8px)' }}>Grand Total</td>
                    {colLabels.map(cl => (
                      <td key={cl} className="text-center px-3 py-2.5 font-mono font-bold text-[#ce93d8] whitespace-nowrap">{(colTotals[cl] ?? 0).toLocaleString('id-ID')}</td>
                    ))}
                    <td className="text-center px-3 py-2.5 font-mono font-black text-white text-sm border-l border-white/10 whitespace-nowrap">{grandTotal.toLocaleString('id-ID')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}'''

# Find and replace the old PivotTableSection
old_start = '/* ─── Cross-Tabulation Pivot Table ─── */'
old_end_marker = 'interface PivotTableConfig {'

start_idx = content.index(old_start)
end_idx = content.index(old_end_marker)

content = content[:start_idx] + new_pivot_section + '\n\n' + content[end_idx:]

# ─── 5. Update default pivotTables to 3 ───
old_pt_state = """const [pivotTables, setPivotTables] = useState<PivotTableConfig[]>([
    { id: 'pt-1', title: 'Pivot Table 1', rowField: 'provinsi', colField: 'klasifikasiTsa' },
  ]);"""
new_pt_state = """const [pivotTables, setPivotTables] = useState<PivotTableConfig[]>([
    { id: 'pt-1', title: 'Pivot Table 1 — Provinsi x Klasifikasi', rowField: 'provinsi', colField: 'klasifikasiTsa' },
    { id: 'pt-2', title: 'Pivot Table 2 — Provinsi x PIC TSA', rowField: 'provinsi', colField: 'picTsa' },
    { id: 'pt-3', title: 'Pivot Table 3 — Kabupaten x PIC TSA', rowField: 'kabupaten', colField: 'picTsa' },
  ]);"""
content = content.replace(old_pt_state, new_pt_state)

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print('OK: pivot-charts.tsx updated successfully')
print(f'File size: {len(content)} chars, {content.count(chr(10))} lines')
