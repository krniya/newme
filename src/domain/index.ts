/**
 * The domain layer: every rule that decides what a user's actions are worth.
 *
 * Pure TypeScript by contract — no React, no React Native, no database, no
 * I/O, no clock reads except through an explicitly passed `Date`. That is
 * what lets the whole progression system be replayed from the event log
 * (spec §8.2), which in turn is what makes import and retroactive rule
 * changes possible without a server to fix things.
 *
 * The contract is enforced by `__tests__/purity.test.ts`.
 */

export * from './types';

export * from './time/localDate';

export * from './xp/constants';
export * from './xp/curve';
export * from './xp/dailyCap';
export * from './xp/award';

export * from './momentum/momentum';
export * from './scheduling/schedule';
export * from './streak/streak';
export * from './insights/automaticity';
