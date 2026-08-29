import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getProjectId } from '@/lib/project-context';

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Hanya admin yang bisa menghapus data' }, { status: 403 });
    }

    const projectId = getProjectId(request.url);
    const rowCounts = await db.monitoringRow.count({ where: { projectId } });
    const colCounts = await db.customColumn.count({ where: { projectId } });

    // Delete rows and custom columns in a transaction
    await db.$transaction([
      db.monitoringRow.deleteMany({ where: { projectId } }),
      db.customColumn.deleteMany({ where: { projectId } }),
    ]);

    // Reset columnOrder — with fallback if column doesn't exist yet
    try {
      await db.project.update({
        where: { id: projectId },
        data: { columnOrder: '[]' },
      });
    } catch (e: any) {
      // columnOrder column might not exist — try adding it via raw SQL
      console.warn('columnOrder reset failed, attempting migration:', e.message);
      try {
        await db.$executeRawUnsafe(`
          DO $$ BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'Project' AND column_name = 'columnOrder'
            ) THEN
              ALTER TABLE "Project" ADD COLUMN "columnOrder" TEXT NOT NULL DEFAULT '[]';
            END IF;
          END $$;
        `);
        await db.project.update({
          where: { id: projectId },
          data: { columnOrder: '[]' },
        });
      } catch (e2: any) {
        console.warn('columnOrder migration also failed:', e2.message);
      }
    }

    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'CLEAR_ALL',
        tableName: 'MonitoringRow + CustomColumn',
        newValue: JSON.stringify({
          deletedRows: rowCounts,
          deletedColumns: colCounts,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      deletedRows: rowCounts,
      deletedColumns: colCounts,
      message: `Berhasil menghapus ${rowCounts} baris data dan ${colCounts} kolom kustom`,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }
    console.error('Clear data error:', error);
    return NextResponse.json({ error: 'Gagal menghapus data: ' + (error.message || 'Unknown error') }, { status: 500 });
  }
}
