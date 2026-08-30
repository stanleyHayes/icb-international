/**
 * Help centre content: categories, articles and the frequently asked.
 *
 * The support page searches this data client-side, so every article carries the keywords a
 * customer would actually type — not just the words in its title.
 */

export interface HelpArticle {
  readonly slug: string;
  readonly category: string;
  readonly title: string;
  readonly summary: string;
  readonly keywords: readonly string[];
}

const CATEGORY_PAYMENTS = 'Payments & transfers';
const CATEGORY_CARDS = 'Cards';
const CATEGORY_ACCOUNTS = 'Accounts & balances';
const CATEGORY_SECURITY = 'Security & fraud';

export const HELP_CATEGORIES = [
  { name: CATEGORY_PAYMENTS, description: 'Rails, arrival times, limits and recalls' },
  { name: CATEGORY_CARDS, description: 'Controls, declines, lost cards and PINs' },
  { name: CATEGORY_ACCOUNTS, description: 'Ledger vs available, statements, overdrafts' },
  { name: CATEGORY_SECURITY, description: 'Sessions, scams, sign-in problems' },
] as const;

export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    slug: 'transfer-times',
    category: CATEGORY_PAYMENTS,
    title: 'How long a transfer takes, by rail',
    summary:
      'ICB to ICB is instant at any hour. Domestic arrives the next business day, a same-day wire the same day before 16:00 UTC, and international in two business days.',
    keywords: ['transfer', 'speed', 'slow', 'pending', 'wire', 'ach', 'swift', 'arrive'],
  },
  {
    slug: 'transfer-recall',
    category: CATEGORY_PAYMENTS,
    title: 'Getting money back after a wrong transfer',
    summary:
      'A posted transfer cannot be edited or deleted. Raise a recall from the transaction and we contact the receiving bank; recovery is best-effort, so check details before confirming.',
    keywords: ['wrong', 'mistake', 'recall', 'reverse', 'sent', 'account number'],
  },
  {
    slug: 'new-payee-cap',
    category: CATEGORY_PAYMENTS,
    title: 'Why a new payee is capped for four hours',
    summary:
      'Newly added payees are capped for four hours. The cap lifts automatically and is the single most effective control against account-takeover fraud.',
    keywords: ['payee', 'beneficiary', 'limit', 'cap', 'cannot send', 'cooling off'],
  },
  {
    slug: 'scheduled-recurring',
    category: CATEGORY_PAYMENTS,
    title: 'Scheduled and recurring transfers',
    summary:
      'Schedule a one-off transfer for a future date or set a standing order. Both are editable until the day they run, and each run posts as its own transaction.',
    keywords: ['standing order', 'recurring', 'schedule', 'future', 'rent', 'monthly'],
  },
  {
    slug: 'card-declined',
    category: CATEGORY_CARDS,
    title: 'Why a card was declined with money in the account',
    summary:
      'Most declines are a control you set: frozen card, blocked category, disabled channel or a per-transaction limit. The exact reason is on the authorisation in the app.',
    keywords: ['declined', 'refused', 'card', 'limit', 'frozen', 'blocked', 'online'],
  },
  {
    slug: 'lost-card',
    category: CATEGORY_CARDS,
    title: 'Lost or stolen card: what to do first',
    summary:
      'Freeze the card in the app — it takes effect immediately. Then report it lost or stolen and choose a reissue; pending authorisations on the old card are released.',
    keywords: ['lost', 'stolen', 'freeze', 'replace', 'reissue', 'card'],
  },
  {
    slug: 'card-pin',
    category: CATEGORY_CARDS,
    title: 'Setting or changing a card PIN',
    summary:
      'Set or change your PIN in the app. We will never ask what your PIN is, and neither should anyone else.',
    keywords: ['pin', 'change', 'forgot', 'unlock', 'card'],
  },
  {
    slug: 'travel-notice',
    category: CATEGORY_CARDS,
    title: 'Using your card abroad',
    summary:
      'No travel notice is needed. Per-channel controls apply everywhere, and a decline abroad carries its reason in the app the same as one at home.',
    keywords: ['abroad', 'travel', 'foreign', 'holiday', 'international', 'atm'],
  },
  {
    slug: 'ledger-vs-available',
    category: CATEGORY_ACCOUNTS,
    title: 'Ledger balance vs available balance',
    summary:
      'Ledger is what has actually posted; available is that minus authorisation holds, plus any arranged overdraft. Both are shown so neither surprises you.',
    keywords: ['balance', 'available', 'ledger', 'hold', 'pending', 'overdraft'],
  },
  {
    slug: 'statements',
    category: CATEGORY_ACCOUNTS,
    title: 'Statements for any period',
    summary:
      'Generate a statement for any date range from Documents. It is produced from the ledger, so opening plus credits minus debits equals closing, exactly.',
    keywords: ['statement', 'pdf', 'download', 'proof', 'documents', 'export'],
  },
  {
    slug: 'close-account',
    category: CATEGORY_ACCOUNTS,
    title: 'Closing an account',
    summary:
      'Request closure from Settings. The balance moves to an account you nominate, the ledger keeps the full history, and statements remain downloadable.',
    keywords: ['close', 'leave', 'shut', 'account', 'cancel'],
  },
  {
    slug: 'deposit-protection',
    category: CATEGORY_ACCOUNTS,
    title: 'How deposits are protected',
    summary:
      'Eligible deposits are protected up to 250,000 per depositor across all ICB accounts combined. See the deposit protection page for what is and is not covered.',
    keywords: ['protected', 'safe', 'guarantee', 'insured', 'deposit', 'fail'],
  },
  {
    slug: 'sign-out-everywhere',
    category: CATEGORY_SECURITY,
    title: 'Signing out of every device',
    summary:
      'Settings lists every active session with its device and location. You can revoke one or all of them; a revoked session stops working immediately.',
    keywords: ['session', 'device', 'sign out', 'logout', 'phone lost', 'revoke'],
  },
  {
    slug: 'scam-messages',
    category: CATEGORY_SECURITY,
    title: 'Spotting messages that are not from us',
    summary:
      'ICB never asks for your password, PIN, a one-time code or your full card number, and never asks you to move money to a “safe account”. Anyone who does is not us.',
    keywords: ['scam', 'phishing', 'fraud', 'email', 'text', 'call', 'safe account'],
  },
  {
    slug: 'dispute-transaction',
    category: CATEGORY_SECURITY,
    title: 'Disputing a transaction',
    summary:
      'Open the transaction and choose Dispute. Provisional credit is assessed within 48 hours, and you are updated at every stage with the reason for the outcome.',
    keywords: ['dispute', 'chargeback', 'unrecognised', 'fraud', 'refund', 'transaction'],
  },
] as const;

