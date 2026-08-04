import { Card, CardBody } from '@icb/ui';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

/** Shows a real balanced transaction rather than describing one. */
export function TransparencySection() {
  return (
      <section className="border-y border-[var(--icb-border)] bg-[var(--icb-bg-subtle)]">
        <div className="mx-auto max-w-[1200px] px-5 py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-[var(--icb-accent-text)] uppercase">
                Transparency
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
                Every posting, on the record
              </h2>
              <p className="mt-4 text-[var(--icb-text-muted)]">
                Open any transaction and you see both sides of it — what was debited, what was
                credited, the fee, the rate, and the exact moment it settled. Nothing is netted off
                and nothing is rounded away.
              </p>
              <Link
                href="/security"
                className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--icb-primary)] hover:underline"
              >
                How we keep it safe
                <ArrowRight size={15} />
              </Link>
            </div>

            <Card className="overflow-hidden">
              <div className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-muted)] px-5 py-2.5 font-mono text-[0.7rem] tracking-wide text-[var(--icb-text-subtle)]">
                TRANSACTION TRF-VPDCKVKD · POSTED
              </div>
              <CardBody className="pt-4">
                <table className="w-full text-sm">
                  <caption className="sr-only">Postings for transaction TRF-VPDCKVKD</caption>
                  <thead>
                    <tr className="text-left text-[0.7rem] tracking-[0.1em] text-[var(--icb-text-subtle)] uppercase">
                      <th scope="col" className="pb-2 font-medium">
                        Account
                      </th>
                      <th scope="col" className="pb-2 text-right font-medium">
                        Debit
                      </th>
                      <th scope="col" className="pb-2 text-right font-medium">
                        Credit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    <tr className="border-t border-[var(--icb-border)]">
                      <td className="py-2.5">Everyday Current ···· 9806</td>
                      <td className="tabular py-2.5 text-right">250.00</td>
                      <td className="py-2.5 text-right text-[var(--icb-text-subtle)]">—</td>
                    </tr>
                    <tr className="border-t border-[var(--icb-border)]">
                      <td className="py-2.5">Reserve Savings ···· 2081</td>
                      <td className="py-2.5 text-right text-[var(--icb-text-subtle)]">—</td>
                      <td className="tabular py-2.5 text-right">250.00</td>
                    </tr>
                    <tr className="border-t-2 border-[var(--icb-border-strong)] font-semibold">
                      <td className="py-2.5">Balanced</td>
                      <td className="tabular py-2.5 text-right">250.00</td>
                      <td className="tabular py-2.5 text-right">250.00</td>
                    </tr>
                  </tbody>
                </table>
              </CardBody>
            </Card>
          </div>
        </div>
      </section>
  );
}
