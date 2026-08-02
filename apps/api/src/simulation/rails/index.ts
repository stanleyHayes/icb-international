import type { Provider } from '@nestjs/common';

import { AchRail } from './ach.rail.js';
import { CardNetworkRail } from './card-network.rail.js';
import { InternalRail } from './internal.rail.js';
import { RailRegistry } from './rail.registry.js';
import { RAIL_ADAPTERS } from './rail.tokens.js';
import { SwiftRail } from './swift.rail.js';
import { WireRail } from './wire.rail.js';

export { AchRail } from './ach.rail.js';
export { CardNetworkRail } from './card-network.rail.js';
export { InternalRail } from './internal.rail.js';
export { RailRegistry } from './rail.registry.js';
export { SwiftRail } from './swift.rail.js';
export { WireRail } from './wire.rail.js';
export { RAIL_UNAVAILABLE } from './rail-codes.js';
export type { Rail, RailResult, RailSubmission } from './rail.types.js';

/** Everything the rail layer contributes to the simulation module. */
export const RAIL_PROVIDERS: Provider[] = [
  InternalRail,
  AchRail,
  WireRail,
  SwiftRail,
  CardNetworkRail,
  {
    provide: RAIL_ADAPTERS,
    useFactory: (
      internal: InternalRail,
      ach: AchRail,
      wire: WireRail,
      swift: SwiftRail,
      card: CardNetworkRail,
    ) => [internal, ach, wire, swift, card],
    inject: [InternalRail, AchRail, WireRail, SwiftRail, CardNetworkRail],
  },
  RailRegistry,
];
