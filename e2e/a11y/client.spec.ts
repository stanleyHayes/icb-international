import { test } from 'playwright/test';

import { buildInventory } from './support/inventory';
import { describeRouteScans } from './support/scan';

test.describe('client — axe on every route', () => {
  describeRouteScans('client', buildInventory('client'));
});
