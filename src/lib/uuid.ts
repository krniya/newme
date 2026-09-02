import { getRandomValues } from 'expo-crypto';
import { createUuidV7 } from './uuidCore';

/**
 * The app's id generator, wired to the real clock and a CSPRNG.
 *
 * Lives outside `src/domain` because it reads the clock and consumes
 * randomness — both forbidden there, since they would make replay
 * non-deterministic (see `src/domain/__tests__/purity.test.ts`).
 */
export const uuidv7 = createUuidV7({
  now: () => Date.now(),
  random: (byteLength) => getRandomValues(new Uint8Array(byteLength)),
});

export { isUuidV7, timestampOfUuidV7 } from './uuidCore';
