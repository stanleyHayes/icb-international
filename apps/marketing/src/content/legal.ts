/**
 * Legal copy.
 *
 * Plain language on purpose. A terms page nobody can read is a terms page nobody has agreed to.
 */
/** All four documents were last revised together. */
const LAST_UPDATED = '1 January 2026';

export interface LegalDocument {
  readonly slug: string;
  readonly title: string;
  readonly updated: string;
  readonly standfirst: string;
  readonly sections: readonly { heading: string; paragraphs: readonly string[] }[];
}

export const LEGAL_DOCUMENTS = {
  terms: {
    slug: 'terms',
    title: 'Terms of service',
    updated: LAST_UPDATED,
    standfirst:
      'These terms govern your ICB account. They are written to be read, not to be survived.',
    sections: [
      {
        heading: 'Who we are',
        paragraphs: [
          'ICB International Commercial Bank provides current accounts, savings, cards, lending and payment services to personal and business customers. Our BIC is ICBKGHAC and our sort code is 60-16-13.',
          'Eligible deposits are protected up to 250,000 per depositor. Protection applies to the total across all your ICB accounts, not to each account separately.',
        ],
      },
      {
        heading: 'Your account',
        paragraphs: [
          'You must provide accurate information when opening an account and keep it current. You are responsible for keeping your password and second factor secret. We will never ask you for either.',
          'We may suspend or close an account where we reasonably believe it is being used unlawfully, where verification cannot be completed, or where you ask us to. We will tell you why unless we are prevented from doing so.',
        ],
      },
      {
        heading: 'Moving money',
        paragraphs: [
          'Every transfer states its rail, its fee and its expected arrival before you confirm. Instructions submitted after a rail cut-off are dated to the next business day, and this is shown at the point of confirmation.',
          'An instruction that has been posted cannot be edited or deleted. Corrections are made by a reversing transaction, and both entries remain visible on your statement.',
          'Limits apply according to your verification tier and are shown in the app. A transfer that would exceed a limit is declined with the limit and the shortfall stated.',
        ],
      },
      {
        heading: 'Fees and interest',
        paragraphs: [
          'Fees are those published on the rates page at the time of the transaction. We give at least 30 days notice before a fee increases or an interest rate falls.',
          'Interest accrues daily on the cleared balance and is capitalised monthly, on an ACT/365 basis.',
        ],
      },
      {
        heading: 'Liability',
        paragraphs: [
          'We are responsible for executing your instructions as given. We are not responsible for a loss caused by information you supplied incorrectly, such as a wrong account number, though we will make reasonable efforts to help recover it.',
          'Nothing in these terms limits liability where the law does not allow it to be limited.',
        ],
      },
      {
        heading: 'Complaints',
        paragraphs: [
          'Raise a complaint through the app or in writing. We acknowledge within three business days and aim to resolve within eight weeks, telling you where we have got to if it takes longer.',
        ],
      },
    ],
  },
  privacy: {
    slug: 'privacy',
    title: 'Privacy notice',
    updated: LAST_UPDATED,
    standfirst: 'What we collect, why we hold it, and what you can ask us to do with it.',
    sections: [
      {
        heading: 'What we collect',
        paragraphs: [
          'Identity data: your name, date of birth, nationality, address and the documents you supply for verification. Contact data: email and mobile number. Financial data: your accounts, balances, transactions and the postings behind them. Technical data: the device and IP address a session was created from, so you can recognise your own sessions and spot one that is not yours.',
        ],
      },
      {
        heading: 'Why we hold it',
        paragraphs: [
          'To operate your account and execute your instructions. To verify your identity and meet anti-money-laundering obligations. To detect and prevent fraud. To produce statements and regulatory reports. We do not sell your data and we do not use it to train models.',
        ],
      },
      {
        heading: 'How it is protected',
        paragraphs: [
          'Card numbers and national identifiers are encrypted at rest. Passwords are hashed with argon2id and are never recoverable, by us or by anyone else. Logs are passed through a redaction filter that strips card numbers, tokens, passwords and dates of birth before anything is written.',
          'Access to customer data by staff is role-gated and every access is written to an append-only, hash-chained audit log.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          'You can request a copy of your data, ask for a correction, or ask us to delete it where we are not required to keep it. Request a data export from Settings; we respond within 30 days.',
          'Where we must keep records for regulatory reasons we will tell you which records and for how long.',
        ],
      },
    ],
  },
  cookies: {
    slug: 'cookies',
    title: 'Cookie notice',
    updated: LAST_UPDATED,
    standfirst: 'ICB sets only the cookies it needs to keep you signed in safely.',
    sections: [
      {
        heading: 'What we set',
        paragraphs: [
          'icb_session — holds your signed-in session, encrypted so that only our server can read it. httpOnly, SameSite=Lax, and removed when you sign out.',
          'icb_refresh — allows your session to be renewed without signing in again. httpOnly, SameSite=Strict, rotated on every use.',
        ],
      },
      {
        heading: 'What we do not set',
        paragraphs: [
          'No advertising cookies. No third-party trackers. No cross-site identifiers. There is no cookie banner because there is nothing to consent to beyond the two cookies that make signing in work, which are strictly necessary.',
        ],
      },
    ],
  },
  accessibility: {
    slug: 'accessibility',
    title: 'Accessibility statement',
    updated: LAST_UPDATED,
    standfirst:
      'ICB aims to meet WCAG 2.2 level AA across the marketing site, the dashboard and the operations console.',
    sections: [
      {
        heading: 'What we have done',
        paragraphs: [
          'Every interactive element is reachable and operable by keyboard alone, with a visible focus ring that meets contrast requirements. Every form input has an associated label, and validation errors are announced and linked to the field that caused them.',
          'Colour is never the only carrier of meaning: a credit is green and carries a plus sign; a debit is grey and carries a minus. Status is stated in words as well as colour.',
          'All text meets 4.5:1 contrast against its background, and large text and interface borders meet 3:1. Monetary figures use tabular numerals so a changing balance does not shift the layout.',
          'Animation is limited and respects prefers-reduced-motion; nothing moves that the reader did not ask to move.',
        ],
      },
      {
        heading: 'Known limitations',
        paragraphs: [
          'Some data tables in the operations console scroll horizontally on narrow screens. The scroll container is keyboard reachable, but the experience is better on a wider viewport.',
        ],
      },
      {
        heading: 'Telling us about a problem',
        paragraphs: [
          'If any part of ICB is difficult to use with assistive technology, tell us through the app or in writing and we will treat it as a defect rather than an enhancement.',
        ],
      },
    ],
  },
} as const satisfies Record<string, LegalDocument>;
