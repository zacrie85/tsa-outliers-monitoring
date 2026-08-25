'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Download, Plus, X, BarChart3, LineChart as LineChartIcon,
  PieChart as PieChartIcon, AreaChart, Edit3, Check, Table2,
  ArrowUp, ArrowDown, TrendingUp, Minus, Hash, RefreshCw, Save, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart as RechartsArea, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const CHART_TYPES = [
  { value: 'bar', label: 'Bar', icon: BarChart3 },
  { value: 'hbar', label: 'H-Bar', icon: BarChart3 },
  { value: 'line', label: 'Line', icon: LineChartIcon },
  { value: 'pie', label: 'Pie', icon: PieChartIcon },
  { value: 'area', label: 'Area', icon: AreaChart },
  { value: 'table', label: 'Tabel', icon: Table2 },
];

const PALETTES = [
  { name: 'Ocean', colors: ['#64b5f6', '#42a5f5', '#1e88e5', '#90caf9', '#bbdefb'] },
  { name: 'Forest', colors: ['#81c784', '#66bb6a', '#43a047', '#a5d6a7', '#c8e6c9'] },
  { name: 'Sunset', colors: ['#ffb74d', '#ffa726', '#ff9800', '#ffcc02', '#fff176'] },
  { name: 'Berry', colors: ['#e57373', '#ef5350', '#f44336', '#ef9a9a', '#ffcdd2'] },
  { name: 'Violet', colors: ['#ba68c8', '#ab47bc', '#9c27b0', '#ce93d8', '#e1bee7'] },
  { name: 'Cyan', colors: ['#4dd0e1', '#26c6da', '#00bcd4', '#80deea', '#b2ebf2'] },
  { name: 'Multi', colors: ['#64b5f6', '#81c784', '#ffb74d', '#e57373', '#ba68c8', '#4dd0e1', '#fff176', '#ff8a65'] },
];

const BASE_COL_OPTIONS = [
  { key: 'provinsi', label: 'Provinsi' },
  { key: 'kabupaten', label: 'Kabupaten' },
  { key: 'kecamatan', label: 'Kecamatan' },
  { key: 'kelurahan', label: 'Kelurahan' },
  { key: 'categoryBak', label: 'Category BAK' },
  { key: 'klasifikasiTsa', label: 'Klasifikasi TSA' },
  { key: 'picTsa', label: 'PIC TSA' },
];

const AGGREGATIONS = [
  { value: 'count', label: 'Jumlah (Count)' },
  { value: 'sum_homepass', label: 'Total Homepass' },
  { value: 'sum_odp', label: 'Total ODP' },
  { value: 'avg_homepass', label: 'Rata-rata Homepass' },
  { value: 'avg_odp', label: 'Rata-rata ODP' },
];

interface PivotRow {
  id: string;
  label: string;
  value: number;
}

interface PivotChart {
  id: string;
  title: string;
  chartType: string;
  paletteIndex: number;
  groupCol: string;
  aggMethod: string;
  data: PivotRow[];
  edited: boolean;
}

interface MonitoringRow {
  id: string;
  provinsi: string;
  kabupaten: string;
  kecamatan: string;
  kelurahan: string;
  categoryBak: string;
  klasifikasiTsa: string;
  picTsa: string;
  homepass: number;
  odp: number;
  customData: string;
}

function createEmptyChart(index: number): PivotChart {
  return {
    id: `pivot-${Date.now()}-${index}`,
    title: `Pivot Chart ${index + 1}`,
    chartType: 'bar',
    paletteIndex: index % PALETTES.length,
    groupCol: 'provinsi',
    aggMethod: 'count',
    data: [],
    edited: false,
  };
}

