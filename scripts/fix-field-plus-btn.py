import re

filepath = '/home/z/my-project/src/components/pivot/excel-pivot-table.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# === 1. Add Plus to lucide imports ===
content = content.replace(
    '  ChevronDown, ChevronRight, RotateCcw, PanelRightOpen, PanelRightClose,',
    '  ChevronDown, ChevronRight, Plus, RotateCcw, PanelRightOpen, PanelRightClose,'
)

# === 2. Add fieldMenuOpen state ===
content = content.replace(
    '  const [contextChip, setContextChip] = useState<string | null>(null);',
    '  const [contextChip, setContextChip] = useState<string | null>(null);\n  const [fieldMenuOpen, setFieldMenuOpen] = useState<string | null>(null);'
)

# === 3. Replace the entire field list rendering ===
old_field_list = '''            {/* Field list */}
            <div className="px-3 pb-2">
              <p className="text-[10px] text-[#546e7a] font-medium mb-1.5">Choose fields to add to report:</p>
              <div className="max-h-[180px] overflow-y-auto aero-scroll space-y-px">
                {filteredFieldList.map(f => {
                  const used = isFieldUsed(f.key);
                  const zone = getFieldZone(f.key);
                  return (
                    <label key={f.key}
                      className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-all ${used ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}`}
                    >
                      <input type="checkbox" checked={used} onChange={() => toggleField(f.key)}
                        className="w-3 h-3 rounded accent-[#4dd0e1]" />
                      <span className={`text-[11px] flex-1 truncate ${used ? 'text-[#e0e0e0] font-medium' : 'text-[#78909c]'}`}>{f.label}</span>
                      {zone && (
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-semibold ${
                          zone === 'rows' ? 'bg-[#64b5f6]/15 text-[#64b5f6]' :
                          zone === 'columns' ? 'bg-[#ba68c8]/15 text-[#ba68c8]' :
                          zone === 'values' ? 'bg-[#66bb6a]/15 text-[#66bb6a]' :
                          'bg-[#ffb74d]/15 text-[#ffb74d]'
                        }`}>
                          {zone === 'rows' ? 'Rows' : zone === 'columns' ? 'Cols' : zone === 'values' ? 'Values' : 'Filter'}
                        </span>
                      )}
                    </label>
                  );
                })}
                {filteredFieldList.length === 0 && (
                  <p className="text-[10px] text-[#37474f] italic px-2 py-2">Tidak ada field ditemukan</p>
                )}
              </div>
            </div>'''

