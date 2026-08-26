import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/forms/[id] — get form config (PUBLIC, no auth)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const form = await db.formConfig.findUnique({
      where: { id },
      select: {
        id: true, title: true, description: true, fields: true,
        isActive: true, submissionCount: true,
        project: { select: { name: true, color: true } },
      },
    });
    if (!form) {
      return NextResponse.json({ error: 'Form tidak ditemukan' }, { status: 404 });
    }
    if (!form.isActive) {
      return NextResponse.json({ error: 'Form sudah ditutup' }, { status: 410 });
    }
    return NextResponse.json({ form });
  } catch (error: any) {
    console.error('Form get error:', error);
    return NextResponse.json({ error: 'Gagal memuat form' }, { status: 500 });
  }
}

// PATCH /api/forms/[id] — toggle active / update title (admin)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    const form = await db.formConfig.update({
      where: { id },
      data: body,
    });
    return NextResponse.json({ success: true, form });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error('Form update error:', error);
    return NextResponse.json({ error: 'Gagal update form' }, { status: 500 });
  }
}

// DELETE /api/forms/[id] — delete form (admin)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    }
    const { id } = await params;
    await db.formConfig.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error('Form delete error:', error);
    return NextResponse.json({ error: 'Gagal hapus form' }, { status: 500 });
  }
}
