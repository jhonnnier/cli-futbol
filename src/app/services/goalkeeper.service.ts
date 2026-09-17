import { Injectable, inject, signal } from '@angular/core';
import { Goalkeeper } from '../models/player.model';
import goalkeepersSeed from '../../assets/data/goalkeepers.json';
import { FirebaseService } from './firebase.service';
import { dedupeGoalkeeperIds, mergeGoalkeepers, decideSeed } from './sync/data-sync';

@Injectable({
  providedIn: 'root'
})
export class GoalkeeperService {
  private readonly storageKey = 'futbol-goalkeepers';
  private readonly firebaseService = inject(FirebaseService);
  private readonly goalkeepersData = signal<Goalkeeper[]>(goalkeepersSeed);
  private isInitialized = false;

  readonly goalkeepers = this.goalkeepersData.asReadonly();
  readonly maxSelected = 2;

  readonly selectedGoalkeepers = () => this.goalkeepersData().filter(gk => gk.selected);

  async initializeGoalkeepers(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const remote = await this.firebaseService.getGoalkeepers();

      const dedupe = dedupeGoalkeeperIds(goalkeepersSeed);
      if (dedupe.duplicateIds.length) {
        console.info(
          '[GoalkeeperService] Se detectaron IDs de arqueros duplicados en el seed y se reasignaron:',
          dedupe.duplicateIds,
          dedupe.reassignments
        );
      }
      const seedPrepared = dedupe.goalkeepers;

      const decision = decideSeed(remote, seedPrepared, mergeGoalkeepers);
      await this.firebaseService.saveGoalkeepers(decision.data);
      this.goalkeepersData.set(decision.data);
    } catch (error) {
      console.error('[GoalkeeperService] Error loading goalkeepers from Firebase:', error);
      const localGoalkeepers = localStorage.getItem(this.storageKey);
      if (localGoalkeepers) {
        this.goalkeepersData.set(JSON.parse(localGoalkeepers));
      } else {
        this.goalkeepersData.set(dedupeGoalkeeperIds(goalkeepersSeed).goalkeepers);
      }
    } finally {
      this.isInitialized = true;
    }
  }

  private async persist(): Promise<void> {
    localStorage.setItem(this.storageKey, JSON.stringify(this.goalkeepersData()));
    try {
      await this.firebaseService.saveGoalkeepers(this.goalkeepersData());
    } catch (error) {
      console.error('[GoalkeeperService] Error saving goalkeepers to Firebase:', error);
    }
  }

  async toggleGoalkeeper(id: string): Promise<void> {
    const goalkeeper = this.goalkeepersData().find(gk => gk.id === id);
    if (!goalkeeper) return;

    const currentSelected = this.selectedGoalkeepers().length;

    if (!goalkeeper.selected && currentSelected >= this.maxSelected) {
      return;
    }

    this.goalkeepersData.update(goalkeepers =>
      goalkeepers.map(gk => gk.id === id ? { ...gk, selected: !gk.selected } : gk)
    );
    await this.persist();
  }

  canSelect(id: string): boolean {
    const goalkeeper = this.goalkeepers().find(gk => gk.id === id);
    if (!goalkeeper) return false;

    if (goalkeeper.selected) return true;

    return this.selectedGoalkeepers().length < this.maxSelected;
  }
}