const tooltipStyle = {
  background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  fontSize: 12,
  color: '#e0e0e0',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

function PivotCard({
  chart, rows, customColOptions, onUpdate, onRemove,
}: {
  chart: PivotChart;
  index: number;
  rows: MonitoringRow[];
  customColOptions: { key: string; label: string }[];
  onUpdate: (chart: PivotChart) => void;
  onRemove: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(chart.title);
  const [showPalette, setShowPalette] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTitleDraft(chart.title); }, [chart.title]);

  const palette = PALETTES[chart.paletteIndex] || PALETTES[0];
  const colors = palette.colors;
  const accentColor = colors[0];
  const allColOptions = [...BASE_COL_OPTIONS, ...customColOptions];

  const updateTitle = () => {
    if (titleDraft.trim()) onUpdate({ ...chart, title: titleDraft.trim() });
    setEditingTitle(false);
  };

  const updateRow = (rowId: string, field: 'label' | 'value', val: string) => {
    onUpdate({
      ...chart,
      edited: true,
      data: chart.data.map(r =>
        r.id === rowId
          ? { ...r, [field]: field === 'value' ? (parseFloat(val) || 0) : val }
          : r
      ),
    });
  };

  const removeRow = (rowId: string) => {
    onUpdate({ ...chart, edited: true, data: chart.data.filter(r => r.id !== rowId) });
  };

  const moveRow = (rowId: string, dir: -1 | 1) => {
    const idx = chart.data.findIndex(r => r.id === rowId);
    if (idx < 0) return;
    const ni = idx + dir;
    if (ni < 0 || ni >= chart.data.length) return;
    const nd = [...chart.data];
    [nd[idx], nd[ni]] = [nd[ni], nd[idx]];
    onUpdate({ ...chart, edited: true, data: nd });
  };

  const addEmptyRow = () => {
    onUpdate({
      ...chart,
      edited: true,
      data: [...chart.data, { id: `row-${Date.now()}`, label: '', value: 0 }],
    });
  };

  // Auto-generate data from monitoring rows
  const autoGenerate = useCallback(() => {
    if (!chart.groupCol || rows.length === 0) return;

    const groups: Record<string, { count: number; homepass: number; odp: number }> = {};
    rows.forEach(row => {
      let val = 'Lainnya';
      if (chart.groupCol in row) {
        val = String((row as any)[chart.groupCol] || 'Lainnya');
      } else {
        try {
          const cd = JSON.parse(row.customData || '{}');
          val = String(cd[chart.groupCol] || 'Lainnya');
        } catch { /* */ }
      }
      if (!groups[val]) groups[val] = { count: 0, homepass: 0, odp: 0 };
      groups[val].count++;
      groups[val].homepass += row.homepass || 0;
      groups[val].odp += row.odp || 0;
    });

    const data: PivotRow[] = Object.entries(groups)
      .map(([name, d]) => {
        let value = 0;
        if (chart.aggMethod === 'count') value = d.count;
        else if (chart.aggMethod === 'sum_homepass') value = d.homepass;
        else if (chart.aggMethod === 'sum_odp') value = d.odp;
        else if (chart.aggMethod === 'avg_homepass') value = d.count > 0 ? Math.round(d.homepass / d.count) : 0;
        else if (chart.aggMethod === 'avg_odp') value = d.count > 0 ? Math.round(d.odp / d.count) : 0;
        return { id: `r-${name}-${Date.now()}`, label: name, value };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 25);

    onUpdate({ ...chart, data, edited: false });
  }, [chart.groupCol, chart.aggMethod, rows, onUpdate]);

  // Auto-generate when groupCol or aggMethod changes
  useEffect(() => { autoGenerate(); }, [chart.groupCol, chart.aggMethod]);
  // Re-generate when rows change (but only if not manually edited)
  useEffect(() => { if (!chart.edited) autoGenerate(); }, [rows.length]);

  const chartData = chart.data.map(r => ({ name: r.label || '-', value: r.value }));
  const hasData = chartData.length > 0;

  const stats = hasData ? {
    total: chartData.reduce((s, d) => s + d.value, 0),
    avg: chartData.reduce((s, d) => s + d.value, 0) / chartData.length,
    min: Math.min(...chartData.map(d => d.value)),
    max: Math.max(...chartData.map(d => d.value)),
  } : null;

  const handleDownloadPNG = useCallback(() => {
    const el = chartRef.current;
    if (!el) return;
    const svgEl = el.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); return; }
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#0d1117');
      grad.addColorStop(1, '#161b22');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${chart.title.replace(/\s+/g, '_')}.png`;
      a.click();
    };
    img.src = url;
  }, [chart.title]);

  const handleDownloadCSV = useCallback(() => {
    if (!hasData) return;
    const csv = 'Label,Value\n' + chart.data.map(r => `"${r.label}",${r.value}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${chart.title.replace(/\s+/g, '_')}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [chart.title, chart.data, hasData]);

  const axisProps = {
    tick: { fill: '#78909c', fontSize: 10 },
    axisLine: { stroke: 'rgba(255,255,255,0.06)' },
    tickLine: { stroke: 'rgba(255,255,255,0.06)' },
  };

  const renderChart = () => {
    if (!hasData) return (
      <div className="flex flex-col items-center justify-center h-full text-[#37474f] select-none">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-3">
          <BarChart3 className="w-7 h-7 opacity-20" />
        </div>
        <p className="text-xs font-medium">Pilih kolom untuk generate chart</p>
        <p className="text-[10px] text-[#2a2a3a] mt-1">Data otomatis terisi dari tabel monitoring</p>
      </div>
    );
    if (chart.chartType === 'table') return null;

    switch (chart.chartType) {
      case 'hbar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" {...axisProps} />
              <YAxis type="category" dataKey="name" width={90} {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" {...axisProps} angle={-25} textAnchor="end" height={55} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="value" stroke={accentColor} strokeWidth={2.5} dot={{ fill: accentColor, r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: accentColor, stroke: '#fff', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="75%" innerRadius="35%" paddingAngle={3} strokeWidth={0}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsArea data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" {...axisProps} angle={-25} textAnchor="end" height={55} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <defs>
                <linearGradient id={`ag-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={accentColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke={accentColor} fill={`url(#ag-${chart.id})`} strokeWidth={2.5} />
            </RechartsArea>
          </ResponsiveContainer>
        );
      default:
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" {...axisProps} angle={-25} textAnchor="end" height={55} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={28}>
                {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  const selectCls = 'w-full px-2.5 py-1.5 rounded-lg text-[11px] bg-white/[0.04] border border-white/[0.06] text-[#e0e0e0] focus:outline-none focus:border-white/[0.12] transition-all cursor-pointer';
  const optStyle = { background: '#1a1a2e' };

  return (
    <div className="group relative rounded-2xl overflow-hidden border border-white/[0.06] bg-gradient-to-br from-[#111827]/80 to-[#0d1117]/90 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.1]">
      {/* Accent line */}
      <div className="absolute top-0 inset-x-0 h-[2px] opacity-60" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-1.5">
              <input autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') updateTitle(); if (e.key === 'Escape') { setTitleDraft(chart.title); setEditingTitle(false); } }}
                className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#64b5f6]/40 w-48" />
              <button onClick={updateTitle} className="p-1 rounded-lg hover:bg-[#66bb6a]/20 text-[#66bb6a]"><Check className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <button onClick={() => { setTitleDraft(chart.title); setEditingTitle(true); }}
              className="flex items-center gap-2 text-sm font-semibold text-[#e3f2fd] hover:text-white transition-colors truncate">
              <Edit3 className="w-3 h-3 text-[#37474f] group-hover:text-[#546e7a] transition-colors flex-shrink-0" />
              <span className="truncate">{chart.title}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Palette */}
          <div className="relative">
            <button onClick={() => setShowPalette(!showPalette)}
              className="w-4 h-4 rounded-full border border-white/20 hover:border-white/40 transition-all"
              style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1] || colors[0]})` }}
              title={`Palet: ${palette.name}`} />
            {showPalette && (
              <div className="absolute right-0 top-6 z-20 p-1.5 rounded-xl bg-[#1a1a2e] border border-white/10 shadow-2xl flex flex-col gap-1 min-w-[110px]">
                {PALETTES.map((p, pi) => (
                  <button key={p.name} onClick={() => { onUpdate({ ...chart, paletteIndex: pi }); setShowPalette(false); }}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] transition-all ${chart.paletteIndex === pi ? 'bg-white/10 text-white' : 'text-[#78909c] hover:text-white hover:bg-white/5'}`}>
                    <div className="flex gap-px">{p.colors.slice(0, 4).map((c, ci) => <span key={ci} className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c }} />)}</div>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-px h-4 bg-white/[0.06]" />
          {/* Chart types */}
          <div className="flex items-center rounded-lg bg-white/[0.03] p-0.5 border border-white/[0.04]">
            {CHART_TYPES.map(ct => {
              const Icon = ct.icon;
              const active = chart.chartType === ct.value;
              return (
                <button key={ct.value} onClick={() => onUpdate({ ...chart, chartType: ct.value })} title={ct.label}
                  className={`p-1 rounded-md transition-all duration-200 ${active ? 'text-white' : 'text-[#37474f] hover:text-[#78909c]'}`}
                  style={active ? { background: `${accentColor}22` } : {}}>
                  <Icon className="w-3 h-3" />
                </button>
              );
            })}
          </div>
          <div className="w-px h-4 bg-white/[0.06]" />
          <button onClick={handleDownloadCSV} disabled={!hasData} className="p-1 rounded-lg hover:bg-white/5 text-[#37474f] hover:text-[#4dd0e1] disabled:opacity-20 transition-all" title="CSV"><Table2 className="w-3 h-3" /></button>
          <button onClick={handleDownloadPNG} disabled={!hasData} className="p-1 rounded-lg hover:bg-white/5 text-[#37474f] hover:text-[#66bb6a] disabled:opacity-20 transition-all" title="PNG"><Download className="w-3 h-3" /></button>
          <button onClick={onRemove} className="p-1 rounded-lg hover:bg-[#ef5350]/10 text-[#37474f] hover:text-[#ef5350] transition-all" title="Hapus"><X className="w-3 h-3" /></button>
        </div>
      </div>

      {/* Selector bar */}
      <div className="px-4 pb-2 flex flex-wrap items-center gap-2">
        <select value={chart.groupCol} onChange={(e) => onUpdate({ ...chart, groupCol: e.target.value, edited: false })} className={selectCls}>
          {allColOptions.map(co => <option key={co.key} value={co.key} style={optStyle}>{co.label}</option>)}
        </select>
        <select value={chart.aggMethod} onChange={(e) => onUpdate({ ...chart, aggMethod: e.target.value, edited: false })} className={selectCls}>
          {AGGREGATIONS.map(ag => <option key={ag.value} value={ag.value} style={optStyle}>{ag.label}</option>)}
        </select>
        {chart.edited && (
          <button onClick={autoGenerate} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] text-[#4dd0e1] hover:bg-[#4dd0e1]/10 transition-all" title="Refresh dari data monitoring">
            <RefreshCw className="w-3 h-3" /> Reset
          </button>
        )}
        {chart.edited && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#ffb74d]/10 text-[#ffb74d] border border-[#ffb74d]/20">Edited</span>
        )}
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="px-4 pb-1.5 flex items-center gap-2.5 text-[10px]">
          <span className="text-[#546e7a]"><Hash className="w-2.5 h-2.5 inline" /> {chartData.length}</span>
          <span className="text-[#90caf9]"><TrendingUp className="w-2.5 h-2.5 inline" /> {stats.total.toLocaleString('id-ID')}</span>
          <span className="text-[#a5d6a7]">Avg: {stats.avg.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</span>
          <span className="text-[#ffb74d]">Min: {stats.min.toLocaleString('id-ID')}</span>
          <span className="text-[#ef9a9a]">Max: {stats.max.toLocaleString('id-ID')}</span>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col min-h-0" style={{ height: chart.chartType === 'table' ? 'auto' : 280 }}>
        {/* Chart area */}
        <div className="flex-1 min-h-[180px] px-3 pb-1" ref={chartRef}>
          {chart.chartType === 'table' && hasData ? (
            <div className="h-full overflow-auto aero-scroll rounded-xl border border-white/[0.04]">
              <table className="w-full text-xs">
                <thead><tr className="bg-white/[0.03]">
                  <th className="text-left px-3 py-2 text-[#78909c] font-medium sticky top-0 bg-[#0d1117]/95 backdrop-blur-sm">No</th>
                  <th className="text-left px-3 py-2 text-[#78909c] font-medium sticky top-0 bg-[#0d1117]/95 backdrop-blur-sm">Label</th>
                  <th className="text-right px-3 py-2 text-[#78909c] font-medium sticky top-0 bg-[#0d1117]/95 backdrop-blur-sm">Value</th>
                </tr></thead>
                <tbody>
                  {chart.data.map((row, i) => (
                    <tr key={row.id} className="border-t border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-3 py-1.5 text-[#546e7a] font-mono">{i + 1}</td>
                      <td className="px-3 py-1.5 text-[#e0e0e0]">{row.label || '-'}</td>
                      <td className="px-3 py-1.5 text-right font-mono" style={{ color: colors[i % colors.length] }}>{row.value.toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                  {stats && (
                    <tr className="border-t-2 border-white/[0.08] bg-white/[0.02]">
                      <td colSpan={2} className="px-3 py-2 text-[#78909c] font-semibold">Total</td>
                      <td className="px-3 py-2 text-right font-bold text-white font-mono">{stats.total.toLocaleString('id-ID')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : renderChart()}
        </div>

        {/* Editable data table */}
        <div className="border-t border-white/[0.04]">
          <div className="flex items-center justify-between px-4 py-1.5">
            <span className="text-[9px] text-[#37474f] font-medium uppercase tracking-wider">Data {chart.edited ? '(edited)' : '(auto)'}</span>
            <div className="flex gap-1.5">
              <button onClick={autoGenerate} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-[#546e7a] hover:text-white hover:bg-white/5 transition-all" title="Refresh dari data monitoring">
                <RefreshCw className="w-2.5 h-2.5" /> Refresh
              </button>
              <button onClick={addEmptyRow} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-all hover:bg-white/5" style={{ color: accentColor }}>
                <Plus className="w-2.5 h-2.5" /> Tambah
              </button>
            </div>
          </div>
          {chart.data.length === 0 ? (
            <div className="px-4 pb-3"><div className="flex items-center justify-center h-10 rounded-lg border border-dashed border-white/[0.04] text-[#2a2a3a] text-[10px]">Menunggu data...</div></div>
          ) : (
            <div className="max-h-[160px] overflow-y-auto aero-scroll">
              <table className="w-full text-[11px]">
                <thead><tr className="bg-white/[0.02]">
                  <th className="w-6 px-0.5 py-1"></th>
                  <th className="text-left px-2 py-1 text-[#37474f] font-medium">Label</th>
                  <th className="text-left px-2 py-1 text-[#37474f] font-medium w-24">Value</th>
                  <th className="w-6 px-0.5 py-1"></th>
                </tr></thead>
                <tbody>
                  {chart.data.map((row, ri) => (
                    <tr key={row.id} className="group/row border-t border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                      <td className="px-0.5 py-0.5">
                        <div className="flex flex-col gap-px opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button onClick={() => moveRow(row.id, -1)} disabled={ri === 0} className="p-px text-[#37474f] hover:text-white disabled:opacity-20"><ArrowUp className="w-2.5 h-2.5" /></button>
                          <button onClick={() => moveRow(row.id, 1)} disabled={ri === chart.data.length - 1} className="p-px text-[#37474f] hover:text-white disabled:opacity-20"><ArrowDown className="w-2.5 h-2.5" /></button>
                        </div>
                      </td>
                      <td className="px-0.5 py-0.5">
                        <input value={row.label} onChange={(e) => updateRow(row.id, 'label', e.target.value)}
                          className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-white/[0.06] focus:border-white/[0.12] focus:bg-white/[0.03] rounded text-[#e0e0e0] placeholder:text-[#2a2a3a] focus:outline-none transition-all text-[11px]" />
                      </td>
                      <td className="px-0.5 py-0.5">
                        <input type="number" value={row.value || ''} onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                          className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-white/[0.06] focus:border-white/[0.12] focus:bg-white/[0.03] rounded text-right font-mono text-[#e0e0e0] placeholder:text-[#2a2a3a] focus:outline-none transition-all text-[11px]" />
                      </td>
                      <td className="px-0.5 py-0.5">
                        <button onClick={() => removeRow(row.id)}
                          className="p-0.5 rounded opacity-0 group-hover/row:opacity-100 text-[#37474f] hover:text-[#ef5350] hover:bg-[#ef5350]/10 transition-all">
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PivotCharts() {
  const [charts, setCharts] = useState<PivotChart[]>(() =>
    Array.from({ length: 8 }, (_, i) => createEmptyChart(i))
  );
  const [rows, setRows] = useState<MonitoringRow[]>([]);
  const [customCols, setCustomCols] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [rowsRes, colsRes] = await Promise.all([
        fetch('/api/monitoring'),
        fetch('/api/columns'),
      ]);
      const rowsData = await rowsRes.json();
      const colsData = await colsRes.json();
      setRows(rowsData.rows);
      setCustomCols(colsData.columns);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const customColOptions = customCols.map((c: any) => ({ key: c.id, label: c.label }));

  const updateChart = useCallback((index: number, chart: PivotChart) => {
    setCharts(prev => prev.map((c, i) => i === index ? chart : c));
  }, []);

  const removeChart = (index: number) => {
    setCharts(prev => prev.filter((_, i) => i !== index));
  };

  const addChart = () => {
    setCharts(prev => [...prev, createEmptyChart(prev.length)]);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#64b5f6]/20 to-[#42a5f5]/5 border border-[#64b5f6]/20 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-[#64b5f6]" />
            </div>
            Pivot Charts
          </h2>
          <p className="text-[11px] text-[#546e7a] mt-1 ml-10">Data otomatis dari monitoring — pilih kolom & agregasi, edit jika perlu, lalu download</p>
        </div>
        <button onClick={addChart}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-[#64b5f6]/20 to-[#42a5f5]/10 border border-[#64b5f6]/20 text-[#90caf9] hover:from-[#64b5f6]/30 hover:to-[#42a5f5]/20 hover:border-[#64b5f6]/30 transition-all">
          <Plus className="w-4 h-4" /> Tambah Chart
        </button>
      </div>

      <div className="flex-1 overflow-y-auto aero-scroll pb-4">
        {charts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#37474f]">
            <div className="w-20 h-20 rounded-3xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-4">
              <BarChart3 className="w-10 h-10 opacity-20" />
            </div>
            <p className="text-sm font-medium">Tidak ada chart</p>
            <p className="text-[11px] mt-1">Klik &quot;Tambah Chart&quot; untuk memulai</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {charts.map((chart, i) => (
              <PivotCard key={chart.id} chart={chart} index={i} rows={rows}
                customColOptions={customColOptions} onUpdate={(c) => updateChart(i, c)} onRemove={() => removeChart(i)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
