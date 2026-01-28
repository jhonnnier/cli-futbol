import { Injectable, signal } from '@angular/core';
import { Player, Team } from '../models/player.model';
import playersData from '../../assets/data/players.json';

@Injectable({
  providedIn: 'root'
})
export class PlayerService {
  private readonly storageKey = 'futbol-players';
  readonly players = signal<Player[]>(playersData);

  // Lista de pares de IDs de jugadores que no pueden estar en el mismo equipo
  // Ejemplo: [['6', '12'], ['3', '4']] significa que 1 y 2 no pueden estar juntos, ni 3 y 4
  private readonly separatedPairs: [string, string][] = [
    ['6', '12']
  ];

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

    // Intentar generar equipos válidos (máximo 100 intentos)
    for (let attempt = 0; attempt < 100; attempt++) {
      const teams = this.tryGenerateTeams(allPlayers);
      if (this.validateTeams(teams)) {
        return teams;
      }
    }

    // Si no se pudo después de 100 intentos, retornar el último intento
    return this.tryGenerateTeams(allPlayers);
  }

  private tryGenerateTeams(allPlayers: Player[]): Team[] {
    // Crear exactamente 2 equipos
    const teams: Team[] = [
      { name: 'Equipo 1', players: [], totalSkill: 0 },
      { name: 'Equipo 2', players: [], totalSkill: 0 }
    ];

    // Primero, colocar jugadores que deben estar separados en equipos diferentes
    const assignedIds = new Set<string>();

    for (const [id1, id2] of this.separatedPairs) {
      const player1 = allPlayers.find(p => p.id === id1);
      const player2 = allPlayers.find(p => p.id === id2);

      if (player1 && player2 && !assignedIds.has(id1) && !assignedIds.has(id2)) {
        // Asignar aleatoriamente a equipos diferentes
        const firstTeam = Math.random() < 0.5 ? 0 : 1;
        teams[firstTeam].players.push(player1);
        teams[firstTeam].totalSkill += this.getPlayerSkill(player1);
        teams[1 - firstTeam].players.push(player2);
        teams[1 - firstTeam].totalSkill += this.getPlayerSkill(player2);
        assignedIds.add(id1);
        assignedIds.add(id2);
      }
    }

    // Obtener jugadores restantes (no asignados)
    const remainingPlayers = allPlayers.filter(p => !assignedIds.has(p.id));

    // Mezclar y ordenar por habilidad
    const shuffledRemaining = this.shuffleArray(remainingPlayers);
    shuffledRemaining.sort((a, b) => this.getPlayerSkill(b) - this.getPlayerSkill(a));

    // Distribuir restantes al equipo con menor habilidad total
    for (const player of shuffledRemaining) {
      // Verificar restricciones antes de asignar
      let targetTeam = teams[0].totalSkill <= teams[1].totalSkill ? 0 : 1;

      // Verificar si puede ir al equipo objetivo
      if (!this.canAddToTeam(player, teams[targetTeam])) {
        targetTeam = 1 - targetTeam;
      }

      teams[targetTeam].players.push(player);
      teams[targetTeam].totalSkill += this.getPlayerSkill(player);
    }

    // Mezclar jugadores dentro de cada equipo para variedad visual
    teams.forEach(team => {
      team.players = this.shuffleArray(team.players);
    });

    return teams;
  }

  private canAddToTeam(player: Player, team: Team): boolean {
    const teamPlayerIds = team.players.map(p => p.id);
    for (const [id1, id2] of this.separatedPairs) {
      if (player.id === id1 && teamPlayerIds.includes(id2)) {
        return false;
      }
      if (player.id === id2 && teamPlayerIds.includes(id1)) {
        return false;
      }
    }
    return true;
  }

  private validateTeams(teams: Team[]): boolean {
    for (const team of teams) {
      const playerIds = team.players.map(p => p.id);
      for (const [id1, id2] of this.separatedPairs) {
        if (playerIds.includes(id1) && playerIds.includes(id2)) {
          return false;
        }
      }
    }
    return true;
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
