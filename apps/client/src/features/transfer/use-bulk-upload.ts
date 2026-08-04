'use client';

import type { AccountSummary, BulkTransferResult } from '@icb/contracts';
import { useState } from 'react';

import { getScale } from '@icb/money';

import { submitBulkTransferAction } from './bulk-actions';
import { parseBulkCsv, type ParsedBulkRow } from './bulk-csv';

export type BulkStage = 'upload' | 'preview' | 'done';

/** State machine behind the bulk CSV flow: upload → preview → done. */
export function useBulkUpload(accounts: AccountSummary[]) {
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id ?? '');
  const [rows, setRows] = useState<ParsedBulkRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [stage, setStage] = useState<BulkStage>('upload');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkTransferResult | null>(null);

  const account = accounts.find((a) => a.id === fromAccountId) ?? accounts[0];
  const currency = account?.currency ?? 'USD';

  async function onFiles(files: File[]) {
    const file = files[0];
    if (!file) {
      return;
    }
    const parsed = parseBulkCsv(await file.text(), getScale(currency));
    setRows(parsed.rows);
    setFileError(parsed.fileError);
    setStage(parsed.fileError ? 'upload' : 'preview');
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const outcome = await submitBulkTransferAction({
      fromAccountId,
      currency,
      rows: rows.map((row) => ({
        rowNumber: row.rowNumber,
        accountHolderName: row.accountHolderName,
        sortCode: row.sortCode,
        accountNumber: row.accountNumber,
        amountMinorUnits: row.amountMinorUnits ?? 0,
        ...(row.reference ? { reference: row.reference } : {}),
      })),
    });
    setBusy(false);
    if (outcome.ok) {
      setResult(outcome.data);
      setStage('done');
    } else {
      setError(outcome.error);
    }
  }

  function reset() {
    setRows([]);
    setFileError(null);
    setError(null);
    setResult(null);
    setStage('upload');
  }

  return {
    fromAccountId,
    setFromAccountId,
    rows,
    fileError,
    stage,
    busy,
    error,
    result,
    account,
    currency,
    onFiles,
    submit,
    reset,
  };
}
