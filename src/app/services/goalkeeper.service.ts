import { Injectable, signal } from '@angular/core';
import { Goalkeeper } from '../models/player.model';
import goalkeepersData from '../../assets/data/goalkeepers.json';

@Injectable({
  providedIn: 'root'
})
export class GoalkeeperService {
  private readonly storageKey = 'futbol-goalkeepers';
  readonly goalkeepers = signal<Goalkeeper[]>(goalkeepersData);
  readonly maxSelected = 2;

  readonly selectedGoalkeepers = () => this.goalkeepers().filter(gk => gk.selected);

  private saveGoalkeepers(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.goalkeepers()));
  }

  toggleGoalkeeper(id: string): void {
    const goalkeeper = this.goalkeepers().find(gk => gk.id === id);
    if (!goalkeeper) return;

    const currentSelected = this.selectedGoalkeepers().length;

    if (!goalkeeper.selected && currentSelected >= this.maxSelected) {
      return;
    }

    this.goalkeepers.update(goalkeepers =>
      goalkeepers.map(gk => gk.id === id ? { ...gk, selected: !gk.selected } : gk)
    );
    this.saveGoalkeepers();
  }

  canSelect(id: string): boolean {
    const goalkeeper = this.goalkeepers().find(gk => gk.id === id);
    if (!goalkeeper) return false;
    
    if (goalkeeper.selected) return true;
    
    return this.selectedGoalkeepers().length < this.maxSelected;
  }
}
