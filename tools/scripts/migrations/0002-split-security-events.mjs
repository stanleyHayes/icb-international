/**
 * Migration 0002-split-security-events — move legacy authentication rows out of `audit_events`.
 *
 * Two different `AuditEventDoc` classes were once registered under the same Mongoose model name
 * over the same `audit_events` collection: the governance change-trail in `modules/audit`, and
 * the authentication trail in `modules/auth`. Mongoose keys its model registry by class name, so
 * whichever module compiled first defined the schema and the other module's writes failed
 * validation. Auth won, which means every governance append was silently rejected — and the rows
 * that did land in `audit_events` are all authentication-shaped.
 *
 * The code fix renamed auth's model to `SecurityEventDoc` over its own `security_events`
 * collection. This migration deals with what the collision already wrote.
 *
 * Authentication rows are identified structurally, not by action name: the governance schema
 * requires `sequence`, the authentication schema has no such field and carries `occurredAt`
 * where governance carries `at`. Rows are *moved*, never dropped — an append-only trail is not
 * something a migration gets to delete, and the login history screen reads them back.
 *
 * Leaving them in place is not an option: the governance chain hashes each row against its
 * predecessor, so an authentication row sitting in the middle of it makes `verifyIntegrity`
 * report the chain broken forever.
 */

/** Governance rows always carry a numeric `sequence`; authentication rows never do. */
const AUTHENTICATION_SHAPED = { sequence: { $exists: false }, occurredAt: { $exists: true } };

export async function up(db) {
  const legacy = await db.collection('audit_events').find(AUTHENTICATION_SHAPED).toArray();
  if (legacy.length === 0) {
    console.log('    no authentication rows in audit_events; nothing to move');
    return;
  }

  // Upsert by _id so a re-run is idempotent and never duplicates a row.
  await db.collection('security_events').bulkWrite(
    legacy.map((doc) => ({
      replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
    })),
    { ordered: false },
  );
  const removed = await db
    .collection('audit_events')
    .deleteMany({ _id: { $in: legacy.map((doc) => doc._id) } });

  console.log(`    authentication rows moved to security_events: ${legacy.length}`);
  console.log(`    removed from audit_events: ${removed.deletedCount}`);

  // The governance chain is hashed head-to-tail. Any row that linked onto an authentication
  // row now points at a hash that is no longer its predecessor, so the chain cannot verify.
  // There is nothing to repair — those appends were the first ones ever to succeed — so the
  // honest move is to say so rather than leave `verifyIntegrity` reporting a broken chain.
  const orphaned = await db
    .collection('audit_events')
    .countDocuments({ sequence: { $exists: true } });
  if (orphaned > 0) {
    console.log(
      `    NOTE: ${orphaned} governance row(s) remain and may chain onto a moved row.` +
        ' Run `pnpm db:reset` to rebuild the trail from a clean seed if verifyIntegrity reports a break.',
    );
  }
}

export async function down(db) {
  // Reverse the move: authentication rows return to where the collision had them.
  const moved = await db.collection('security_events').find(AUTHENTICATION_SHAPED).toArray();
  if (moved.length === 0) {
    console.log('    no authentication rows in security_events; nothing to move back');
    return;
  }
  await db.collection('audit_events').bulkWrite(
    moved.map((doc) => ({
      replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
    })),
    { ordered: false },
  );
  const removed = await db
    .collection('security_events')
    .deleteMany({ _id: { $in: moved.map((doc) => doc._id) } });
  console.log(`    authentication rows returned to audit_events: ${removed.deletedCount}`);
}
