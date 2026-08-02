/**
 * Return and response codes, in the vocabulary each network actually uses.
 *
 * The codes matter more than they look. A customer-facing message like "the payment bounced" is
 * useless to an operator; `R01` versus `R03` is the difference between "tell them to top up" and
 * "the account does not exist, stop retrying". Modelling the real code sets means the failure
 * paths downstream have to be written for reality rather than for a boolean.
 */

export interface WeightedCode {
  readonly code: string;
  readonly label: string;
  readonly weight: number;
}

/** The rail is switched off in `sim_state`. Not a network code — ICB never sent anything. */
export const RAIL_UNAVAILABLE = 'RAIL_UNAVAILABLE';

/** NACHA return codes. Weighted the way a real ACH file returns: mostly R01. */
export const ACH_RETURN_CODES: readonly WeightedCode[] = [
  { code: 'R01', label: 'Insufficient funds', weight: 55 },
  { code: 'R02', label: 'Account closed', weight: 20 },
  { code: 'R03', label: 'No account or unable to locate account', weight: 15 },
  { code: 'R04', label: 'Invalid account number', weight: 10 },
];

/** Fedwire-style rejects. Wires fail rarely, and almost never for funds — they are pre-funded. */
export const WIRE_REJECT_CODES: readonly WeightedCode[] = [
  { code: 'E01', label: 'Beneficiary account not found', weight: 45 },
  { code: 'E02', label: 'Beneficiary bank not participating', weight: 30 },
  { code: 'E03', label: 'Instruction rejected by compliance screening', weight: 25 },
];

/** SWIFT MT199/MT299 rejection reasons on a correspondent leg. */
export const SWIFT_REJECT_CODES: readonly WeightedCode[] = [
  { code: 'RJCT-AC01', label: 'Incorrect account number', weight: 35 },
  { code: 'RJCT-AC04', label: 'Closed account number', weight: 20 },
  { code: 'RJCT-AGNT', label: 'Correspondent agent declined the instruction', weight: 25 },
  { code: 'RJCT-RR04', label: 'Regulatory reason', weight: 20 },
];

/** ISO-8583 DE39 response codes for a declined authorisation. */
export const CARD_DECLINE_CODES: readonly WeightedCode[] = [
  { code: '51', label: 'Insufficient funds', weight: 50 },
  { code: '05', label: 'Do not honour', weight: 30 },
  { code: '54', label: 'Expired card', weight: 20 },
];

/** DE39 on a successful authorisation. */
export const CARD_APPROVED_CODE = '00';

/** Internal book transfers can only fail if the bank itself is unavailable. */
export const INTERNAL_REJECT_CODES: readonly WeightedCode[] = [
  { code: 'INT01', label: 'Core banking unavailable', weight: 100 },
];
