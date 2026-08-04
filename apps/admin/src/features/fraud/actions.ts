'use server';

import { resolveRiskCaseRequestSchema, updateRiskRuleRequestSchema } from '@icb/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, api } from '@/lib/api';

export interface FraudActionState {
  status: 'idle' | 'error' | 'done';
  message: string | null;
  fieldErrors: Record<string, string>;
}

function errorState(error: unknown, fallback: string): FraudActionState {
  return {
    status: 'error',
    message: error instanceof ApiError ? error.problem.detail : fallback,
    fieldErrors: {},
  };
}

function fieldErrorsOf(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) {
  return Object.fromEntries(issues.map((issue) => [issue.path.map(String).join('.'), issue.message]));
}

/** Claim a case from the queue. The API attributes the claim to the session's staff member. */
export async function claimCaseAction(caseId: string): Promise<FraudActionState> {
  try {
    await api(`/risk/cases/${caseId}/assign`, { method: 'POST' });
    revalidatePath(`/fraud/${caseId}`);
    return { status: 'done', message: null, fieldErrors: {} };
  } catch (error) {
    return errorState(error, 'The case could not be claimed. Please try again.');
  }
}

/**
 * Resolve a fraud case.
 *
 * The note is mandatory and validated by the shared contract schema: blocking a customer's
 * money without a recorded reason is not a decision a bank gets to make.
 */
export async function resolveCaseAction(
  _previous: FraudActionState,
  formData: FormData,
): Promise<FraudActionState> {
  const caseIdValue = formData.get('caseId');
  const caseId = typeof caseIdValue === 'string' ? caseIdValue : '';

  const parsed = resolveRiskCaseRequestSchema.safeParse({
    action: formData.get('action'),
    note: formData.get('note'),
  });
  if (!parsed.success) {
    return { status: 'error', message: null, fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }

  try {
    await api(`/risk/cases/${caseId}/resolve`, { method: 'POST', body: parsed.data });
    revalidatePath(`/fraud/${caseId}`);
    revalidatePath('/fraud');
    return { status: 'done', message: null, fieldErrors: {} };
  } catch (error) {
    return errorState(error, 'The resolution could not be recorded. Please try again.');
  }
}

/** A rule parameter keeps the type the rule declared for it. */
type RuleParameter = string | number | boolean;

/** Coerce a parameter draft back to the type the rule declared for it. */
function coerceParameter(draft: string, current: RuleParameter): RuleParameter {
  const numeric = Number(draft);
  let value: RuleParameter = draft;
  if (typeof current === 'boolean') {
    value = draft === 'true';
  } else if (typeof current === 'number' && Number.isFinite(numeric)) {
    value = numeric;
  }
  return value;
}

/**
 * Update a detection rule.
 *
 * Every change carries a reason into the audit trail; the API enforces it, this action only
 * shapes the payload. Parameter values keep the type the rule already declared, so a threshold
 * stays a number and a flag stays a boolean.
 */
export async function updateRuleAction(
  _previous: FraudActionState,
  formData: FormData,
): Promise<FraudActionState> {
  const ruleIdValue = formData.get('ruleId');
  const ruleId = typeof ruleIdValue === 'string' ? ruleIdValue : '';
  const currentValue = formData.get('currentParameters');
  const current: Record<string, RuleParameter> =
    typeof currentValue === 'string'
      ? (JSON.parse(currentValue) as Record<string, RuleParameter>)
      : {};

  const parameters: Record<string, RuleParameter> = {};
  for (const [key, existing] of Object.entries(current)) {
    const draft = formData.get(`param.${key}`);
    if (typeof draft === 'string') {
      parameters[key] = coerceParameter(draft, existing);
    }
  }

  const weightDraft = Number(formData.get('weight'));
  const parsed = updateRiskRuleRequestSchema.safeParse({
    enabled: formData.get('enabled') === 'on',
    ...(Number.isFinite(weightDraft) ? { weight: weightDraft } : {}),
    ...(Object.keys(parameters).length > 0 ? { parameters } : {}),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    return { status: 'error', message: null, fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }

  try {
    await api(`/risk/rules/${ruleId}`, { method: 'PATCH', body: parsed.data });
    revalidatePath('/fraud/rules');
    return { status: 'done', message: null, fieldErrors: {} };
  } catch (error) {
    return errorState(error, 'The rule could not be updated. Please try again.');
  }
}
