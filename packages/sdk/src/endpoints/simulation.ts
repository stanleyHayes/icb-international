import { type z } from 'zod';
import {
  advanceClockRequestSchema,
  clockStateSchema,
  endOfDayReportSchema,
  featureFlagSchema,
  itemsEnvelopeSchema,
  ledgerIntegrityReportSchema,
  railProfileSchema,
  runScenarioRequestSchema,
  scenarioRunSchema,
  scenarioSchema,
  setClockRequestSchema,
  simulationStateSchema,
  updateFeatureFlagRequestSchema,
  updateRailProfileRequestSchema,
} from '@icb/contracts';

import { get, patch, post, put, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const simulationEndpoints = {
  state: get('/simulation/state', simulationStateSchema),
  clock: get('/simulation/clock', clockStateSchema),
  advanceClock: post('/simulation/clock/advance', clockStateSchema, {
    body: advanceClockRequestSchema,
  }),
  setClock: put('/simulation/clock', clockStateSchema, { body: setClockRequestSchema }),
  resetClock: post('/simulation/clock/reset', clockStateSchema, {}),
  listRails: get('/simulation/rails', itemsEnvelopeSchema(railProfileSchema)),
  updateRail: patch('/simulation/rails/:rail', railProfileSchema, {
    body: updateRailProfileRequestSchema,
  }),
  listScenarios: get('/simulation/scenarios', itemsEnvelopeSchema(scenarioSchema)),
  runScenario: post('/simulation/scenarios/runs', scenarioRunSchema, {
    body: runScenarioRequestSchema,
  }),
  getScenarioRun: get('/simulation/scenarios/runs/:runId', scenarioRunSchema),
  runEndOfDay: post('/simulation/end-of-day', endOfDayReportSchema, {}),
  verifyLedger: post('/simulation/ledger/verification', ledgerIntegrityReportSchema, {}),
  listFlags: get('/simulation/flags', itemsEnvelopeSchema(featureFlagSchema)),
  updateFlag: patch('/simulation/flags/:flagKey', featureFlagSchema, {
    body: updateFeatureFlagRequestSchema,
  }),
};

export function createSimulationApi(call: Requester) {
  return {
    state: (options?: RequestOptions) => call(simulationEndpoints.state, { options }),
    clock: (options?: RequestOptions) => call(simulationEndpoints.clock, { options }),
    advanceClock: (body: z.input<typeof advanceClockRequestSchema>, options?: RequestOptions) =>
      call(simulationEndpoints.advanceClock, { body, options }),
    setClock: (body: z.input<typeof setClockRequestSchema>, options?: RequestOptions) =>
      call(simulationEndpoints.setClock, { body, options }),
    resetClock: (options?: RequestOptions) => call(simulationEndpoints.resetClock, { options }),
    listRails: (options?: RequestOptions) => call(simulationEndpoints.listRails, { options }),
    updateRail: (
      rail: string,
      body: z.input<typeof updateRailProfileRequestSchema>,
      options?: RequestOptions,
    ) => call(simulationEndpoints.updateRail, { params: { rail }, body, options }),
    listScenarios: (options?: RequestOptions) => call(simulationEndpoints.listScenarios, { options }),
    runScenario: (body: z.input<typeof runScenarioRequestSchema>, options?: RequestOptions) =>
      call(simulationEndpoints.runScenario, { body, options }),
    getScenarioRun: (runId: string, options?: RequestOptions) =>
      call(simulationEndpoints.getScenarioRun, { params: { runId }, options }),
    runEndOfDay: (options?: RequestOptions) => call(simulationEndpoints.runEndOfDay, { options }),
    verifyLedger: (options?: RequestOptions) => call(simulationEndpoints.verifyLedger, { options }),
    listFlags: (options?: RequestOptions) => call(simulationEndpoints.listFlags, { options }),
    updateFlag: (
      flagKey: string,
      body: z.input<typeof updateFeatureFlagRequestSchema>,
      options?: RequestOptions,
    ) => call(simulationEndpoints.updateFlag, { params: { flagKey }, body, options }),
  };
}

export type SimulationApi = ReturnType<typeof createSimulationApi>;
