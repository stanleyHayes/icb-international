import {
  beneficiaryQuerySchema,
  beneficiarySchema,
  beneficiaryVerificationSchema,
  createBeneficiaryRequestSchema,
  updateBeneficiaryRequestSchema,
  verifyBeneficiaryRequestSchema,
} from '../../../src/index.js';
import { idSchema } from '../../../src/common/primitives.js';
import { PAGE_SCHEMAS } from '../components.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

const BENEFICIARY_ID = { beneficiaryId: idSchema } as const;

export const beneficiariesOperations = defineOperations([
  {
    method: 'get',
    path: '/beneficiaries',
    tag: TAG.beneficiaries,
    operationId: 'listBeneficiaries',
    summary: 'Saved payees',
    query: beneficiaryQuerySchema,
    response: success(STATUS.ok, 'A cursor page of beneficiaries.', PAGE_SCHEMAS.BeneficiaryPage),
  },
  {
    method: 'post',
    path: '/beneficiaries',
    tag: TAG.beneficiaries,
    operationId: 'createBeneficiary',
    summary: 'Add a payee (cooling-off applies)',
    request: createBeneficiaryRequestSchema,
    response: success(STATUS.created, 'The beneficiary, in cooling-off.', beneficiarySchema),
    errors: [{ status: STATUS.unprocessable }],
  },
  {
    method: 'get',
    path: '/beneficiaries/{beneficiaryId}',
    tag: TAG.beneficiaries,
    operationId: 'getBeneficiary',
    summary: 'Payee detail with verification state',
    pathParams: BENEFICIARY_ID,
    response: success(STATUS.ok, 'The beneficiary.', beneficiarySchema),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'patch',
    path: '/beneficiaries/{beneficiaryId}',
    tag: TAG.beneficiaries,
    operationId: 'updateBeneficiary',
    summary: 'Rename or favourite a payee',
    pathParams: BENEFICIARY_ID,
    request: updateBeneficiaryRequestSchema,
    response: success(STATUS.ok, 'The updated beneficiary.', beneficiarySchema),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'delete',
    path: '/beneficiaries/{beneficiaryId}',
    tag: TAG.beneficiaries,
    operationId: 'deleteBeneficiary',
    summary: 'Remove a payee',
    pathParams: BENEFICIARY_ID,
    response: success(STATUS.noContent, 'Beneficiary removed.'),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'post',
    path: '/beneficiaries/{beneficiaryId}/verify/send',
    tag: TAG.beneficiaries,
    operationId: 'sendVerificationDeposits',
    summary: 'Send the two micro-deposits (simulated)',
    pathParams: BENEFICIARY_ID,
    idempotent: true,
    response: success(
      STATUS.ok,
      'Verification state after dispatch.',
      beneficiaryVerificationSchema,
    ),
    errors: [{ status: STATUS.notFound }, { status: STATUS.conflict }],
  },
  {
    method: 'post',
    path: '/beneficiaries/{beneficiaryId}/verify/confirm',
    tag: TAG.beneficiaries,
    operationId: 'confirmVerificationDeposits',
    summary: 'Confirm the two micro-deposit amounts',
    pathParams: BENEFICIARY_ID,
    request: verifyBeneficiaryRequestSchema,
    idempotent: true,
    response: success(
      STATUS.ok,
      'Verification state after the attempt.',
      beneficiaryVerificationSchema,
    ),
    errors: [
      { status: STATUS.notFound },
      { status: STATUS.conflict, description: 'Attempts exhausted; verification is locked.' },
      { status: STATUS.unprocessable, description: 'The amounts do not match.' },
    ],
  },
  {
    method: 'get',
    path: '/beneficiaries/{beneficiaryId}/verify',
    tag: TAG.beneficiaries,
    operationId: 'getBeneficiaryVerification',
    summary: 'Micro-deposit verification status',
    pathParams: BENEFICIARY_ID,
    response: success(STATUS.ok, 'The current verification state.', beneficiaryVerificationSchema),
    errors: [{ status: STATUS.notFound }],
  },
]);
