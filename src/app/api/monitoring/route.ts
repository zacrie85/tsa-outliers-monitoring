import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getProjectId } from '@/lib/project-context';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const projectId = getProjectId(request.url);
    const rows = await db.monitoringRow.findMany({
      where: { projectId },
      orderBy: { orderNum: 'asc' },
    });
    return NextResponse.json({ rows });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Hanya admin yang bisa menambah baris' }, { status: 403 });
    }
    const body = await request.json();
    const projectId = getProjectId(request.url);
    const maxOrder = await db.monitoringRow.findFirst({
      where: { projectId },
      orderBy: { orderNum: 'desc' },
      select: { orderNum: true },
    });
    const nextOrder = (maxOrder?.orderNum || 0) + 1;

    const row = await db.monitoringRow.create({
      data: {
        projectId,
        orderNum: nextOrder,
        categoryBak: body.categoryBak || '',
        provinsi: body.provinsi || '',
        kabupaten: body.kabupaten || '',
        kecamatan: body.kecamatan || '',
        kelurahan: body.kelurahan || '',
        kelRwSiteName: body.kelRwSiteName || '',
        desaPerum: body.desaPerum || '',
        indexNum: body.indexNum || 0,
        homepass: body.homepass || 0,
        odp: body.odp || 0,
        remarksTsa: body.remarksTsa || '',
        klasifikasiTsa: body.klasifikasiTsa || '',
        picTsa: body.picTsa || '',
        remarksJlm: body.remarksJlm || '',
        customData: body.customData || '{}',
      },
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'ROW_ADD',
        tableName: 'MonitoringRow',
        rowId: row.id,
        newValue: JSON.stringify(body),
      },
    });

    return NextResponse.json({ row });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal menambah baris' }, { status: 500 });
  }
}