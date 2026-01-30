import { Component, inject } from '@angular/core';
import { PlayerService } from '../../services/player.service';
import { StarRating } from '../star-rating/star-rating';
import { Player } from '../../models/player.model';

@Component({
  selector: 'app-player-list',
  imports: [StarRating],
  templateUrl: './player-list.html',
  styleUrl: './player-list.scss'
})
export class PlayerList {
  private readonly playerService = inject(PlayerService);
  readonly players = this.playerService.players;
  readonly enabledPlayers = this.playerService.enabledPlayers;
  readonly disabledPlayers = this.playerService.disabledPlayers;

  updateSkill(player: Player, skill: 'defense' | 'creation' | 'offense', value: number): void {
    this.playerService.updatePlayer({
      ...player,
      [skill]: value
    });
  }

  deletePlayer(id: string): void {
    this.playerService.deletePlayer(id);
  }

  togglePlayer(id: string): void {
    this.playerService.togglePlayer(id);
  }

  getTotalSkill(player: Player): number {
    return this.playerService.getPlayerSkill(player);
  }
}
