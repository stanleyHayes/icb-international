/**
 * Company copy: leadership, open roles, newsroom articles and sustainability commitments.
 *
 * Held as data so the company pages render from one shape and a title or a figure appears in
 * exactly one place. Dates are display strings — these pages prerender, so nothing here is
 * computed at request time.
 */

export interface Leader {
  readonly name: string;
  readonly role: string;
  readonly bio: string;
}

export const LEADERSHIP: readonly Leader[] = [
  {
    name: 'Adaeze Okafor',
    role: 'Chief Executive',
    bio: 'Founded ICB on a simple conviction: a bank is a ledger with a licence, and the ledger comes first. Two decades in core banking and payments before that.',
  },
  {
    name: 'Marcus Webb',
    role: 'Chief Technology Officer',
    bio: 'Owns the double-entry core and the six invariants asserted against it every business day. Previously built settlement systems for a central securities depository.',
  },
  {
    name: 'Priya Raman',
    role: 'Chief Financial Officer',
    bio: 'Runs treasury, capital and the reconciliation desk. Will not sign a set of accounts in which a single minor unit is unexplained, and has not had to.',
  },
  {
    name: 'Daniel Mensah',
    role: 'Chief Risk Officer',
    bio: 'Owns credit, market and operational risk, and the rule engine whose every decision is shown to the customer it affects, in plain language.',
  },
  {
    name: 'Sofia Almeida',
    role: 'Chief Customer Officer',
    bio: 'Owns support, complaints and the eight-week resolution clock. Measures success by how rarely anyone needs to contact us twice about the same thing.',
  },
  {
    name: 'James Whitfield',
    role: 'General Counsel',
    bio: 'Owns legal, compliance and the plain-language programme that keeps our terms readable. A contract nobody can read is a contract nobody agreed to.',
  },
] as const;

export interface Role {
  readonly id: string;
  readonly title: string;
  readonly team: string;
  readonly location: string;
  readonly type: 'Full-time' | 'Part-time';
  readonly summary: string;
}

export const OPEN_ROLES: readonly Role[] = [
  {
    id: 'eng-ledger',
    title: 'Senior Engineer, Ledger Core',
    team: 'Engineering',
    location: 'Accra',
    type: 'Full-time',
    summary:
      'Work on the double-entry posting pipeline: idempotency, concurrency under payday load, and the nightly invariant checks. TypeScript, MongoDB transactions, and a test suite that treats a lost cent as a failing build.',
  },
  {
    id: 'eng-payments',
    title: 'Engineer, Payments & Rails',
    team: 'Engineering',
    location: 'Accra or remote (GMT±2)',
    type: 'Full-time',
    summary:
      'Build the adapters that move money between rails — ACH, wire, SWIFT — with exactly-once semantics and honest status reporting. You will own the confirmation screen customers read before pressing send.',
  },
  {
    id: 'risk-fraud',
    title: 'Fraud Analyst',
    team: 'Risk',
    location: 'Accra',
    type: 'Full-time',
    summary:
      'Work the alert queue, tune velocity and device rules, and write the plain-language explanation that goes to the customer when a payment is held. Case work with evidence, not gut feel.',
  },
  {
    id: 'kyc-specialist',
    title: 'KYC Operations Specialist',
    team: 'Operations',
    location: 'Kumasi',
    type: 'Full-time',
    summary:
      'Review onboarding cases against document standards, request what is missing in one message rather than three, and keep the SLA timer honest. Judgement over box-ticking.',
  },
  {
    id: 'support-advocate',
    title: 'Customer Support Advocate',
    team: 'Support',
    location: 'Remote (GMT±2)',
    type: 'Full-time',
    summary:
      'Answer secure messages with the customer\u2019s account context in front of you, so nobody explains their problem twice. You own the thread until it is resolved, not until it is replied to.',
  },
  {
    id: 'design-product',
    title: 'Product Designer',
    team: 'Design',
    location: 'Accra or remote (GMT±2)',
    type: 'Full-time',
    summary:
      'Design the interfaces onto the ledger: transfers, statements, disputes. Accessibility is a requirement, not a polish pass — you will ship keyboard-complete, screen-reader-labelled flows.',
  },
] as const;

export interface NewsArticle {
  readonly slug: string;
  readonly title: string;
  readonly date: string;
  readonly category: 'Announcement' | 'Product' | 'Policy';
  readonly standfirst: string;
  readonly paragraphs: readonly string[];
}

