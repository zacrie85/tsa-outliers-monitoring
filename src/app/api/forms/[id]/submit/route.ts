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

    const BASE_FIELDS = ['categoryBak', 'provinsi', 'kabupaten', 'kecamatan', 'kelurahan', 'kelRwSiteName', 'desaPerum'];
    const NUM_FIELDS = ['indexNum', 'homepass', 'odp'];
    const REMARKS_FIELDS = ['remarksTsa', 'klasifikasiTsa', 'picTsa', 'remarksJlm'];

    if (form.referenceColumn && referenceRowId) {
      // === UPDATE EXISTING ROW ===
      const existingRow = await db.monitoringRow.findUnique({
        where: { id: referenceRowId },
      });
      if (!existingRow) {
        return NextResponse.json({ error: 'Baris data tidak ditemukan' }, { status: 404 });
      }

      const updateData: any = { updatedAt: new Date() };
      const customUpdates: Record<string, string> = {};
      const existingCustom = JSON.parse(existingRow.customData || '{}');

      for (const field of fields) {
        const val = String(data[field.key] || '').trim();
        if (BASE_FIELDS.includes(field.key)) {
          updateData[field.key] = val;
        } else if (NUM_FIELDS.includes(field.key)) {
          updateData[field.key] = parseInt(val) || 0;
        } else if (REMARKS_FIELDS.includes(field.key)) {
          updateData[field.key] = val;
        } else {
          customUpdates[field.key] = val;
        }
      }

      if (Object.keys(customUpdates).length > 0) {
        updateData.customData = JSON.stringify({ ...existingCustom, ...customUpdates });
      }

      await db.monitoringRow.update({
        where: { id: referenceRowId },
        data: updateData,
      });
    } else {
      // === CREATE NEW ROW ===
      const maxOrder = await db.monitoringRow.findFirst({
        where: { projectId: form.projectId },
        orderBy: { orderNum: 'desc' },
        select: { orderNum: true },
      });
      const startOrder = (maxOrder?.orderNum || 0) + 1;

      const rowData: any = { projectId: form.projectId, orderNum: startOrder };
      for (const f of BASE_FIELDS) rowData[f] = '';
      for (const f of NUM_FIELDS) rowData[f] = 0;
      for (const f of REMARKS_FIELDS) rowData[f] = '';

      const customData: Record<string, string> = {};

      for (const field of fields) {
        const val = String(data[field.key] || '').trim();
        if (BASE_FIELDS.includes(field.key)) {
          rowData[field.key] = val;
        } else if (NUM_FIELDS.includes(field.key)) {
          rowData[field.key] = parseInt(val) || 0;
        } else if (REMARKS_FIELDS.includes(field.key)) {
          rowData[field.key] = val;
        } else {
          customData[field.key] = val;
        }
      }

      rowData.customData = JSON.stringify(customData);
      await db.monitoringRow.create({ data: rowData });
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
