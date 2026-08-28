/**
 * Migration script: Move data from base columns to customData
 * Create default Project and CustomColumn records
 * Fix null projectId on all rows
 *
 * Run: node scripts/migrate-base-to-custom.js
 */
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

// The 14 original TSA base columns in their original display order
const BASE_COL_DEFS = [
  { key: 'categoryBak', label: 'Category BAK' },
  { key: 'provinsi', label: 'Provinsi' },
  { key: 'kabupaten', label: 'Kabupaten' },
  { key: 'kecamatan', label: 'Kecamatan' },
  { key: 'kelurahan', label: 'Kelurahan' },
  { key: 'kelRwSiteName', label: 'Kel RW/Site Name' },
  { key: 'desaPerum', label: 'Desa/Perum' },
  { key: 'indexNum', label: 'Index' },
  { key: 'homepass', label: 'Homepass' },
  { key: 'odp', label: 'ODP' },
  { key: 'remarksTsa', label: 'Remarks TSA' },
  { key: 'klasifikasiTsa', label: 'Klasifikasi TSA' },
  { key: 'picTsa', label: 'PIC TSA' },
  { key: 'remarksJlm', label: 'Remarks JLM' },
];

async function migrate() {
  console.log('=== MIGRATION: Base Columns → customData ===\n');

  // 1. Check current state
  const rows = await db.monitoringRow.findMany({ orderBy: { orderNum: 'asc' } });
  const existingProjects = await db.project.findMany();
  const existingCols = await db.customColumn.findMany();

  console.log(`Found: ${rows.length} rows, ${existingProjects.length} projects, ${existingCols.length} custom columns`);

  // 2. Ensure 'default' project exists
  let project = existingProjects.find(p => p.id === 'default');
  if (!project) {
    project = await db.project.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        name: 'TSA Outliers Monitoring',
        color: '#64b5f6',
        columnOrder: JSON.stringify(BASE_COL_DEFS.map(c => c.key)),
      },
    });
    console.log(`Created project: ${project.id} (${project.name})`);
  } else {
    // Update columnOrder if empty
    if (!project.columnOrder || project.columnOrder === '[]') {
      await db.project.update({
        where: { id: 'default' },
        data: { columnOrder: JSON.stringify(BASE_COL_DEFS.map(c => c.key)) },
      });
      console.log('Updated project columnOrder');
    }
  }

  // 3. Create CustomColumn records for each base column
  const columnOrder = BASE_COL_DEFS.map(c => c.key);
  for (let i = 0; i < BASE_COL_DEFS.length; i++) {
    const def = BASE_COL_DEFS[i];
    const existing = existingCols.find(c => c.projectId === 'default' && (c.name === def.key || c.label === def.label));
    if (!existing) {
      await db.customColumn.create({
        data: {
          projectId: 'default',
          name: def.key,
          label: def.label,
          order: i + 1,
        },
      });
      console.log(`  Created column: ${def.label} (${def.key})`);
    } else {
      console.log(`  Column already exists: ${def.label}`);
    }
  }

  // 4. Migrate data from base columns to customData
  let migrated = 0;
  let skipped = 0;
  for (const row of rows) {
    // Check if row has any base column data
    const hasBaseData =
      row.categoryBak || row.provinsi || row.kabupaten || row.kecamatan ||
      row.kelurahan || row.kelRwSiteName || row.desaPerum ||
      row.indexNum || row.homepass || row.odp ||
      row.remarksTsa || row.klasifikasiTsa || row.picTsa || row.remarksJlm;

    // Check if customData already has data
    let customData = {};
    try { customData = JSON.parse(row.customData || '{}'); } catch {}
    const hasCustomData = Object.keys(customData).length > 0;

    if (!hasBaseData && !hasCustomData) {
      skipped++;
      continue;
    }

    // Build customData from base columns
    if (hasBaseData) {
      if (row.categoryBak) customData.categoryBak = row.categoryBak;
      if (row.provinsi) customData.provinsi = row.provinsi;
      if (row.kabupaten) customData.kabupaten = row.kabupaten;
      if (row.kecamatan) customData.kecamatan = row.kecamatan;
      if (row.kelurahan) customData.kelurahan = row.kelurahan;
      if (row.kelRwSiteName) customData.kelRwSiteName = row.kelRwSiteName;
      if (row.desaPerum) customData.desaPerum = row.desaPerum;
      if (row.indexNum) customData.indexNum = String(row.indexNum);
      if (row.homepass) customData.homepass = String(row.homepass);
      if (row.odp) customData.odp = String(row.odp);
      if (row.remarksTsa) customData.remarksTsa = row.remarksTsa;
      if (row.klasifikasiTsa) customData.klasifikasiTsa = row.klasifikasiTsa;
      if (row.picTsa) customData.picTsa = row.picTsa;
      if (row.remarksJlm) customData.remarksJlm = row.remarksJlm;
    }

    // Update row: set projectId and customData
    await db.monitoringRow.update({
      where: { id: row.id },
      data: {
        projectId: 'default',
        customData: JSON.stringify(customData),
      },
    });
    migrated++;
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Migrated: ${migrated} rows`);
  console.log(`Skipped (empty): ${skipped} rows`);

  // Verify
  const verifyRows = await db.monitoringRow.findMany({
    where: { projectId: 'default' },
    take: 2,
    orderBy: { orderNum: 'asc' },
  });
  console.log(`\nVerification (first 2 rows):`);
  for (const r of verifyRows) {
    const cd = JSON.parse(r.customData || '{}');
    console.log(`  ${r.id}: provinsi=${cd.provinsi}, kabupaten=${cd.kabupaten}, homepass=${cd.homepass}`);
  }

  const finalCols = await db.customColumn.findMany({ where: { projectId: 'default' }, orderBy: { order: 'asc' } });
  console.log(`\nFinal columns (${finalCols.length}):`, finalCols.map(c => c.label).join(', '));

  await db.$disconnect();
  console.log('\nMigration complete!');
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  db.$disconnect();
  process.exit(1);
});
