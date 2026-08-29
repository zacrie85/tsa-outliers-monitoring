'use client';
import { apiFetch } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { useProjectFields, FieldDef } from '@/hooks/use-project-fields';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

import {
  Download, Plus, X, BarChart3, LineChart as LineChartIcon, Filter, ChevronDown, ChevronRight,
  PieChart as PieChartIcon, AreaChart, Edit3, Check, Table2,
  ArrowUp, ArrowDown, TrendingUp, Minus, Hash, RefreshCw, FileSpreadsheet, CornerDownRight, Image as ImageIcon,
} from 'lucide-react';
import { ExcelPivotTable } from './excel-pivot-table';
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

const DEFAULT_AGGREGATIONS = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
];

const DEFAULT_HIERARCHY: { key: string; label: string }[] = [];


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
  orderNum: number;
  customData: string;
}

function getFieldValue(row: MonitoringRow, key: string): string {
  try {
    const data = JSON.parse(row.customData || '{}');
    return String(data[key] ?? '');
  } catch {
    return '';
  }
}

function createEmptyChart(index: number): PivotChart {
  return {
    id: `pivot-${Date.now()}-${index}`,
    title: `Pivot Chart ${index + 1}`,
    chartType: 'bar',
    paletteIndex: index % PALETTES.length,
    groupCol: '',
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
  colOptions, aggregations, hierarchy,
}: {
  chart: PivotChart;
  index: number;
  rows: MonitoringRow[];
  customColOptions: { key: string; label: string }[];
  onUpdate: (chart: PivotChart) => void;
  onRemove: () => void;
  colOptions: { key: string; label: string }[];
  aggregations: { value: string; label: string }[];
  hierarchy: { key: string; label: string }[];
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(chart.title);
  const [showPalette, setShowPalette] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTitleDraft(chart.title); }, [chart.title]);

  const palette = PALETTES[chart.paletteIndex] || PALETTES[0];
  const colors = palette.colors;
  const accentColor = colors[0];
  const safeColOptions = Array.isArray(colOptions) ? colOptions : [];
  const safeCustomColOptions = Array.isArray(customColOptions) ? customColOptions : [];
  const safeAggregations = Array.isArray(aggregations) ? aggregations : DEFAULT_AGGREGATIONS;
  const safeHierarchy = Array.isArray(hierarchy) ? hierarchy : [];
  const allColOptions = [...safeColOptions, ...safeCustomColOptions];

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

    // Determine the numeric field key for sum/avg (from project fields dynamic aggs like sum_xxx, avg_xxx)
    const aggFieldKey = (chart.aggMethod.startsWith('sum_') || chart.aggMethod.startsWith('avg_'))
      ? chart.aggMethod.replace(/^(sum|avg)_/, '')
      : null;

    const groups: Record<string, { count: number; nums: Record<string, number> }> = {};
    rows.forEach(row => {
      const val = getFieldValue(row, chart.groupCol) || 'Lainnya';
      if (!groups[val]) groups[val] = { count: 0, nums: {} };
      groups[val].count++;
      // Collect numeric value for the aggregation field from customData
      if (aggFieldKey) {
        const num = parseFloat(getFieldValue(row, aggFieldKey)) || 0;
        groups[val].nums[aggFieldKey] = (groups[val].nums[aggFieldKey] || 0) + num;
      }
    });

    const data: PivotRow[] = Object.entries(groups)
      .map(([name, d]) => {
        let value = 0;
        if (chart.aggMethod === 'count') {
          value = d.count;
        } else if (chart.aggMethod.startsWith('sum_') && aggFieldKey) {
          value = d.nums[aggFieldKey] || 0;
        } else if (chart.aggMethod.startsWith('avg_') && aggFieldKey) {
          const total = d.nums[aggFieldKey] || 0;
          value = d.count > 0 ? Math.round(total / d.count) : 0;
        } else {
          value = d.count;
        }
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
          {safeAggregations.map(ag => <option key={ag.value} value={ag.value} style={optStyle}>{ag.label}</option>)}
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

/* ─── Pivot Table Accents ─── */

const PIVOT_ACCENTS = [
  { from: '#ba68c8', to: '#64b5f6', icon: '#ba68c8' },
  { from: '#64b5f6', to: '#4dd0e1', icon: '#64b5f6' },
  { from: '#4dd0e1', to: '#66bb6a', icon: '#4dd0e1' },
  { from: '#ffb74d', to: '#ef5350', icon: '#ffb74d' },
  { from: '#ef5350', to: '#ba68c8', icon: '#ef5350' },
  { from: '#81c784', to: '#64b5f6', icon: '#81c784' },
];

/* ─── Helpers for Pivot Table ─── */

function getRowValue(row: MonitoringRow, colKey: string): string {
  return getFieldValue(row, colKey) || 'Lainnya';
}

function computeAgg(items: MonitoringRow[], method: string, projectFields?: FieldDef[]): number {
  if (items.length === 0) return 0;
  if (method === 'count') return items.length;
  // Dynamic: sum_xxx or avg_xxx
  if (method.startsWith('sum_') || method.startsWith('avg_')) {
    const fieldKey = method.replace(/^(sum|avg)_/, '');
    const nums = items.map(r => parseFloat(getFieldValue(r, fieldKey)) || 0);
    if (nums.length === 0) return 0;
    if (method.startsWith('sum_')) return nums.reduce((s, v) => s + v, 0);
    return Math.round(nums.reduce((s, v) => s + v, 0) / nums.length);
  }
  // Generic sum / avg (no field suffix) — not meaningful without a field, fall back to count
  return items.length;
}

/* ─── Cascading Filter Hierarchy ─── */

function PivotTableSection({ rows, allColOptions, defaultRowField = 'provinsi', defaultColField = 'klasifikasiTsa', tableTitle, accentFrom = '#ba68c8', accentTo = '#64b5f6', iconColor: iconClr = '#ba68c8', onRemove, hierarchy, aggregations }: {
  rows: MonitoringRow[];
  allColOptions: { key: string; label: string }[];
  defaultRowField?: string;
  defaultColField?: string;
  tableTitle?: string;
  accentFrom?: string;
  accentTo?: string;
  iconColor?: string;
  onRemove?: () => void;
  hierarchy?: { key: string; label: string }[];
  aggregations?: { value: string; label: string }[];
}) {
  const safeAllColOptions = Array.isArray(allColOptions) ? allColOptions : [];
  const activeHierarchy = Array.isArray(hierarchy) ? hierarchy : DEFAULT_HIERARCHY;
  const activeAggregations = Array.isArray(aggregations) ? aggregations : DEFAULT_AGGREGATIONS;
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
      const idx = activeHierarchy.findIndex(h => h.key === levelKey);
      for (let i = idx + 1; i < activeHierarchy.length; i++) {
        newFilters[activeHierarchy[i].key] = [];
      }
      return newFilters;
    });
  };

  const clearFilters = () => setFilters({});

  const hasActiveFilter = activeHierarchy.some(h => (filters[h.key] || []).length > 0);
  const activeFilterCount = activeHierarchy.reduce((s, h) => s + (filters[h.key] || []).length, 0);

  const getOptionsForLevel = useCallback((levelKey: string): string[] => {
    const idx = activeHierarchy.findIndex(h => h.key === levelKey);
    let filtered = rows;
    for (let i = 0; i < idx; i++) {
      const parentKey = activeHierarchy[i].key;
      const selected = filters[parentKey];
      if (selected && selected.length > 0) {
        filtered = filtered.filter(r => selected.includes(getRowValue(r, parentKey)));
      }
    }
    return [...new Set(filtered.map(r => getRowValue(r, levelKey)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [rows, filters]);

  const filteredRows = useMemo(() => {
    let result = rows;
    activeHierarchy.forEach(h => {
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

  /* ── hasData check (used by download functions) ── */
  const hasData = rowLabels.length > 0 && colLabels.length > 0;

  /* ── Download Functions ── */
  const handleDownloadCSV = () => {
    if (!hasData) return;
    const header = ['Row Labels', ...colLabels, 'Grand Total'].join(',');
    const body = rowLabels.map(rl => {
      const vals = colLabels.map(cl => matrix[rl]?.[cl] ?? 0);
      return [rl, ...vals, rowTotals[rl] ?? 0].join(',');
    });
    const totalRow = ['Grand Total', ...colLabels.map(cl => colTotals[cl] ?? 0), grandTotal].join(',');
    const csv = [header, ...body, totalRow].join('\n');
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
              {safeAllColOptions.map(co => <option key={co.key} value={co.key} style={optStyle}>{co.label}</option>)}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="block text-[10px] text-[#546e7a] mb-1">Column Labels (Kolom)</label>
            <select value={colField} onChange={(e) => setColField(e.target.value)} className={selCls}>
              {safeAllColOptions.map(co => <option key={co.key} value={co.key} style={optStyle}>{co.label}</option>)}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="block text-[10px] text-[#546e7a] mb-1">Agregasi</label>
            <select value={aggMethod} onChange={(e) => setAggMethod(e.target.value)} className={selCls}>
              {activeAggregations.map(ag => <option key={ag.value} value={ag.value} style={optStyle}>{ag.label}</option>)}
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

            {activeHierarchy.map((level, li) => {
              const options = getOptionsForLevel(level.key);
              const selected = filters[level.key] || [];
              const parentSelected = li > 0 && (filters[activeHierarchy[li - 1].key] || []).length > 0;
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
                          const idx = activeHierarchy.findIndex(h => h.key === level.key);
                          for (let i = idx + 1; i < activeHierarchy.length; i++) { nf[activeHierarchy[i].key] = []; }
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
                            {isActive && <span className="ml-1.5 text-[8px]">✓</span>}
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
}

interface PivotTableConfig {
  id: string;
  title: string;
  rowField: string;
  colField: string;
}

export function PivotCharts() {
  const { projects, activeProjectId } = useAppStore();
  const safeProjects = Array.isArray(projects) ? projects : [];

  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId || 'default');
  const [rows, setRows] = useState<MonitoringRow[]>([]);
  const [customCols, setCustomCols] = useState<any[]>([]);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [pivotIds, setPivotIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return ['ep-1'];
    return ['ep-1'];
  });

  // Fetch data when selected project changes
  const fetchData = useCallback(async (pid: string) => {
    if (!pid) return;
    setLoading(true);
    try {
      const [rowsRes, colsRes, fieldsRes] = await Promise.all([
        fetch(`/api/monitoring?projectId=${pid}`).then(r => r.json()),
        fetch(`/api/columns?projectId=${pid}`).then(r => r.json()),
        fetch(`/api/columns/fields?projectId=${pid}`).then(r => r.json()),
      ]);
      const rawRows = Array.isArray(rowsRes?.rows) ? rowsRes.rows : [];
      setRows(rawRows.filter((r: any) => r && typeof r === 'object' && r.id));
      setCustomCols(Array.isArray(colsRes?.columns) ? colsRes.columns : []);
      setFields(Array.isArray(fieldsRes?.fields) ? fieldsRes.fields : []);
    } catch (err) {
      console.error('Failed to fetch pivot data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + refetch on project change
  useEffect(() => { void fetchData(selectedProjectId); }, [selectedProjectId, fetchData]);

  // Re-fetch on project switch from other tabs
  useEffect(() => {
    const handler = () => {
      setSelectedProjectId(useAppStore.getState().activeProjectId || 'default');
    };
    window.addEventListener('project-switched', handler);
    return () => window.removeEventListener('project-switched', handler);
  }, []);

  // Persist pivot IDs per project in localStorage
  useEffect(() => {
    try { localStorage.setItem(`pivot-ids-${selectedProjectId}`, JSON.stringify(pivotIds)); } catch {}
  }, [pivotIds, selectedProjectId]);

  // Load pivot IDs from localStorage on project change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`pivot-ids-${selectedProjectId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setPivotIds(parsed);
      } else {
        setPivotIds(['ep-1']);
      }
    } catch {
      setPivotIds(['ep-1']);
    }
  }, [selectedProjectId]);

  const addPivot = () => {
    setPivotIds(prev => [...prev, `ep-${Date.now()}`]);
  };

  const removePivot = (id: string) => {
    setPivotIds(prev => {
      const next = prev.filter(i => i !== id);
      if (next.length === 0) return ['ep-1'];
      return next;
    });
    try { localStorage.removeItem(`pivot-excel-${id}`); } catch {}
  };

  const selectedProject = safeProjects.find(p => p.id === selectedProjectId);
  const selCls = 'px-3 py-2 rounded-lg text-xs bg-white/[0.04] border border-white/[0.06] text-[#e0e0e0] focus:outline-none focus:border-white/[0.12] transition-all cursor-pointer';
  const optStyle = { background: '#1a1a2e' };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header with Project Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#4dd0e1]/20 to-[#ba68c8]/10 border border-[#4dd0e1]/20 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-[#4dd0e1]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Pivot Table
            </h2>
            <p className="text-[11px] text-[#546e7a] mt-0.5">
              {loading ? 'Memuat data...' : `${rows.length} baris \u00b7 ${fields.length} kolom`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Project Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#546e7a] whitespace-nowrap">Project:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className={selCls}
              style={{ minWidth: 180 }}
            >
              {safeProjects.map(p => (
                <option key={p.id} value={p.id} style={optStyle}>{p.name}</option>
              ))}
            </select>
          </div>

          <button onClick={addPivot}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-[#4dd0e1]/20 to-[#ba68c8]/10 border border-[#4dd0e1]/20 text-[#4dd0e1] hover:from-[#4dd0e1]/30 hover:to-[#ba68c8]/20 hover:border-[#4dd0e1]/30 transition-all">
            <Plus className="w-4 h-4" /> Tambah Pivot
          </button>
        </div>
      </div>

      {/* Pivot Tables */}
      <div className="flex-1 overflow-y-auto aero-scroll pb-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#37474f]">
            <div className="w-10 h-10 border-2 border-[#4dd0e1]/30 border-t-[#4dd0e1] rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs">Memuat data project{selectedProject ? `: ${selectedProject.name}` : ''}...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pivotIds.map((id) => (
              <div key={id} className="relative group">
                <ExcelPivotTable
                  instanceId={id}
                  rows={rows}
                  customCols={customCols}
                  fields={fields}
                />
                {pivotIds.length > 1 && (
                  <button
                    onClick={() => removePivot(id)}
                    className="absolute top-3 right-14 z-20 opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium hover:bg-[#ef5350]/10 text-[#546e7a] hover:text-[#ef5350] border border-transparent hover:border-[#ef5350]/20 transition-all"
                    title="Hapus Pivot Table ini"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button onClick={addPivot}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-white/[0.06] text-[#546e7a] hover:text-[#4dd0e1] hover:border-[#4dd0e1]/20 hover:bg-[#4dd0e1]/[0.02] transition-all text-xs font-medium">
              <Plus className="w-4 h-4" /> Tambah Pivot Table
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* Wrapped export with Error Catcher */
export default function PivotChartsWithErrorBoundary() {
  return <PivotCharts />;
}
