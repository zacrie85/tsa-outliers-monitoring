import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// Auto-setup: ensures default project exists with correct schema.
// Safe to call multiple times (idempotent)
export async function POST() {
  try {
    await requireAuth();
    const results: string[] = [];

    // 1. Ensure default project exists
    const projectCount = await db.project.count();
    if (projectCount === 0) {
      await db.project.create({
        data: {
          id: 'default',
          name: 'TSA Outliers Monitoring',
          description: 'Proyek default',
          color: '#64b5f6',
          columnOrder: '[]',
        },
      });
      results.push('Default project created');
    } else {
      results.push(`Projects already exist (${projectCount})`);
    }

    // 2. Backfill: set projectId = 'default' for any rows/columns with NULL projectId
    try {
      const result = await db.monitoringRow.updateMany({
        where: { projectId: null },
        data: { projectId: 'default' },
      });
      if (result.count > 0) results.push(`Backfilled ${result.count} rows with projectId`);
    } catch { /* skip */ }

    try {
      const result = await db.customColumn.updateMany({
        where: { projectId: null },
        data: { projectId: 'default' },
      });
      if (result.count > 0) results.push(`Backfilled ${result.count} columns with projectId`);
    } catch { /* skip */ }

    try {
      const result = await db.chartConfig.updateMany({
        where: { projectId: null },
        data: { projectId: 'default' },
      });
      if (result.count > 0) results.push(`Backfilled ${result.count} charts with projectId`);
    } catch { /* skip */ }

    // 3. Migrate customData keys: CUID → column name (if needed)
    try {
      const columns = await db.customColumn.findMany({ select: { id: true, name: true } });
      if (columns.length > 0) {
        const idToName: Record<string, string> = {};
        for (const col of columns) idToName[col.id] = col.name;

        const rows = await db.monitoringRow.findMany({
          select: { id: true, customData: true },
        });
        let migrated = 0;
        for (const row of rows) {
          try {
            const data = JSON.parse(row.customData || '{}');
            if (!data || typeof data !== 'object') continue;
            let needsUpdate = false;
            const newData: Record<string, string> = {};
            for (const [key, value] of Object.entries(data)) {
              if (key in idToName) {
                const newKey = idToName[key];
                if (newKey !== key) {
                  needsUpdate = true;
                  if (!(newKey in newData && newData[newKey])) newData[newKey] = String(value ?? '');
                } else {
                  newData[key] = String(value ?? '');
                }
              } else {
                newData[key] = String(value ?? '');
              }
            }
            if (needsUpdate) {
              await db.monitoringRow.update({ where: { id: row.id }, data: { customData: JSON.stringify(newData) } });
              migrated++;
            }
          } catch { /* skip row */ }
        }
        results.push(`customData migration: ${migrated} rows updated`);
      }
    } catch (e: any) {
      results.push(`customData migration: ${e.message}`);
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error('Setup error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Unknown' }, { status: 500 });
  }
}