export interface Faq {
  readonly q: string;
  readonly a: string;
}

/**
 * The frequently asked, duplicated into the page's FAQPage JSON-LD. Keep answers to one
 * paragraph — structured data truncates anything longer anyway.
 */
export const FAQS: readonly Faq[] = [
  {
    q: 'How long does a transfer take?',
    a: 'Between ICB accounts, instantly, at any hour. To another domestic bank, the next business day. A same-day wire arrives the same day if submitted before 16:00 UTC. International payments take two business days. Every transfer states its rail and expected arrival before you confirm.',
  },
  {
    q: 'What is the difference between my ledger and available balance?',
    a: 'Ledger balance is the sum of everything that has actually posted. Available balance is that figure minus any authorisation holds, plus any arranged overdraft. When you tap your card, a hold is placed immediately — the money is spoken for before the merchant has claimed it. Both numbers are shown so neither surprises you.',
  },
  {
    q: 'Why was my card declined when I have the money?',
    a: 'Most often a control you set: a frozen card, a blocked category, a disabled channel, or a per-transaction limit. Open the card in the app and the decline reason is on the authorisation. If no control was hit, the risk engine may have held it — in which case the rules that fired are shown to you.',
  },
  {
    q: 'I have added a new payee and cannot send the full amount.',
    a: 'New payees are capped for four hours after being added. This is deliberate: it is the single most effective control against someone who has gained access to your session adding their own account and draining the balance in one move. The cap lifts automatically.',
  },
  {
    q: 'How do I dispute a transaction?',
    a: 'Open the transaction and choose Dispute. Pick a reason, describe what happened and attach any evidence. We assess provisional credit within 48 hours and keep you updated at every stage. If the dispute is upheld the credit stands; if not, it is reversed and you are told why.',
  },
  {
    q: 'Can I get a statement for a period that is not a calendar month?',
    a: 'Yes. Documents lets you generate a statement for any date range. It is produced from the ledger itself, so the opening balance plus credits minus debits always equals the closing balance exactly.',
  },
  {
    q: 'What happens if I lose my card?',
    a: 'Freeze it in the app immediately — that takes effect at once, before you speak to anyone. Then report it lost or stolen in the same screen and choose whether to reissue. The old card is cancelled and any pending authorisations on it are released.',
  },
  {
    q: 'How is my money protected?',
    a: 'Eligible deposits are protected up to 250,000 per depositor across all your ICB accounts combined. Separately, your session token never reaches your browser, card numbers are encrypted at rest, and every privileged action is written to a hash-chained audit log.',
  },
] as const;
