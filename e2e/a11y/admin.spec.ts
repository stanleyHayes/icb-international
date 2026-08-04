import { test } from 'playwright/test';

import { buildInventory } from './support/inventory';
import { describeRouteScans } from './support/scan';

test.describe('admin — axe on every route', () => {
  describeRouteScans('admin', buildInventory('admin'));
});
