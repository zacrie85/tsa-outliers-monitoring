import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/forms/[id]/submit — PUBLIC form submission (no auth)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get form config
    const form = await db.formConfig.findUnique({
      where: { id },
      select: { id: true, fields: true, isActive: true, projectId: true, referenceColumn: true },
    });

    if (!form) {
      return NextResponse.json({ error: 'Form tidak ditemukan' }, { status: 404 });
    }
    if (!form.isActive) {
      return NextResponse.json({ error: 'Form sudah ditutup' }, { status: 410 });
    }

    const body = await request.json();
    const data = body.data || {};
    const referenceRowId = body.referenceRowId || null;
    const fields: Array<{ key: string; label: string; type: string; required: boolean }> = JSON.parse(form.fields);

    // If reference mode, rowId is required
    if (form.referenceColumn && !referenceRowId) {
      return NextResponse.json({ error: 'Pilih baris data yang ingin diupdate' }, { status: 400 });
    }

    // Validate required fields
    for (const field of fields) {
      if (field.required) {
        const val = (data[field.key] || '').trim();
        if (!val) {
          return NextResponse.json({ error: `Field "${field.label}" wajib diisi` }, { status: 400 });
        }
      }
    }

    // ALL field values go into customData — no more base column separation
    const customData: Record<string, string> = {};
    for (const field of fields) {
      customData[field.key] = String(data[field.key] || '').trim();
    }

    if (form.referenceColumn && referenceRowId) {
      // === UPDATE EXISTING ROW ===
      const existingRow = await db.monitoringRow.findUnique({
        where: { id: referenceRowId },
      });
      if (!existingRow) {
        return NextResponse.json({ error: 'Baris data tidak ditemukan' }, { status: 404 });
      }

      const existingCustom = JSON.parse(existingRow.customData || '{}');
      await db.monitoringRow.update({
        where: { id: referenceRowId },
        data: {
          customData: JSON.stringify({ ...existingCustom, ...customData }),
          updatedAt: new Date(),
        },
      });
    } else {
      // === CREATE NEW ROW ===
      const maxOrder = await db.monitoringRow.findFirst({
        where: { projectId: form.projectId },
        orderBy: { orderNum: 'desc' },
        select: { orderNum: true },
      });
      const startOrder = (maxOrder?.orderNum || 0) + 1;

      await db.monitoringRow.create({
        data: {
          projectId: form.projectId,
          orderNum: startOrder,
          customData: JSON.stringify(customData),
        },
      });
    }

    // Increment submission count
    await db.formConfig.update({
      where: { id },
      data: { submissionCount: { increment: 1 } },
    });

    return NextResponse.json({ success: true, message: form.referenceColumn ? 'Data berhasil diupdate!' : 'Data berhasil disubmit!' });
  } catch (error: any) {
    console.error('Form submit error:', error);
    return NextResponse.json({ error: 'Gagal submit: ' + (error.message || 'Unknown') }, { status: 500 });
  }
}