export const NEWS_ARTICLES: readonly NewsArticle[] = [
  {
    slug: 'fixed-deposit-60-month',
    title: 'A 60-month fixed deposit, and why the rate falls after 24',
    date: '14 July 2026',
    category: 'Product',
    standfirst:
      'We now offer fixed terms out to sixty months. The longest term pays less than the 24-month, and we would rather explain that on the rates page than have you discover it.',
    paragraphs: [
      'Fixed term deposits now run from one month to sixty, with the rate fixed for the whole term and quoted to the cent before you commit. The full matrix is on the rates page, and the in-app opening flow quotes the same figures.',
      'The 60-month rate, 4.75% AER, sits below the 24-month rate of 5.05%. That is not an error. Long-term funding is priced off the yield curve, and at present the curve rewards us less for certainty at five years than at two. Publishing the matrix as it stands, including where it is less flattering, is the point of the rates page.',
      'Breaking any term early forfeits a share of accrued interest. The penalty is quoted to the cent before you confirm — never discovered on the statement afterwards.',
    ],
  },
  {
    slug: 'new-payee-cooling-off',
    title: 'Why new payees are capped for four hours',
    date: '2 June 2026',
    category: 'Policy',
    standfirst:
      'A newly added payee cannot receive more than a capped amount for its first four hours. It is the single most effective control we have against authorised push payment fraud.',
    paragraphs: [
      'Most account takeovers follow the same shape: an attacker gains a session, adds their own account as a payee, and moves the balance in one instruction. The four-hour cooling-off cap breaks that shape. The legitimate customer, adding a payee for rent or a purchase, plans ahead by more than four hours in almost every case.',
      'The cap lifts automatically and requires no call, no verification and no branch visit. It is shown at the point you add the payee and again at the point you send, so it never arrives as a surprise.',
      'We considered making the delay optional. We decided against it: the customers most targeted by this fraud are the ones most likely to be talked through disabling it. Some controls protect best by not having an off switch.',
    ],
  },
  {
    slug: 'fifteen-currencies',
    title: 'Holding and settling in fifteen currencies',
    date: '20 April 2026',
    category: 'Announcement',
    standfirst:
      'Every ICB current account can now hold fifteen currencies side by side, with conversion at a published 0.35% spread and no fixed fee.',
    paragraphs: [
      'A current account now holds balances in fifteen currencies under one account number. Receiving in a supported currency credits that currency\u2019s balance directly; there is no forced conversion at a rate you did not choose.',
      'Conversion between your own balances is instant and priced at a 0.35% spread on the mid-market rate, with no fixed fee. The quote screen shows the rate, the spread, and the exact figure you will receive, and the quote holds while its countdown runs.',
      'International transfers over SWIFT settle in two business days and are tracked end to end in the app — each hop is an entry you can see, not a status that says “processing”.',
    ],
  },
  {
    slug: 'dispute-provisional-credit',
    title: 'Provisional credit on disputes, assessed within 48 hours',
    date: '9 March 2026',
    category: 'Policy',
    standfirst:
      'When you dispute a card transaction, we now assess provisional credit within 48 hours — so a contested charge does not hold your balance hostage while it is investigated.',
    paragraphs: [
      'A disputed card transaction can take weeks to resolve through the chargeback process. That is a poor reason for the money to be missing from your account in the meantime. From today, provisional credit is assessed within 48 hours of a dispute being raised.',
      'If the dispute is upheld, the credit stands permanently. If it is not, the credit is reversed — and the reversal, like everything else on the ledger, is a new transaction that appears on your statement with the reason attached. Nothing is edited and nothing disappears.',
      'You can follow every stage of the dispute from the transaction itself, with the evidence we hold and the deadline the card scheme imposes shown alongside.',
    ],
  },
] as const;

export interface SustainabilityCommitment {
  readonly title: string;
  readonly body: string;
}

export const SUSTAINABILITY: readonly SustainabilityCommitment[] = [
  {
    title: 'Operations',
    body: 'Our offices and the regions our infrastructure runs in are matched with renewable electricity purchases annually. What cannot yet be matched is disclosed, not omitted from the boundary.',
  },
  {
    title: 'Lending',
    body: 'Credit decisions include an environmental screen. We do not lend to extraction of thermal coal, and the full exclusion list is published rather than summarised.',
  },
  {
    title: 'Reporting',
    body: 'Financed emissions are measured and published annually to the Partnership for Carbon Accounting Financials standard, with the methodology attached so the numbers can be checked.',
  },
  {
    title: 'Suppliers',
    body: 'Every supplier above a de-minimis spend signs up to the same labour and environmental standards we hold ourselves to. The standards are public, as is the list of suppliers that meet them.',
  },
] as const;
