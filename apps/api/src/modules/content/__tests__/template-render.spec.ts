import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../../common/errors/index.js';
import { renderTemplate, unknownVariables } from '../domain/template-render.js';

const SAMPLE: Readonly<Record<string, string>> = {
  recipientName: 'Amara',
  amount: '1,250.00',
};

describe('renderTemplate', () => {
  it('replaces every occurrence of a known variable', () => {
    expect(renderTemplate('Hi {{recipientName}} / {{recipientName}}', SAMPLE)).toBe(
      'Hi Amara / Amara',
    );
  });

  it('tolerates whitespace inside the braces', () => {
    expect(renderTemplate('You sent {{ amount }}', SAMPLE)).toBe('You sent 1,250.00');
  });

  it('leaves plain text untouched', () => {
    expect(renderTemplate('No variables here.', SAMPLE)).toBe('No variables here.');
  });

  it('throws a ValidationError naming each unknown variable', () => {
    try {
      renderTemplate('{{foo}} and {{bar}}', SAMPLE);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const fieldErrors = (error as ValidationError).fieldErrors ?? [];
      expect(fieldErrors.map((field) => field.message)).toEqual([
        'Unknown variable {{foo}}',
        'Unknown variable {{bar}}',
      ]);
    }
  });
});

describe('unknownVariables', () => {
  it('lists each unknown variable once', () => {
    expect(unknownVariables('{{foo}} {{foo}} {{recipientName}} {{bar}}', SAMPLE)).toEqual([
      'foo',
      'bar',
    ]);
  });

  it('is empty when every variable resolves', () => {
    expect(unknownVariables('Hi {{recipientName}}', SAMPLE)).toEqual([]);
  });
});
