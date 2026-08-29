import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// Ensure a column exists on a table (PostgreSQL only)
async function ensureColumn(table: string, column: string, type: string, defaultValue?: string) {
  try {
    const result: any = await db.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = '${table}' AND column_name = '${column}'
    `);
    if (Array.isArray(result) && result.length > 0) return; // already exists
    const defaultClause = defaultValue !== undefined ? ` DEFAULT ${defaultValue}` : '';
    await db.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}${defaultClause}`);
    console.log(`Migration: Added ${table}.${column} ${type}`);
  } catch (e: any) {
    console.warn(`Migration skip ${table}.${column}: ${e.message}`);
  }
}

// Ensure Project table exists
async function ensureProjectTable() {
  try {
    await db.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'Project'
    `);
  } catch {
    // Table doesn't exist, create it via raw SQL
    await db.$executeRawUnsafe(`
      CREATE TABLE "Project" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "color" TEXT NOT NULL DEFAULT '#64b5f6',
        "columnOrder" TEXT NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Migration: Created Project table');
  }
}

// Ensure FormConfig table exists
async function ensureFormConfigTable() {
  try {
    await db.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'FormConfig'
    `);
  } catch {
    await db.$executeRawUnsafe(`
      CREATE TABLE "FormConfig" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "projectId" TEXT,
        "title" TEXT NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "fields" TEXT NOT NULL DEFAULT '[]',
        "referenceColumn" TEXT,
        "referenceLabel" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "submissionCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Migration: Created FormConfig table');
  }
}

// Auto-setup: ensures database schema is up to date and default project exists.
// Safe to call multiple times (idempotent)
export async function POST() {
  try {
    await requireAuth();
    const results: string[] = [];

    // ═══ 0. Schema Migration: ensure all columns/tables exist ═══
    try {
      await ensureProjectTable();

      // Project columns that might be missing
      await ensureColumn('Project', 'columnOrder', 'TEXT', "'[]'");
      await ensureColumn('Project', 'description', 'TEXT');
      await ensureColumn('Project', 'color', 'TEXT', "'#64b5f6'");

      // projectId on existing tables (added for multi-project feature)
      await ensureColumn('MonitoringRow', 'projectId', 'TEXT');
      await ensureColumn('CustomColumn', 'projectId', 'TEXT');
      await ensureColumn('ChartConfig', 'projectId', 'TEXT');

      // FormConfig table and columns
      await ensureFormConfigTable();
      await ensureColumn('FormConfig', 'referenceColumn', 'TEXT');
      await ensureColumn('FormConfig', 'referenceLabel', 'TEXT');
      await ensureColumn('FormConfig', 'isActive', 'BOOLEAN', 'true');
      await ensureColumn('FormConfig', 'submissionCount', 'INTEGER', '0');
      await ensureColumn('FormConfig', 'projectId', 'TEXT');

      // User columns that might be missing
      await ensureColumn('User', 'divisionId', 'TEXT');

      // CustomColumn columns that might be missing
      await ensureColumn('CustomColumn', 'isLocked', 'BOOLEAN', 'false');

      results.push('Schema migration complete');
    } catch (e: any) {
      results.push(`Schema migration warning: ${e.message}`);
    }

    // ═══ 1. Ensure default project exists ═══
    try {
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
        results.push(`Projects exist (${projectCount})`);
      }
    } catch (e: any) {
      results.push(`Project check: ${e.message}`);
    }

    // ═══ 2. Backfill: set projectId = 'default' for rows/columns with NULL projectId ═══
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

    // ═══ 3. Migrate customData keys: CUID → column name (if needed) ═══
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
