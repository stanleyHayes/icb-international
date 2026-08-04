import type { AccountDetail, Product } from '@icb/contracts';
import { Card, CardBody, CardHeader } from '@icb/ui';

import { InterestForm } from '@/features/accounts/interest-form';
import { ManualPostingForm } from '@/features/accounts/manual-posting-form';
import { OverdraftForm } from '@/features/accounts/overdraft-form';
import { ProductForm } from '@/features/accounts/product-form';
import { StatusForm } from '@/features/accounts/status-form';

/** Only products of the same kind and currency are valid targets for a product change. */
function productOptions(account: AccountDetail, products: Product[]) {
  return products
    .filter(
      (product) =>
        product.kind === account.kind &&
        product.code !== account.productCode &&
        product.currencies.includes(account.currency),
    )
    .map((product) => ({ code: product.code, name: product.name }));
}

/** The write side of the account console: lifecycle, pricing, product and manual postings. */
export function OpsPanels({
  account,
  products,
}: Readonly<{ account: AccountDetail; products: Product[] }>) {
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Status"
            description="Freeze, dormancy and closure are audited lifecycle transitions"
          />
          <CardBody className="pt-0">
            <StatusForm accountId={account.id} currentStatus={account.status} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Overdraft limit" />
          <CardBody className="pt-0">
            <OverdraftForm
              accountId={account.id}
              currency={account.currency}
              currentMinorUnits={account.balances.overdraftLimit.minorUnits}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Product" description={`Currently ${account.productName}`} />
          <CardBody className="pt-0">
            <ProductForm accountId={account.id} products={productOptions(account, products)} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Interest override"
            description="Overrides the product's scheduled rate for this account"
          />
          <CardBody className="pt-0">
            <InterestForm accountId={account.id} currentRate={account.interestRate} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Manual credit or debit"
          description="Posts only after a second operator approves it in the approvals inbox"
        />
        <CardBody className="pt-0">
          <ManualPostingForm accountId={account.id} currency={account.currency} />
        </CardBody>
      </Card>
    </>
  );
}
