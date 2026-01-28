import { Component, inject, signal } from '@angular/core';
import { PlayerService } from '../../services/player.service';
import { Team } from '../../models/player.model';

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

  getSkillAverage(team: Team): number {
    if (team.players.length === 0) return 0;
    return Math.round((team.totalSkill / team.players.length) * 10) / 10;
  }
}
