import { Component, inject, signal } from '@angular/core';
import { PlayerService } from '../../services/player.service';
import { Team, Player } from '../../models/player.model';

@Component({
  selector: 'app-team-generator',
  imports: [],
  templateUrl: './team-generator.html',
  styleUrl: './team-generator.scss'
})
export class TeamGenerator {
  private readonly playerService = inject(PlayerService);

  readonly teams = signal<Team[]>([]);
  readonly players = this.playerService.players;

  generateTeams(): void {
    const generatedTeams = this.playerService.generateTeams();
    this.teams.set(generatedTeams);
  }

  generateTeamsAndScroll(): void {
    this.generateTeams();
    setTimeout(() => {
      const element = document.getElementById('teams-section');
      if (element) {
        const elementPosition = element.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
          top: elementPosition,
          behavior: 'smooth'
        });
      }
    }, 100);
  }

  scrollToPlayers(): void {
    const element = document.getElementById('players');
    if (element) {
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementPosition - 80,
        behavior: 'smooth'
      });
    }
  }

  getSkillAverage(team: Team): number {
    if (team.players.length === 0) return 0;
    return Math.round((team.totalSkill / team.players.length) * 10) / 10;
  }

  getInitial(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  getPlayerSkill(player: Player): number {
    return player.defense + player.creation + player.offense;
  }

  getPlayerPosition(player: Player): 'defense' | 'creation' | 'offense' {
    if (player.defense >= player.creation && player.defense >= player.offense) {
      return 'defense';
    } else if (player.creation >= player.offense) {
      return 'creation';
    } else {
      return 'offense';
    }
  }

  getSortedPlayers(players: Player[], reverseOrder: boolean = false): Player[] {
    return [...players].sort((a, b) => {
      const posOrder = reverseOrder
        ? { offense: 0, creation: 1, defense: 2 }
        : { defense: 0, creation: 1, offense: 2 };
      const posA = this.getPlayerPosition(a);
      const posB = this.getPlayerPosition(b);
      return posOrder[posA] - posOrder[posB];
    });
  }

  getRowPlayers(players: Player[], startIdx: number): Player[] {
    return players.slice(startIdx, startIdx + 3);
  }
}
