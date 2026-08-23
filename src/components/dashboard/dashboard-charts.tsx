'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Download, Settings, X, Save, BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, AreaChart, ScatterChart, Activity } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart as RechartsArea, Area,
  ScatterChart as RechartsScatter, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Treemap, FunnelChart, Funnel, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart', icon: BarChart3 },
  { value: 'line', label: 'Line Chart', icon: LineChartIcon },
  { value: 'pie', label: 'Pie Chart', icon: PieChartIcon },
  { value: 'area', label: 'Area Chart', icon: AreaChart },
  { value: 'scatter', label: 'Scatter Plot', icon: ScatterChart },
  { value: 'radar', label: 'Radar Chart', icon: Activity },
];

const BASE_COL_OPTIONS = [
  { key: 'provinsi', label: 'Provinsi' },
  { key: 'kabupaten', label: 'Kabupaten' },
  { key: 'kecamatan', label: 'Kecamatan' },
  { key: 'klasifikasiTsa', label: 'Klasifikasi TSA' },
  { key: 'picTsa', label: 'PIC TSA' },
  { key: 'categoryBak', label: 'Category BAK' },
  { key: 'homepass', label: 'Homepass' },
  { key: 'odp', label: 'ODP' },
];

const AGGREGATIONS = [
  { value: 'count', label: 'Jumlah (Count)' },
  { value: 'sum_homepass', label: 'Total Homepass' },
  { value: 'sum_odp', label: 'Total ODP' },
  { value: 'avg_homepass', label: 'Rata-rata Homepass' },
  { value: 'avg_odp', label: 'Rata-rata ODP' },
];

const COLORS = ['#64b5f6', '#81c784', '#ffb74d', '#e57373', '#ba68c8', '#4dd0e1', '#fff176', '#ff8a65', '#a5d6a7', '#90caf9'];

interface ChartConfig {
  id: string;
  title: string;
  chartType: string;
  config: string;
  order: number;
}

interface MonitoringRow {
  id: string;
  provinsi: string;
  kabupaten: string;
  kecamatan: string;
  klasifikasiTsa: string;
  picTsa: string;
  categoryBak: string;
  homepass: number;
  odp: number;
  customData: string;
}

