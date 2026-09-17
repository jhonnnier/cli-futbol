import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import fc from 'fast-check';

import { GoalkeeperService } from './goalkeeper.service';
import { FirebaseService } from './firebase.service';
import { Goalkeeper } from '../models/player.model';
import { dedupeGoalkeeperIds, countSelected } from './sync/data-sync';
import goalkeepersSeed from '../../assets/data/goalkeepers.json';

const STORAGE_KEY = 'futbol-goalkeepers';

/**
 * Minimal mock of FirebaseService: only the surface the GoalkeeperService uses
 * (`isAvailable` + the goalkeeper read/write methods). Each method is a spy so
 * that tests can assert the wiring and drive the fallback branches by making a
 * read reject.
 */
interface FirebaseServiceMock {
  isAvailable: boolean;
  getGoalkeepers: ReturnType<typeof vi.fn>;
  saveGoalkeeper: ReturnType<typeof vi.fn>;
  saveGoalkeepers: ReturnType<typeof vi.fn>;
}

function createFirebaseMock(): FirebaseServiceMock {
  return {
    isAvailable: true,
    getGoalkeepers: vi.fn().mockResolvedValue([]),
    saveGoalkeeper: vi.fn().mockResolvedValue(undefined),
    saveGoalkeepers: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Builds a GoalkeeperService wired to the given FirebaseService mock through
 * Angular's TestBed, so that `inject(FirebaseService)` inside the service
 * resolves to the mock.
 */
function buildService(firebaseMock: FirebaseServiceMock): GoalkeeperService {
  TestBed.configureTestingModule({
    providers: [
      GoalkeeperService,
      { provide: FirebaseService, useValue: firebaseMock },
    ],
  });
  return TestBed.inject(GoalkeeperService);
}

/** The deduplicated seed, i.e. the state the service starts from when remote is empty. */
const dedupedSeed: Goalkeeper[] = dedupeGoalkeeperIds(goalkeepersSeed).goalkeepers;
const dedupedSeedIds: string[] = dedupedSeed.map((gk) => gk.id);

describe('GoalkeeperService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Task 5.3 — Property 7: max selected goalkeepers invariant (property test)
  // -------------------------------------------------------------------------
  describe('Property 7: max selected goalkeepers invariant', () => {
    it('never lets more than maxSelected (2) goalkeepers be selected across any toggle sequence', async () => {
      // Feature: firebase-data-sync, Property 7: Invariante de máximo de arqueros seleccionados
      // Validates: Requirements 4.4
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom(...dedupedSeedIds), { maxLength: 30 }),
          async (toggleSequence) => {
            // Reset at the start of each run so a prior (possibly failed/shrinking)
            // run cannot leak its TestBed configuration or cached state into this one.
            TestBed.resetTestingModule();
            localStorage.clear();

            const firebaseMock = createFirebaseMock();
            // Empty remote => the service seeds the deduplicated JSON as its state.
            firebaseMock.getGoalkeepers.mockResolvedValue([]);

            const service = buildService(firebaseMock);
            await service.initializeGoalkeepers();

            // The invariant must already hold for the initial (seeded) state.
            expect(countSelected(service.goalkeepers())).toBeLessThanOrEqual(service.maxSelected);

            for (const id of toggleSequence) {
              const before = service.goalkeepers();
              const target = before.find((gk) => gk.id === id);
              const wasSelected = target?.selected === true;
              const selectedBefore = countSelected(before);

              await service.toggleGoalkeeper(id);

              const after = service.goalkeepers();

              // Invariant: at no point may more than maxSelected be selected.
              expect(countSelected(after)).toBeLessThanOrEqual(service.maxSelected);

              // Trying to select a THIRD goalkeeper when 2 are already selected
              // must leave the state unchanged.
              if (!wasSelected && selectedBefore >= service.maxSelected) {
                expect(after).toEqual(before);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Task 5.4 — wiring / fallback unit tests (FirebaseService mocked)
  // -------------------------------------------------------------------------
  describe('toggleGoalkeeper persistence (Requirements 4.1, 4.2)', () => {
    it('persists via saveGoalkeepers and writes the change to localStorage', async () => {
      const firebaseMock = createFirebaseMock();
      firebaseMock.getGoalkeepers.mockResolvedValue([]);

      const service = buildService(firebaseMock);
      await service.initializeGoalkeepers();

      // Pick an unselected goalkeeper while fewer than 2 are selected. In the
      // seeded state gk5 (Yonathan) and gk2 (Leo) are selected; gk1 (Ivan) is not.
      const targetId = 'gk1';
      const before = service.goalkeepers().find((gk) => gk.id === targetId);
      expect(before?.selected).toBe(false);

      // Deselect one of the two selected so there is room, then select gk1.
      await service.toggleGoalkeeper('gk5');
      firebaseMock.saveGoalkeepers.mockClear();

      await service.toggleGoalkeeper(targetId);

      // The signal now reflects the selection.
      const after = service.goalkeepers().find((gk) => gk.id === targetId);
      expect(after?.selected).toBe(true);

      // Persistence to Firebase went through saveGoalkeepers with the new state.
      expect(firebaseMock.saveGoalkeepers).toHaveBeenCalledTimes(1);
      const persistedArg = firebaseMock.saveGoalkeepers.mock.calls[0][0] as Goalkeeper[];
      expect(persistedArg.find((gk) => gk.id === targetId)?.selected).toBe(true);

      // localStorage reflects the change.
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Goalkeeper[];
      expect(cached.find((gk) => gk.id === targetId)?.selected).toBe(true);
    });
  });

  describe('initializeGoalkeepers with non-empty remote (Requirement 4.3)', () => {
    it('leaves the signal with the merged remote data', async () => {
      const firebaseMock = createFirebaseMock();
      // Remote is the source of state: one goalkeeper without image so the merge
      // fills it from the seed, proving the data came from remote (merged).
      const remote: Goalkeeper[] = [
        { id: 'gk3', name: 'Alan Remote', skill: 2, selected: true },
      ];
      firebaseMock.getGoalkeepers.mockResolvedValue(remote);

      const service = buildService(firebaseMock);
      await service.initializeGoalkeepers();

      const state = service.goalkeepers();

      // The state comes from the remote collection (single remote doc), not the seed.
      expect(state.length).toBe(1);
      expect(state[0].id).toBe('gk3');
      expect(state[0].name).toBe('Alan Remote');
      expect(state[0].skill).toBe(2);
      expect(state[0].selected).toBe(true);

      // The merge filled `image` from the seed (seed gk3 has a real image URL).
      const seedGk3 = goalkeepersSeed.find((gk) => gk.id === 'gk3');
      expect(state[0].image).toBe(seedGk3?.image);
    });
  });

  describe('initializeGoalkeepers read failure fallback (Requirements 5.3, 5.4)', () => {
    it('5.3: falls back to localStorage cache when the read rejects', async () => {
      const cached: Goalkeeper[] = [
        { id: 'gkCached', name: 'Cached Keeper', skill: 3, selected: false },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));

      const firebaseMock = createFirebaseMock();
      firebaseMock.getGoalkeepers.mockRejectedValue(new Error('firestore down'));

      const service = buildService(firebaseMock);
      await service.initializeGoalkeepers();

      expect(service.goalkeepers()).toEqual(cached);
    });

    it('5.4: falls back to the deduplicated seed JSON when the read rejects and there is no cache', async () => {
      const firebaseMock = createFirebaseMock();
      firebaseMock.getGoalkeepers.mockRejectedValue(new Error('firestore down'));

      const service = buildService(firebaseMock);
      await service.initializeGoalkeepers();

      const state = service.goalkeepers();

      // Same cardinality as the seed, unique ids (deduplicated), and the second
      // gk5 was reassigned to gk5-2.
      expect(state.length).toBe(goalkeepersSeed.length);
      const ids = state.map((gk) => gk.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toContain('gk5-2');
      // The reassigned document keeps its original domain fields (Ricardo).
      expect(state.find((gk) => gk.id === 'gk5-2')?.name).toBe('Ricardo');
    });
  });

  describe('toggleGoalkeeper write failure (Requirement 5.6)', () => {
    it('keeps the change in localStorage, logs the error and does not throw when saveGoalkeepers rejects', async () => {
      const firebaseMock = createFirebaseMock();
      firebaseMock.getGoalkeepers.mockResolvedValue([]);

      const service = buildService(firebaseMock);
      await service.initializeGoalkeepers();

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      // Now make the write path fail on the next persist().
      firebaseMock.saveGoalkeepers.mockRejectedValue(new Error('write failed'));

      // gk1 (Ivan) starts unselected and there is room after the seed's 2 are
      // reduced; deselect gk5 first to make room, clearing spies afterwards.
      await service.toggleGoalkeeper('gk5');
      consoleErrorSpy.mockClear();

      // This toggle triggers a persist() whose Firebase write rejects.
      await expect(service.toggleGoalkeeper('gk1')).resolves.toBeUndefined();

      // State was preserved locally despite the write failure.
      const after = service.goalkeepers().find((gk) => gk.id === 'gk1');
      expect(after?.selected).toBe(true);

      const cached = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Goalkeeper[];
      expect(cached.find((gk) => gk.id === 'gk1')?.selected).toBe(true);

      // The failure was logged with the service prefix.
      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedPrefixes = consoleErrorSpy.mock.calls.map((call) => String(call[0]));
      expect(loggedPrefixes.some((msg) => msg.includes('[GoalkeeperService]'))).toBe(true);
    });
  });
});
