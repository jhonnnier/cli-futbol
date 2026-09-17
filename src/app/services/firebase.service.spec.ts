import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { Player, Goalkeeper } from '../models/player.model';

/**
 * Unit tests for FirebaseService — Task 4.3.
 *
 * `firebase/app` and `firebase/firestore` are fully mocked, so NO real Firestore
 * connection is ever opened. The service reads `environment.firebase` in its
 * constructor, so to exercise the different config shapes (real vs. placeholders)
 * we mock the environment module and re-import the service inside each test via
 * `vi.resetModules()` + dynamic `import()`. This guarantees the constructor runs
 * against the config we want for that particular case.
 *
 * Covered acceptance criteria:
 *  - 1.1 (SMOKE): real config  => isAvailable === true.
 *  - 1.4: placeholder config    => isAvailable === false, no throw, getX() => [],
 *          console.error called, initializeApp NOT called.
 *  - 1.5: initializeApp throws  => isAvailable === false, constructor does not throw.
 *  - 1.2 / 1.3: getPlayers / getGoalkeepers call collection + getDocs on the right
 *          collections and rebuild { ...data, id: doc.id }; savePlayer /
 *          saveGoalkeeper call the right APIs.
 *  - 2.6 / 4.5: saveGoalkeeper uses setDoc(doc(db, 'goalkeepers', gk.id), data)
 *          (upsert by id, NOT addDoc); data includes name/skill/selected and omits
 *          image when empty.
 */

// --- Firebase module mocks -------------------------------------------------
// These are hoisted by Vitest to the top of the module, so all imports of
// `firebase/app` / `firebase/firestore` (including the ones inside the SUT) use
// these mocks.

const initializeApp = vi.fn();
const getFirestore = vi.fn();
const collection = vi.fn();
const getDocs = vi.fn();
const doc = vi.fn();
const setDoc = vi.fn();
const deleteDoc = vi.fn();
const updateDoc = vi.fn();

vi.mock('firebase/app', () => ({
  initializeApp: (...args: unknown[]) => initializeApp(...args),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: (...args: unknown[]) => getFirestore(...args),
  collection: (...args: unknown[]) => collection(...args),
  getDocs: (...args: unknown[]) => getDocs(...args),
  doc: (...args: unknown[]) => doc(...args),
  setDoc: (...args: unknown[]) => setDoc(...args),
  deleteDoc: (...args: unknown[]) => deleteDoc(...args),
  updateDoc: (...args: unknown[]) => updateDoc(...args),
}));

// --- Environment config mock ----------------------------------------------
// The service imports `environment` from '../../environments/environment'.
// We control the returned config per test via this mutable holder and re-import
// the service module after resetting modules.

const REAL_CONFIG = {
  apiKey: 'AIzaSyReal',
  authDomain: 'real.firebaseapp.com',
  projectId: 'real-project',
  storageBucket: 'real.appspot.com',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abcdef',
};

const PLACEHOLDER_CONFIG = {
  apiKey: 'TU_API_KEY',
  authDomain: 'TU_AUTH_DOMAIN',
  projectId: 'TU_PROJECT_ID',
  storageBucket: 'TU_STORAGE_BUCKET',
  messagingSenderId: 'TU_MESSAGING_SENDER_ID',
  appId: 'TU_APP_ID',
};

let currentConfig: Record<string, string> = { ...REAL_CONFIG };

vi.mock('../../environments/environment', () => ({
  get environment() {
    return { production: false, firebase: currentConfig };
  },
}));

/**
 * Freshly instantiate FirebaseService against `config` with all mocks reset.
 * Re-imports the module so the constructor runs against the desired environment.
 */
async function createService(config: Record<string, string>) {
  currentConfig = config;
  vi.resetModules();
  vi.clearAllMocks();
  const fakeApp = { name: 'fake-app' };
  const fakeDb = { type: 'fake-db' };
  initializeApp.mockReturnValue(fakeApp);
  getFirestore.mockReturnValue(fakeDb);
  const { FirebaseService } = await import('./firebase.service');
  const service = new FirebaseService();
  return { service, fakeApp, fakeDb };
}

