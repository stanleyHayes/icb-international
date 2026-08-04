import { test } from 'playwright/test';

import { buildInventory } from './support/inventory';
import { describeRouteScans } from './support/scan';

test.describe('marketing — axe on every route', () => {
  describeRouteScans('marketing', buildInventory('marketing'));
});
