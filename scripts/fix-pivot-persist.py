filepath = '/home/z/my-project/src/components/pivot/excel-pivot-table.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# === 1. Add persistable state type ===
old_types_end = "type ZoneName = 'rows' | 'columns' | 'values' | 'filters';"
new_types_end = """type ZoneName = 'rows' | 'columns' | 'values' | 'filters';

interface PivotPersistState {
  rowFields: string[];
  colFields: string[];
  valueFields: ValueAgg[];
  filterFields: string[];
  activeFilters: Record<string, string[]>;
  showPanel: boolean;
}"""
content = content.replace(old_types_end, new_types_end)

# === 2. Modify component signature to accept instanceId ===
old_sig = "export function ExcelPivotTable({ rows, customCols }: { rows: MonitoringRow[]; customCols: any[] }) {"
new_sig = """export function ExcelPivotTable({ rows, customCols, instanceId = 'ep-default' }: { rows: MonitoringRow[]; customCols: any[]; instanceId?: string }) {"""
content = content.replace(old_sig, new_sig)

# === 3. Add mounted ref, load from localStorage effect, and save effect ===
old_counter = '  const aggIdCounter = useRef(0);\n  const nextAggId = useCallback(() => `va-${++aggIdCounter.current}`, []);'
new_counter = '''  const aggIdCounter = useRef(0);
  const nextAggId = useCallback(() => `va-${++aggIdCounter.current}`, []);
  const mounted = useRef(false);

  // Ensure aggIdCounter is always higher than any loaded IDs
  const maxLoadedId = useRef(0);

  // Load persisted state from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`pivot-excel-${instanceId}`);
      if (raw) {
        const saved: PivotPersistState = JSON.parse(raw);
        if (saved.rowFields) setRowFields(saved.rowFields);
        if (saved.colFields) setColFields(saved.colFields);
        if (saved.valueFields) {
          setValueFields(saved.valueFields);
          // Sync counter so new IDs don't collide
          saved.valueFields.forEach(v => {
            const num = parseInt(v.id.replace('va-', ''), 10);
            if (!isNaN(num) && num > maxLoadedId.current) maxLoadedId.current = num;
          });
          aggIdCounter.current = maxLoadedId.current;
        }
        if (saved.filterFields) setFilterFields(saved.filterFields);
        if (saved.activeFilters) setActiveFilters(saved.activeFilters);
        if (saved.showPanel !== undefined) setShowPanel(saved.showPanel);
      }
    } catch (e) { console.error('Failed to load pivot state:', e); }
    mounted.current = true;
  }, [instanceId]);

  // Debounced save to localStorage
  useEffect(() => {
    if (!mounted.current) return;
    const timer = setTimeout(() => {
      const state: PivotPersistState = {
        rowFields, colFields, valueFields, filterFields, activeFilters, showPanel,
      };
      try { localStorage.setItem(`pivot-excel-${instanceId}`, JSON.stringify(state)); } catch (e) { /* quota exceeded */ }
    }, 200);
    return () => clearTimeout(timer);
  }, [rowFields, colFields, valueFields, filterFields, activeFilters, showPanel, instanceId]);'''
content = content.replace(old_counter, new_counter)

with open(filepath, 'w') as f:
    f.write(content)

print('Step 1 done: ExcelPivotTable now persists state to localStorage.')

# =======================================================
# Step 2: Update pivot-charts.tsx for multiple instances
# =======================================================
filepath2 = '/home/z/my-project/src/components/pivot/pivot-charts.tsx'
with open(filepath2, 'r') as f:
    content2 = f.read()

# === 1. Replace single ExcelPivotTable rendering with multiple instances ===
old_excel_render = '''      {/* Excel-Style Pivot Table */}
      <ExcelPivotTable rows={rows} customCols={customCols} />'''

new_excel_render = '''      {/* Excel-Style Pivot Tables */}
      <div className="flex flex-col gap-4">
        {excelPivotIds.map((id) => (
          <div key={id} className="relative group">
            <ExcelPivotTable instanceId={id} rows={rows} customCols={customCols} />
            {excelPivotIds.length > 1 && (
              <button
                onClick={() => removeExcelPivot(id)}
                className="absolute top-3 right-14 z-20 opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium hover:bg-[#ef5350]/10 text-[#546e7a] hover:text-[#ef5350] border border-transparent hover:border-[#ef5350]/20 transition-all"
                title="Hapus Pivot Table ini"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        <button onClick={addExcelPivot}
          className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-white/[0.06] text-[#546e7a] hover:text-[#4dd0e1] hover:border-[#4dd0e1]/20 hover:bg-[#4dd0e1]/[0.02] transition-all text-xs font-medium">
          <Plus className="w-4 h-4" /> Tambah Excel-Style Pivot Table
        </button>
      </div>'''

content2 = content2.replace(old_excel_render, new_excel_render)

# === 2. Add excelPivotIds state and handlers ===
# Find the addPivotTable function and add excel pivot state before it
old_add_pivot = '  const addPivotTable = () => {'
new_add_pivot = '''  /* ── Excel-Style Pivot Table instances ── */
  const EXCEL_PIVOT_KEY = 'pivot-excel-instances';
  const [excelPivotIds, setExcelPivotIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return ['ep-1'];
    try {
      const saved = localStorage.getItem(EXCEL_PIVOT_KEY);
      if (saved) { const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length > 0) return parsed; }
    } catch {}
    return ['ep-1'];
  });

  useEffect(() => {
    try { localStorage.setItem(EXCEL_PIVOT_KEY, JSON.stringify(excelPivotIds)); } catch {}
  }, [excelPivotIds]);

  const addExcelPivot = () => {
    const newId = `ep-${Date.now()}`;
    setExcelPivotIds(prev => [...prev, newId]);
  };

  const removeExcelPivot = (id: string) => {
    setExcelPivotIds(prev => prev.filter(i => i !== id));
    try { localStorage.removeItem(`pivot-excel-${id}`); } catch {}
  };

  const addPivotTable = () => {'''

content2 = content2.replace(old_add_pivot, new_add_pivot)

with open(filepath2, 'w') as f:
    f.write(content2)

print('Step 2 done: pivot-charts now manages multiple ExcelPivotTable instances.')
print('All changes applied!')
