'use server';

import {
  advanceClockRequestSchema,
  runScenarioRequestSchema,
  updateRailProfileRequestSchema,
  type EndOfDayReport,
  type ScenarioRun,
} from '@icb/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, api } from '@/lib/api';

import { failed, ok, type ActionState } from './action-feedback';
import { percentToRate, RESET_CONFIRMATION } from './controls.constants';

export interface EodState extends ActionState {
  report: EndOfDayReport | null;
}

export interface ScenarioState extends ActionState {
  run: ScenarioRun | null;
}

const PAGE = '/controls';
const GENERIC_ERROR = 'The request could not be completed. Please try again.';
/** A 404 here means the platform build has no route for the control — say so, plainly. */
const UNSUPPORTED_ERROR = 'This control is not available in the current platform build.';

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.status === 404 ? UNSUPPORTED_ERROR : error.problem.detail;
  }
  return GENERIC_ERROR;
}

function numberField(formData: FormData, key: string): number {
  const raw = formData.get(key);
  const parsed = typeof raw === 'string' ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Advance the clock by an ISO-8601 duration preset, optionally running EOD per day crossed. */
export async function advanceClockAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = advanceClockRequestSchema.safeParse({
    duration: formData.get('duration'),
    runEndOfDay: formData.get('runEndOfDay') === 'on',
  });
  if (!parsed.success) {
    return failed('Choose how far to advance the clock.');
  }

  try {
    await api(`${PAGE}/clock/advance`, { method: 'POST', body: parsed.data });
    revalidatePath(PAGE);
    return ok(`Clock advanced by ${parsed.data.duration ?? ''}.`);
  } catch (error) {
    return failed(errorMessage(error));
  }
}

/** Jump straight to a moment in time. No end-of-day runs — the days in between simply never were. */
export async function jumpClockAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = formData.get('to');
  const target = typeof raw === 'string' ? new Date(raw) : null;
  if (!target || Number.isNaN(target.getTime())) {
    return failed('Enter a valid date and time to jump to.');
  }

  try {
    await api(`${PAGE}/clock/set`, { method: 'POST', body: { to: target.toISOString() } });
    revalidatePath(PAGE);
    return ok('Clock moved.');
  } catch (error) {
    return failed(errorMessage(error));
  }
}

/** Freeze or resume the clock. */
export async function freezeClockAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const frozen = formData.get('frozen') === 'true';
  try {
    await api(`${PAGE}/clock/set`, { method: 'POST', body: { frozen } });
    revalidatePath(PAGE);
    return ok(frozen ? 'Clock frozen.' : 'Clock running again.');
  } catch (error) {
    return failed(errorMessage(error));
  }
}

/** Return the clock to real time. */
export async function resetClockAction(): Promise<ActionState> {
  try {
    await api(`${PAGE}/clock/reset`, { method: 'POST' });
    revalidatePath(PAGE);
    return ok('Clock reset to real time.');
  } catch (error) {
    return failed(errorMessage(error));
  }
}

/** Run the end-of-day pipeline now and hand the full report back for step-by-step display. */
export async function runEndOfDayAction(): Promise<EodState> {
  try {
    const report = await api<EndOfDayReport>(`${PAGE}/end-of-day`, { method: 'POST' });
    revalidatePath(PAGE);
    return { status: 'ok', message: null, report };
  } catch (error) {
    return { status: 'error', message: errorMessage(error), report: null };
  }
}

/** Save one rail's runtime profile — latency band, failure rate, settlement behaviour. */
export async function updateRailAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawRail = formData.get('rail');
  const rail = typeof rawRail === 'string' ? rawRail : '';
  const cutOff = formData.get('cutOffTime');
  const parsed = updateRailProfileRequestSchema.safeParse({
    enabled: formData.get('enabled') === 'true',
    minLatencyMs: numberField(formData, 'minLatencyMs'),
    maxLatencyMs: numberField(formData, 'maxLatencyMs'),
    failureRate: percentToRate(numberField(formData, 'failureRatePercent')),
    settlementDelayHours: numberField(formData, 'settlementDelayHours'),
    cutOffTime: typeof cutOff === 'string' && cutOff !== '' ? cutOff : null,
  });
  if (!parsed.success) {
    return failed('Check the rail values — latency and settlement must be zero or more.');
  }

  try {
    await api(`${PAGE}/rails/${rail}`, { method: 'PATCH', body: parsed.data });
    revalidatePath(PAGE);
    return ok('Rail profile saved.');
  } catch (error) {
    return failed(errorMessage(error));
  }
}

/** Run a named scenario. Runs are synchronous: the returned run is the finished one. */
export async function runScenarioAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ScenarioState> {
  const seed = formData.get('seed');
  const parsed = runScenarioRequestSchema.safeParse({
    name: formData.get('name'),
    intensity: formData.get('intensity'),
    ...(typeof seed === 'string' && seed !== '' ? { seed } : {}),
  });
  if (!parsed.success) {
    return { status: 'error', message: 'Choose a scenario and intensity.', run: null };
  }

  try {
    const run = await api<ScenarioRun>(`${PAGE}/scenarios/runs`, {
      method: 'POST',
      body: parsed.data,
    });
    revalidatePath(PAGE);
    return { status: 'ok', message: null, run };
  } catch (error) {
    return { status: 'error', message: errorMessage(error), run: null };
  }
}

/** Apply chaos settings. The platform endpoint for this is pending; the error path says so. */
export async function updateChaosAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const body = {
    enabled: formData.get('enabled') === 'true',
    databaseLatencyMs: numberField(formData, 'databaseLatencyMs'),
    randomFailureRate: percentToRate(numberField(formData, 'randomFailureRatePercent')),
  };
  try {
    await api(`${PAGE}/chaos`, { method: 'PATCH', body });
    revalidatePath(PAGE);
    return ok('Chaos settings saved.');
  } catch (error) {
    return failed(errorMessage(error));
  }
}

/** Reset the database to its seed state. Armed only by the typed confirmation. */
export async function resetDatabaseAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (formData.get('confirmation') !== RESET_CONFIRMATION) {
    return failed(`Type ${RESET_CONFIRMATION} to confirm the reset.`);
  }
  try {
    await api(`${PAGE}/database/reset`, { method: 'POST' });
    revalidatePath(PAGE);
    return ok('Database reset to seed state.');
  } catch (error) {
    return failed(errorMessage(error));
  }
}