describe('FirebaseService (mocked firebase/app + firebase/firestore)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('availability (Req 1.1, 1.4, 1.5)', () => {
    it('is available with a real config (SMOKE 1.1)', async () => {
      const { service } = await createService({ ...REAL_CONFIG });

      expect(service.isAvailable).toBe(true);
      expect(initializeApp).toHaveBeenCalledTimes(1);
      expect(initializeApp).toHaveBeenCalledWith(REAL_CONFIG);
      expect(getFirestore).toHaveBeenCalledTimes(1);
    });

    it('degrades to local mode with placeholder config without throwing (1.4)', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { service } = await createService({ ...PLACEHOLDER_CONFIG });

      // isAvailable is false and the constructor did not throw.
      expect(service.isAvailable).toBe(false);
      // A descriptive error was logged.
      expect(errorSpy).toHaveBeenCalled();
      // initializeApp is NOT called when the config has placeholders.
      expect(initializeApp).not.toHaveBeenCalled();
      expect(getFirestore).not.toHaveBeenCalled();

      // Remote reads return [] so the services fall back to local mode.
      await expect(service.getPlayers()).resolves.toEqual([]);
      await expect(service.getGoalkeepers()).resolves.toEqual([]);
      // No read APIs were touched.
      expect(getDocs).not.toHaveBeenCalled();
      expect(collection).not.toHaveBeenCalled();
    });

    it('detects placeholders when a single field is left unreplaced (1.4)', async () => {
      const mixed = { ...REAL_CONFIG, appId: 'TU_APP_ID' };

      const { service } = await createService(mixed);

      expect(service.isAvailable).toBe(false);
      expect(initializeApp).not.toHaveBeenCalled();
    });

    it('detects placeholders when a field is empty (1.4)', async () => {
      const mixed = { ...REAL_CONFIG, apiKey: '' };

      const { service } = await createService(mixed);

      expect(service.isAvailable).toBe(false);
      expect(initializeApp).not.toHaveBeenCalled();
    });

    it('degrades to local mode when initializeApp throws, without propagating (1.5)', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      currentConfig = { ...REAL_CONFIG };
      vi.resetModules();
      vi.clearAllMocks();
      // Config is real, but initializeApp explodes.
      initializeApp.mockImplementation(() => {
        throw new Error('boom: firebase init failed');
      });

      const { FirebaseService } = await import('./firebase.service');

      // The constructor must NOT propagate the exception.
      let service: InstanceType<typeof FirebaseService> | undefined;
      expect(() => {
        service = new FirebaseService();
      }).not.toThrow();

      expect(service!.isAvailable).toBe(false);
      expect(initializeApp).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('reads use the correct Firestore APIs (Req 1.2, 1.3)', () => {
    it('getPlayers reads the players collection and rebuilds { ...data, id } (1.2)', async () => {
      const { service, fakeDb } = await createService({ ...REAL_CONFIG });

      const playersRef = { __ref: 'players' };
      collection.mockReturnValue(playersRef);
      getDocs.mockResolvedValue({
        docs: [
          { id: 'p1', data: () => ({ name: 'Ana', defense: 3, creation: 4, offense: 5, enabled: true }) },
          { id: 'p2', data: () => ({ name: 'Beto', defense: 2, creation: 2, offense: 2, enabled: false }) },
        ],
      });

      const players = await service.getPlayers();

      // collection called on the db with the 'players' collection name.
      expect(collection).toHaveBeenCalledWith(fakeDb, 'players');
      expect(getDocs).toHaveBeenCalledWith(playersRef);

      // Reconstructs { ...data, id: doc.id }.
      expect(players).toEqual([
        { name: 'Ana', defense: 3, creation: 4, offense: 5, enabled: true, id: 'p1' },
        { name: 'Beto', defense: 2, creation: 2, offense: 2, enabled: false, id: 'p2' },
      ]);
    });

    it('getGoalkeepers reads the goalkeepers collection and rebuilds { ...data, id } (1.3)', async () => {
      const { service, fakeDb } = await createService({ ...REAL_CONFIG });

      const goalkeepersRef = { __ref: 'goalkeepers' };
      collection.mockReturnValue(goalkeepersRef);
      getDocs.mockResolvedValue({
        docs: [
          { id: 'gk1', data: () => ({ name: 'Leo', skill: 4, selected: true }) },
          { id: 'gk5-2', data: () => ({ name: 'Ricardo', skill: 4, selected: false }) },
        ],
      });

      const goalkeepers = await service.getGoalkeepers();

      expect(collection).toHaveBeenCalledWith(fakeDb, 'goalkeepers');
      expect(getDocs).toHaveBeenCalledWith(goalkeepersRef);

      expect(goalkeepers).toEqual([
        { name: 'Leo', skill: 4, selected: true, id: 'gk1' },
        { name: 'Ricardo', skill: 4, selected: false, id: 'gk5-2' },
      ]);
    });
  });

  describe('writes use the correct Firestore APIs (Req 1.2, 1.3, 2.6, 4.5)', () => {
    it('savePlayer upserts by id via setDoc(doc(db, "players", id), data) (1.2)', async () => {
      const { service, fakeDb } = await createService({ ...REAL_CONFIG });

      const playerRef = { __ref: 'players/p1' };
      doc.mockReturnValue(playerRef);
      setDoc.mockResolvedValue(undefined);

      const player: Player = {
        id: 'p1',
        name: 'Ana',
        defense: 3,
        creation: 4,
        offense: 5,
        enabled: true,
        order: 7,
        image: 'ana.png',
      };

      await service.savePlayer(player);

      // doc addressed by id on the players collection (upsert, not addDoc).
      expect(doc).toHaveBeenCalledWith(fakeDb, 'players', 'p1');
      expect(setDoc).toHaveBeenCalledTimes(1);
      const [refArg, dataArg] = setDoc.mock.calls[0];
      expect(refArg).toBe(playerRef);
      expect(dataArg).toMatchObject({
        name: 'Ana',
        defense: 3,
        creation: 4,
        offense: 5,
        enabled: true,
        order: 7,
        image: 'ana.png',
      });
    });

    it('saveGoalkeeper upserts by id via setDoc(doc(db, "goalkeepers", gk.id), data) — NOT addDoc (2.6, 4.5)', async () => {
      const { service, fakeDb } = await createService({ ...REAL_CONFIG });

      const goalkeeperRef = { __ref: 'goalkeepers/gk1' };
      doc.mockReturnValue(goalkeeperRef);
      setDoc.mockResolvedValue(undefined);

      const goalkeeper: Goalkeeper = {
        id: 'gk1',
        name: 'Leo',
        skill: 4,
        selected: true,
        image: 'leo.png',
      };

      await service.saveGoalkeeper(goalkeeper);

      // Upsert by id: doc is addressed with the 'goalkeepers' collection and the gk id.
      expect(doc).toHaveBeenCalledWith(fakeDb, 'goalkeepers', 'gk1');
      expect(setDoc).toHaveBeenCalledTimes(1);

      const [refArg, dataArg] = setDoc.mock.calls[0];
      expect(refArg).toBe(goalkeeperRef);
      // Data carries the domain fields.
      expect(dataArg).toMatchObject({ name: 'Leo', skill: 4, selected: true, image: 'leo.png' });
      // The document id is NOT stored inside the document (reconstructed from doc.id on read).
      expect(dataArg).not.toHaveProperty('id');
    });

    it('saveGoalkeeper omits image when empty (2.6, 4.5)', async () => {
      const { service } = await createService({ ...REAL_CONFIG });

      doc.mockReturnValue({ __ref: 'goalkeepers/gk2' });
      setDoc.mockResolvedValue(undefined);

      const goalkeeper: Goalkeeper = {
        id: 'gk2',
        name: 'Nico',
        skill: 3,
        selected: false,
        image: '',
      };

      await service.saveGoalkeeper(goalkeeper);

      const [, dataArg] = setDoc.mock.calls[0];
      expect(dataArg).toEqual({ name: 'Nico', skill: 3, selected: false });
      expect(dataArg).not.toHaveProperty('image');
    });

    it('saveGoalkeepers upserts every goalkeeper via setDoc (2.6, 4.5)', async () => {
      const { service } = await createService({ ...REAL_CONFIG });

      doc.mockImplementation((_db: unknown, coll: string, id: string) => ({ __ref: `${coll}/${id}` }));
      setDoc.mockResolvedValue(undefined);

      const goalkeepers: Goalkeeper[] = [
        { id: 'gk1', name: 'Leo', skill: 4, selected: true },
        { id: 'gk2', name: 'Nico', skill: 3, selected: false },
      ];

      await service.saveGoalkeepers(goalkeepers);

      expect(setDoc).toHaveBeenCalledTimes(2);
      expect(doc).toHaveBeenCalledWith(expect.anything(), 'goalkeepers', 'gk1');
      expect(doc).toHaveBeenCalledWith(expect.anything(), 'goalkeepers', 'gk2');
    });
  });

  describe('write no-ops when unavailable (Req 1.4)', () => {
    it('saveGoalkeeper is a no-op when isAvailable is false', async () => {
      const { service } = await createService({ ...PLACEHOLDER_CONFIG });

      await service.saveGoalkeeper({ id: 'gk1', name: 'Leo', skill: 4, selected: true });

      expect(setDoc).not.toHaveBeenCalled();
      expect(doc).not.toHaveBeenCalled();
    });
  });
});
