import { Component, inject } from '@angular/core';
import { GoalkeeperService } from '../../services/goalkeeper.service';
import { StarRating } from '../star-rating/star-rating';

@Component({
  selector: 'app-goalkeeper-list',
  imports: [StarRating],
  templateUrl: './goalkeeper-list.html',
  styleUrl: './goalkeeper-list.scss'
})
export class GoalkeeperList {
  readonly goalkeeperService = inject(GoalkeeperService);
  readonly goalkeepers = this.goalkeeperService.goalkeepers;
  readonly selectedCount = () => this.goalkeeperService.selectedGoalkeepers().length;
  readonly maxSelected = this.goalkeeperService.maxSelected;

  toggleGoalkeeper(id: string): void {
    this.goalkeeperService.toggleGoalkeeper(id);
  }

  canSelect(id: string): boolean {
    return this.goalkeeperService.canSelect(id);
  }
}
