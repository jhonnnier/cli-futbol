import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { PlayerService } from './player.service';
import { FirebaseService } from './firebase.service';
import { GoalkeeperService } from './goalkeeper.service';
import { Player } from '../models/player.model';
import playersSeed from '../../assets/data/players.json';

const STORAGE_KEY = 'futbol-players';

/**
 * Minimal mock of FirebaseService: only the surface PlayerService touches
 * (`isAvailable` + the player read/write methods). Each method is a spy so the
 * tests can drive the fallback branches (by rejecting a read/write) and assert
 * the wiring (what gets passed to `savePlayers`).
 */
interface FirebaseServiceMock {
  isAvailable: boolean;
  getPlayers: ReturnType<typeof vi.fn>;
  savePlayers: ReturnType<typeof vi.fn>;
}

function createFirebaseMock(): FirebaseServiceMock {
  return {
    isAvailable: true,
    getPlayers: vi.fn().mockResolvedValue([]),
    savePlayers: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Minimal stub of GoalkeeperService. PlayerService injects it but only calls
 * `selectedGoalkeepers()` inside `generateTeams` — never in the paths exercised
 * here — so an empty selection is enough to satisfy the injection.
 */
function createGoalkeeperStub(): Pick<GoalkeeperService, 'selectedGoalkeepers'> {
  return {
    selectedGoalkeepers: () => [],
  };
}

/**
 * Builds a PlayerService wired to the given mocks through Angular's TestBed so
 * that `inject(FirebaseService)` and `inject(GoalkeeperService)` inside the
 * service resolve to the provided doubles.
 */
function buildService(firebaseMock: FirebaseServiceMock): PlayerService {
  TestBed.configureTestingModule({
    providers: [
      PlayerService,
      { provide: FirebaseService, useValue: firebaseMock },
      { provide: GoalkeeperService, useValue: createGoalkeeperStub() },
    ],
  });
  return TestBed.inject(PlayerService);
}

/** Look up a player by id in the (sorted) computed signal without assuming order. */
function findById(players: readonly Player[], id: string): Player | undefined {
  return players.find((p) => p.id === id);
}

describe('PlayerService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Read failure fallback (Requirements 5.1, 5.2)
  // -------------------------------------------------------------------------
  describe('initializePlayers read failure fallback (Requirements 5.1, 5.2)', () => {
    it('5.1: falls back to the localStorage cache when getPlayers rejects', async () => {
      const cached: Player[] = [
        { id: 'cached-1', name: 'Cached Player', defense: 3, creation: 3, offense: 3, enabled: true, order: 1 },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));

      const firebaseMock = createFirebaseMock();
      firebaseMock.getPlayers.mockRejectedValue(new Error('firestore down'));

      const service = buildService(firebaseMock);
      await service.initializePlayers();

      const state = service.players();
      // The state reflects the cache, not the seed.
      expect(state.length).toBe(cached.length);
      expect(findById(state, 'cached-1')?.name).toBe('Cached Player');
    });

    it('5.2: falls back to the seed JSON when getPlayers rejects and there is no cache', async () => {
      const firebaseMock = createFirebaseMock();
      firebaseMock.getPlayers.mockRejectedValue(new Error('firestore down'));

      const service = buildService(firebaseMock);
      await service.initializePlayers();

      const state = service.players();

      // Same cardinality as the seed (29 players) and a couple of known seed docs present.
      expect(state.length).toBe(playersSeed.length);
      expect(findById(state, '3')?.name).toBe('Goku');
      expect(findById(state, '2')?.name).toBe('Jhonnier');
    });
  });

  // -------------------------------------------------------------------------
  // Write failure (Requirement 5.5)
  // -------------------------------------------------------------------------
  describe('write failure keeps state in localStorage and logs (Requirement 5.5)', () => {
    it('preserves the change in localStorage, logs the error and does not throw when savePlayers rejects', async () => {
      const firebaseMock = createFirebaseMock();
      // Empty remote so init seeds the JSON and finishes cleanly.
      firebaseMock.getPlayers.mockResolvedValue([]);

      const service = buildService(firebaseMock);
      await service.initializePlayers();

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      // Make the write path fail on the next persist (togglePlayer -> savePlayers).
      firebaseMock.savePlayers.mockRejectedValue(new Error('write failed'));

      const targetId = '3'; // Goku, enabled: true in the seed.
      const before = findById(service.players(), targetId)?.enabled;

      // togglePlayer triggers a persist whose Firebase write rejects; must not throw.
      await expect(service.togglePlayer(targetId)).resolves.toBeUndefined();

      // The signal reflects the toggle despite the write failure.
      const after = findById(service.players(), targetId);
      expect(after?.enabled).toBe(!before);

      // localStorage was written with the toggled state (change preserved locally).
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Player[];
      expect(findById(cached, targetId)?.enabled).toBe(!before);

      // The failure was logged.
      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMessages = consoleErrorSpy.mock.calls.map((call) => String(call[0]));
      expect(loggedMessages.some((msg) => msg.includes('Error saving players'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Merge is persisted back to Firestore (Requirement 6.5)
  // -------------------------------------------------------------------------
  describe('initializePlayers persists the merged result (Requirement 6.5)', () => {
    it('calls savePlayers with the merged data, keeping remote ids and filling image/order from the seed', async () => {
      const firebaseMock = createFirebaseMock();

      // Remote is the source of state. Use two known seed ids so the merge can
      // pair them and fill presentation fields the remote is missing:
      //   - '3'  (Goku)     -> remote lacks image AND order -> both filled from seed
      //   - '16' (Oscar)    -> remote already has image/order -> remote wins
      const remote: Player[] = [
        { id: '3', name: 'Goku', defense: 3, creation: 2, offense: 2, enabled: true },
        {
          id: '16',
          name: 'Oscar',
          defense: 4,
          creation: 2,
          offense: 1,
          enabled: true,
          order: 99,
          image: 'https://remote.example/oscar-custom.png',
        },
      ];
      firebaseMock.getPlayers.mockResolvedValue(remote);

      const service = buildService(firebaseMock);
      await service.initializePlayers();

      // savePlayers was called with the merged result.
      expect(firebaseMock.savePlayers).toHaveBeenCalledTimes(1);
      const persisted = firebaseMock.savePlayers.mock.calls[0][0] as Player[];

      // The persisted argument contains exactly the remote ids (remote is the source).
      const persistedIds = new Set(persisted.map((p) => p.id));
      expect(persistedIds.has('3')).toBe(true);
      expect(persistedIds.has('16')).toBe(true);
      expect(persisted.length).toBe(remote.length);

      // Player '3' had no image/order in remote -> both filled from the seed JSON.
      const seedGoku = playersSeed.find((p) => p.id === '3')!;
      const mergedGoku = persisted.find((p) => p.id === '3')!;
      expect(mergedGoku.image).toBe(seedGoku.image);
      expect(mergedGoku.order).toBe(seedGoku.order);

      // Player '16' already had image/order in remote -> remote values preserved.
      const mergedOscar = persisted.find((p) => p.id === '16')!;
      expect(mergedOscar.image).toBe('https://remote.example/oscar-custom.png');
      expect(mergedOscar.order).toBe(99);

      // The service signal also reflects the merged state.
      const state = service.players();
      expect(findById(state, '3')?.image).toBe(seedGoku.image);
      expect(findById(state, '16')?.order).toBe(99);
    });
  });
});
