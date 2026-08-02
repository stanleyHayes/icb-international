/**
 * Injection token for the adapter set.
 *
 * The registry takes the adapters as one array rather than five constructor arguments so that
 * adding a rail is a change to the module wiring alone, and so the registry never grows a branch
 * per network.
 */
export const RAIL_ADAPTERS = Symbol('ICB_RAIL_ADAPTERS');
