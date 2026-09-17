import { Player, Goalkeeper } from '../../models/player.model';

/**
 * Result of the goalkeeper id dedupe: the corrected list plus a record of what changed.
 */
export interface DedupeResult {
  /** List with unique ids, keeping the input order and cardinality. */
  goalkeepers: Goalkeeper[];
  /** One entry per goalkeeper whose id was effectively reassigned. */
  reassignments: Array<{
    oldId: string;
    newId: string;
    name: string;
  }>;
  /** Ids that appeared more than once in the input. */
  duplicateIds: string[];
}

/**
 * Decision produced from the remote collection state: whether to seed the
 * prepared data or to merge the remote data with the seed, plus the resulting list.
 */
export interface SeedDecision<T> {
  action: 'seed' | 'merge';
  data: T[];
}

/**
 * Detects repeated ids and reassigns a deterministic unique id to the
 * occurrences after the first one, preserving name/skill/selected/image.
 *
 * Reassignment rule (deterministic, no randomness or timestamps):
 *   - The FIRST occurrence of an id keeps its original id.
 *   - Each subsequent occurrence of the same id receives `${id}-${n}` with
 *     n = 2, 3, ... according to the order of appearance.
 *   - If the candidate id `${id}-${n}` already exists in the input list (or has
 *     already been assigned), n is incremented until a free id is found
 *     (guarantees global uniqueness).
 * Example: [gk5(Yonathan), gk5(Ricardo)] -> [gk5(Yonathan), gk5-2(Ricardo)].
 */
export function dedupeGoalkeeperIds(goalkeepers: Goalkeeper[]): DedupeResult {
  // Reserve every original id up-front so a reassigned id can never collide
  // with an original id that appears later in the list (global uniqueness).
  const usedIds = new Set<string>(goalkeepers.map((gk) => gk.id));

  // Count how many times each id appears in the input to derive `duplicateIds`.
  const idCounts = new Map<string, number>();
  for (const gk of goalkeepers) {
    idCounts.set(gk.id, (idCounts.get(gk.id) ?? 0) + 1);
  }

  const duplicateIds: string[] = [];
  for (const [id, count] of idCounts) {
    if (count > 1) {
      duplicateIds.push(id);
    }
  }

  const seenIds = new Set<string>();
  const reassignments: DedupeResult['reassignments'] = [];

  const deduped = goalkeepers.map((gk) => {
    const originalId = gk.id;

    // First occurrence keeps its original id.
    if (!seenIds.has(originalId)) {
      seenIds.add(originalId);
      return { ...gk };
    }

    // Subsequent occurrence: find the next free `${id}-${n}` (n = 2, 3, ...).
    let n = 2;
    let candidate = `${originalId}-${n}`;
    while (usedIds.has(candidate)) {
      n += 1;
      candidate = `${originalId}-${n}`;
    }

    usedIds.add(candidate);
    reassignments.push({ oldId: originalId, newId: candidate, name: gk.name });

    return { ...gk, id: candidate };
  });

  return {
    goalkeepers: deduped,
    reassignments,
    duplicateIds,
  };
}

/**
 * Merges the remote list (source of state) with Seed_JSON (source of
 * presentation) for Player. Rule per remote document:
 *   - start from the remote Player (source of truth for state),
 *   - if the remote has no `image` and the matching seed Player (by id) does,
 *     assign the seed `image`,
 *   - if the remote has no `order` and the matching seed Player does, assign
 *     the seed `order`,
 *   - the remote keeps its own `image`/`order` when it already has them.
 * Remote documents with no match in the seed are kept untouched.
 *
 * "Has image" is a truthiness check (empty string/undefined = absent), matching
 * how FirebaseService.savePlayer treats `image`. "Has order" uses `!== undefined`
 * so that `order: 0` counts as present, matching how `order` is persisted.
 *
 * Deterministic and idempotent: mergePlayers(mergePlayers(r, s), s) is deeply
 * equal to mergePlayers(r, s). No `image`/`order` key is ever added with an
 * `undefined` value, so re-running the merge does not alter deep equality.
 */
