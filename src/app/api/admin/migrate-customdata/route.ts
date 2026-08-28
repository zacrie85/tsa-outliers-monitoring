import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

/**
 * One-time migration: Convert customData keys from CUID (col.id) to column name (col.name).
 * 
 * Previously, the import route stored custom column values with the column's CUID as key:
 *   { "clx1abc234": "Ahmad sopian" }
 * But the app (cell editor, pivot, forms) expects the column name as key:
 *   { "pic_permit": "Ahmad sopian" }
 * 
 * This endpoint reads all CustomColumns, builds an id→name map, then updates
 * all MonitoringRow.customData entries that have CUID keys.
 */
export async function POST() {
  try {
    await requireAdmin();

    // Step 1: Build id→name map
    const columns = await db.customColumn.findMany({
      select: { id: true, name: true, label: true },
    });

    if (columns.length === 0) {
      return NextResponse.json({ message: 'No custom columns found. Nothing to migrate.', updated: 0 });
    }

    const idToName: Record<string, string> = {};
    for (const col of columns) {
      idToName[col.id] = col.name;
    }

    // Step 2: Fetch all rows with non-empty customData
    const rows = await db.monitoringRow.findMany({
      select: { id: true, customData: true },
    });

    // Step 3: Process each row
    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const data = JSON.parse(row.customData || '{}');
        if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
          unchanged++;
          continue;
        }

        let needsUpdate = false;
        const newData: Record<string, string> = {};

        for (const [key, value] of Object.entries(data)) {
          if (key in idToName) {
            const newKey = idToName[key];
            if (newKey !== key) {
              needsUpdate = true;
              // If name key already exists, keep non-empty value
              if (newKey in newData && newData[newKey]) {
                continue;
              }
              newData[newKey] = String(value ?? '');
            } else {
              newData[key] = String(value ?? '');
            }
          } else {
            newData[key] = String(value ?? '');
          }
        }

        if (needsUpdate) {
          await db.monitoringRow.update({
            where: { id: row.id },
            data: { customData: JSON.stringify(newData) },
          });
          updated++;
        } else {
          unchanged++;
        }
      } catch {
        errors++;
      }
    }

    return NextResponse.json({
      message: `Migration complete: ${updated} updated, ${unchanged} unchanged, ${errors} errors`,
      totalColumns: columns.length,
      totalRows: rows.length,
      updated,
      unchanged,
      errors,
      columnMap: Object.fromEntries(columns.map(c => [c.id, `${c.name} (${c.label})`])),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    console.error('Migration error:', error);
    return NextResponse.json({ error: error.message || 'Migration failed' }, { status: 500 });
  }
}
