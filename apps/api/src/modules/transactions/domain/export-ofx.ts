import { toDecimalString } from '@icb/money';

import type { ExportLine } from './export-lines.js';

/**
 * OFX 1.02 (SGML) bank-statement renderer — the dialect every personal-finance tool imports.
 * Tags are emitted unclosed, as the SGML profile allows; dates are `YYYYMMDD`; amounts are
 * signed decimals. Pure: the whole document is a function of its input, clock included.
 */

export interface OfxContext {
  readonly bankId: string;
  readonly accountId: string;
  readonly currency: string;
  readonly from: string;
  readonly to: string;
  /** "Now" for DTASOF — injected so the renderer stays deterministic. */
  readonly asOf: Date;
  /** Balance after the last line; the LEDGERBAL the import reconciles against. */
  readonly closingMinorUnits: number;
  /** Server-assigned document id, echoed as TRNUID so re-imports dedupe. */
  readonly documentId: string;
}

const HEADER = [
  'OFXHEADER:100',
  'DATA:OFXSGML',
  'VERSION:102',
  'SECURITY:NONE',
  'ENCODING:USASCII',
  'CHARSET:1252',
  'COMPRESSION:NONE',
  'OLDFILEUID:NONE',
  'NEWFILEUID:NONE',
];

/** OFX predates XML entities in the wild, but `&` and `<` still break parsers. */
function escape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    // CHARSET 1252 cannot hold code points above Latin-1; fold rather than emit mojibake.
    .replaceAll(/[^\x20-\xFF]/g, '?');
}

/** `2026-08-02` → `20260802`. The value date is already an ISO calendar date. */
function ofxDate(isoDate: string): string {
  return isoDate.replaceAll('-', '');
}

function transactionBlock(line: ExportLine): string[] {
  const memo = `${line.type} · ${line.category}`;
  return [
    '<STMTTRN>',
    `<TRNTYPE>${line.direction === 'credit' ? 'CREDIT' : 'DEBIT'}</TRNTYPE>`,
    `<DTPOSTED>${ofxDate(line.valueDate)}</DTPOSTED>`,
    `<TRNAMT>${toDecimalString({ minorUnits: line.signedMinorUnits, currency: line.currency })}</TRNAMT>`,
    `<FITID>${escape(line.transactionId)}</FITID>`,
    `<NAME>${escape(line.description)}</NAME>`,
    `<MEMO>${escape(memo)}</MEMO>`,
    '</STMTTRN>',
  ];
}

/** The full statement document, LF-separated with a trailing newline. */
export function toOfx(lines: readonly ExportLine[], context: OfxContext): string {
  const closing = toDecimalString({
    minorUnits: context.closingMinorUnits,
    currency: context.currency as ExportLine['currency'],
  });

  const body = [
    '<OFX>',
    '<BANKMSGSRSV1>',
    '<STMTTRNRS>',
    `<TRNUID>${escape(context.documentId)}</TRNUID>`,
    '<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>',
    '<STMTRS>',
    `<CURDEF>${escape(context.currency)}</CURDEF>`,
    '<BANKACCTFROM>',
    `<BANKID>${escape(context.bankId)}</BANKID>`,
    `<ACCTID>${escape(context.accountId)}</ACCTID>`,
    '<ACCTTYPE>CHECKING</ACCTTYPE>',
    '</BANKACCTFROM>',
    '<BANKTRANLIST>',
    `<DTSTART>${ofxDate(context.from)}</DTSTART>`,
    `<DTEND>${ofxDate(context.to)}</DTEND>`,
    ...lines.flatMap(transactionBlock),
    '</BANKTRANLIST>',
    '<LEDGERBAL>',
    `<BALAMT>${closing}</BALAMT>`,
    `<DTASOF>${ofxDate(context.asOf.toISOString().slice(0, 10))}</DTASOF>`,
    '</LEDGERBAL>',
    '</STMTRS>',
    '</STMTTRNRS>',
    '</BANKMSGSRSV1>',
    '</OFX>',
  ];

  return [...HEADER, '', ...body].join('\n') + '\n';
}
