import re

filepath = '/home/z/my-project/src/components/pivot/excel-pivot-table.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# === 1. Add `id` to ValueAgg interface ===
old_va = '''interface ValueAgg {
  fieldKey: string;
  aggType: 'count' | 'sum' | 'avg' | 'min' | 'max';
  label: string;
}'''
new_va = '''interface ValueAgg {
  id: string;
  fieldKey: string;
  aggType: 'count' | 'sum' | 'avg' | 'min' | 'max';
  label: string;
}'''
content = content.replace(old_va, new_va)

# === 2. Add a counter ref for unique ValueAgg IDs ===
old_state = "  const [downloading, setDownloading] = useState(false);"
new_state = "  const [downloading, setDownloading] = useState(false);\n  const aggIdCounter = useRef(0);\n  const nextAggId = useCallback(() => `va-${++aggIdCounter.current}`, []);"
content = content.replace(old_state, new_state)

# === 3. Replace `isFieldUsed` and `toggleField` and `moveFieldToZone` and `removeField` and `updateValueAgg` ===
old_zone_helpers = '''  /* ── Zone helpers ── */
  const getFieldZone = useCallback((key: string): ZoneName | null => {
    if (rowFields.includes(key)) return 'rows';
    if (colFields.includes(key)) return 'columns';
    if (valueFields.some(v => v.fieldKey === key)) return 'values';
    if (filterFields.includes(key)) return 'filters';
    return null;
  }, [rowFields, colFields, valueFields, filterFields]);

  const isFieldUsed = useCallback((key: string) => getFieldZone(key) !== null, [getFieldZone]);

  const toggleField = useCallback((key: string) => {
    if (isFieldUsed(key)) {
      // Remove from current zone
      setRowFields(p => p.filter(k => k !== key));
      setColFields(p => p.filter(k => k !== key));
      setValueFields(p => p.filter(v => v.fieldKey !== key));
      setFilterFields(p => p.filter(k => k !== key));
      setActiveFilters(p => { const n = { ...p }; delete n[key]; return n; });
    } else {
      // Auto-assign based on type
      const field = fieldMap[key];
      if (field?.isNumeric) {
        setValueFields(p => [...p, { fieldKey: key, aggType: 'sum', label: makeAggLabel(field.label, 'sum') }]);
      } else {
        setRowFields(p => [...p, key]);
      }
    }
  }, [isFieldUsed, fieldMap]);

  const moveFieldToZone = useCallback((key: string, zone: ZoneName) => {
    const field = fieldMap[key];
    if (!field) return;
    // Remove from all zones first
    setRowFields(p => p.filter(k => k !== key));
    setColFields(p => p.filter(k => k !== key));
    setValueFields(p => p.filter(v => v.fieldKey !== key));
    setFilterFields(p => p.filter(k => k !== key));
    // Add to target zone
    if (zone === 'rows') setRowFields(p => [...p, key]);
    else if (zone === 'columns') setColFields(p => [...p, key]);
    else if (zone === 'values') {
      const agg = field.isNumeric ? 'sum' as const : 'count' as const;
      setValueFields(p => [...p, { fieldKey: key, aggType: agg, label: makeAggLabel(field.label, agg) }]);
    } else if (zone === 'filters') setFilterFields(p => [...p, key]);
  }, [fieldMap]);

  const removeField = useCallback((key: string) => { toggleField(key); }, [toggleField]);

  const updateValueAgg = useCallback((fieldKey: string, newAgg: ValueAgg['aggType']) => {
    setValueFields(p => p.map(v => {
      if (v.fieldKey !== fieldKey) return v;
      return { ...v, aggType: newAgg, label: makeAggLabel(fieldMap[fieldKey]?.label || fieldKey, newAgg) };
    }));
  }, [fieldMap]);'''