export function mergePlayers(remote: Player[], seed: Player[]): Player[] {
  const seedById = new Map<string, Player>();
  for (const player of seed) {
    // First occurrence wins to keep the merge deterministic.
    if (!seedById.has(player.id)) {
      seedById.set(player.id, player);
    }
  }

  return remote.map((remotePlayer) => {
    const seedPlayer = seedById.get(remotePlayer.id);
    if (!seedPlayer) {
      // No pair in the seed: keep the remote player untouched.
      return { ...remotePlayer };
    }

    const merged: Player = { ...remotePlayer };

    // Fill `image` from the seed only when the remote lacks it (truthiness).
    if (!merged.image && seedPlayer.image) {
      merged.image = seedPlayer.image;
    }

    // Fill `order` from the seed only when the remote lacks it (`undefined`).
    if (merged.order === undefined && seedPlayer.order !== undefined) {
      merged.order = seedPlayer.order;
    }

    return merged;
  });
}

/**
 * Analogous to mergePlayers for Goalkeeper, preserving only `image`.
 *   - start from the remote Goalkeeper,
 *   - if the remote has no `image` and the matching seed Goalkeeper (by id)
 *     does, assign the seed `image`.
 * All other remote fields are kept. Remote documents with no match in the seed
 * are kept untouched.
 *
 * "Has image" is a truthiness check (empty string/undefined = absent), matching
 * how `image` is treated across the codebase.
 *
 * Deterministic and idempotent: mergeGoalkeepers(mergeGoalkeepers(r, s), s) is
 * deeply equal to mergeGoalkeepers(r, s). No `image` key is ever added with an
 * `undefined` value.
 */
export function mergeGoalkeepers(remote: Goalkeeper[], seed: Goalkeeper[]): Goalkeeper[] {
  const seedById = new Map<string, Goalkeeper>();
  for (const goalkeeper of seed) {
    // First occurrence wins to keep the merge deterministic.
    if (!seedById.has(goalkeeper.id)) {
      seedById.set(goalkeeper.id, goalkeeper);
    }
  }

  return remote.map((remoteGoalkeeper) => {
    const seedGoalkeeper = seedById.get(remoteGoalkeeper.id);
    if (!seedGoalkeeper) {
      // No pair in the seed: keep the remote goalkeeper untouched.
      return { ...remoteGoalkeeper };
    }

    const merged: Goalkeeper = { ...remoteGoalkeeper };

    // Fill `image` from the seed only when the remote lacks it (truthiness).
    if (!merged.image && seedGoalkeeper.image) {
      merged.image = seedGoalkeeper.image;
    }

    return merged;
  });
}

/**
 * Decides, given the remote collection state, what the initial data is and
 * whether the seed must be written:
 *   - remote.length === 0 -> { action: 'seed', data: seedPrepared }
 *   - remote.length > 0    -> { action: 'merge', data: merge(remote, seedPrepared) }
 *
 * The remote list is the source of truth for state, so when it has data the
 * result is the merge of remote with the prepared seed (never a plain replace).
 * `seedPrepared` is the seed already made ready for persistence; for goalkeepers
 * it is `dedupeGoalkeeperIds(seed).goalkeepers`, so the seed path writes unique ids.
 *
 * Pure and deterministic: it does not mutate `remote` or `seedPrepared` and it
 * delegates the merge to the provided function.
 */
export function decideSeed<T extends { id: string }>(
  remote: T[],
  seedPrepared: T[],
  merge: (r: T[], s: T[]) => T[]
): SeedDecision<T> {
  if (remote.length === 0) {
    return { action: 'seed', data: seedPrepared };
  }

  return { action: 'merge', data: merge(remote, seedPrepared) };
}

/**
 * Domain invariant helper reused by tests and the service: counts how many
 * goalkeepers are currently selected (`selected === true`).
 */
export function countSelected(goalkeepers: Goalkeeper[]): number {
  return goalkeepers.filter((goalkeeper) => goalkeeper.selected === true).length;
}
