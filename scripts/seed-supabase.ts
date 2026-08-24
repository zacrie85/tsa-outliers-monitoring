/**
 * Seed script for Supabase PostgreSQL
 * Usage: DATABASE_URL="postgresql://..." npx tsx scripts/seed-supabase.ts
 */
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as path from 'path';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function seed() {
  console.log('Connecting to database...');
  await prisma.$connect();
  console.log('Connected!');

  console.log('Seeding divisions...');
  const divisions = await Promise.all([
    prisma.division.upsert({ where: { name: 'TSA' }, update: {}, create: { name: 'TSA', color: '#3b82f6' } }),
    prisma.division.upsert({ where: { name: 'JLM' }, update: {}, create: { name: 'JLM', color: '#10b981' } }),
    prisma.division.upsert({ where: { name: 'AMT' }, update: {}, create: { name: 'AMT', color: '#f59e0b' } }),
    prisma.division.upsert({ where: { name: 'NOSS' }, update: {}, create: { name: 'NOSS', color: '#ef4444' } }),
    prisma.division.upsert({ where: { name: 'Konstruksi' }, update: {}, create: { name: 'Konstruksi', color: '#8b5cf6' } }),
  ]);

  console.log('Seeding users...');
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', name: 'Administrator', password: hashPassword('asrama33'), role: 'ADMIN' }
  });

  const editorUsers = [
    { username: 'tsa_editor', name: 'Editor TSA', divisionName: 'TSA' },
    { username: 'jlm_editor', name: 'Editor JLM', divisionName: 'JLM' },
    { username: 'amt_editor', name: 'Editor AMT', divisionName: 'AMT' },
    { username: 'noss_editor', name: 'Editor NOSS', divisionName: 'NOSS' },
    { username: 'konstruksi_editor', name: 'Editor Konstruksi', divisionName: 'Konstruksi' },
  ];

  for (const eu of editorUsers) {
    const div = divisions.find(d => d.name === eu.divisionName)!;
    await prisma.user.upsert({
      where: { username: eu.username },
      update: {},
      create: { username: eu.username, name: eu.name, password: hashPassword('password123'), role: 'EDITOR', divisionId: div.id }
    });
  }

  await prisma.user.upsert({
    where: { username: 'viewer' },
    update: {},
    create: { username: 'viewer', name: 'Viewer', password: hashPassword('viewer123'), role: 'VIEWER' }
  });

  // Import Excel data
  const excelPaths = [
    path.join(process.cwd(), 'upload/138 LIST OUTLIERS TSA 11 AGUSTUS 2026 (1).xlsx'),
    path.join(process.cwd(), '../upload/138 LIST OUTLIERS TSA 11 AGUSTUS 2026 (1).xlsx'),
  ];

  let excelPath = excelPaths.find(p => {
    try { require('fs').accessSync(p); return true; } catch { return false; }
  });

  if (excelPath) {
    console.log(`Importing Excel data from ${excelPath}...`);
    const workbook = XLSX.readFile(excelPath);
    const ws = workbook.Sheets['OUTLIERS TSA'];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

    let count = 0;
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0] || r[0] === null) continue;
      const orderNum = typeof r[0] === 'number' ? r[0] : parseInt(String(r[0])) || (i - 1);
      const homepass = typeof r[9] === 'number' ? r[9] : parseInt(String(r[9])) || 0;
      const odp = typeof r[10] === 'number' ? r[10] : parseInt(String(r[10])) || 0;
      const indexNum = typeof r[8] === 'number' ? r[8] : parseInt(String(r[8])) || 0;

      await prisma.monitoringRow.create({
        data: {
          orderNum, categoryBak: String(r[1] || ''), provinsi: String(r[2] || ''),
          kabupaten: String(r[3] || ''), kecamatan: String(r[4] || ''),
          kelurahan: String(r[5] || ''), kelRwSiteName: String(r[6] || ''),
          desaPerum: String(r[7] || ''), indexNum, homepass, odp,
          remarksTsa: String(r[11] || ''), klasifikasiTsa: String(r[12] || ''),
          picTsa: String(r[13] || ''), remarksJlm: String(r[14] || ''),
          customData: '{}',
        }
      });
      count++;
    }
    console.log(`Imported ${count} rows from Excel`);
  } else {
    console.log('Excel file not found. Skipping data import.');
    console.log('You can import data manually via the app admin panel.');
  }

  console.log('Creating chart configs...');
  const chartTypes = ['bar', 'line', 'pie', 'area', 'bar', 'line', 'pie', 'bar'];
  const existingCharts = await prisma.chartConfig.count();
  if (existingCharts === 0) {
    for (let i = 0; i < 8; i++) {
      await prisma.chartConfig.create({
        data: { title: `Chart ${i + 1}`, chartType: chartTypes[i], config: JSON.stringify({}), order: i }
      });
    }
    console.log('Created 8 chart configs');
  }

  console.log('\nSeeding complete!');
  await prisma.$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
