import { ValidationError } from '../errors/index.js';

/**
 * NoSQL-injection guard for the common validation path.
 *
 * A JSON body can carry an object where the schema expects a scalar (`{"email": {"$gt": ""}}`),
 * and Fastify's flat querystring parser turns `?email[$gt]=` into the literal key `email[$gt]`.
 * Either shape is an operator-injection attempt if it ever reaches a Mongo filter, so the guard
 * rejects any payload whose *keys* contain `$` or `.` — at any depth — with a 400 before the
 * schema even runs. `__proto__` keys are refused for the same reason: a parsed body can carry it
 * as an own property, and a careless spread would turn it into prototype pollution.
 *
 * Only keys are inspected; string *values* are data, not query syntax.
 */
export function assertNoMongoOperatorKeys(value: unknown, path = ''): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoMongoOperatorKeys(item, `${path}[${index}]`));
    return;
  }
  if (!isPlainRecord(value)) {
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (isDangerousKey(key)) {
      throw new ValidationError('The request failed validation', [
        { path: joinPath(path, key), message: 'Field names must not contain $, ., or __proto__' },
      ]);
    }
    assertNoMongoOperatorKeys(nested, joinPath(path, key));
  }
}

function isDangerousKey(key: string): boolean {
  return key.includes('$') || key.includes('.') || key === '__proto__';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function joinPath(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`;
}
