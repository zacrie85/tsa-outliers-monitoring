'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Download, Plus, Trash2, X, BarChart3, LineChart as LineChartIcon,
  PieChart as PieChartIcon, AreaChart, Edit3, Check,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart as RechartsArea, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const CHART_TYPES = [
  { value: 'bar', label: 'Bar', icon: BarChart3 },
  { value: 'line', label: 'Line', icon: LineChartIcon },
  { value: 'pie', label: 'Pie', icon: PieChartIcon },
  { value: 'area', label: 'Area', icon: AreaChart },
];

const COLORS = [
  '#64b5f6', '#81c784', '#ffb74d', '#e57373',
  '#ba68c8', '#4dd0e1', '#fff176', '#ff8a65',
  '#a5d6a7', '#90caf9', '#ce93d8', '#80cbc4',
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
  data: PivotRow[];
}

function createEmptyChart(index: number): PivotChart {
  return {
    id: `pivot-${Date.now()}-${index}`,
    title: `Pivot Chart ${index + 1}`,
    chartType: 'bar',
    data: [],
  };
}

function PivotCard({
  chart, index, onUpdate, onRemove,
}: {
  chart: PivotChart;
  index: number;
  onUpdate: (chart: PivotChart) => void;
  onRemove: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(chart.title);
  const chartRef = useRef<HTMLDivElement>(null);

  const updateTitle = () => {
    if (titleDraft.trim()) {
      onUpdate({ ...chart, title: titleDraft.trim() });
    }
    setEditingTitle(false);
  };

  const addRow = () => {
    onUpdate({
      ...chart,
      data: [...chart.data, { id: `row-${Date.now()}`, label: '', value: 0 }],
    });
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

  const chartData = chart.data.map(r => ({ name: r.label || '-', value: r.value }));

  const handleDownload = useCallback(() => {
    const el = chartRef.current;
    if (!el) return;
    const svgEl = el.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob(
      [svgData],
      { type: 'image/svg+xml;charset=utf-8' }
    );
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); return; }
      ctx.fillStyle = '#0d1117';
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

  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-[#546e7a]">
          <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-xs">Tambahkan data untuk melihat chart</p>
        </div>
      );
    }

    const commonAxisProps = {
      tick: { fill: '#78909c', fontSize: 11 },
      axisLine: { stroke: '#ffffff10' },
      tickLine: { stroke: '#ffffff10' },
    };

    switch (chart.chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="name" {...commonAxisProps} />
              <YAxis {...commonAxisProps} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #ffffff15', borderRadius: 8, fontSize: 12, color: '#e0e0e0' }} />
              <Line type="monotone" dataKey="value" stroke="#64b5f6" strokeWidth={2} dot={{ fill: '#64b5f6', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%" innerRadius="30%" paddingAngle={2} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #ffffff15', borderRadius: 8, fontSize: 12, color: '#e0e0e0' }} />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsArea data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="name" {...commonAxisProps} />
              <YAxis {...commonAxisProps} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #ffffff15', borderRadius: 8, fontSize: 12, color: '#e0e0e0' }} />
              <defs>
                <linearGradient id={`grad-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64b5f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#64b5f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke="#64b5f6" fill={`url(#grad-${chart.id})`} strokeWidth={2} />
            </RechartsArea>
          </ResponsiveContainer>
        );
      default:
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="name" {...commonAxisProps} />
              <YAxis {...commonAxisProps} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #ffffff15', borderRadius: 8, fontSize: 12, color: '#e0e0e0' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden flex flex-col">
      {/* Card Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') updateTitle(); if (e.key === 'Escape') { setTitleDraft(chart.title); setEditingTitle(false); } }}
                className="px-2 py-1 glass-input rounded-md text-sm w-48"
              />
              <button onClick={updateTitle} className="p-1 rounded-md hover:bg-[#66bb6a]/20 text-[#66bb6a]"><Check className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <button
              onClick={() => { setTitleDraft(chart.title); setEditingTitle(true); }}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#e3f2fd] hover:text-white truncate"
            >
              <Edit3 className="w-3 h-3 text-[#546e7a] flex-shrink-0" />
              <span className="truncate">{chart.title}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Chart type selector */}
          <div className="flex items-center rounded-lg bg-white/5 p-0.5">
            {CHART_TYPES.map(ct => {
              const Icon = ct.icon;
              return (
                <button
                  key={ct.value}
                  onClick={() => onUpdate({ ...chart, chartType: ct.value })}
                  title={ct.label}
                  className={`p-1 rounded-md transition-all ${chart.chartType === ct.value ? 'bg-[#64b5f6]/20 text-[#64b5f6]' : 'text-[#546e7a] hover:text-[#90caf9]'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>
          <button
            onClick={handleDownload}
            disabled={chartData.length === 0}
            className="p-1.5 rounded-md hover:bg-[#66bb6a]/10 text-[#78909c] hover:text-[#66bb6a] disabled:opacity-30 disabled:cursor-not-allowed"
            title="Download PNG"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-md hover:bg-[#ef5350]/10 text-[#78909c] hover:text-[#ef5350]"
            title="Hapus chart"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Data input panel */}
        <div className="w-52 border-r border-white/5 flex flex-col flex-shrink-0">
          <div className="p-2 border-b border-white/5">
            <button
              onClick={addRow}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] glass-btn"
            >
              <Plus className="w-3 h-3" /> Tambah Data
            </button>
          </div>
          <div className="flex-1 overflow-y-auto aero-scroll">
            {chart.data.length === 0 ? (
              <p className="text-[10px] text-[#546e7a] text-center py-6 px-2">
                Klik &quot;Tambah Data&quot; untuk memulai
              </p>
            ) : (
              <div className="p-1.5 space-y-1">
                {chart.data.map((row, ri) => (
                  <div key={row.id} className="flex items-center gap-1 p-1.5 rounded-md bg-white/5 group">
                    <div className="flex-1 min-w-0">
                      <input
                        value={row.label}
                        onChange={(e) => updateRow(row.id, 'label', e.target.value)}
                        placeholder="Label"
                        className="w-full px-1.5 py-1 glass-input rounded text-[10px] mb-0.5"
                      />
                      <input
                        type="number"
                        value={row.value || ''}
                        onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                        placeholder="0"
                        className="w-full px-1.5 py-1 glass-input rounded text-[10px]"
                      />
                    </div>
                    <button
                      onClick={() => removeRow(row.id)}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-[#78909c] hover:text-[#ef5350] transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chart area */}
        <div className="flex-1 p-3 min-h-[250px]" ref={chartRef}>
          {renderChart()}
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
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="glass-card rounded-xl p-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#e3f2fd]">Pivot Charts</h2>
          <p className="text-[11px] text-[#546e7a] mt-0.5">Buat chart pivot manual — isi data, pilih tipe chart, dan download sebagai PNG</p>
        </div>
        <button
          onClick={addChart}
          className="flex items-center gap-2 px-4 py-2 glass-btn rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" /> Tambah Chart
        </button>
      </div>

      {/* Charts Grid */}
      <div className="flex-1 overflow-y-auto aero-scroll">
        {charts.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <BarChart3 className="w-12 h-12 text-[#546e7a] mx-auto mb-3 opacity-30" />
            <p className="text-sm text-[#546e7a]">Tidak ada chart. Klik &quot;Tambah Chart&quot; untuk memulai.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
