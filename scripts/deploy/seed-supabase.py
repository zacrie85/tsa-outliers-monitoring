import subprocess, json, sys, os

token = os.environ.get('SUPABASE_ACCESS_TOKEN', '')
if not token:
    print('Error: Set SUPABASE_ACCESS_TOKEN environment variable')
    sys.exit(1)
url = 'https://api.supabase.com/v1/projects/bjjhswrpsmvljqsbbycj/database/query'

def run_sql(sql, desc='SQL'):
    payload = json.dumps({'query': sql})
    result = subprocess.run(
        ['curl', '-s', '-X', 'POST',
         '-H', f'Authorization: Bearer {token}',
         '-H', 'Content-Type: application/json',
         '-d', payload, url],
        capture_output=True, text=True, timeout=120
    )
    if result.returncode != 0:
        print(f'  {desc}: CURL ERROR - {result.stderr[:100]}')
        return None
    try:
        data = json.loads(result.stdout)
        if isinstance(data, list):
            print(f'  {desc}: OK ({len(data)} rows)')
        else:
            print(f'  {desc}: {data}')
        return data
    except:
        print(f'  {desc}: RAW - {result.stdout[:100]}')
        return None

# Step 1: Disable RLS
print('=== Disabling RLS ===')
for tbl in ['Division', 'User', 'MonitoringRow', 'CustomColumn', 'AuditLog', 'ChartConfig']:
    run_sql(f'ALTER TABLE "{tbl}" DISABLE ROW LEVEL SECURITY;', f'Disable RLS {tbl}')

# Step 2: Clean test data
print('\n=== Cleaning test data ===')
run_sql("DELETE FROM \"Division\" WHERE \"id\" = 'test-id';", 'Clean test')

# Step 3: Seed divisions
print('\n=== Seeding Divisions ===')
divisions_sql = '''
INSERT INTO "Division" ("id", "name", "color") VALUES (gen_random_uuid()::text, 'TSA', '#3b82f6') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "Division" ("id", "name", "color") VALUES (gen_random_uuid()::text, 'JLM', '#10b981') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "Division" ("id", "name", "color") VALUES (gen_random_uuid()::text, 'AMT', '#f59e0b') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "Division" ("id", "name", "color") VALUES (gen_random_uuid()::text, 'NOSS', '#ef4444') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "Division" ("id", "name", "color") VALUES (gen_random_uuid()::text, 'Konstruksi', '#8b5cf6') ON CONFLICT ("name") DO NOTHING;
SELECT count(*) as divisions FROM "Division";
'''
run_sql(divisions_sql, 'Divisions')

# Step 4: Seed users
print('\n=== Seeding Users ===')
import hashlib
def h(pw): return hashlib.sha256(pw.encode()).hexdigest()

users_sql = f'''
INSERT INTO "User" ("id", "username", "name", "password", "role", "divisionId", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, 'admin', 'Administrator', '{h("asrama33")}', 'ADMIN', NULL, NOW(), NOW()) ON CONFLICT ("username") DO NOTHING;
INSERT INTO "User" ("id", "username", "name", "password", "role", "divisionId", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, 'tsa_editor', 'Editor TSA', '{h("password123")}', 'EDITOR', (SELECT "id" FROM "Division" WHERE "name" = 'TSA'), NOW(), NOW()) ON CONFLICT ("username") DO NOTHING;
INSERT INTO "User" ("id", "username", "name", "password", "role", "divisionId", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, 'jlm_editor', 'Editor JLM', '{h("password123")}', 'EDITOR', (SELECT "id" FROM "Division" WHERE "name" = 'JLM'), NOW(), NOW()) ON CONFLICT ("username") DO NOTHING;
INSERT INTO "User" ("id", "username", "name", "password", "role", "divisionId", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, 'amt_editor', 'Editor AMT', '{h("password123")}', 'EDITOR', (SELECT "id" FROM "Division" WHERE "name" = 'AMT'), NOW(), NOW()) ON CONFLICT ("username") DO NOTHING;
INSERT INTO "User" ("id", "username", "name", "password", "role", "divisionId", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, 'noss_editor', 'Editor NOSS', '{h("password123")}', 'EDITOR', (SELECT "id" FROM "Division" WHERE "name" = 'NOSS'), NOW(), NOW()) ON CONFLICT ("username") DO NOTHING;
INSERT INTO "User" ("id", "username", "name", "password", "role", "divisionId", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, 'konstruksi_editor', 'Editor Konstruksi', '{h("password123")}', 'EDITOR', (SELECT "id" FROM "Division" WHERE "name" = 'Konstruksi'), NOW(), NOW()) ON CONFLICT ("username") DO NOTHING;
INSERT INTO "User" ("id", "username", "name", "password", "role", "divisionId", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, 'viewer', 'Viewer', '{h("viewer123")}', 'VIEWER', NULL, NOW(), NOW()) ON CONFLICT ("username") DO NOTHING;
SELECT count(*) as users FROM "User";
'''
run_sql(users_sql, 'Users')

