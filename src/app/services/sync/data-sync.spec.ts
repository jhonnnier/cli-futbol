import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { dedupeGoalkeeperIds, mergePlayers, mergeGoalkeepers, decideSeed } from './data-sync';
import { Player, Goalkeeper } from '../../models/player.model';

/**
 * Arbitrary for a Goalkeeper.
 *
 * The `id` is drawn from a small domain so that collisions are frequent and the
 * dedupe logic (reassignment of duplicated ids) is actually exercised. The rest
 * of the fields cover the full domain space:
 *   - name: any string
 *   - skill: integer 1..5 (matches the model's "1-5 estrellas")
 *   - selected: boolean
 *   - image: optional — undefined / empty string / a URL-ish string
 */
const goalkeeperArb: fc.Arbitrary<Goalkeeper> = fc.record({
  id: fc.constantFrom('gk1', 'gk2', 'gk5'),
  name: fc.string(),
  skill: fc.integer({ min: 1, max: 5 }),
  selected: fc.boolean(),
  image: fc.option(fc.oneof(fc.constant(''), fc.webUrl()), { nil: undefined }),
}).map((partial) => {
  // Drop the `image` key entirely when the arbitrary produced `undefined`, so
  // that both "absent" and "present" shapes of the optional field are covered.
  const gk: Goalkeeper = {
    id: partial.id,
    name: partial.name,
    skill: partial.skill,
    selected: partial.selected,
  };
  if (partial.image !== undefined) {
    gk.image = partial.image;
  }
  return gk;
});

const goalkeeperListArb: fc.Arbitrary<Goalkeeper[]> = fc.array(goalkeeperArb, { maxLength: 20 });

