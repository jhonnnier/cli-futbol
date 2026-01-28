import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlayerService } from '../../services/player.service';
import { StarRating } from '../star-rating/star-rating';

@Component({
  selector: 'app-player-form',
  imports: [FormsModule, StarRating],
  templateUrl: './player-form.html',
  styleUrl: './player-form.scss'
})
export class PlayerForm {
  private readonly playerService = inject(PlayerService);

  readonly name = signal('');
  readonly defense = signal(3);
  readonly creation = signal(3);
  readonly offense = signal(3);

  addPlayer(): void {
    if (this.name().trim()) {
      this.playerService.addPlayer({
        name: this.name().trim(),
        defense: this.defense(),
        creation: this.creation(),
        offense: this.offense()
      });
      this.resetForm();
    }
  }

  private resetForm(): void {
    this.name.set('');
    this.defense.set(3);
    this.creation.set(3);
    this.offense.set(3);
  }
}