# Step 5: Seed monitoring rows
print('\n=== Seeding Monitoring Rows ===')
import openpyxl
wb = openpyxl.load_workbook('/home/z/my-project/upload/138 LIST OUTLIERS TSA 11 AGUSTUS 2026 (1).xlsx', read_only=True)
ws = wb['OUTLIERS TSA']
rows = []
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i < 2: continue
    if row[0] is None: continue
    rows.append(list(row))
wb.close()

print(f'  Read {len(rows)} rows from Excel')

# Build and send in batches of 20
for batch_start in range(0, len(rows), 20):
    batch = rows[batch_start:batch_start+20]
    stmts = []
    for idx, r in enumerate(batch):
        i = batch_start + idx
        orderNum = r[0] if isinstance(r[0], (int,float)) else (int(float(str(r[0]))) if str(r[0]).strip().replace('.','').replace('-','').isdigit() else i+1)
        vals = [f'gen_random_uuid()::text', str(int(orderNum))]
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
        cols = '"id","orderNum","categoryBak","provinsi","kabupaten","kecamatan","kelurahan","kelRwSiteName","desaPerum","indexNum","homepass","odp","remarksTsa","klasifikasiTsa","picTsa","remarksJlm","customData","createdAt","updatedAt"'
        stmts.append(f'INSERT INTO "MonitoringRow" ({cols}) VALUES ({", ".join(vals)});')
    sql = '\n'.join(stmts) + f'\nSELECT {len(batch)} as batch_{batch_start//20+1};'
    run_sql(sql, f'Rows {batch_start+1}-{batch_start+len(batch)}')

# Step 6: Seed chart configs
print('\n=== Seeding Chart Configs ===')
charts_sql = '''
INSERT INTO "ChartConfig" ("id","title","chartType","config","order") VALUES (gen_random_uuid()::text, 'Chart 1', 'bar', '{}', 0);
INSERT INTO "ChartConfig" ("id","title","chartType","config","order") VALUES (gen_random_uuid()::text, 'Chart 2', 'line', '{}', 1);
INSERT INTO "ChartConfig" ("id","title","chartType","config","order") VALUES (gen_random_uuid()::text, 'Chart 3', 'pie', '{}', 2);
INSERT INTO "ChartConfig" ("id","title","chartType","config","order") VALUES (gen_random_uuid()::text, 'Chart 4', 'area', '{}', 3);
INSERT INTO "ChartConfig" ("id","title","chartType","config","order") VALUES (gen_random_uuid()::text, 'Chart 5', 'bar', '{}', 4);
INSERT INTO "ChartConfig" ("id","title","chartType","config","order") VALUES (gen_random_uuid()::text, 'Chart 6', 'line', '{}', 5);
INSERT INTO "ChartConfig" ("id","title","chartType","config","order") VALUES (gen_random_uuid()::text, 'Chart 7', 'pie', '{}', 6);
INSERT INTO "ChartConfig" ("id","title","chartType","config","order") VALUES (gen_random_uuid()::text, 'Chart 8', 'bar', '{}', 7);
SELECT count(*) as charts FROM "ChartConfig";
'''
run_sql(charts_sql, 'Charts')

# Step 7: Verify all data
print('\n=== Verification ===')
run_sql('SELECT (SELECT count(*) FROM "Division") as divisions, (SELECT count(*) FROM "User") as users, (SELECT count(*) FROM "MonitoringRow") as monitoring_rows, (SELECT count(*) FROM "ChartConfig") as charts', 'Final Count')
print('\nDone!')
