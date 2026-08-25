'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Download, Plus, Trash2, X, BarChart3, LineChart as LineChartIcon,
  PieChart as PieChartIcon, AreaChart, Edit3, Check, Table2,
  ArrowUp, ArrowDown, TrendingUp, TrendingDown, Minus, Hash,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart as RechartsArea, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart', icon: BarChart3 },
  { value: 'hbar', label: 'Horizontal Bar', icon: BarChart3 },
  { value: 'line', label: 'Line Chart', icon: LineChartIcon },
  { value: 'pie', label: 'Pie Chart', icon: PieChartIcon },
  { value: 'area', label: 'Area Chart', icon: AreaChart },
  { value: 'table', label: 'Tabel Data', icon: Table2 },
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
  data: PivotRow[];
}

function createEmptyChart(index: number): PivotChart {
  return {
    id: `pivot-${Date.now()}-${index}`,
    title: `Pivot Chart ${index + 1}`,
    chartType: 'bar',
    paletteIndex: 0,
    data: [],
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
  chart, onUpdate, onRemove,
}: {
  chart: PivotChart;
  index: number;
  onUpdate: (chart: PivotChart) => void;
  onRemove: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(chart.title);
  const [showPalette, setShowPalette] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const tableInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTitleDraft(chart.title); }, [chart.title]);

  const palette = PALETTES[chart.paletteIndex] || PALETTES[0];
  const colors = palette.colors;
  const accentColor = colors[0];

  const updateTitle = () => {
    if (titleDraft.trim()) onUpdate({ ...chart, title: titleDraft.trim() });
    setEditingTitle(false);
  };

  const addRow = () => {
    const newRow: PivotRow = { id: `row-${Date.now()}-${Math.random()}`, label: '', value: 0 };
    onUpdate({ ...chart, data: [...chart.data, newRow] });
    setTimeout(() => tableInputRef.current?.focus(), 50);
  };

  const removeRow = (rowId: string) => {
    onUpdate({ ...chart, data: chart.data.filter(r => r.id !== rowId) });
  };

  const updateRow = (rowId: string, field: 'label' | 'value', val: string) => {
    onUpdate({
      ...chart,
      data: chart.data.map(r =>
        r.id === rowId
          ? { ...r, [field]: field === 'value' ? (parseFloat(val) || 0) : val }
          : r
      ),
    });
  };

  const moveRow = (rowId: string, dir: -1 | 1) => {
    const idx = chart.data.findIndex(r => r.id === rowId);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= chart.data.length) return;
    const newData = [...chart.data];
    [newData[idx], newData[newIdx]] = [newData[newIdx], newData[idx]];
    onUpdate({ ...chart, data: newData });
  };

  const chartData = chart.data.map(r => ({ name: r.label || '-', value: r.value }));
  const hasData = chartData.length > 0;

  const stats = hasData
    ? {
        total: chartData.reduce((s, d) => s + d.value, 0),
        avg: chartData.reduce((s, d) => s + d.value, 0) / chartData.length,
        min: Math.min(...chartData.map(d => d.value)),
        max: Math.max(...chartData.map(d => d.value)),
      }
    : null;

  const handleDownload = useCallback(() => {
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
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `${chart.title.replace(/\s+/g, '_')}.png`;
      a.click();
    };
    img.src = url;
  }, [chart.title]);

  const handleDownloadCSV = useCallback(() => {
    if (!hasData) return;
    const header = 'Label,Value\n';
    const rows = chart.data.map(r => `${r.label},${r.value}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chart.title.replace(/\s+/g, '_')}.csv`;
    a.click();
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
        <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-3">
          <BarChart3 className="w-8 h-8 opacity-20" />
        </div>
        <p className="text-xs font-medium">Tambahkan data untuk melihat chart</p>
        <p className="text-[10px] text-[#2a2a3a] mt-1">Isi tabel di bawah atau klik + Tambah Data</p>
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
              <YAxis type="category" dataKey="name" width={80} {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
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
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="value" stroke={accentColor} strokeWidth={2.5} dot={{ fill: accentColor, r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: accentColor, stroke: '#fff', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="75%" innerRadius="35%" paddingAngle={3} strokeWidth={0} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
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
              <XAxis dataKey="name" {...axisProps} />
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
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32}>
                {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="group relative rounded-2xl overflow-hidden border border-white/[0.06] bg-gradient-to-br from-[#111827]/80 to-[#0d1117]/90 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.1]">
      {/* Accent line top */}
      <div className="absolute top-0 inset-x-0 h-[2px] opacity-60" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') updateTitle(); if (e.key === 'Escape') { setTitleDraft(chart.title); setEditingTitle(false); } }}
                className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#64b5f6]/40 w-52"
              />
              <button onClick={updateTitle} className="p-1.5 rounded-lg hover:bg-[#66bb6a]/20 text-[#66bb6a]"><Check className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <button
              onClick={() => { setTitleDraft(chart.title); setEditingTitle(true); }}
              className="flex items-center gap-2 text-sm font-semibold text-[#e3f2fd] hover:text-white transition-colors truncate"
            >
              <Edit3 className="w-3 h-3 text-[#37474f] group-hover:text-[#546e7a] transition-colors flex-shrink-0" />
              <span className="truncate">{chart.title}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Palette picker */}
          <div className="relative">
            <button
              onClick={() => setShowPalette(!showPalette)}
              className="w-5 h-5 rounded-full border-2 border-white/20 hover:border-white/40 transition-all"
              style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1] || colors[0]})` }}
              title={`Palet: ${palette.name}`}
            />
            {showPalette && (
              <div className="absolute right-0 top-7 z-20 p-2 rounded-xl bg-[#1a1a2e] border border-white/10 shadow-2xl flex flex-col gap-1.5 min-w-[120px]">
                {PALETTES.map((p, pi) => (
                  <button
                    key={p.name}
                    onClick={() => { onUpdate({ ...chart, paletteIndex: pi }); setShowPalette(false); }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] transition-all ${chart.paletteIndex === pi ? 'bg-white/10 text-white' : 'text-[#78909c] hover:text-white hover:bg-white/5'}`}
                  >
                    <div className="flex gap-0.5">
                      {p.colors.slice(0, 4).map((c, ci) => (
                        <span key={ci} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-white/[0.06]" />

          {/* Chart type selector */}
          <div className="flex items-center rounded-xl bg-white/[0.03] p-0.5 border border-white/[0.04]">
            {CHART_TYPES.map(ct => {
              const Icon = ct.icon;
              const isActive = chart.chartType === ct.value;
              return (
                <button
                  key={ct.value}
                  onClick={() => onUpdate({ ...chart, chartType: ct.value })}
                  title={ct.label}
                  className={`p-1.5 rounded-lg transition-all duration-200 ${isActive ? `text-white shadow-sm` : 'text-[#37474f] hover:text-[#78909c]'}`}
                  style={isActive ? { background: `${accentColor}22` } : {}}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>

          <div className="w-px h-5 bg-white/[0.06]" />

          <button onClick={handleDownloadCSV} disabled={!hasData} className="p-1.5 rounded-lg hover:bg-white/5 text-[#37474f] hover:text-[#4dd0e1] disabled:opacity-20 transition-all" title="Download CSV">
            <Table2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleDownload} disabled={!hasData} className="p-1.5 rounded-lg hover:bg-white/5 text-[#37474f] hover:text-[#66bb6a] disabled:opacity-20 transition-all" title="Download PNG">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-[#ef5350]/10 text-[#37474f] hover:text-[#ef5350] transition-all" title="Hapus">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="px-4 pb-2 flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1 text-[#546e7a]"><Hash className="w-3 h-3" />{chartData.length} data</div>
          <div className="w-px h-3 bg-white/[0.06]" />
          <div className="flex items-center gap-1 text-[#90caf9]"><TrendingUp className="w-3 h-3" />Total: {stats.total.toLocaleString('id-ID')}</div>
          <div className="w-px h-3 bg-white/[0.06]" />
          <div className="flex items-center gap-1 text-[#a5d6a7]">Avg: {stats.avg.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</div>
          <div className="w-px h-3 bg-white/[0.06]" />
          <div className="flex items-center gap-1 text-[#ffb74d]">Min: {stats.min.toLocaleString('id-ID')}</div>
          <div className="w-px h-3 bg-white/[0.06]" />
          <div className="flex items-center gap-1 text-[#ef9a9a]">Max: {stats.max.toLocaleString('id-ID')}</div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col min-h-0" style={{ height: chart.chartType === 'table' ? 'auto' : 300 }}>
        {/* Chart / Table view */}
        <div className="flex-1 min-h-[200px] px-3 pb-2" ref={chartRef}>
          {chart.chartType === 'table' && hasData ? (
            <div className="h-full overflow-auto aero-scroll rounded-xl border border-white/[0.04]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/[0.03]">
                    <th className="text-left px-4 py-2.5 text-[#78909c] font-medium sticky top-0 bg-[#0d1117]/90 backdrop-blur-sm">No</th>
                    <th className="text-left px-4 py-2.5 text-[#78909c] font-medium sticky top-0 bg-[#0d1117]/90 backdrop-blur-sm">Label</th>
                    <th className="text-right px-4 py-2.5 text-[#78909c] font-medium sticky top-0 bg-[#0d1117]/90 backdrop-blur-sm">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {chart.data.map((row, i) => (
                    <tr key={row.id} className="border-t border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2 text-[#546e7a] font-mono">{i + 1}</td>
                      <td className="px-4 py-2 text-[#e0e0e0]">{row.label || '-'}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: colors[i % colors.length] }}>{row.value.toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                  {stats && (
                    <tr className="border-t-2 border-white/[0.08] bg-white/[0.02]">
                      <td colSpan={2} className="px-4 py-2.5 text-[#78909c] font-semibold">Total</td>
                      <td className="px-4 py-2.5 text-right font-bold text-white font-mono">{stats.total.toLocaleString('id-ID')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            renderChart()
          )}
        </div>

        {/* Spreadsheet-style data input */}
        <div className="border-t border-white/[0.04]">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-[10px] text-[#37474f] font-medium uppercase tracking-wider">Data Input</span>
            <button
              onClick={addRow}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all hover:bg-white/5"
              style={{ color: accentColor }}
            >
              <Plus className="w-3 h-3" /> Tambah Data
            </button>
          </div>
          {chart.data.length === 0 ? (
            <div className="px-4 pb-4 pt-0">
              <div className="flex items-center justify-center h-12 rounded-xl border border-dashed border-white/[0.06] text-[#2a2a3a] text-[11px]">
                Klik &quot;+ Tambah Data&quot; untuk memulai
              </div>
            </div>
          ) : (
            <div className="max-h-[180px] overflow-y-auto aero-scroll">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-white/[0.02]">
                    <th className="w-8 px-1 py-1.5"></th>
                    <th className="text-left px-3 py-1.5 text-[#37474f] font-medium">Label</th>
                    <th className="text-left px-3 py-1.5 text-[#37474f] font-medium w-28">Value</th>
                    <th className="w-8 px-1 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {chart.data.map((row, ri) => (
                    <tr key={row.id} className="group/row border-t border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                      <td className="px-1 py-0.5">
                        <div className="flex flex-col gap-px opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button onClick={() => moveRow(row.id, -1)} disabled={ri === 0} className="p-0.5 text-[#37474f] hover:text-white disabled:opacity-20"><ArrowUp className="w-2.5 h-2.5" /></button>
                          <button onClick={() => moveRow(row.id, 1)} disabled={ri === chart.data.length - 1} className="p-0.5 text-[#37474f] hover:text-white disabled:opacity-20"><ArrowDown className="w-2.5 h-2.5" /></button>
                        </div>
                      </td>
                      <td className="px-1 py-0.5">
                        {ri === 0 ? (
                          <input
                            ref={tableInputRef}
                            value={row.label}
                            onChange={(e) => updateRow(row.id, 'label', e.target.value)}
                            placeholder="Nama label..."
                            className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-white/[0.06] focus:border-white/[0.12] focus:bg-white/[0.03] rounded-lg text-[#e0e0e0] placeholder:text-[#2a2a3a] focus:outline-none transition-all"
                          />
                        ) : (
                          <input
                            value={row.label}
                            onChange={(e) => updateRow(row.id, 'label', e.target.value)}
                            placeholder="Nama label..."
                            className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-white/[0.06] focus:border-white/[0.12] focus:bg-white/[0.03] rounded-lg text-[#e0e0e0] placeholder:text-[#2a2a3a] focus:outline-none transition-all"
                          />
                        )}
                      </td>
                      <td className="px-1 py-0.5">
                        <input
                          type="number"
                          value={row.value || ''}
                          onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-white/[0.06] focus:border-white/[0.12] focus:bg-white/[0.03] rounded-lg text-right font-mono text-[#e0e0e0] placeholder:text-[#2a2a3a] focus:outline-none transition-all"
                        />
                      </td>
                      <td className="px-1 py-0.5">
                        <button
                          onClick={() => removeRow(row.id)}
                          className="p-1 rounded-md opacity-0 group-hover/row:opacity-100 text-[#37474f] hover:text-[#ef5350] hover:bg-[#ef5350]/10 transition-all"
                        >
                          <Minus className="w-3 h-3" />
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

  const updateChart = (index: number, chart: PivotChart) => {
    setCharts(prev => prev.map((c, i) => i === index ? chart : c));
  };

  const removeChart = (index: number) => {
    setCharts(prev => prev.filter((_, i) => i !== index));
  };

  const addChart = () => {
    setCharts(prev => [...prev, createEmptyChart(prev.length)]);
  };

  return (
    <div className="flex flex-col h-full gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#64b5f6]/20 to-[#42a5f5]/5 border border-[#64b5f6]/20 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-[#64b5f6]" />
            </div>
            Pivot Charts
          </h2>
          <p className="text-[11px] text-[#546e7a] mt-1 ml-10">Buat chart pivot interaktif — isi data secara manual, pilih tipe chart & palet warna, lalu download</p>
        </div>
        <button
          onClick={addChart}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-[#64b5f6]/20 to-[#42a5f5]/10 border border-[#64b5f6]/20 text-[#90caf9] hover:from-[#64b5f6]/30 hover:to-[#42a5f5]/20 hover:border-[#64b5f6]/30 transition-all"
        >
          <Plus className="w-4 h-4" /> Tambah Chart
        </button>
      </div>

      {/* Charts Grid */}
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
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {charts.map((chart, i) => (
              <PivotCard
                key={chart.id}
                chart={chart}
                index={i}
                onUpdate={(c) => updateChart(i, c)}
                onRemove={() => removeChart(i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
