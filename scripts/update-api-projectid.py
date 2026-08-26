import re

# === 1. Update /api/monitoring/route.ts ===
fp = '/home/z/my-project/src/app/api/monitoring/route.ts'
with open(fp, 'r') as f:
    c = f.read()

c = c.replace(
    "import { NextRequest, NextResponse } from 'next/server';\nimport { db } from '@/lib/db';\nimport { requireAuth } from '@/lib/auth';",
    "import { NextRequest, NextResponse } from 'next/server';\nimport { db } from '@/lib/db';\nimport { requireAuth } from '@/lib/auth';\nimport { getProjectId } from '@/lib/project-context';"
)

c = c.replace(
    'export async function GET() {',
    'export async function GET(request: NextRequest) {'
)

c = c.replace(
    '''    const user = await requireAuth();
    const rows = await db.monitoringRow.findMany({
      orderBy: { orderNum: 'asc' },
    });''',
    '''    const user = await requireAuth();
    const projectId = getProjectId(request.url);
    const rows = await db.monitoringRow.findMany({
      where: { projectId },
      orderBy: { orderNum: 'asc' },
    });'''
)

c = c.replace(
    '''    const body = await request.json();
    const maxOrder = await db.monitoringRow.findFirst({
      orderBy: { orderNum: 'desc' },
      select: { orderNum: true },
    });''',
    '''    const body = await request.json();
    const projectId = getProjectId(request.url);
    const maxOrder = await db.monitoringRow.findFirst({
      where: { projectId },
      orderBy: { orderNum: 'desc' },
      select: { orderNum: true },
    });'''
)

c = c.replace(
    '''    const row = await db.monitoringRow.create({
      data: {
        orderNum: nextOrder,''',
    '''    const row = await db.monitoringRow.create({
      data: {
        projectId,
        orderNum: nextOrder,'''
)

with open(fp, 'w') as f:
    f.write(c)
print('1. /api/monitoring/route.ts updated')

# === 2. Update /api/columns/route.ts ===
fp2 = '/home/z/my-project/src/app/api/columns/route.ts'
with open(fp2, 'r') as f:
    c2 = f.read()

c2 = c2.replace(
    "import { NextRequest, NextResponse } from 'next/server';\nimport { db } from '@/lib/db';\nimport { requireAdmin } from '@/lib/auth';",
    "import { NextRequest, NextResponse } from 'next/server';\nimport { db } from '@/lib/db';\nimport { requireAdmin } from '@/lib/auth';\nimport { getProjectId } from '@/lib/project-context';"
)

c2 = c2.replace(
    'export async function GET() {',
    'export async function GET(request: NextRequest) {'
)

c2 = c2.replace(
    '''    const columns = await db.customColumn.findMany({
      orderBy: { order: 'asc' },
      include: { division: true },
    });''',
    '''    const projectId = getProjectId(request.url);
    const columns = await db.customColumn.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
      include: { division: true },
    });'''
)

c2 = c2.replace(
    '''    const { name, label, divisionId } = await request.json();

    const maxOrder = await db.customColumn.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const column = await db.customColumn.create({
      data: {
        name,
        label,
        divisionId: divisionId || null,
        order: (maxOrder?.order || 0) + 1,
      },
    });''',
    '''    const { name, label, divisionId } = await request.json();
    const projectId = getProjectId(request.url);

    const maxOrder = await db.customColumn.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const column = await db.customColumn.create({
      data: {
        projectId,
        name,
        label,
        divisionId: divisionId || null,
        order: (maxOrder?.order || 0) + 1,
      },
    });'''
)

# Also fix the column rename migration to filter by projectId
c2 = c2.replace(
    '''      const allRows = await db.monitoringRow.findMany({
        select: { id: true, customData: true },
      });''',
    '''      const allRows = await db.monitoringRow.findMany({
        where: { projectId: existing.projectId || 'default' },
        select: { id: true, customData: true },
      });'''
)

with open(fp2, 'w') as f:
    f.write(c2)
print('2. /api/columns/route.ts updated')

# === 3. Update /api/charts/route.ts ===
fp3 = '/home/z/my-project/src/app/api/charts/route.ts'
with open(fp3, 'r') as f:
    c3 = f.read()

c3 = c3.replace(
    "import { NextRequest, NextResponse } from 'next/server';\nimport { db } from '@/lib/db';\nimport { requireAuth } from '@/lib/auth';",
    "import { NextRequest, NextResponse } from 'next/server';\nimport { db } from '@/lib/db';\nimport { requireAuth } from '@/lib/auth';\nimport { getProjectId } from '@/lib/project-context';"
)

c3 = c3.replace(
    'export async function GET() {',
    'export async function GET(request: NextRequest) {'
)

c3 = c3.replace(
    '''    await requireAuth();
    const charts = await db.chartConfig.findMany({
      orderBy: { order: 'asc' },
    });''',
    '''    await requireAuth();
    const projectId = getProjectId(request.url);
    const charts = await db.chartConfig.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });'''
)

