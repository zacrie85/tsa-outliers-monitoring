import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// Auto-setup: creates Project table, adds projectId columns, seeds default project
// Safe to call multiple times (idempotent)
export async function POST() {
  try {
    await requireAuth();
    const results: string[] = [];

    // 1. Create Project table if not exists
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Project" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "color" TEXT NOT NULL DEFAULT '#64b5f6',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      results.push('Project table created/verified');
    } catch (e: any) {
      results.push(`Project table: ${e.message}`);
    }

    // 2. Add projectId to MonitoringRow if not exists
    try {
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'MonitoringRow' AND column_name = 'projectId') THEN
            ALTER TABLE "MonitoringRow" ADD COLUMN "projectId" TEXT;
          END IF;
        END $$;
      `);
      results.push('MonitoringRow.projectId added/verified');
    } catch (e: any) {
      results.push(`MonitoringRow.projectId: ${e.message}`);
    }

    // 3. Add projectId to CustomColumn if not exists
    try {
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CustomColumn' AND column_name = 'projectId') THEN
            ALTER TABLE "CustomColumn" ADD COLUMN "projectId" TEXT;
          END IF;
        END $$;
      `);
      results.push('CustomColumn.projectId added/verified');
    } catch (e: any) {
      results.push(`CustomColumn.projectId: ${e.message}`);
    }

    // 4. Add projectId to ChartConfig if not exists
    try {
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ChartConfig' AND column_name = 'projectId') THEN
            ALTER TABLE "ChartConfig" ADD COLUMN "projectId" TEXT;
          END IF;
        END $$;
      `);
      results.push('ChartConfig.projectId added/verified');
    } catch (e: any) {
      results.push(`ChartConfig.projectId: ${e.message}`);
    }

    // 5. Seed default project if none exists
    try {
      const count = await db.project.count();
      if (count === 0) {
        await db.project.create({
          data: {
            id: 'default',
            name: 'TSA Outliers Monitoring',
            description: 'Proyek default - data TSA yang sudah ada',
            color: '#64b5f6',
          },
        });
        results.push('Default project seeded');
      } else {
        results.push('Projects already exist');
      }
    } catch (e: any) {
      try {
        await db.$queryRawUnsafe(`
          INSERT INTO "Project" ("id", "name", "description", "color", "createdAt", "updatedAt")
          VALUES ('default', 'TSA Outliers Monitoring', 'Proyek default - data TSA yang sudah ada', '#64b5f6', NOW(), NOW())
          ON CONFLICT DO NOTHING;
        `);
        results.push('Default project seeded via raw SQL');
      } catch (e2: any) {
        results.push(`Seed: ${e2.message}`);
      }
    }

    // 6. Backfill: set projectId = 'default' for any rows that have NULL projectId
    try {
      await db.$executeRawUnsafe(`UPDATE "MonitoringRow" SET "projectId" = 'default' WHERE "projectId" IS NULL`);
      results.push('MonitoringRow backfilled');
    } catch (e: any) {
      results.push(`MonitoringRow backfill: ${e.message}`);
    }

    try {
      await db.$executeRawUnsafe(`UPDATE "CustomColumn" SET "projectId" = 'default' WHERE "projectId" IS NULL`);
      results.push('CustomColumn backfilled');
    } catch (e: any) {
      results.push(`CustomColumn backfill: ${e.message}`);
    }

    try {
      await db.$executeRawUnsafe(`UPDATE "ChartConfig" SET "projectId" = 'default' WHERE "projectId" IS NULL`);
      results.push('ChartConfig backfilled');
    } catch (e: any) {
      results.push(`ChartConfig backfill: ${e.message}`);
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error('Setup error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Unknown' }, { status: 500 });
  }
}
