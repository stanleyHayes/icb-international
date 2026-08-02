/**
 * Typed errors for `@icb/testing`. Never a bare `Error` (agent_plan.md §1).
 */

export abstract class TestingError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The Mongo harness was asked to boot without a connection string. */
export class MongoUriMissingError extends TestingError {
  readonly code = 'MONGO_URI_MISSING';

  constructor() {
    super(
      'No Mongo connection string found. Set MONGO_URI (or MONGODB_URI) in the environment, ' +
        'or pass `uri` to createMongoTestHarness.',
    );
  }
}

/** A ledger factory call whose lines do not sum to zero per currency (agent_plan.md N4). */
export class UnbalancedPostingError extends TestingError {
  readonly code = 'UNBALANCED_POSTING';

  constructor(
    readonly currency: string,
    readonly debitMinorUnits: number,
    readonly creditMinorUnits: number,
  ) {
    super(
      `Ledger posting is unbalanced in ${currency}: ` +
        `debits ${debitMinorUnits} != credits ${creditMinorUnits} minor units.`,
    );
  }
}

/** A factory was given overrides that cannot produce a valid entity. */
export class FactoryOverrideError extends TestingError {
  readonly code = 'FACTORY_OVERRIDE';

  constructor(detail: string) {
    super(`Invalid factory override: ${detail}`);
  }
}
