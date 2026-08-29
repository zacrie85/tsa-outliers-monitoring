import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/projects — list all projects
export async function GET() {
  try {
    await requireAuth();
    let projects: any[];
    try {
      projects = await db.project.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
          _count: { select: { rows: true, columns: true } },
        },
      });
    } catch (dbError: any) {
      // Table doesn't exist yet — return empty so UI doesn't crash
      console.warn('Project table not ready:', dbError.message);
      return NextResponse.json({ projects: [] });
    }
    return NextResponse.json({ projects });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error(error);
    return NextResponse.json({ projects: [] });
  }
}

// POST /api/projects — create new project
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { name, description, color } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama proyek diperlukan' }, { status: 400 });
    }

    let project;
    try {
      project = await db.project.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          color: color || '#66bb6a',
        },
      });
    } catch (createErr: any) {
      // If columnOrder is missing, run migration and retry
      if (createErr.message?.includes('columnOrder')) {
        console.warn('Project create failed (missing column), running migration...');
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
          project = await db.project.create({
            data: {
              name: name.trim(),
              description: description?.trim() || null,
              color: color || '#66bb6a',
            },
          });
        } catch (retryErr: any) {
          console.error('Project create retry failed:', retryErr);
          return NextResponse.json({ error: 'Gagal membuat proyek: ' + retryErr.message }, { status: 500 });
        }
      } else {
        throw createErr;
      }
    }
    try {
      await db.auditLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'PROJECT_CREATE',
          tableName: 'Project',
          rowId: project.id,
          colLabel: project.name,
          newValue: JSON.stringify({ name, description, color }),
        },
      });
    } catch {}

    return NextResponse.json({ project });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal membuat proyek' }, { status: 500 });
  }
}

// PUT /api/projects — rename/update project
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { id, name, description, color } = await request.json();

    if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });

    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Proyek tidak ditemukan' }, { status: 404 });

    const project = await db.project.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(color ? { color } : {}),
      },
    });

    try {
      await db.auditLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'PROJECT_UPDATE',
          tableName: 'Project',
          rowId: id,
          colLabel: existing.name,
          oldValue: JSON.stringify({ name: existing.name, description: existing.description, color: existing.color }),
          newValue: JSON.stringify({ name: name || existing.name, description, color }),
        },
      });
    } catch {}

    return NextResponse.json({ project });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengubah proyek' }, { status: 500 });
  }
}

// DELETE /api/projects?id=xxx — delete project and all its data
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });
    if (id === 'default') return NextResponse.json({ error: 'Proyek default tidak bisa dihapus' }, { status: 403 });

    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Proyek tidak ditemukan' }, { status: 404 });

    await db.project.delete({ where: { id } });

    try {
      await db.auditLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'PROJECT_DELETE',
          tableName: 'Project',
          rowId: id,
          colLabel: existing.name,
          oldValue: JSON.stringify(existing),
        },
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal menghapus proyek' }, { status: 500 });
  }
}
