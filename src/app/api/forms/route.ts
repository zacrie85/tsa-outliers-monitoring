import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getProjectId } from '@/lib/project-context';

// Ensure FormConfig table exists (idempotent)
async function ensureFormConfigTable() {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "FormConfig" (
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
      );
    `);
    // Ensure referenceColumn & referenceLabel columns exist
    await db.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'FormConfig' AND column_name = 'referenceColumn') THEN
          ALTER TABLE "FormConfig" ADD COLUMN "referenceColumn" TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'FormConfig' AND column_name = 'referenceLabel') THEN
          ALTER TABLE "FormConfig" ADD COLUMN "referenceLabel" TEXT;
        END IF;
      END $$;
    `);
  } catch (e: any) {
    console.error('ensureFormConfigTable error:', e.message);
  }
}

// GET /api/forms — list forms for a project (admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    }
    await ensureFormConfigTable();
    const projectId = getProjectId(request.url);
    const forms = await db.formConfig.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, description: true, fields: true,
        referenceColumn: true, referenceLabel: true,
        isActive: true, submissionCount: true, createdAt: true, updatedAt: true,
      },
    });
    return NextResponse.json({ forms });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error('Forms list error:', error);
    return NextResponse.json({ forms: [] });
  }
}

// POST /api/forms — create a new form (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Hanya admin yang bisa buat form' }, { status: 403 });
    }
    const body = await request.json();
    const { title, description, fields, projectId, referenceColumn, referenceLabel } = body;

    if (!title || !fields || !Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json({ error: 'Title dan fields wajib diisi' }, { status: 400 });
    }

    const pid = projectId || getProjectId(request.url);

    // Ensure table exists before creating
    await ensureFormConfigTable();

    const form = await db.formConfig.create({
      data: {
        projectId: pid,
        title: title.trim(),
        description: (description || '').trim(),
        fields: JSON.stringify(fields),
        referenceColumn: referenceColumn || null,
        referenceLabel: referenceLabel || null,
      },
    });

    return NextResponse.json({ success: true, form });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error('Form create error:', error);
    return NextResponse.json({ error: 'Gagal membuat form: ' + (error.message || 'Unknown') }, { status: 500 });
  }
}
