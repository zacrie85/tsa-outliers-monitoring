'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import {
  FileText, Plus, Trash2, X, Link2, Copy, Check, Eye, EyeOff,
  Loader2, ClipboardList, ChevronDown, ChevronUp, GripVertical, Link as LinkIcon,
} from 'lucide-react';

const BASE_COLUMNS = [
  { key: 'categoryBak', label: 'Category BAK', type: 'text' as const },
  { key: 'provinsi', label: 'Provinsi', type: 'text' as const },
  { key: 'kabupaten', label: 'Kabupaten', type: 'text' as const },
  { key: 'kecamatan', label: 'Kecamatan', type: 'text' as const },
  { key: 'kelurahan', label: 'Kelurahan', type: 'text' as const },
  { key: 'kelRwSiteName', label: 'Kel RW/Site Name', type: 'text' as const },
  { key: 'desaPerum', label: 'Desa/Perum', type: 'text' as const },
  { key: 'indexNum', label: 'Index', type: 'number' as const },
  { key: 'homepass', label: 'Homepass', type: 'number' as const },
  { key: 'odp', label: 'ODP', type: 'number' as const },
  { key: 'remarksTsa', label: 'Remarks TSA', type: 'textarea' as const },
  { key: 'klasifikasiTsa', label: 'Klasifikasi TSA', type: 'text' as const },
  { key: 'picTsa', label: 'PIC TSA', type: 'text' as const },
  { key: 'remarksJlm', label: 'Remarks JLM', type: 'textarea' as const },
];

interface FormField { key: string; label: string; type: 'text' | 'number' | 'textarea'; required: boolean; placeholder?: string; }
interface FormItem { id: string; title: string; description: string; fields: string; referenceColumn: string | null; referenceLabel: string | null; isActive: boolean; submissionCount: number; createdAt: string; }
interface FormBuilderProps { customCols: Array<{ id: string; name: string; label: string }>; }