describe('dedupeGoalkeeperIds', () => {
  it('produces unique ids and preserves cardinality', () => {
    // Feature: firebase-data-sync, Property 5: El dedupe produce IDs únicos y conserva la cardinalidad
    // Validates: Requirements 3.2, 3.5
    fc.assert(
      fc.property(goalkeeperListArb, (list) => {
        const result = dedupeGoalkeeperIds(list);

        // Cardinality: the deduped list has exactly as many elements as the input.
        expect(result.goalkeepers.length).toBe(list.length);

        // Uniqueness: no id is repeated in the result.
        const ids = result.goalkeepers.map((gk) => gk.id);
        expect(new Set(ids).size).toBe(result.goalkeepers.length);
      }),
      { numRuns: 100 },
    );
  });

  it('preserves domain fields and reports the changes correctly', () => {
    // Feature: firebase-data-sync, Property 6: El dedupe preserva los campos de dominio y reporta los cambios correctamente
    // Validates: Requirements 3.1, 3.3, 3.4
    fc.assert(
      fc.property(goalkeeperListArb, (list) => {
        const result = dedupeGoalkeeperIds(list);

        // Domain fields are preserved by position — only the id may change.
        list.forEach((input, i) => {
          const output = result.goalkeepers[i];
          expect(output.name).toBe(input.name);
          expect(output.skill).toBe(input.skill);
          expect(output.selected).toBe(input.selected);
          expect(output.image).toBe(input.image);
        });

        // duplicateIds contains exactly the ids that appeared more than once in the input.
        const counts = new Map<string, number>();
        for (const gk of list) {
          counts.set(gk.id, (counts.get(gk.id) ?? 0) + 1);
        }
        const expectedDuplicateIds = [...counts.entries()]
          .filter(([, count]) => count > 1)
          .map(([id]) => id);
        expect([...result.duplicateIds].sort()).toEqual([...expectedDuplicateIds].sort());

        // Each reassignment has newId !== oldId and its newId matches the id that
        // appears in the corresponding position of the result.
        //
        // A reassigned entry is any position whose resulting id differs from the
        // input id; these must line up one-to-one with `reassignments`, in order.
        const reassignedPositions: number[] = [];
        list.forEach((input, i) => {
          if (result.goalkeepers[i].id !== input.id) {
            reassignedPositions.push(i);
          }
        });

        expect(result.reassignments.length).toBe(reassignedPositions.length);

        reassignedPositions.forEach((position, k) => {
          const reassignment = result.reassignments[k];
          const input = list[position];
          const output = result.goalkeepers[position];

          expect(reassignment.oldId).toBe(input.id);
          expect(reassignment.newId).not.toBe(reassignment.oldId);
          expect(reassignment.newId).toBe(output.id);
          expect(reassignment.name).toBe(input.name);
        });
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Arbitrary for a Player.
 *
 * The `id` is drawn from a small domain so that a remote Player and a seed
 * Player frequently share an id and the merge pairing logic is actually
 * exercised. Numeric attributes are integers 1..5 (matches the model's "1-5
 * estrellas") and `enabled` is a boolean.
 *
 * The optional fields `image`, `order` and `lastToggled` are sometimes present
 * and sometimes absent so that both branches of the merge (fill from seed vs.
 * keep remote) are covered. When the arbitrary decides "absent", the key is
 * omitted from the object entirely (not set to `undefined`).
 */
const playerArb: fc.Arbitrary<Player> = fc
  .record({
    id: fc.constantFrom('p1', 'p2', 'p3'),
    name: fc.string(),
    defense: fc.integer({ min: 1, max: 5 }),
    creation: fc.integer({ min: 1, max: 5 }),
    offense: fc.integer({ min: 1, max: 5 }),
    enabled: fc.boolean(),
    // Optional presentation/state fields: undefined => key omitted below.
    image: fc.option(fc.oneof(fc.constant(''), fc.webUrl()), { nil: undefined }),
    order: fc.option(fc.integer({ min: 0, max: 50 }), { nil: undefined }),
    lastToggled: fc.option(fc.integer({ min: 0, max: 1_000_000 }), { nil: undefined }),
  })
  .map((partial) => {
    const player: Player = {
      id: partial.id,
      name: partial.name,
      defense: partial.defense,
      creation: partial.creation,
      offense: partial.offense,
      enabled: partial.enabled,
    };
    if (partial.image !== undefined) {
      player.image = partial.image;
    }
    if (partial.order !== undefined) {
      player.order = partial.order;
    }
    if (partial.lastToggled !== undefined) {
      player.lastToggled = partial.lastToggled;
    }
    return player;
  });

const playerListArb: fc.Arbitrary<Player[]> = fc.array(playerArb, { maxLength: 20 });

describe('mergePlayers / mergeGoalkeepers idempotence', () => {
  it('mergePlayers is idempotent under the same seed', () => {
    // Feature: firebase-data-sync, Property 2: Idempotencia del merge
    // Validates: Requirements 2.5, 6.6
    fc.assert(
      fc.property(playerListArb, playerListArb, (remote, seed) => {
        const once = mergePlayers(remote, seed);
        const twice = mergePlayers(once, seed);
        expect(twice).toEqual(once);
      }),
      { numRuns: 100 },
    );
  });

  it('mergeGoalkeepers is idempotent under the same seed', () => {
    // Feature: firebase-data-sync, Property 2: Idempotencia del merge
    // Validates: Requirements 2.5, 6.6
    fc.assert(
      fc.property(goalkeeperListArb, goalkeeperListArb, (remote, seed) => {
        const once = mergeGoalkeepers(remote, seed);
        const twice = mergeGoalkeepers(once, seed);
        expect(twice).toEqual(once);
      }),
      { numRuns: 100 },
    );
  });
});

describe('mergePlayers preserves remote state and fills presentation from seed', () => {
  it('keeps remote image/order when present, fills from seed when absent, keeps other fields and unmatched remotes', () => {
    // Feature: firebase-data-sync, Property 3: mergePlayers conserva estado remoto y rellena presentación desde el JSON
    // Validates: Requirements 6.1, 6.2, 6.3
    fc.assert(
      fc.property(playerListArb, playerListArb, (remote, seed) => {
        const merged = mergePlayers(remote, seed);

        // First seed occurrence wins (matches the implementation's pairing).
        const seedById = new Map<string, Player>();
        for (const player of seed) {
          if (!seedById.has(player.id)) {
            seedById.set(player.id, player);
          }
        }

        // Same cardinality and order as the remote input.
        expect(merged.length).toBe(remote.length);

        remote.forEach((remotePlayer, i) => {
          const result = merged[i];
          const seedPlayer = seedById.get(remotePlayer.id);

          // Non-presentation fields are always the remote ones.
          expect(result.id).toBe(remotePlayer.id);
          expect(result.name).toBe(remotePlayer.name);
          expect(result.defense).toBe(remotePlayer.defense);
          expect(result.creation).toBe(remotePlayer.creation);
          expect(result.offense).toBe(remotePlayer.offense);
          expect(result.enabled).toBe(remotePlayer.enabled);
          expect(result.lastToggled).toBe(remotePlayer.lastToggled);

          if (!seedPlayer) {
            // Remote without a seed pair stays intact.
            expect(result.image).toBe(remotePlayer.image);
            expect(result.order).toBe(remotePlayer.order);
            return;
          }

          // image: remote wins when it has a truthy value; otherwise fill from
          // seed when the seed has a truthy value.
          if (remotePlayer.image) {
            expect(result.image).toBe(remotePlayer.image);
          } else if (seedPlayer.image) {
            expect(result.image).toBe(seedPlayer.image);
          } else {
            expect(result.image).toBe(remotePlayer.image);
          }

          // order: remote wins when present (!== undefined); otherwise fill from
          // seed when the seed has it.
          if (remotePlayer.order !== undefined) {
            expect(result.order).toBe(remotePlayer.order);
          } else if (seedPlayer.order !== undefined) {
            expect(result.order).toBe(seedPlayer.order);
          } else {
            expect(result.order).toBe(remotePlayer.order);
          }
        });
      }),
      { numRuns: 100 },
    );
  });
});

describe('mergeGoalkeepers preserves remote state and fills image from seed', () => {
  it('keeps remote image when present, fills from seed when absent, keeps other fields and unmatched remotes', () => {
    // Feature: firebase-data-sync, Property 4: mergeGoalkeepers conserva estado remoto y rellena image desde el JSON
    // Validates: Requirements 6.4
    fc.assert(
      fc.property(goalkeeperListArb, goalkeeperListArb, (remote, seed) => {
        const merged = mergeGoalkeepers(remote, seed);

        // First seed occurrence wins (matches the implementation's pairing).
        const seedById = new Map<string, Goalkeeper>();
        for (const goalkeeper of seed) {
          if (!seedById.has(goalkeeper.id)) {
            seedById.set(goalkeeper.id, goalkeeper);
          }
        }

        // Same cardinality and order as the remote input.
        expect(merged.length).toBe(remote.length);

        remote.forEach((remoteGoalkeeper, i) => {
          const result = merged[i];
          const seedGoalkeeper = seedById.get(remoteGoalkeeper.id);

          // Non-image fields are always the remote ones.
          expect(result.id).toBe(remoteGoalkeeper.id);
          expect(result.name).toBe(remoteGoalkeeper.name);
          expect(result.skill).toBe(remoteGoalkeeper.skill);
          expect(result.selected).toBe(remoteGoalkeeper.selected);

          if (!seedGoalkeeper) {
            // Remote without a seed pair stays intact.
            expect(result.image).toBe(remoteGoalkeeper.image);
            return;
          }

          // image: remote wins when it has a truthy value; otherwise fill from
          // seed when the seed has a truthy value.
          if (remoteGoalkeeper.image) {
            expect(result.image).toBe(remoteGoalkeeper.image);
          } else if (seedGoalkeeper.image) {
            expect(result.image).toBe(seedGoalkeeper.image);
          } else {
            expect(result.image).toBe(remoteGoalkeeper.image);
          }
        });
      }),
      { numRuns: 100 },
    );
  });
});

describe('decideSeed decides seed vs. merge from the remote state', () => {
  it('seeds when remote is empty and merges keeping every remote id when remote has data (players)', () => {
    // Feature: firebase-data-sync, Property 1: Decisión de seed vs. merge según el estado remoto
    // Validates: Requirements 2.1, 2.2, 2.3, 2.4
    fc.assert(
      fc.property(playerListArb, playerListArb, (remote, seedPrepared) => {
        const decision = decideSeed(remote, seedPrepared, mergePlayers);

        if (remote.length === 0) {
          // Empty remote => seed: the prepared seed is returned as-is (same reference).
          expect(decision.action).toBe('seed');
          expect(decision.data).toBe(seedPrepared);
        } else {
          // Non-empty remote => merge: the remote state is used as the source and
          // every remote id survives in the merged data (never dropped/replaced).
          expect(decision.action).toBe('merge');
          const resultIds = new Set(decision.data.map((p) => p.id));
          for (const remotePlayer of remote) {
            expect(resultIds.has(remotePlayer.id)).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('seeds when remote is empty and merges keeping every remote id when remote has data (goalkeepers)', () => {
    // Feature: firebase-data-sync, Property 1: Decisión de seed vs. merge según el estado remoto
    // Validates: Requirements 2.1, 2.2, 2.3, 2.4
    fc.assert(
      fc.property(goalkeeperListArb, goalkeeperListArb, (remote, seedPrepared) => {
        const decision = decideSeed(remote, seedPrepared, mergeGoalkeepers);

        if (remote.length === 0) {
          // Empty remote => seed: the prepared seed is returned as-is (same reference).
          expect(decision.action).toBe('seed');
          expect(decision.data).toBe(seedPrepared);
        } else {
          // Non-empty remote => merge: every remote id survives in the merged data.
          expect(decision.action).toBe('merge');
          const resultIds = new Set(decision.data.map((gk) => gk.id));
          for (const remoteGoalkeeper of remote) {
            expect(resultIds.has(remoteGoalkeeper.id)).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
