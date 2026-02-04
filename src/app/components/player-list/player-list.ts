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

  async updateSkill(player: Player, skill: 'defense' | 'creation' | 'offense', value: number): Promise<void> {
    await this.playerService.updatePlayer({
      ...player,
      [skill]: value
    });
  }

  async deletePlayer(id: string): Promise<void> {
    await this.playerService.deletePlayer(id);
  }

  async togglePlayer(id: string): Promise<void> {
    await this.playerService.togglePlayer(id);
  }

  getTotalSkill(player: Player): number {
    return this.playerService.getPlayerSkill(player);
  }

  getEnabledIndex(player: Player): number {
    return this.enabledPlayers().findIndex(p => p.id === player.id);
  }
}
