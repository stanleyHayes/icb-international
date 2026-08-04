import { describe, expect, it } from 'vitest';

import { renderMacro, unknownVariables, type MacroContext } from '../domain/macro.js';
import { UnknownMacroVariableError } from '../domain/support-errors.js';

const CONTEXT: MacroContext = {
  customerName: 'Amara Mensah',
  ticketReference: 'SUP-8F3K2M9Q',
  agentName: 'Sam Boateng',
};

describe('renderMacro', () => {
  it('renders every supported variable', () => {
    const rendered = renderMacro(
      'Hi {{customerName}}, re {{ticketReference}} — {{agentName}}, ICB support.',
      CONTEXT,
    );
    expect(rendered).toBe('Hi Amara Mensah, re SUP-8F3K2M9Q — Sam Boateng, ICB support.');
  });

  it('renders the same variable more than once', () => {
    expect(renderMacro('{{customerName}} / {{customerName}}', CONTEXT)).toBe(
      'Amara Mensah / Amara Mensah',
    );
  });

  it('tolerates whitespace inside the braces', () => {
    expect(renderMacro('Hi {{ customerName }}', CONTEXT)).toBe('Hi Amara Mensah');
  });

  it('leaves plain text untouched', () => {
    expect(renderMacro('No variables here.', CONTEXT)).toBe('No variables here.');
  });

  it('fails loudly on an unknown variable rather than sending it to a customer', () => {
    expect(() => renderMacro('Hi {{custmerName}}', CONTEXT)).toThrow(UnknownMacroVariableError);
  });

  it('reports each unknown variable as a field error', () => {
    try {
      renderMacro('{{foo}} and {{bar}}', CONTEXT);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownMacroVariableError);
      const fieldErrors = (error as UnknownMacroVariableError).fieldErrors;
      expect(fieldErrors.map((field) => field.message)).toEqual([
        'Unknown variable {{foo}}',
        'Unknown variable {{bar}}',
      ]);
    }
  });
});

describe('unknownVariables', () => {
  it('lists each unknown variable once', () => {
    expect(unknownVariables('{{foo}} {{foo}} {{customerName}} {{bar}}')).toEqual(['foo', 'bar']);
  });

  it('is empty for a clean template', () => {
    expect(unknownVariables('{{customerName}} — {{agentName}}')).toEqual([]);
  });
});
