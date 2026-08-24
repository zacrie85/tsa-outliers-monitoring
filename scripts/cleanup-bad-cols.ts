import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  // List all custom columns
  const cols = await db.customColumn.findMany({ orderBy: { order: 'asc' } });
  console.log('Current custom columns:', cols.length);
  for (const c of cols) {
    console.log(' ', c.id, '|', c.name, '|', c.label);
  }

  // Delete all custom columns that are NOT part of the original 3
  // Original 3 custom columns from the initial setup
  const keepIds: string[] = [];
  
  // Just delete ALL custom columns since the new import should recreate needed ones
  const result = await db.customColumn.deleteMany({
    where: {
      id: { notIn: keepIds }
    }
  });
  console.log('\nDeleted', result.count, 'bad custom columns');

  // Also clean customData from all rows (set to empty {})
  const updateResult = await db.monitoringRow.updateMany({
    data: { customData: '{}' }
  });
  console.log('Cleared customData from', updateResult.count, 'rows');

  console.log('\nDone! Refresh the app to see clean columns.');
}

main().catch(console.error).finally(() => db.$disconnect());
