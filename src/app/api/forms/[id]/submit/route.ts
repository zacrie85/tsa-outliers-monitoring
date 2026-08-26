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
      select: { id: true, fields: true, isActive: true, projectId: true },
    });

    if (!form) {
      return NextResponse.json({ error: 'Form tidak ditemukan' }, { status: 404 });
    }
    if (!form.isActive) {
      return NextResponse.json({ error: 'Form sudah ditutup' }, { status: 410 });
    }

    const body = await request.json();
    const data = body.data || {};
    const fields: Array<{ key: string; label: string; type: string; required: boolean }> = JSON.parse(form.fields);

    // Validate required fields
    for (const field of fields) {
      if (field.required) {
        const val = (data[field.key] || '').trim();
        if (!val) {
          return NextResponse.json({ error: `Field "${field.label}" wajib diisi` }, { status: 400 });
        }
      }
    }

    // Get next orderNum
    const maxOrder = await db.monitoringRow.findFirst({
      where: { projectId: form.projectId },
      orderBy: { orderNum: 'desc' },
      select: { orderNum: true },
    });
    const startOrder = (maxOrder?.orderNum || 0) + 1;

    // Build the row data
    const BASE_FIELDS = ['categoryBak', 'provinsi', 'kabupaten', 'kecamatan', 'kelurahan', 'kelRwSiteName', 'desaPerum'];
    const NUM_FIELDS = ['indexNum', 'homepass', 'odp'];
    const REMARKS_FIELDS = ['remarksTsa', 'klasifikasiTsa', 'picTsa', 'remarksJlm'];

    const rowData: any = {
      projectId: form.projectId,
      orderNum: startOrder,
    };

    // Set defaults for all base fields
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
        // Custom column
        customData[field.key] = val;
      }
    }

    rowData.customData = JSON.stringify(customData);

    // Insert the row
    await db.monitoringRow.create({ data: rowData });

    // Increment submission count
    await db.formConfig.update({
      where: { id },
      data: { submissionCount: { increment: 1 } },
    });

    return NextResponse.json({ success: true, message: 'Data berhasil disubmit!' });
  } catch (error: any) {
    console.error('Form submit error:', error);
    return NextResponse.json({ error: 'Gagal submit: ' + (error.message || 'Unknown') }, { status: 500 });
  }
}