export function FormBuilder({ customCols }: FormBuilderProps) {
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const [showPanel, setShowPanel] = useState(false);
  const [forms, setForms] = useState<FormItem[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [selectedFields, setSelectedFields] = useState<FormField[]>([]);
  const [refColumn, setRefColumn] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const allColumns = [...BASE_COLUMNS, ...customCols.map(c => ({ key: c.id, label: c.label, type: 'text' as const }))];
  const refColumns = allColumns.filter(c => c.type !== 'number');
  const refColLabel = refColumns.find(c => c.key === refColumn)?.label || '';
  const editableFields = selectedFields.filter(f => f.key !== refColumn);

  const fetchForms = useCallback(async () => {
    try {
      const res = await fetch(`/api/forms?projectId=${activeProjectId}`);
      if (res.ok) { const data = await res.json(); setForms(data.forms || []); }
    } catch {}
  }, [activeProjectId]);

  useEffect(() => { if (showPanel) fetchForms(); }, [showPanel, fetchForms]);

  const toggleField = (col: typeof allColumns[0]) => {
    setSelectedFields(prev => {
      if (prev.find(f => f.key === col.key)) return prev.filter(f => f.key !== col.key);
      return [...prev, { key: col.key, label: col.label, type: col.type || 'text', required: false, placeholder: '' }];
    });
  };

  const updateField = (key: string, updates: Partial<FormField>) => {
    setSelectedFields(prev => prev.map(f => f.key === key ? { ...f, ...updates } : f));
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    setSelectedFields(prev => {
      const arr = [...prev]; const t = idx + dir;
      if (t < 0 || t >= arr.length) return prev;
      [arr[idx], arr[t]] = [arr[t], arr[idx]]; return arr;
    });
  };

  const resetCreate = () => { setFormTitle(''); setFormDesc(''); setSelectedFields([]); setRefColumn(''); };

  const handleCreate = async () => {
    if (!formTitle.trim() || editableFields.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch('/api/forms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: formTitle.trim(), description: formDesc.trim(), fields: editableFields, projectId: activeProjectId, referenceColumn: refColumn || null, referenceLabel: refColLabel || null }),
      });
      if (res.ok) { resetCreate(); setShowCreate(false); fetchForms(); }
    } catch {}
    setCreating(false);
  };

  const handleToggleActive = async (f: FormItem) => {
    try { await fetch(`/api/forms/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !f.isActive }) }); fetchForms(); } catch {}
  };
  const handleDelete = async (id: string) => { if (!confirm('Hapus form ini?')) return; try { await fetch(`/api/forms/${id}`, { method: 'DELETE' }); fetchForms(); } catch {} };
  const getFormUrl = (id: string) => typeof window !== 'undefined' ? `${window.location.origin}/f/${id}` : '';
  const copyLink = async (id: string) => { try { await navigator.clipboard.writeText(getFormUrl(id)); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };
  const parsedFields = (j: string): FormField[] => { try { return JSON.parse(j); } catch { return []; } };
  const getTypeLabel = (t: string) => t === 'number' ? 'Angka' : t === 'textarea' ? 'Paragraf' : 'Teks';

  if (!showPanel) {
    return (
      <button onClick={() => setShowPanel(true)} className="flex items-center gap-2 px-4 py-2.5 glass-btn rounded-lg text-sm"
        style={{ background: 'linear-gradient(135deg, rgba(186,104,200,0.2), rgba(186,104,200,0.08))', border: '1px solid rgba(186,104,200,0.3)' }}>
        <ClipboardList className="w-4 h-4" style={{ color: '#ba68c8' }} />
        <span style={{ color: '#ce93d8' }}>Form Online</span>
      </button>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[#ba68c8]" />
          <h3 className="text-sm font-semibold text-[#e3f2fd]">Form Online</h3>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#ba68c8]/15 text-[#ce93d8] border border-[#ba68c8]/30">{forms.length} form</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowCreate(!showCreate); if (showCreate) resetCreate(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'linear-gradient(135deg, rgba(186,104,200,0.25), rgba(186,104,200,0.1))', border: '1px solid rgba(186,104,200,0.35)', color: '#ce93d8' }}>
            <Plus className="w-3.5 h-3.5" /> Buat Form Baru
          </button>
          <button onClick={() => setShowPanel(false)} className="text-[#546e7a] hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 mb-4 space-y-3">
          <div className="space-y-2">
            <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Judul Form..." className="w-full px-3 py-2 glass-input rounded-lg text-sm" />
            <input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Deskripsi singkat (opsional)..." className="w-full px-3 py-2 glass-input rounded-lg text-xs" />
          </div>

          {/* Reference Column */}
          <div className="rounded-lg bg-[#64b5f6]/[0.06] border border-[#64b5f6]/20 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-3.5 h-3.5 text-[#64b5f6]" />
              <span className="text-[10px] font-semibold text-[#90caf9] uppercase tracking-wider">Hubungkan ke Data yang Sudah Ada</span>
            </div>
            <p className="text-[10px] text-[#78909c]">Pilih kolom acuan agar pengisi form bisa memilih baris data yang ingin diupdate.</p>
            <select value={refColumn} onChange={e => setRefColumn(e.target.value)} className="w-full px-3 py-2 glass-input rounded-lg text-xs">
              <option value="" style={{ background: '#1a1a2e' }}>-- Tidak ada (buat baris baru) --</option>
              {refColumns.map(c => <option key={c.key} value={c.key} style={{ background: '#1a1a2e' }}>{c.label}</option>)}
            </select>
            {refColumn && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#81c784]/[0.08] border border-[#81c784]/20">
                <Check className="w-3 h-3 text-[#81c784]" />
                <span className="text-[10px] text-[#a5d6a7]">Mode Update: pengisi form akan memilih baris data terlebih dahulu, lalu mengisi data untuk baris tersebut.</span>
              </div>
            )}
          </div>

          {/* Column Selection */}
          <div>
            <p className="text-[10px] text-[#78909c] font-medium mb-2 uppercase tracking-wider">
              Pilih Kolom ({editableFields.length} dipilih)
              {refColumn && <span className="text-[#64b5f6] ml-2">(kolom acuan: {refColLabel})</span>}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto aero-scroll p-2 rounded-lg bg-white/[0.02]">
              {allColumns.map(col => {
                const sel = selectedFields.some(f => f.key === col.key);
                const isRef = col.key === refColumn;
                const btnCls = isRef
                  ? 'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-left transition-all bg-[#64b5f6]/10 text-[#64b5f6]/60 border border-[#64b5f6]/20 cursor-not-allowed'
                  : sel ? 'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-left transition-all bg-[#ba68c8]/15 text-[#ce93d8] border border-[#ba68c8]/30'
                  : 'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-left transition-all text-[#78909c] hover:bg-white/5 border border-transparent';
                const icoCls = isRef
                  ? 'w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 bg-[#64b5f6]/30 border-[#64b5f6]/40'
                  : sel ? 'w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 bg-[#ba68c8] border-[#ba68c8]'
                  : 'w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 border-[#546e7a]';
                return (
                  <button key={col.key} onClick={() => !isRef && toggleField(col)} className={btnCls}>
                    <div className={icoCls}>
                      {sel && !isRef && <Check className="w-2 h-2 text-white" />}
                      {isRef && <LinkIcon className="w-2 h-2" />}
                    </div>
                    <span className="truncate">{col.label}</span>
                    {isRef && <span className="text-[8px] text-[#64b5f6] ml-auto">ACUAN</span>}
                    {!isRef && <span className="text-[9px] text-[#546e7a] ml-auto">{getTypeLabel(col.type)}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {editableFields.length > 0 && (
            <div>
              <p className="text-[10px] text-[#78909c] font-medium mb-2 uppercase tracking-wider">Urutan dan Pengaturan Field</p>
              <div className="space-y-1 max-h-48 overflow-y-auto aero-scroll">
                {editableFields.map((field, idx) => (
                  <div key={field.key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] group">
                    <GripVertical className="w-3 h-3 text-[#37474f]" />
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <input value={field.label} onChange={e => updateField(field.key, { label: e.target.value })} className="flex-1 px-2 py-1 glass-input rounded text-[11px] min-w-0" placeholder="Label" />
                        <label className="flex items-center gap-1 text-[10px] text-[#78909c] cursor-pointer flex-shrink-0">
                          <input type="checkbox" checked={field.required} onChange={e => updateField(field.key, { required: e.target.checked })} className="rounded accent-[#ef5350]" /> Wajib
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <select value={field.type} onChange={e => updateField(field.key, { type: e.target.value as 'text' | 'number' | 'textarea' })} className="px-2 py-0.5 glass-input rounded text-[10px]">
                          <option value="text" style={{ background: '#1a1a2e' }}>Teks Pendek</option>
                          <option value="textarea" style={{ background: '#1a1a2e' }}>Paragraf</option>
                          <option value="number" style={{ background: '#1a1a2e' }}>Angka</option>
                        </select>
                        <input value={field.placeholder || ''} onChange={e => updateField(field.key, { placeholder: e.target.value })} placeholder="Placeholder (opsional)" className="flex-1 px-2 py-0.5 glass-input rounded text-[10px] min-w-0" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button onClick={() => moveField(idx, -1)} disabled={idx === 0} className="p-0.5 rounded hover:bg-white/10 text-[#546e7a] hover:text-white disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
                      <button onClick={() => moveField(idx, 1)} disabled={idx === editableFields.length - 1} className="p-0.5 rounded hover:bg-white/10 text-[#546e7a] hover:text-white disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
                    </div>
                    <button onClick={() => setSelectedFields(prev => prev.filter(f => f.key !== field.key))} className="p-1 rounded hover:bg-[#ef5350]/10 text-[#546e7a] hover:text-[#ef5350] opacity-0 group-hover:opacity-100 transition-all"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <button onClick={() => { setShowCreate(false); resetCreate(); }} className="px-4 py-2 glass-btn rounded-lg text-xs">Batal</button>
            <button onClick={handleCreate} disabled={!formTitle.trim() || editableFields.length === 0 || creating}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-30"
              style={{ background: 'linear-gradient(135deg, rgba(129,199,132,0.3), rgba(129,199,132,0.15))', border: '1px solid rgba(129,199,132,0.4)', color: '#81c784' }}>
              {creating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Membuat...</> : <><FileText className="w-3.5 h-3.5" /> Buat Form</>}
            </button>
          </div>
        </div>
      )}

      {forms.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-8 h-8 text-[#37474f] mx-auto mb-2" />
          <p className="text-xs text-[#546e7a]">Belum ada form. Klik &quot;Buat Form Baru&quot; untuk memulai.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {forms.map(form => {
            const fields = parsedFields(form.fields);
            const isExpanded = expandedId === form.id;
            return (
              <div key={form.id} className={"rounded-xl border transition-all " + (form.isActive ? 'border-white/[0.08] bg-white/[0.03]' : 'border-white/[0.04] bg-white/[0.01] opacity-60')}>
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : form.id)}>
                  <FileText className={"w-4 h-4 flex-shrink-0 " + (form.isActive ? 'text-[#ba68c8]' : 'text-[#546e7a]')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[#e0e0e0] truncate">{form.title}</span>
                      {form.referenceColumn && <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#64b5f6]/15 text-[#64b5f6] border border-[#64b5f6]/30">UPDATE</span>}
                      {!form.isActive && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#546e7a]/20 text-[#78909c]">Ditutup</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-[#546e7a]">{fields.length} field</span>
                      <span className="text-[10px] text-[#37474f]">·</span>
                      <span className="text-[10px] text-[#546e7a]">{form.submissionCount} respons</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={e => { e.stopPropagation(); copyLink(form.id); }} className="p-1.5 rounded-md hover:bg-[#64b5f6]/15 text-[#546e7a] hover:text-[#64b5f6] transition-all" title="Salin link">
                      {copiedId === form.id ? <Check className="w-3.5 h-3.5 text-[#81c784]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleToggleActive(form); }} className="p-1.5 rounded-md hover:bg-white/10 text-[#546e7a] hover:text-white transition-all">
                      {form.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(form.id); }} className="p-1.5 rounded-md hover:bg-[#ef5350]/10 text-[#546e7a] hover:text-[#ef5350] transition-all" title="Hapus">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[#546e7a]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#546e7a]" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-white/[0.06]">
                    {form.description && <p className="text-[11px] text-[#78909c] mt-3 mb-2">{form.description}</p>}
                    {form.referenceColumn && (
                      <div className="flex items-center gap-2 mt-3 mb-2 px-3 py-2 rounded-lg bg-[#64b5f6]/[0.06] border border-[#64b5f6]/15">
                        <LinkIcon className="w-3 h-3 text-[#64b5f6]" />
                        <span className="text-[10px] text-[#90caf9]">Kolom acuan: <strong>{form.referenceLabel}</strong> — mode update data</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-3 mb-3 p-2 rounded-lg bg-white/[0.04]">
                      <Link2 className="w-3.5 h-3.5 text-[#64b5f6] flex-shrink-0" />
                      <input readOnly value={getFormUrl(form.id)} className="flex-1 bg-transparent text-[11px] text-[#b0bec5] outline-none min-w-0" />
                      <button onClick={() => copyLink(form.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] glass-btn flex-shrink-0">
                        {copiedId === form.id ? <><Check className="w-3 h-3" /> Tersalin</> : <><Copy className="w-3 h-3" /> Salin</>}
                      </button>
                    </div>
                    <p className="text-[10px] text-[#546e7a] uppercase tracking-wider font-medium mb-1.5">Field dalam form:</p>
                    <div className="space-y-1">
                      {fields.map((f, i) => (
                        <div key={f.key} className="flex items-center gap-2 text-[11px] px-2 py-1 rounded bg-white/[0.02]">
                          <span className="text-[#37474f] w-4 text-right">{i + 1}.</span>
                          <span className="text-[#b0bec5] flex-1">{f.label}</span>
                          <span className="text-[9px] text-[#546e7a]">{getTypeLabel(f.type)}</span>
                          {f.required && <span className="text-[9px] text-[#ef5350]">*</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
