import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';

import { AuditImmutableError } from '../domain/audit-errors.js';
import { AuditEventSchema, type AuditEventDoc } from '../infrastructure/audit-event.schemas.js';

/**
 * Append-only enforcement runs in the schema's mutating middleware, which fires before any
 * command is buffered — so these tests need no live Mongo to prove the rejection.
 */
const MODEL_NAME = 'AuditAppendOnlySpec';
const model =
  (mongoose.models[MODEL_NAME] as mongoose.Model<AuditEventDoc> | undefined) ??
  mongoose.model<AuditEventDoc>(MODEL_NAME, AuditEventSchema);

describe('audit_events append-only enforcement', () => {
  it('rejects updateOne', async () => {
    await expect(model.updateOne({}, { summary: 'rewrite' }).exec()).rejects.toThrow(
      AuditImmutableError,
    );
  });

  it('rejects findOneAndUpdate', async () => {
    await expect(model.findOneAndUpdate({}, { summary: 'rewrite' }).exec()).rejects.toThrow(
      AuditImmutableError,
    );
  });

  it('rejects deleteOne', async () => {
    await expect(model.deleteOne({}).exec()).rejects.toThrow(AuditImmutableError);
  });

  it('rejects deleteMany', async () => {
    await expect(model.deleteMany({}).exec()).rejects.toThrow(AuditImmutableError);
  });
});
