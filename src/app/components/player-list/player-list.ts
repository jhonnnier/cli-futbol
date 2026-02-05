import { Component, inject, signal, computed } from '@angular/core';
import { PlayerService } from '../../services/player.service';
import { GoalkeeperService } from '../../services/goalkeeper.service';
import { StarRating } from '../star-rating/star-rating';
import { Player, Goalkeeper } from '../../models/player.model';
import { PlayerForm } from '../player-form/player-form';

@Component({
  selector: 'app-player-list',
  imports: [StarRating, PlayerForm],
  templateUrl: './player-list.html',
  styleUrl: './player-list.scss'
})
export class PlayerList {
  private readonly playerService = inject(PlayerService);
  private readonly goalkeeperService = inject(GoalkeeperService);
  readonly players = this.playerService.players;
  readonly enabledPlayers = this.playerService.enabledPlayers;
  readonly disabledPlayers = this.playerService.disabledPlayers;
  readonly showModal = signal(false);
  
  readonly selectedGoalkeepers = this.goalkeeperService.selectedGoalkeepers;
  
  readonly allPlayersWithGoalkeepers = computed(() => {
    const goalkeepers = this.selectedGoalkeepers();
    const players = this.players();
    return [...goalkeepers, ...players];
  });

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

  isGoalkeeper(player: Player | Goalkeeper): player is Goalkeeper {
    return 'selected' in player;
  }

  getDefense(player: Player | Goalkeeper): number {
    return this.isGoalkeeper(player) ? player.skill : player.defense;
  }

  getCreation(player: Player | Goalkeeper): number {
    return this.isGoalkeeper(player) ? player.skill : player.creation;
  }

  getOffense(player: Player | Goalkeeper): number {
    return this.isGoalkeeper(player) ? player.skill : player.offense;
  }

  getPlayerTotalSkill(player: Player | Goalkeeper): number {
    if (this.isGoalkeeper(player)) {
      return player.skill * 3;
    }
    return this.getTotalSkill(player);
  }

  openModal(): void {
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }
}
