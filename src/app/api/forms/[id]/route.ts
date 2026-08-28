import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/forms/[id] — get form config (PUBLIC, no auth)
// If ?references=true, also return distinct values for the reference column
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const withReferences = url.searchParams.get('references') === 'true';

    const form = await db.formConfig.findUnique({
      where: { id },
      select: {
        id: true, title: true, description: true, fields: true,
        referenceColumn: true, referenceLabel: true, projectId: true,
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

    let references: Array<{ value: string; rowId: string }> = [];
    if (withReferences && form.referenceColumn) {
      const colKey = form.referenceColumn;
      // Determine if it's a base field or custom column
      const baseFields = ['categoryBak','provinsi','kabupaten','kecamatan','kelurahan','kelRwSiteName','desaPerum','indexNum','homepass','odp','remarksTsa','klasifikasiTsa','picTsa','remarksJlm'];

      if (baseFields.includes(colKey)) {
        // Base field - query directly
        const rows = await db.monitoringRow.findMany({
          where: { projectId: form.projectId },
          select: { id: true, [colKey]: true },
          orderBy: { orderNum: 'asc' },
        });
        references = rows
          .filter(r => {
            const v = String((r as any)[colKey] ?? '').trim();
            return v !== '' && v !== '0';
          })
          .map(r => ({ value: String((r as any)[colKey]), rowId: r.id }));
      } else {
        // Custom column - parse customData JSON
        const rows = await db.monitoringRow.findMany({
          where: { projectId: form.projectId },
          select: { id: true, customData: true },
          orderBy: { orderNum: 'asc' },
        });
        references = [];
        const seen = new Set<string>();
        for (const r of rows) {
          try {
            const cd = JSON.parse(r.customData || '{}');
            const v = String(cd[colKey] ?? '').trim();
            if (v && !seen.has(v)) {
              seen.add(v);
              references.push({ value: v, rowId: r.id });
            }
          } catch {}
        }
      }
    }

    return NextResponse.json({ form, references });
  } catch (error: any) {
    console.error('Form get error:', error);
    return NextResponse.json({ error: 'Gagal memuat form' }, { status: 500 });
  }
}

// PATCH /api/forms/[id] — toggle active / update (admin)
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