with open(fp3, 'w') as f:
    f.write(c3)
print('3. /api/charts/route.ts updated')

# === 4. Update /api/monitoring/clear/route.ts ===
fp4 = '/home/z/my-project/src/app/api/monitoring/clear/route.ts'
with open(fp4, 'r') as f:
    c4 = f.read()

c4 = c4.replace(
    "import { NextResponse } from 'next/server';\nimport { db } from '@/lib/db';\nimport { requireAuth } from '@/lib/auth';",
    "import { NextRequest, NextResponse } from 'next/server';\nimport { db } from '@/lib/db';\nimport { requireAuth } from '@/lib/auth';\nimport { getProjectId } from '@/lib/project-context';"
)

c4 = c4.replace(
    'export async function DELETE() {',
    'export async function DELETE(request: NextRequest) {'
)

c4 = c4.replace(
    '''    const rowCounts = await db.monitoringRow.count();
    const colCounts = await db.customColumn.count();

    await db.$transaction([
      db.monitoringRow.deleteMany(),
      db.customColumn.deleteMany(),
    ]);''',
    '''    const projectId = getProjectId(request.url);
    const rowCounts = await db.monitoringRow.count({ where: { projectId } });
    const colCounts = await db.customColumn.count({ where: { projectId } });

    await db.$transaction([
      db.monitoringRow.deleteMany({ where: { projectId } }),
      db.customColumn.deleteMany({ where: { projectId } }),
    ]);'''
)

with open(fp4, 'w') as f:
    f.write(c4)
print('4. /api/monitoring/clear/route.ts updated')

# === 5. Update /api/monitoring/import/route.ts ===
fp5 = '/home/z/my-project/src/app/api/monitoring/import/route.ts'
with open(fp5, 'r') as f:
    c5 = f.read()

c5 = c5.replace(
    "import { NextRequest, NextResponse } from 'next/server';\nimport { db } from '@/lib/db';\nimport { requireAuth } from '@/lib/auth';",
    "import { NextRequest, NextResponse } from 'next/server';\nimport { db } from '@/lib/db';\nimport { requireAuth } from '@/lib/auth';\nimport { getProjectId } from '@/lib/project-context';"
)

c5 = c5.replace(
    '''    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mode = formData.get('mode') as string || 'replace';''',
    '''    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mode = formData.get('mode') as string || 'replace';
    const projectId = (formData.get('projectId') as string) || getProjectId(request.url);'''
)

c5 = c5.replace(
    '''    if (mode === 'replace') {
      await db.monitoringRow.deleteMany();
      await db.customColumn.deleteMany();
    }''',
    '''    if (mode === 'replace') {
      await db.monitoringRow.deleteMany({ where: { projectId } });
      await db.customColumn.deleteMany({ where: { projectId } });
    }'''
)

c5 = c5.replace(
    '    const existingCustomCols = await db.customColumn.findMany();',
    '    const existingCustomCols = await db.customColumn.findMany({ where: { projectId } });'
)

c5 = c5.replace(
    '''    let startOrder = 1;
    if (mode === 'append') {
      const maxOrder = await db.monitoringRow.findFirst({ orderBy: { orderNum: 'desc' }, select: { orderNum: true } });
      startOrder = (maxOrder?.orderNum || 0) + 1;
    }''',
    '''    let startOrder = 1;
    if (mode === 'append') {
      const maxOrder = await db.monitoringRow.findFirst({ where: { projectId }, orderBy: { orderNum: 'desc' }, select: { orderNum: true } });
      startOrder = (maxOrder?.orderNum || 0) + 1;
    }'''
)

c5 = c5.replace(
    '''    const insertData = rows.map((row, idx) => {
      const data: any = {
        orderNum: startOrder + idx,''',
    '''    const insertData = rows.map((row, idx) => {
      const data: any = {
        projectId,
        orderNum: startOrder + idx,'''
)

with open(fp5, 'w') as f:
    f.write(c5)
print('5. /api/monitoring/import/route.ts updated')

# === 6. Update /api/route.ts (main data for dashboard) ===
fp6 = '/home/z/my-project/src/app/api/route.ts'
with open(fp6, 'r') as f:
    c6 = f.read()

c6 = c6.replace(
    "import { NextResponse } from 'next/server';\nimport { db } from '@/lib/db';",
    "import { NextRequest, NextResponse } from 'next/server';\nimport { db } from '@/lib/db';\nimport { getProjectId } from '@/lib/project-context';"
)

c6 = c6.replace(
    'export async function GET() {',
    'export async function GET(request: NextRequest) {'
)

# Replace the first findMany for rows
c6 = c6.replace(
    '    const rows = await db.monitoringRow.findMany({',
    '    const projectId = getProjectId(request.url);\n    const rows = await db.monitoringRow.findMany({\n      where: { projectId },'
)

with open(fp6, 'w') as f:
    f.write(c6)
print('6. /api/route.ts updated')

print('\nAll API routes updated with projectId filtering!')