new_field_list = '''            {/* Field list */}
            <div className="px-3 pb-2">
              <p className="text-[10px] text-[#546e7a] font-medium mb-1.5">Choose fields to add to report:</p>
              <div className="max-h-[180px] overflow-y-auto aero-scroll space-y-px">
                {filteredFieldList.map(f => {
                  const inRows = isFieldInZone(f.key, 'rows');
                  const inCols = isFieldInZone(f.key, 'columns');
                  const inVals = isFieldInZone(f.key, 'values');
                  const inFilters = isFieldInZone(f.key, 'filters');
                  const used = inRows || inCols || inVals || inFilters;
                  const menuOpen = fieldMenuOpen === f.key;
                  return (
                    <div key={f.key}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${used ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}`}
                    >
                      <input type="checkbox" checked={used} onChange={() => { if (used) { toggleField(f.key); } else { toggleField(f.key); } setFieldMenuOpen(null); }}
                        className="w-3 h-3 rounded accent-[#4dd0e1] flex-shrink-0 cursor-pointer" />
                      <span className={`text-[11px] flex-1 truncate cursor-pointer ${used ? 'text-[#e0e0e0] font-medium' : 'text-[#78909c]'}`}>{f.label}</span>
                      {/* Zone badges - show all zones the field is in */}
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {inRows && <span className="text-[7px] px-1 py-0.5 rounded bg-[#64b5f6]/15 text-[#64b5f6] font-semibold">R</span>}
                        {inCols && <span className="text-[7px] px-1 py-0.5 rounded bg-[#ba68c8]/15 text-[#ba68c8] font-semibold">C</span>}
                        {inVals && <span className="text-[7px] px-1 py-0.5 rounded bg-[#66bb6a]/15 text-[#66bb6a] font-semibold">V</span>}
                        {inFilters && <span className="text-[7px] px-1 py-0.5 rounded bg-[#ffb74d]/15 text-[#ffb74d] font-semibold">F</span>}
                      </div>
                      {/* + button to add to specific zone */}
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); setFieldMenuOpen(menuOpen ? null : f.key); }}
                          className={`w-4 h-4 rounded flex items-center justify-center transition-all ${menuOpen ? 'bg-[#4dd0e1]/20 text-[#4dd0e1]' : 'text-[#37474f] hover:text-[#4dd0e1] hover:bg-white/[0.06]'}`}
                          title="Tambah ke zona..."
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        {menuOpen && (
                          <div className="absolute top-full right-0 z-50 mt-1 py-1 rounded-lg bg-[#1a1d29] border border-white/10 shadow-2xl min-w-[120px]">
                            <p className="px-3 py-1 text-[8px] text-[#546e7a] font-semibold uppercase tracking-wider">Tambah ke:</p>
                            <button onClick={() => { addFieldToZone(f.key, 'rows'); setFieldMenuOpen(null); }}
                              className={`flex items-center gap-2 w-full px-3 py-1.5 text-[10px] transition-all ${inRows ? 'text-[#37474f] cursor-default' : 'text-[#78909c] hover:text-[#64b5f6] hover:bg-white/5'}`} disabled={inRows}>
                              <ArrowUpDown className="w-3 h-3" /> Rows {inRows && '✓'}
                            </button>
                            <button onClick={() => { addFieldToZone(f.key, 'columns'); setFieldMenuOpen(null); }}
                              className={`flex items-center gap-2 w-full px-3 py-1.5 text-[10px] transition-all ${inCols ? 'text-[#37474f] cursor-default' : 'text-[#78909c] hover:text-[#ba68c8] hover:bg-white/5'}`} disabled={inCols}>
                              <LayoutGrid className="w-3 h-3" /> Columns {inCols && '✓'}
                            </button>
                            <button onClick={() => { addFieldToZone(f.key, 'values'); setFieldMenuOpen(null); }}
                              className={`flex items-center gap-2 w-full px-3 py-1.5 text-[10px] transition-all ${inVals ? 'text-[#37474f] cursor-default' : 'text-[#78909c] hover:text-[#66bb6a] hover:bg-white/5'}`}>
                              <Sigma className="w-3 h-3" /> Values {inVals && '✓'}
                            </button>
                            <button onClick={() => { addFieldToZone(f.key, 'filters'); setFieldMenuOpen(null); }}
                              className={`flex items-center gap-2 w-full px-3 py-1.5 text-[10px] transition-all ${inFilters ? 'text-[#37474f] cursor-default' : 'text-[#78909c] hover:text-[#ffb74d] hover:bg-white/5'}`} disabled={inFilters}>
                              <Filter className="w-3 h-3" /> Filters {inFilters && '✓'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredFieldList.length === 0 && (
                  <p className="text-[10px] text-[#37474f] italic px-2 py-2">Tidak ada field ditemukan</p>
                )}
              </div>
            </div>'''

content = content.replace(old_field_list, new_field_list)

# === 4. Close the dropdown when clicking outside ===
# Add a click-outside handler after the component opens its return
# We'll add it as an effect
old_effect = '  /* ── Zone helpers ── */'
new_effect = '''  /* ── Close field menu on outside click ── */
  useEffect(() => {
    if (!fieldMenuOpen) return;
    const handler = () => setFieldMenuOpen(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [fieldMenuOpen]);

  /* ── Zone helpers ── */'''
content = content.replace(old_effect, new_effect)

with open(filepath, 'w') as f:
    f.write(content)

print("Done! + button added to field list.")
