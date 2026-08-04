/**
 * Migration 0001-customers-schema-version — example for the migrate.mjs runner.
 *
 * Backfills `schemaVersion: 1` on customer documents that predate the field, and removes
 * it again on rollback. Picked as the example because it shows both directions of a data
 * migration without touching money: nothing here reads or writes a balance, and the
 * update is idempotent (re-running matches zero documents).
 */
export async function up(db) {
  const result = await db
    .collection('customers')
    .updateMany({ schemaVersion: { $exists: false } }, { $set: { schemaVersion: 1 } });
  console.log(`    customers backfilled with schemaVersion=1: ${result.modifiedCount}`);
}

export async function down(db) {
  const result = await db
    .collection('customers')
    .updateMany({ schemaVersion: 1 }, { $unset: { schemaVersion: '' } });
  console.log(`    customers with schemaVersion removed: ${result.modifiedCount}`);
}
