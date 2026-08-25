filepath = '/home/z/my-project/src/components/pivot/excel-pivot-table.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# === 1. Update MonitoringRow interface ===
old_interface = '''interface MonitoringRow {
  id: string;
  provinsi: string; kabupaten: string; kecamatan: string; kelurahan: string;
  categoryBak: string; klasifikasiTsa: string; picTsa: string;
  homepass: number; odp: number; customData: string;
}'''

new_interface = '''interface MonitoringRow {
  id: string;
  orderNum: number; indexNum: number;
  provinsi: string; kabupaten: string; kecamatan: string; kelurahan: string;
  kelRwSiteName: string; desaPerum: string;
  categoryBak: string; klasifikasiTsa: string; picTsa: string;
  remarksTsa: string; remarksJlm: string;
  homepass: number; odp: number; customData: string;
}'''
content = content.replace(old_interface, new_interface)

# === 2. Update BASE_FIELDS to include ALL database columns ===
old_base = '''const BASE_FIELDS: FieldDef[] = [
  { key: 'provinsi', label: 'Provinsi', isNumeric: false },
  { key: 'kabupaten', label: 'Kabupaten', isNumeric: false },
  { key: 'kecamatan', label: 'Kecamatan', isNumeric: false },
  { key: 'kelurahan', label: 'Kelurahan', isNumeric: false },
  { key: 'categoryBak', label: 'Category BAK', isNumeric: false },
  { key: 'klasifikasiTsa', label: 'Klasifikasi TSA', isNumeric: false },
  { key: 'picTsa', label: 'PIC TSA', isNumeric: false },
  { key: 'homepass', label: 'Homepass', isNumeric: true },
  { key: 'odp', label: 'ODP', isNumeric: true },
];'''

new_base = '''const BASE_FIELDS: FieldDef[] = [
  { key: 'provinsi', label: 'Provinsi', isNumeric: false },
  { key: 'kabupaten', label: 'Kabupaten', isNumeric: false },
  { key: 'kecamatan', label: 'Kecamatan', isNumeric: false },
  { key: 'kelurahan', label: 'Kelurahan', isNumeric: false },
  { key: 'kelRwSiteName', label: 'Kel RW/Site Name', isNumeric: false },
  { key: 'desaPerum', label: 'Desa/Perum', isNumeric: false },
  { key: 'categoryBak', label: 'Category BAK', isNumeric: false },
  { key: 'klasifikasiTsa', label: 'Klasifikasi TSA', isNumeric: false },
  { key: 'picTsa', label: 'PIC TSA', isNumeric: false },
  { key: 'remarksTsa', label: 'Remarks TSA', isNumeric: false },
  { key: 'remarksJlm', label: 'Remarks JLM', isNumeric: false },
  { key: 'indexNum', label: 'No', isNumeric: true },
  { key: 'homepass', label: 'Homepass', isNumeric: true },
  { key: 'odp', label: 'ODP', isNumeric: true },
];'''
content = content.replace(old_base, new_base)

# === 3. Update computeValueAgg to handle all numeric fields ===
old_agg = '''  const nums = items.map(r => {
    if (va.fieldKey === 'homepass') return r.homepass || 0;
    if (va.fieldKey === 'odp') return r.odp || 0;
    return parseFloat(getFieldValue(r, va.fieldKey)) || 0;
  });'''
new_agg = '''  const nums = items.map(r => {
    if (va.fieldKey === 'homepass') return r.homepass || 0;
    if (va.fieldKey === 'odp') return r.odp || 0;
    if (va.fieldKey === 'indexNum') return r.indexNum || 0;
    if (va.fieldKey === 'orderNum') return r.orderNum || 0;
    return parseFloat(getFieldValue(r, va.fieldKey)) || 0;
  });'''
content = content.replace(old_agg, new_agg)

with open(filepath, 'w') as f:
    f.write(content)

print('Step 1 done: excel-pivot-table.tsx updated with all database columns.')

# =======================================================
# Step 2: Update pivot-charts.tsx
# =======================================================
filepath2 = '/home/z/my-project/src/components/pivot/pivot-charts.tsx'
with open(filepath2, 'r') as f:
    content2 = f.read()

# === 1. Update MonitoringRow interface ===
old_iface2 = '''interface MonitoringRow {
  id: string;
  provinsi: string;
  kabupaten: string;
  kecamatan: string;
  kelurahan: string;
  categoryBak: string;
  klasifikasiTsa: string;
  picTsa: string;
  homepass: number;
  odp: number;
  customData: string;
}'''
new_iface2 = '''interface MonitoringRow {
  id: string;
  orderNum: number; indexNum: number;
  provinsi: string; kabupaten: string; kecamatan: string; kelurahan: string;
  kelRwSiteName: string; desaPerum: string;
  categoryBak: string; klasifikasiTsa: string; picTsa: string;
  remarksTsa: string; remarksJlm: string;
  homepass: number; odp: number; customData: string;
}'''
content2 = content2.replace(old_iface2, new_iface2)

# === 2. Update BASE_COL_OPTIONS ===
old_base2 = '''const BASE_COL_OPTIONS = [
  { key: 'provinsi', label: 'Provinsi' },
  { key: 'kabupaten', label: 'Kabupaten' },
  { key: 'kecamatan', label: 'Kecamatan' },
  { key: 'kelurahan', label: 'Kelurahan' },
  { key: 'categoryBak', label: 'Category BAK' },
  { key: 'klasifikasiTsa', label: 'Klasifikasi TSA' },
  { key: 'picTsa', label: 'PIC TSA' },
];'''
new_base2 = '''const BASE_COL_OPTIONS = [
  { key: 'provinsi', label: 'Provinsi' },
  { key: 'kabupaten', label: 'Kabupaten' },
  { key: 'kecamatan', label: 'Kecamatan' },
  { key: 'kelurahan', label: 'Kelurahan' },
  { key: 'kelRwSiteName', label: 'Kel RW/Site Name' },
  { key: 'desaPerum', label: 'Desa/Perum' },
  { key: 'categoryBak', label: 'Category BAK' },
  { key: 'klasifikasiTsa', label: 'Klasifikasi TSA' },
  { key: 'picTsa', label: 'PIC TSA' },
  { key: 'remarksTsa', label: 'Remarks TSA' },
  { key: 'remarksJlm', label: 'Remarks JLM' },
];'''
content2 = content2.replace(old_base2, new_base2)

with open(filepath2, 'w') as f:
    f.write(content2)

print('Step 2 done: pivot-charts.tsx updated with all database columns.')
print('All changes applied!')