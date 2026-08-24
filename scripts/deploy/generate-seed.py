import json, hashlib, sys, subprocess

pw = hashlib.sha256('asrama33'.encode()).hexdigest()

divisions = [
    ('TSA', '#3b82f6'),
    ('JLM', '#10b981'),
    ('AMT', '#f59e0b'),
    ('NOSS', '#ef4444'),
    ('Konstruksi', '#8b5cf6'),
]

users = [
    ('admin', 'Administrator', hashlib.sha256('asrama33'.encode()).hexdigest(), 'ADMIN', None),
    ('tsa_editor', 'Editor TSA', hashlib.sha256('password123'.encode()).hexdigest(), 'EDITOR', 'TSA'),
    ('jlm_editor', 'Editor JLM', hashlib.sha256('password123'.encode()).hexdigest(), 'EDITOR', 'JLM'),
    ('amt_editor', 'Editor AMT', hashlib.sha256('password123'.encode()).hexdigest(), 'EDITOR', 'AMT'),
    ('noss_editor', 'Editor NOSS', hashlib.sha256('password123'.encode()).hexdigest(), 'EDITOR', 'NOSS'),
    ('konstruksi_editor', 'Editor Konstruksi', hashlib.sha256('password123'.encode()).hexdigest(), 'EDITOR', 'Konstruksi'),
    ('viewer', 'Viewer', hashlib.sha256('viewer123'.encode()).hexdigest(), 'VIEWER', None),
]

import openpyxl
wb = openpyxl.load_workbook('/home/z/my-project/upload/138 LIST OUTLIERS TSA 11 AGUSTUS 2026 (1).xlsx', read_only=True)
ws = wb['OUTLIERS TSA']
excel_rows = []
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i < 2: continue
    if row[0] is None: continue
    excel_rows.append(list(row))
wb.close()

sqls = []
for name, color in divisions:
    sqls.append(f"INSERT INTO \"Division\" (\"id\", \"name\", \"color\") VALUES (gen_random_uuid()::text, '{name}', '{color}') ON CONFLICT (\"name\") DO NOTHING;")

for username, name, pw_hash, role, div_name in users:
    div_clause = f"(SELECT \"id\" FROM \"Division\" WHERE \"name\" = '{div_name}')" if div_name else 'NULL'
    sqls.append(f"INSERT INTO \"User\" (\"id\", \"username\", \"name\", \"password\", \"role\", \"divisionId\", \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid()::text, '{username}', '{name}', '{pw_hash}', '{role}', {div_clause}, NOW(), NOW()) ON CONFLICT (\"username\") DO NOTHING;")

for i, r in enumerate(excel_rows):
    vals = [f"gen_random_uuid()::text"]
    orderNum = r[0] if isinstance(r[0], (int,float)) else (int(float(str(r[0]))) if str(r[0]).strip() and str(r[0]).strip().replace('.','').replace('-','').isdigit() else i+1)
    vals.append(str(int(orderNum)))
    for j in range(1, 15):
        v = str(r[j]) if j < len(r) and r[j] is not None else ''
        v = v.replace("'", "''")
        if j in [8, 9, 10]:
            try: vals.append(str(int(float(v))))
            except: vals.append('0')
        else:
            vals.append(f"'{v}'")
    vals.append("'{}'")
    vals.append('NOW()')
    vals.append('NOW()')
    sql = f"INSERT INTO \"MonitoringRow\" (\"id\",\"orderNum\",\"categoryBak\",\"provinsi\",\"kabupaten\",\"kecamatan\",\"kelurahan\",\"kelRwSiteName\",\"desaPerum\",\"indexNum\",\"homepass\",\"odp\",\"remarksTsa\",\"klasifikasiTsa\",\"picTsa\",\"remarksJlm\",\"customData\",\"createdAt\",\"updatedAt\") VALUES ({', '.join(vals)});"
    sqls.append(sql)

chart_types = ['bar', 'line', 'pie', 'area', 'bar', 'line', 'pie', 'bar']
for i, ct in enumerate(chart_types):
    sqls.append(f"INSERT INTO \"ChartConfig\" (\"id\",\"title\",\"chartType\",\"config\",\"order\") VALUES (gen_random_uuid()::text, 'Chart {i+1}', '{ct}', '{{}}', {i});")

with open('/tmp/seed_data.sql', 'w') as f:
    f.write('\n'.join(sqls))

print(f'Generated {len(sqls)} SQL statements')
print(f'  - {len(divisions)} divisions')
print(f'  - {len(users)} users')
print(f'  - {len(excel_rows)} monitoring rows')
print(f'  - {len(chart_types)} chart configs')
