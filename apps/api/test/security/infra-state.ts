import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Where the global setup publishes the throwaway-Redis coordinates for worker processes. */
export const INFRA_STATE_PATH = join(tmpdir(), 'icb-sec02-infra.json');