new_zone_helpers = '''  /* ── Zone helpers ── */
  const getFieldZone = useCallback((key: string): ZoneName | null => {
    if (rowFields.includes(key)) return 'rows';
    if (colFields.includes(key)) return 'columns';
    if (valueFields.some(v => v.fieldKey === key)) return 'values';
    if (filterFields.includes(key)) return 'filters';
    return null;
  }, [rowFields, colFields, valueFields, filterFields]);

  // Check if a field is used in ANY zone (for checkbox display)
  const isFieldUsed = useCallback((key: string) => getFieldZone(key) !== null, [getFieldZone]);

  // Check if a field is used in a SPECIFIC zone
  const isFieldInZone = useCallback((key: string, zone: ZoneName) => {
    if (zone === 'rows') return rowFields.includes(key);
    if (zone === 'columns') return colFields.includes(key);
    if (zone === 'values') return valueFields.some(v => v.fieldKey === key);
    if (zone === 'filters') return filterFields.includes(key);
    return false;
  }, [rowFields, colFields, valueFields, filterFields]);

  // Checkbox toggle: if not used anywhere → add to default zone; if used → remove from ALL zones
  const toggleField = useCallback((key: string) => {
    if (isFieldUsed(key)) {
      // Remove from ALL zones
      setRowFields(p => p.filter(k => k !== key));
      setColFields(p => p.filter(k => k !== key));
      setValueFields(p => p.filter(v => v.fieldKey !== key));
      setFilterFields(p => p.filter(k => k !== key));
      setActiveFilters(p => { const n = { ...p }; delete n[key]; return n; });
    } else {
      // Auto-assign based on type
      const field = fieldMap[key];
      if (field?.isNumeric) {
        setValueFields(p => [...p, { id: nextAggId(), fieldKey: key, aggType: 'sum', label: makeAggLabel(field.label, 'sum') }]);
      } else {
        setRowFields(p => [...p, key]);
      }
    }
  }, [isFieldUsed, fieldMap, nextAggId]);

  // ADD field to a zone WITHOUT removing from other zones (used by drag from field list)
  const addFieldToZone = useCallback((key: string, zone: ZoneName) => {
    const field = fieldMap[key];
    if (!field) return;
    // Only add if not already in THIS specific zone
    if (zone === 'rows' && !rowFields.includes(key)) {
      setRowFields(p => [...p, key]);
    } else if (zone === 'columns' && !colFields.includes(key)) {
      setColFields(p => [...p, key]);
    } else if (zone === 'values') {
      // Allow same field in values multiple times with different agg
      setValueFields(p => {
        const agg = field.isNumeric ? 'sum' as const : 'count' as const;
        return [...p, { id: nextAggId(), fieldKey: key, aggType: agg, label: makeAggLabel(field.label, agg) }];
      });
    } else if (zone === 'filters' && !filterFields.includes(key)) {
      setFilterFields(p => [...p, key]);
    }
  }, [fieldMap, rowFields, colFields, valueFields, filterFields, nextAggId]);

  // MOVE field from current zone to another zone (used by move menu on chip)
  const moveFieldToZone = useCallback((key: string, zone: ZoneName) => {
    const field = fieldMap[key];
    if (!field) return;
    // Remove from all zones first
    setRowFields(p => p.filter(k => k !== key));
    setColFields(p => p.filter(k => k !== key));
    setValueFields(p => p.filter(v => v.fieldKey !== key));
    setFilterFields(p => p.filter(k => k !== key));
    // Add to target zone
    if (zone === 'rows') setRowFields(p => [...p, key]);
    else if (zone === 'columns') setColFields(p => [...p, key]);
    else if (zone === 'values') {
      const agg = field.isNumeric ? 'sum' as const : 'count' as const;
      setValueFields(p => [...p, { id: nextAggId(), fieldKey: key, aggType: agg, label: makeAggLabel(field.label, agg) }]);
    } else if (zone === 'filters') setFilterFields(p => [...p, key]);
  }, [fieldMap, nextAggId]);

  // REMOVE field from a SPECIFIC zone only
  const removeFieldFromZone = useCallback((key: string, zone: ZoneName) => {
    if (zone === 'rows') setRowFields(p => p.filter(k => k !== key));
    else if (zone === 'columns') setColFields(p => p.filter(k => k !== key));
    else if (zone === 'values') setValueFields(p => p.filter(v => v.fieldKey !== key));
    else if (zone === 'filters') {
      setFilterFields(p => p.filter(k => k !== key));
      setActiveFilters(p => { const n = { ...p }; delete n[key]; return n; });
    }
  }, []);

  // Legacy: remove from ALL zones (used by checkbox uncheck)
  const removeField = useCallback((key: string) => { toggleField(key); }, [toggleField]);

  const updateValueAgg = useCallback((vaId: string, newAgg: ValueAgg['aggType']) => {
    setValueFields(p => p.map(v => {
      if (v.id !== vaId) return v;
      return { ...v, aggType: newAgg, label: makeAggLabel(fieldMap[v.fieldKey]?.label || v.fieldKey, newAgg) };
    }));
  }, [fieldMap]);'''

content = content.replace(old_zone_helpers, new_zone_helpers)

# === 4. Update DropZone onDrop to use addFieldToZone instead of moveFieldToZone ===
# Filters zone
content = content.replace(
    'onDrop={(key) => moveFieldToZone(key, \'filters\')}',
    'onDrop={(key) => addFieldToZone(key, \'filters\')}'
)
# Columns zone
content = content.replace(
    'onDrop={(key) => moveFieldToZone(key, \'columns\')}',
    'onDrop={(key) => addFieldToZone(key, \'columns\')}'
)
# Rows zone
content = content.replace(
    'onDrop={(key) => moveFieldToZone(key, \'rows\')}',
    'onDrop={(key) => addFieldToZone(key, \'rows\')}'
)
# Values zone
content = content.replace(
    'onDrop={(key) => moveFieldToZone(key, \'values\')}',
    'onDrop={(key) => addFieldToZone(key, \'values\')}'
)

