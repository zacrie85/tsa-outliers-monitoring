'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Send, CheckCircle2, AlertCircle, Loader2, ClipboardCopy, ExternalLink, Link2, Search, Check } from 'lucide-react';

interface FormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'checkbox';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface ReferenceItem {
  value: string;
  rowId: string;
}

export default function PublicFormPage() {
  const params = useParams();
  const formId = params.formId as string;

  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  // Reference state
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [selectedRowId, setSelectedRowId] = useState('');
  const [refSearch, setRefSearch] = useState('');

  useEffect(() => {
    fetch(`/api/forms/${formId}?references=true`)
      .then(res => res.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setForm(data.form);
        setReferences(data.references || []);
      })
      .catch(() => setError('Gagal memuat form'))
      .finally(() => setLoading(false));
  }, [formId]);

  const fields: FormField[] = form ? JSON.parse(form.fields) : [];
  const hasRef = !!form?.referenceColumn;
  const refLabel = form?.referenceLabel || 'Pilih Data';
  const formUrl = typeof window !== 'undefined' ? window.location.href : '';

  const filteredRefs = references.filter(r =>
    !refSearch || r.value.toLowerCase().includes(refSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/forms/${formId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: formData, referenceRowId: selectedRowId || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSubmitted(true);
    } catch { setError('Gagal mengirim. Coba lagi.'); }
    finally { setSubmitting(false); }
  };

  const copyLink = () => { navigator.clipboard.writeText(formUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  if (loading) {
    return (
      <div className="min-h-screen aero-bg flex items-center justify-center">
        <div className="glass-card rounded-2xl p-8 text-center">
          <Loader2 className="w-6 h-6 text-[#64b5f6] animate-spin mx-auto" />
          <p className="text-sm text-[#78909c] mt-3">Memuat form...</p>
        </div>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen aero-bg flex items-center justify-center px-4">
        <div className="glass-card rounded-2xl p-8 text-center max-w-md">
          <AlertCircle className="w-10 h-10 text-[#ef5350] mx-auto mb-3" />
          <p className="text-sm text-[#e0e0e0] mb-1">Form Tidak Tersedia</p>
          <p className="text-xs text-[#78909c]">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen aero-bg flex items-center justify-center px-4">
        <div className="glass-card rounded-2xl p-10 text-center max-w-md w-full">
          <div className="w-16 h-16 rounded-full bg-[#81c784]/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-[#81c784]" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">{hasRef ? 'Data Berhasil Diupdate!' : 'Respons Tercatat!'}</h2>
          <p className="text-sm text-[#b0bec5] mb-6">{hasRef ? 'Data baris yang kamu pilih sudah diperbarui.' : 'Terima kasih, data kamu sudah berhasil dikirim.'}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setSubmitted(false); setFormData({}); setSelectedRowId(''); setRefSearch(''); }} className="px-5 py-2.5 glass-btn rounded-lg text-sm">
              {hasRef ? 'Update Lagi' : 'Kirim Lagi'}
            </button>
            <button onClick={copyLink} className="flex items-center gap-2 px-5 py-2.5 glass-btn rounded-lg text-sm">
              <ClipboardCopy className="w-3.5 h-3.5" /> {copied ? 'Tersalin!' : 'Salin Link'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const projectColor = form?.project?.color || '#64b5f6';

  return (
    <div className="min-h-screen aero-bg flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-2xl flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: projectColor }} />
          <span className="text-[10px] text-[#546e7a]">{form?.project?.name || 'Form'}</span>
        </div>
        <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] text-[#78909c] hover:text-[#90caf9] hover:bg-white/5 transition-all">
          <ExternalLink className="w-3 h-3" /> {copied ? 'Link Tersalin!' : 'Salin Link'}
        </button>
      </div>

      <div className="w-full max-w-2xl">
        {/* Title Section */}
        <div className="rounded-t-2xl p-6 pb-2" style={{ background: `linear-gradient(135deg, ${projectColor}25, ${projectColor}08)` }}>
          <h1 className="text-xl font-bold text-white mb-1">{form?.title}</h1>
          {form?.description && <p className="text-xs text-[#b0bec5]">{form.description}</p>}
          {hasRef && <p className="text-[10px] text-[#90caf9] mt-2">Mode Update — pilih baris data yang ingin diupdate</p>}
          <p className="text-[10px] text-[#546e7a] mt-1">* Wajib diisi</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="glass-card rounded-t-none space-y-0">
            {/* ===== REFERENCE BOXES ===== */}
            {hasRef && (
              <div className="border-b border-white/[0.08] p-5">
                <div className="rounded-xl bg-white/[0.04] border border-[#64b5f6]/20 p-4 space-y-3">
                  {/* Box 1: Reference Column Label */}
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${projectColor}20`, border: `1px solid ${projectColor}40` }}>
                      <span className="text-[10px] font-bold" style={{ color: projectColor }}>1</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#e0e0e0]">Kolom Acuan</p>
                      <p className="text-[10px] text-[#546e7a]">Kolom yang digunakan untuk mencari data</p>
                    </div>
                    <div className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: `${projectColor}15`, border: `1px solid ${projectColor}30`, color: projectColor }}>
                      {refLabel}
                    </div>
                  </div>

                  {/* Box 2: Row Selector */}
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${projectColor}20`, border: `1px solid ${projectColor}40` }}>
                      <span className="text-[10px] font-bold" style={{ color: projectColor }}>2</span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div>
                        <p className="text-xs font-medium text-[#e0e0e0]">Pilih Baris Data</p>
                        <p className="text-[10px] text-[#546e7a]">Pilih baris data yang ingin kamu update</p>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#546e7a]" />
                        <input
                          type="text"
                          value={refSearch}
                          onChange={(e) => { setRefSearch(e.target.value); setSelectedRowId(''); }}
                          placeholder={`Cari ${refLabel.toLowerCase()}...`}
                          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-[#e0e0e0] placeholder:text-[#37474f] focus:outline-none focus:border-[#64b5f6]/40 transition-all"
                        />
                      </div>
                      <select
                        required
                        value={selectedRowId}
                        onChange={(e) => setSelectedRowId(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-[#e0e0e0] focus:outline-none focus:border-[#64b5f6]/40 transition-all"
                        size={Math.min(filteredRefs.length + 1, 6)}
                      >
                        <option value="" style={{ background: '#1a1a2e' }}>-- Pilih {refLabel} --</option>
                        {filteredRefs.map(r => (
                          <option key={r.rowId} value={r.rowId} style={{ background: '#1a1a2e' }}>{r.value}</option>
                        ))}
                      </select>
                      {filteredRefs.length === 0 && refSearch && (
                        <p className="text-[10px] text-[#78909c]">Tidak ditemukan data yang cocok.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== FORM FIELDS ===== */}
            {fields.map((field, idx) => {
              const isLast = idx === fields.length - 1;
              // Parse selected checkbox values from comma-separated string
              const checkedValues: string[] = (formData[field.key] || '').split(',').filter(Boolean);
              const toggleCheckbox = (opt: string) => {
                const current = (formData[field.key] || '').split(',').filter(Boolean);
                const next = current.includes(opt)
                  ? current.filter(v => v !== opt)
                  : [...current, opt];
                setFormData(prev => ({ ...prev, [field.key]: next.join(',') }));
              };
              return (
                <div key={field.key} className={isLast ? '' : 'border-b border-white/[0.06]'}>
                  <div className="px-6 py-4">
                    <label className="flex items-start gap-1 mb-2">
                      <span className="text-xs font-medium text-[#e0e0e0]">{field.label}</span>
                      {field.required && <span className="text-[#ef5350] text-xs">*</span>}
                    </label>
                    {field.type === 'checkbox' ? (
                      <div className="space-y-2">
                        {(field.options || []).filter(Boolean).map(opt => (
                          <label key={opt} className="flex items-center gap-2.5 cursor-pointer group/chk">
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${checkedValues.includes(opt) ? 'bg-[#64b5f6] border-[#64b5f6]' : 'border-white/20 group-hover/chk:border-white/40'}`}
                              onClick={() => toggleCheckbox(opt)}
                            >
                              {checkedValues.includes(opt) && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <span className="text-sm text-[#b0bec5] group-hover/chk:text-[#e0e0e0] transition-colors">{opt}</span>
                          </label>
                        ))}
                        {(field.options || []).filter(Boolean).length === 0 && (
                          <p className="text-xs text-[#546e7a]">Tidak ada pilihan tersedia.</p>
                        )}
                      </div>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        required={field.required}
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder || `Masukkan ${field.label.toLowerCase()}...`}
                        rows={3}
                        className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-[#e0e0e0] placeholder:text-[#37474f] focus:outline-none focus:border-[#64b5f6]/40 resize-y transition-all"
                      />
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        required={field.required}
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder || `Masukkan ${field.label.toLowerCase()}...`}
                        className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-[#e0e0e0] placeholder:text-[#37474f] focus:outline-none focus:border-[#64b5f6]/40 transition-all"
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Error */}
            {error && (
              <div className="px-6 pb-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-[#ef5350]/10 border border-[#ef5350]/20">
                  <AlertCircle className="w-4 h-4 text-[#ef5350] flex-shrink-0" />
                  <p className="text-xs text-[#ef9a9a]">{error}</p>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="px-6 py-5 flex items-center justify-between">
              <button type="button" onClick={copyLink} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs text-[#78909c] hover:text-[#90caf9] hover:bg-white/5 transition-all">
                <ClipboardCopy className="w-3.5 h-3.5" /> {copied ? 'Tersalin!' : 'Salin Link Form'}
              </button>
              <button
                type="submit"
                disabled={submitting || (hasRef && !selectedRowId)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${projectColor}30, ${projectColor}15)`, border: `1px solid ${projectColor}50`, color: projectColor }}
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim...</> : <><Send className="w-4 h-4" /> {hasRef ? 'Update Data' : 'Kirim'}</>}
              </button>
            </div>
          </div>
        </form>
      </div>

      <p className="text-[9px] text-[#37474f] mt-6">TSA Outliers Monitoring — Online Form</p>
    </div>
  );
}
