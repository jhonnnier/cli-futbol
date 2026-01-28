import { Injectable, signal } from '@angular/core';
import { Player, Team } from '../models/player.model';
import playersData from '../../assets/data/players.json';

@Injectable({
  providedIn: 'root'
})
export class PlayerService {
  private readonly storageKey = 'futbol-players';
  readonly players = signal<Player[]>(playersData);

  readonly enabledPlayers = () => this.players().filter(p => p.enabled);
  readonly disabledPlayers = () => this.players().filter(p => !p.enabled);

  private savePlayers(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.players()));
  }

  addPlayer(player: Omit<Player, 'id' | 'enabled'>): void {
    const newPlayer: Player = {
      ...player,
      id: crypto.randomUUID(),
      enabled: true
    };
    this.players.update(players => [...players, newPlayer]);
    this.savePlayers();
  }

  togglePlayer(id: string): void {
    this.players.update(players =>
      players.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p)
    );
    this.savePlayers();
  }

  updatePlayer(updatedPlayer: Player): void {
    this.players.update(players =>
      players.map(p => p.id === updatedPlayer.id ? updatedPlayer : p)
    );
    this.savePlayers();
  }

  deletePlayer(id: string): void {
    this.players.update(players => players.filter(p => p.id !== id));
    this.savePlayers();
  }

  getPlayerSkill(player: Player): number {
    return player.defense + player.creation + player.offense;
  }

  generateTeams(): Team[] {
    const allPlayers = this.enabledPlayers();
    const totalPlayers = allPlayers.length;

    if (totalPlayers < 2) {
      return [];
    }

    // Mezclar jugadores aleatoriamente primero
    const shuffledPlayers = this.shuffleArray(allPlayers);

    // Ordenar por habilidad total (descendente)
    shuffledPlayers.sort((a, b) => this.getPlayerSkill(b) - this.getPlayerSkill(a));

    // Crear exactamente 2 equipos
    const teams: Team[] = [
      { name: 'Equipo 1', players: [], totalSkill: 0 },
      { name: 'Equipo 2', players: [], totalSkill: 0 }
    ];

    // Distribuir jugadores usando snake draft para balancear (solo 2 equipos)
    shuffledPlayers.forEach((player, index) => {
      // Snake draft: 0,1,1,0,0,1,1,0...
      const round = Math.floor(index / 2);
      const posInRound = index % 2;
      const teamIndex = round % 2 === 0 ? posInRound : 1 - posInRound;

      teams[teamIndex].players.push(player);
      teams[teamIndex].totalSkill += this.getPlayerSkill(player);
    });

    // Mezclar jugadores dentro de cada equipo para variedad visual
    teams.forEach(team => {
      team.players = this.shuffleArray(team.players);
    });

    return teams;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