# === 5. Update filter chip onRemove to use removeFieldFromZone ===
content = content.replace(
    '''<ZoneChip label={fieldMap[fk]?.label || fk}
                        onRemove={() => removeField(fk)}
                        onMove={(z) => moveFieldToZone(fk, z)}
                        showMoveMenu={contextChip === `filter-${fk}`}
                        setShowMoveMenu={(v) => setContextChip(v ? `filter-${fk}` : null)}
                        accentColor="#ffb74d" />''',
    '''<ZoneChip label={fieldMap[fk]?.label || fk}
                        onRemove={() => removeFieldFromZone(fk, 'filters')}
                        onMove={(z) => moveFieldToZone(fk, z)}
                        showMoveMenu={contextChip === `filter-${fk}`}
                        setShowMoveMenu={(v) => setContextChip(v ? `filter-${fk}` : null)}
                        accentColor="#ffb74d" />'''
)

# === 6. Update column chip onRemove to use removeFieldFromZone ===
content = content.replace(
    '''<ZoneChip key={fk} label={fieldMap[fk]?.label || fk}
                    onRemove={() => removeField(fk)}
                    onMove={(z) => moveFieldToZone(fk, z)}
                    showMoveMenu={contextChip === `col-${fk}`}
                    setShowMoveMenu={(v) => setContextChip(v ? `col-${fk}` : null)}
                    accentColor="#ba68c8" />''',
    '''<ZoneChip key={fk} label={fieldMap[fk]?.label || fk}
                    onRemove={() => removeFieldFromZone(fk, 'columns')}
                    onMove={(z) => moveFieldToZone(fk, z)}
                    showMoveMenu={contextChip === `col-${fk}`}
                    setShowMoveMenu={(v) => setContextChip(v ? `col-${fk}` : null)}
                    accentColor="#ba68c8" />'''
)

# === 7. Update row chip onRemove to use removeFieldFromZone ===
content = content.replace(
    '''<ZoneChip key={fk} label={fieldMap[fk]?.label || fk}
                    onRemove={() => removeField(fk)}
                    onMove={(z) => moveFieldToZone(fk, z)}
                    showMoveMenu={contextChip === `row-${fk}`}
                    setShowMoveMenu={(v) => setContextChip(v ? `row-${fk}` : null)}
                    accentColor="#64b5f6" />''',
    '''<ZoneChip key={fk} label={fieldMap[fk]?.label || fk}
                    onRemove={() => removeFieldFromZone(fk, 'rows')}
                    onMove={(z) => moveFieldToZone(fk, z)}
                    showMoveMenu={contextChip === `row-${fk}`}
                    setShowMoveMenu={(v) => setContextChip(v ? `row-${fk}` : null)}
                    accentColor="#64b5f6" />'''
)

# === 8. Update Values zone chips to use va.id as key and removeFieldFromZone ===
old_values_zone = '''{valueFields.map((va, vi) => (
                  <div key={va.fieldKey} className="inline-flex">
                    <ZoneChip label={va.label}
                      onRemove={() => removeField(va.fieldKey)}
                      onMove={(z) => moveFieldToZone(va.fieldKey, z)}
                      showMoveMenu={contextChip === `val-${va.fieldKey}`}
                      setShowMoveMenu={(v) => setContextChip(v ? `val-${va.fieldKey}` : null)}
                      accentColor="#66bb6a"
                      extra={(
                        <select value={va.aggType}
                          onChange={(e) => updateValueAgg(va.fieldKey, e.target.value as ValueAgg['aggType'])}
                          className="bg-transparent text-[9px] text-[#66bb6a] border-none focus:outline-none cursor-pointer"
                          style={{ background: 'transparent' }}
                        >
                          {AGG_OPTIONS.map(ao => <option key={ao.value} value={ao.value} style={{ background: '#1a1d29' }}>{ao.label}</option>)}
                        </select>
                      )} />
                  </div>
                ))}'''

new_values_zone = '''{valueFields.map((va, vi) => (
                  <div key={va.id} className="inline-flex">
                    <ZoneChip label={va.label}
                      onRemove={() => removeFieldFromZone(va.fieldKey, 'values')}
                      onMove={(z) => moveFieldToZone(va.fieldKey, z)}
                      showMoveMenu={contextChip === `val-${va.id}`}
                      setShowMoveMenu={(v) => setContextChip(v ? `val-${va.id}` : null)}
                      accentColor="#66bb6a"
                      extra={(
                        <select value={va.aggType}
                          onChange={(e) => updateValueAgg(va.id, e.target.value as ValueAgg['aggType'])}
                          className="bg-transparent text-[9px] text-[#66bb6a] border-none focus:outline-none cursor-pointer"
                          style={{ background: 'transparent' }}
                        >
                          {AGG_OPTIONS.map(ao => <option key={ao.value} value={ao.value} style={{ background: '#1a1d29' }}>{ao.label}</option>)}
                        </select>
                      )} />
                  </div>
                ))}'''

content = content.replace(old_values_zone, new_values_zone)

with open(filepath, 'w') as f:
    f.write(content)

print("Done! Changes applied successfully.")
