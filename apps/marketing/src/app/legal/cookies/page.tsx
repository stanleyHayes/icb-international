import type { Metadata } from 'next';

import { LEGAL_DOCUMENTS } from '@/content/legal';

import { LegalPage, legalMetadata } from '../shared';

export const metadata: Metadata = legalMetadata('cookies');

export default function Page() {
  return <LegalPage document={LEGAL_DOCUMENTS['cookies']} />;
}