function SingleChart({
  chart,
  rows,
  customCols,
  onSave,
}: {
  chart: ChartConfig;
  rows: MonitoringRow[];
  customCols: any[];
  onSave: (id: string, data: any) => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const chartState = JSON.parse(chart.config || '{}');
  const [groupCol, setGroupCol] = useState(chartState.groupCol || '');
  const [aggMethod, setAggMethod] = useState(chartState.aggMethod || 'count');
  const [filterProv, setFilterProv] = useState(chartState.filterProv || '');
  const [chartType, setChartType] = useState(chartState.chartType || chart.chartType);
  const [title, setTitle] = useState(chartState.title || chart.title);
  const chartRef = useRef<HTMLDivElement>(null);

  const allColOptions = [
    ...BASE_COL_OPTIONS,
    ...customCols.map(c => ({ key: c.id, label: c.label })),
  ];

  const provOptions = [...new Set(rows.map(r => r.provinsi).filter(Boolean))];

  const filteredRows = filterProv
    ? rows.filter(r => r.provinsi === filterProv)
    : rows;

  const getGroupValue = (row: MonitoringRow, colKey: string): string => {
    if (colKey in row) return String((row as any)[colKey] || 'Lainnya');
    try {
      const cd = JSON.parse(row.customData || '{}');
      return String(cd[colKey] || 'Lainnya');
    } catch { return 'Lainnya'; }
  };

  const processData = () => {
    if (!groupCol) return [];

    const groups: Record<string, { count: number; homepass: number; odp: number }> = {};
    filteredRows.forEach(row => {
      const val = getGroupValue(row, groupCol);
      if (!groups[val]) groups[val] = { count: 0, homepass: 0, odp: 0 };
      groups[val].count++;
      groups[val].homepass += row.homepass || 0;
      groups[val].odp += row.odp || 0;
    });

    return Object.entries(groups)
      .map(([name, data]) => {
        let value = 0;
        if (aggMethod === 'count') value = data.count;
        else if (aggMethod === 'sum_homepass') value = data.homepass;
        else if (aggMethod === 'sum_odp') value = data.odp;
        else if (aggMethod === 'avg_homepass') value = data.count > 0 ? Math.round(data.homepass / data.count) : 0;
        else if (aggMethod === 'avg_odp') value = data.count > 0 ? Math.round(data.odp / data.count) : 0;
        return { name, value };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  };

  const chartData = processData();

  const handleSave = () => {
    onSave(chart.id, {
      title: title || chart.title,
      chartType,
      groupCol,
      aggMethod,
      filterProv,
    });
    setShowSettings(false);
  };

  const handleDownload = () => {
    const el = chartRef.current;
    if (!el) return;
    // Create SVG-based download
    const svg = el.querySelector('svg');
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || chart.title}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card rounded-lg p-3 text-xs">
          <p className="text-[#e3f2fd] font-medium mb-1">{label}</p>
          <p className="text-[#81c784]">{payload[0].value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-[#546e7a]">
          <Activity className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Pilih konfigurasi chart di menu pengaturan</p>
        </div>
      );
    }

    switch (chartType) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" outerRadius={100} innerRadius={40} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: '#78909c', fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fill: '#78909c', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="value" stroke="#64b5f6" strokeWidth={2} dot={{ fill: '#64b5f6', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <RechartsArea data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: '#78909c', fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fill: '#78909c', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <defs>
                <linearGradient id={`grad-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64b5f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#64b5f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke="#64b5f6" fill={`url(#grad-${chart.id})`} strokeWidth={2} />
            </RechartsArea>
          </ResponsiveContainer>
        );
      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <RechartsScatter>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: '#78909c', fontSize: 10 }} name="Kategori" />
              <YAxis dataKey="value" tick={{ fill: '#78909c', fontSize: 10 }} name="Nilai" />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={chartData} fill="#64b5f6">
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Scatter>
            </RechartsScatter>
          </ResponsiveContainer>
        );
      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={chartData}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey="name" tick={{ fill: '#78909c', fontSize: 10 }} />
              <PolarRadiusAxis tick={{ fill: '#546e7a', fontSize: 9 }} />
              <Radar name="Nilai" dataKey="value" stroke="#64b5f6" fill="#64b5f6" fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
        );
      case 'bar':
      default:
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: '#78909c', fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fill: '#78909c', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="glass-card rounded-xl flex flex-col overflow-hidden">
      {/* Chart Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <h3 className="text-sm font-semibold text-[#e3f2fd]">{title || chart.title}</h3>
        <div className="flex items-center gap-1">
          <button onClick={handleDownload} className="p-2 rounded-lg hover:bg-white/10 text-[#78909c] hover:text-[#81c784] transition-colors" title="Download SVG">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-lg hover:bg-white/10 text-[#78909c] hover:text-[#64b5f6] transition-colors" title="Pengaturan">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-white/5 bg-white/3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-[10px] text-[#546e7a] mb-1">Judul Chart</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 glass-input rounded-lg text-xs" />
            </div>
            <div>
              <label className="block text-[10px] text-[#546e7a] mb-1">Jenis Chart</label>
              <select value={chartType} onChange={(e) => setChartType(e.target.value)} className="w-full px-3 py-2 glass-input rounded-lg text-xs">
                {CHART_TYPES.map(ct => (
                  <option key={ct.value} value={ct.value} style={{ background: '#1a1a2e' }}>{ct.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[#546e7a] mb-1">Kelompokkan Berdasarkan</label>
              <select value={groupCol} onChange={(e) => setGroupCol(e.target.value)} className="w-full px-3 py-2 glass-input rounded-lg text-xs">
                <option value="" style={{ background: '#1a1a2e' }}>-- Pilih Kolom --</option>
                {allColOptions.map(co => (
                  <option key={co.key} value={co.key} style={{ background: '#1a1a2e' }}>{co.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[#546e7a] mb-1">Agregasi</label>
              <select value={aggMethod} onChange={(e) => setAggMethod(e.target.value)} className="w-full px-3 py-2 glass-input rounded-lg text-xs">
                {AGGREGATIONS.map(ag => (
                  <option key={ag.value} value={ag.value} style={{ background: '#1a1a2e' }}>{ag.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <select value={filterProv} onChange={(e) => setFilterProv(e.target.value)} className="px-3 py-2 glass-input rounded-lg text-xs">
              <option value="" style={{ background: '#1a1a2e' }}>Semua Provinsi</option>
              {provOptions.map(p => (
                <option key={p} value={p} style={{ background: '#1a1a2e' }}>{p}</option>
              ))}
            </select>
            <button onClick={handleSave} className="flex items-center gap-1 px-4 py-2 glass-btn rounded-lg text-xs">
              <Save className="w-3.5 h-3.5" /> Simpan
            </button>
          </div>
        </div>
      )}

      {/* Chart Area */}
      <div className="flex-1 p-4 min-h-[320px]" ref={chartRef}>
        {renderChart()}
      </div>
    </div>
  );
}

export function DashboardCharts() {
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [rows, setRows] = useState<MonitoringRow[]>([]);
  const [customCols, setCustomCols] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [chartsRes, rowsRes, colsRes] = await Promise.all([
        fetch('/api/charts'),
        fetch('/api/monitoring'),
        fetch('/api/columns'),
      ]);
      const chartsData = await chartsRes.json();
      const rowsData = await rowsRes.json();
      const colsData = await colsRes.json();
      setCharts(chartsData.charts);
      setRows(rowsData.rows);
      setCustomCols(colsData.columns);
    } catch (err) {
      console.error(err);
    }
  }, []);

// eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleSaveChart = async (id: string, data: any) => {
    try {
      await fetch('/api/charts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full overflow-auto aero-scroll p-1">
      {charts.map(chart => (
        <SingleChart
          key={chart.id}
          chart={chart}
          rows={rows}
          customCols={customCols}
          onSave={handleSaveChart}
        />
      ))}
    </div>
  );
}
