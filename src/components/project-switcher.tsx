'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore, ProjectInfo } from '@/store/app-store';
import { ChevronDown, Plus, FolderKanban, Trash2, Check, X, Pencil } from 'lucide-react';

const PROJECT_COLORS = ['#64b5f6', '#66bb6a', '#ffb74d', '#ef5350', '#ba68c8', '#4dd0e1', '#ff8a65', '#81c784', '#f06292', '#7986cb'];

export function ProjectSwitcher() {
  const { activeProjectId, setActiveProjectId, projects, setProjects, user } = useAppStore();
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PROJECT_COLORS[1]);
  const [setupDone, setSetupDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const activeProject = projects.find(p => p.id === activeProjectId);

  // Auto-setup database on first load (any authenticated user)
  useEffect(() => {
    if (setupDone || !user) return;
    const setup = async () => {
      try {
        await fetch('/api/projects/setup', { method: 'POST' });
      } catch {}
      setSetupDone(true);
      fetchProjects();
    };
    setup();
  }, [user, setupDone]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        const list = data.projects || [];
        setProjects(list);
        if (list.length > 0 && !list.find((p: ProjectInfo) => p.id === activeProjectId)) {
          setActiveProjectId(list[0].id);
        }
      }
    } catch {}
  }, [activeProjectId, setActiveProjectId, setProjects]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = () => { setOpen(false); setEditingId(null); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const handleSwitch = (id: string) => {
    if (editingId) return; // Don't switch while editing
    setActiveProjectId(id);
    setOpen(false);
    window.dispatchEvent(new CustomEvent('project-switched', { detail: { projectId: id } }));
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchProjects();
        handleSwitch(data.project.id);
        setNewName('');
        setShowNew(false);
        setNewColor(PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]);
      }
    } catch {}
    setLoading(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (id === 'default') return;
    if (!confirm(`Hapus proyek "${name}"?\nSemua data dalam proyek ini akan terhapus permanen.`)) return;
    try {
      const res = await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchProjects();
        if (activeProjectId === id) {
          setActiveProjectId('default');
          window.dispatchEvent(new CustomEvent('project-switched', { detail: { projectId: 'default' } }));
        }
      }
    } catch {}
  };

  const startEdit = (e: React.MouseEvent, p: ProjectInfo) => {
    e.stopPropagation();
    setEditingId(p.id);
    setEditName(p.name);
    setEditColor(p.color);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingId || !editName.trim()) return;
    try {
      const res = await fetch('/api/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, name: editName.trim(), color: editColor }),
      });
      if (res.ok) {
        await fetchProjects();
        setEditingId(null);
      }
    } catch {}
  };

  const safeProjects = Array.isArray(projects) ? projects : [];

  // Don't render until we've attempted setup at least once
  if (!setupDone) return null;

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all"
      >
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: activeProject?.color || '#64b5f6' }}
        />
        <span className="text-xs font-medium text-[#e0e0e0] max-w-[160px] truncate">
          {activeProject?.name || 'Select Project'}
        </span>
        {activeProject?._count && (
          <span className="text-[9px] text-[#546e7a]">
            {activeProject._count.rows} rows
          </span>
        )}
        <ChevronDown className={`w-3 h-3 text-[#546e7a] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 z-[100] mt-1 w-80 rounded-xl bg-[#1a1d29]/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-white/[0.06]">
            <span className="text-[10px] font-semibold text-[#546e7a] uppercase tracking-wider">Proyek</span>
          </div>

          {/* Project list */}
          <div className="max-h-[300px] overflow-y-auto aero-scroll py-1">
            {safeProjects.map(p => {
              const isActive = p.id === activeProjectId;
              const isEditing = editingId === p.id;

              if (isEditing) {
                return (
                  <div key={p.id} className="px-3 py-2.5 bg-white/[0.04] border-l-2" style={{ borderColor: editColor }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Pencil className="w-3 h-3 text-[#90caf9]" />
                      <span className="text-[10px] font-semibold text-[#90caf9] uppercase tracking-wider">Edit Proyek</span>
                    </div>
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(e as any); if (e.key === 'Escape') cancelEdit(e as any); }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-[11px] text-[#e0e0e0] placeholder:text-[#37474f] focus:outline-none focus:border-[#90caf9]/30 mb-2"
                      placeholder="Nama proyek..."
                    />
                    <div className="flex items-center gap-1.5 mb-2.5">
                      {PROJECT_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setEditColor(c)}
                          className={`w-4 h-4 rounded-full transition-all ${editColor === c ? 'ring-2 ring-white/30 scale-125' : 'opacity-40 hover:opacity-80'}`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveEdit}
                        disabled={!editName.trim()}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-medium bg-[#64b5f6]/15 text-[#64b5f6] hover:bg-[#64b5f6]/25 disabled:opacity-30 transition-all"
                      >
                        <Check className="w-3 h-3" /> Simpan
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-medium bg-white/[0.04] text-[#78909c] hover:text-white hover:bg-white/[0.08] transition-all"
                      >
                        <X className="w-3 h-3" /> Batal
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={p.id}
                  onClick={() => handleSwitch(p.id)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-left transition-all cursor-pointer group/item ${
                    isActive
                      ? 'bg-white/[0.06]'
                      : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] font-medium truncate ${isActive ? 'text-white' : 'text-[#b0bec5]'}`}>
                      {p.name}
                      {p.id === 'default' && <span className="ml-1.5 text-[8px] px-1 py-0.5 rounded bg-[#64b5f6]/15 text-[#64b5f6]">DEFAULT</span>}
                    </div>
                    <div className="text-[9px] text-[#546e7a]">
                      {p._count?.rows || 0} baris &middot; {p._count?.columns || 0} kolom
                    </div>
                  </div>
                  {isActive && <Check className="w-3.5 h-3.5 text-[#4dd0e1] flex-shrink-0" />}

                  {/* Action buttons — always visible on hover */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-all flex-shrink-0">
                    {/* Edit button */}
                    <button
                      onClick={(e) => startEdit(e, p)}
                      className="p-1.5 rounded-md hover:bg-[#64b5f6]/15 text-[#546e7a] hover:text-[#64b5f6] transition-all"
                      title="Edit nama proyek"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    {/* Delete button (not for default) */}
                    {p.id !== 'default' && (
                      <button
                        onClick={(e) => handleDelete(e, p.id, p.name)}
                        className="p-1.5 rounded-md hover:bg-[#ef5350]/15 text-[#546e7a] hover:text-[#ef5350] transition-all"
                        title="Hapus proyek"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Divider + New Project */}
          {!showNew ? (
            <div className="border-t border-white/[0.06] p-1.5">
              <button
                onClick={() => { setShowNew(true); setNewColor(PROJECT_COLORS[projects.length % PROJECT_COLORS.length]); }}
                className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-[11px] text-[#78909c] hover:text-[#66bb6a] hover:bg-white/[0.03] transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Buat Proyek Baru
              </button>
            </div>
          ) : (
            <div className="border-t border-white/[0.06] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[#78909c] uppercase tracking-wider">Proyek Baru</span>
                <button onClick={() => { setShowNew(false); setNewName(''); }} className="text-[#546e7a] hover:text-white"><X className="w-3.5 h-3.5" /></button>
              </div>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Nama proyek..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-[11px] text-[#e0e0e0] placeholder:text-[#37474f] focus:outline-none focus:border-white/[0.15]"
              />
              <div className="flex items-center gap-1.5">
                {PROJECT_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`w-4 h-4 rounded-full transition-all ${newColor === c ? 'ring-2 ring-white/30 scale-125' : 'opacity-50 hover:opacity-100'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || loading}
                className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-[11px] font-medium bg-[#66bb6a]/15 text-[#66bb6a] hover:bg-[#66bb6a]/25 disabled:opacity-30 transition-all"
              >
                <FolderKanban className="w-3.5 h-3.5" /> {loading ? 'Membuat...' : 'Buat Proyek'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
