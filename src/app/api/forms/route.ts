import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getProjectId } from '@/lib/project-context';

// GET /api/forms — list forms for a project (admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    }
    const projectId = getProjectId(request.url);
    const forms = await db.formConfig.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, description: true, fields: true,
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
    const { title, description, fields, projectId } = body;

    if (!title || !fields || !Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json({ error: 'Title dan fields wajib diisi' }, { status: 400 });
    }

    const pid = projectId || getProjectId(request.url);

    const form = await db.formConfig.create({
      data: {
        projectId: pid,
        title: title.trim(),
        description: (description || '').trim(),
        fields: JSON.stringify(fields),
      },
    });

    return NextResponse.json({ success: true, form });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error('Form create error:', error);
    return NextResponse.json({ error: 'Gagal membuat form: ' + (error.message || 'Unknown') }, { status: 500 });
  }
}
