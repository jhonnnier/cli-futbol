import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { Landing } from './landing';
import { PlayerService } from '../../services/player.service';
import { GoalkeeperService } from '../../services/goalkeeper.service';

/**
 * Minimal mocks of the services the Landing component orchestrates in
 * `ngOnInit`. Only the initialization methods are stubbed (as resolved
 * promises) so that the component can run its startup logic without touching
 * Firestore, localStorage or the seed JSON.
 */
interface PlayerServiceMock {
  initializePlayers: ReturnType<typeof vi.fn>;
}

interface GoalkeeperServiceMock {
  initializeGoalkeepers: ReturnType<typeof vi.fn>;
}

function createPlayerMock(): PlayerServiceMock {
  return {
    initializePlayers: vi.fn().mockResolvedValue(undefined),
  };
}

function createGoalkeeperMock(): GoalkeeperServiceMock {
  return {
    initializeGoalkeepers: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Builds a Landing instance wired to the given service mocks through Angular's
 * TestBed, so that `inject(PlayerService)` / `inject(GoalkeeperService)` inside
 * the component resolve to the mocks.
 *
 * The component is instantiated directly (not via `createComponent`) so that
 * its child components (which inject the real services) are not rendered; the
 * unit under test here is only `ngOnInit`'s orchestration.
 */
function buildComponent(
  playerMock: PlayerServiceMock,
  goalkeeperMock: GoalkeeperServiceMock
): Landing {
  TestBed.configureTestingModule({
    providers: [
      Landing,
      { provide: PlayerService, useValue: playerMock },
      { provide: GoalkeeperService, useValue: goalkeeperMock },
    ],
  });
  return TestBed.inject(Landing);
}

describe('Landing', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  let playerMock: PlayerServiceMock;
  let goalkeeperMock: GoalkeeperServiceMock;
  let component: Landing;

  beforeEach(() => {
    playerMock = createPlayerMock();
    goalkeeperMock = createGoalkeeperMock();
    component = buildComponent(playerMock, goalkeeperMock);
  });

  // Requirements: 2.1, 2.2, 2.3, 2.4, 4.3
  it('ngOnInit triggers PlayerService.initializePlayers', async () => {
    await component.ngOnInit();

    expect(playerMock.initializePlayers).toHaveBeenCalled();
  });

  // Requirements: 2.1, 2.2, 2.3, 2.4, 4.3
  it('ngOnInit triggers GoalkeeperService.initializeGoalkeepers', async () => {
    await component.ngOnInit();

    expect(goalkeeperMock.initializeGoalkeepers).toHaveBeenCalled();
  });

  // Requirements: 2.1, 2.2, 2.3, 2.4, 4.3
  it('ngOnInit triggers both initializations', async () => {
    await component.ngOnInit();

    expect(playerMock.initializePlayers).toHaveBeenCalledTimes(1);
    expect(goalkeeperMock.initializeGoalkeepers).toHaveBeenCalledTimes(1);
  });
});
