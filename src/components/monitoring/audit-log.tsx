'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, Filter, Download, Loader2 } from 'lucide-react';

interface LogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  tableName: string;
  rowId: string | null;
  colKey: string | null;
  colLabel: string | null;
  oldValue: string | null;
  newValue: string | null;
  timestamp: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CELL_EDIT: { label: 'Edit Sel', color: '#64b5f6' },
  ROW_ADD: { label: 'Tambah Baris', color: '#81c784' },
  ROW_DELETE: { label: 'Hapus Baris', color: '#ef5350' },
  ROW_UPDATE: { label: 'Update Baris', color: '#ffb74d' },
  COL_ADD: { label: 'Tambah Kolom', color: '#81c784' },
  COL_DELETE: { label: 'Hapus Kolom', color: '#ef5350' },
  COL_LOCK: { label: 'Kunci Kolom', color: '#ff8a65' },
  COL_UNLOCK: { label: 'Buka Kunci', color: '#a5d6a7' },
  LOGIN: { label: 'Login', color: '#ba68c8' },
  CHART_UPDATE: { label: 'Update Chart', color: '#4dd0e1' },
  DIVISION_ADD: { label: 'Tambah Divisi', color: '#81c784' },
};

export function AuditLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);
  const limit = 30;

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filterAction) params.set('action', filterAction);
    if (search) params.set('search', search);
    try {
      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      setLogs(data.logs);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      console.error(err);
    }
  }, [page, filterAction, search]);

// eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const getActionBadge = (action: string) => {
    const a = ACTION_LABELS[action] || { label: action, color: '#78909c' };
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
        style={{ backgroundColor: a.color + '20', color: a.color, border: `1px solid ${a.color}40` }}
      >
        {a.label}
      </span>
    );
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ export: 'all' });
      if (filterAction) params.set('action', filterAction);
      const res = await fetch(`/api/logs?${params}`);
      const { logs: allLogs } = await res.json();

      const XLSX = await import('xlsx');
      const rows = allLogs.map((log: LogEntry) => ({
        Waktu: new Date(log.timestamp).toLocaleString('id-ID', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        }),
        Pengguna: log.userName,
        Aksi: (ACTION_LABELS[log.action] || { label: log.action }).label,
        Kolom: log.colLabel || log.colKey || '-',
        'Nilai Lama': log.oldValue || '-',
        'Nilai Baru': log.newValue || '-',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 40 }, { wch: 40 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
      const filename = `audit-log_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
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
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari di log..."
            className="w-full pl-10 pr-4 py-2.5 glass-input rounded-lg text-sm"
          />
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-all hover:bg-[#66bb6a]/10 text-[#66bb6a] disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? 'Mengexport...' : 'Export Excel'}
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-all ${showFilters ? 'glass-btn' : 'hover:bg-white/5 text-[#78909c]'}`}
        >
          <Filter className="w-4 h-4" /> Filter
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-[#78909c] mb-2">Filter berdasarkan aksi:</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setFilterAction(''); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${!filterAction ? 'glass-btn text-[#64b5f6]' : 'text-[#78909c] hover:bg-white/5'}`}
            >
              Semua
            </button>
            {Object.entries(ACTION_LABELS).map(([key, val]) => (
              <button
                key={key}
                onClick={() => { setFilterAction(key); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${filterAction === key ? 'glass-btn text-[#64b5f6]' : 'text-[#78909c] hover:bg-white/5'}`}
              >
                {val.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Log Table */}
      <div className="glass-card rounded-xl flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-auto aero-scroll">
          <table className="aero-table">
            <thead>
              <tr>
                <th style={{ minWidth: 160 }}>Waktu</th>
                <th style={{ minWidth: 130 }}>Pengguna</th>
                <th style={{ minWidth: 120 }}>Aksi</th>
                <th style={{ minWidth: 120 }}>Kolom</th>
                <th style={{ minWidth: 150 }}>Nilai Lama</th>
                <th style={{ minWidth: 150 }}>Nilai Baru</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="text-[11px] text-[#78909c] font-mono">
                    {formatTime(log.timestamp)}
                  </td>
                  <td className="text-xs font-medium">{log.userName}</td>
                  <td>{getActionBadge(log.action)}</td>
                  <td className="text-xs text-[#b0bec5]">{log.colLabel || log.colKey || '-'}</td>
                  <td>
                    <div className="text-xs text-[#ef9a9a] max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={log.oldValue || ''}>
                      {log.oldValue && log.oldValue.length > 80 ? log.oldValue.substring(0, 80) + '...' : log.oldValue || '-'}
                    </div>
                  </td>
                  <td>
                    <div className="text-xs text-[#a5d6a7] max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={log.newValue || ''}>
                      {log.newValue && log.newValue.length > 80 ? log.newValue.substring(0, 80) + '...' : log.newValue || '-'}
                    </div>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-sm text-[#546e7a]">
                    Tidak ada log ditemukan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-3 border-t border-white/5">
          <p className="text-xs text-[#546e7a]">
            Halaman {page} dari {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-md glass-btn disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-[#78909c]">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
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