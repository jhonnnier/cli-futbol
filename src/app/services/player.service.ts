import { Injectable, signal, inject, computed } from '@angular/core';
import { Player, Team } from '../models/player.model';
import playersData from '../../assets/data/players.json';
import { GoalkeeperService } from './goalkeeper.service';

@Injectable({
  providedIn: 'root'
})
export class PlayerService {
  private readonly storageKey = 'futbol-players';
  private readonly goalkeeperService = inject(GoalkeeperService);
  private readonly playersData = signal<Player[]>(playersData);
  
  readonly players = computed(() => {
    const allPlayers = this.playersData();
    return [...allPlayers].sort((a, b) => {
      if (a.enabled === b.enabled) return 0;
      return a.enabled ? -1 : 1;
    });
  });

  // Lista de pares de IDs de jugadores que no pueden estar en el mismo equipo
  // Ejemplo: [['6', '12'], ['3', '4']] significa que 1 y 2 no pueden estar juntos, ni 3 y 4
  private readonly separatedPairs: [string, string][] = [
    ['11', '4']
  ];

  readonly enabledPlayers = () => this.players().filter(p => p.enabled);
  readonly disabledPlayers = () => this.players().filter(p => !p.enabled);

  private savePlayers(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.playersData()));
  }

  addPlayer(player: Omit<Player, 'id' | 'enabled'>): void {
    const newPlayer: Player = {
      ...player,
      id: crypto.randomUUID(),
      enabled: true
    };
    this.playersData.update(players => [...players, newPlayer]);
    this.savePlayers();
  }

  togglePlayer(id: string): void {
    this.playersData.update(players =>
      players.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p)
    );
    this.savePlayers();
  }

  updatePlayer(updatedPlayer: Player): void {
    this.playersData.update(players =>
      players.map(p => p.id === updatedPlayer.id ? updatedPlayer : p)
    );
    this.savePlayers();
  }

  deletePlayer(id: string): void {
    this.playersData.update(players => players.filter(p => p.id !== id));
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
        this.distributeGoalkeepers(teams);
        return teams;
      }
    }

    // Si no se pudo después de 100 intentos, retornar el último intento
    const teams = this.tryGenerateTeams(allPlayers);
    this.distributeGoalkeepers(teams);
    return teams;
  }

  private distributeGoalkeepers(teams: Team[]): void {
    const selectedGoalkeepers = this.goalkeeperService.selectedGoalkeepers();
    
    if (selectedGoalkeepers.length === 2 && teams.length === 2) {
      // Asignar un arquero a cada equipo
      teams[0].goalkeeper = selectedGoalkeepers[0];
      teams[1].goalkeeper = selectedGoalkeepers[1];
    } else if (selectedGoalkeepers.length === 1 && teams.length >= 1) {
      // Si solo hay un arquero, asignarlo al primer equipo
      teams[0].goalkeeper = selectedGoalkeepers[0];
    }
  }

  private tryGenerateTeams(allPlayers: Player[]): Team[] {
    // Crear exactamente 2 equipos con estadísticas detalladas
    const teams: Team[] = [
      { name: 'Equipo 1', players: [], totalSkill: 0 },
      { name: 'Equipo 2', players: [], totalSkill: 0 }
    ];

    const teamStats = [
      { defense: 0, creation: 0, offense: 0 },
      { defense: 0, creation: 0, offense: 0 }
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
        teamStats[firstTeam].defense += player1.defense;
        teamStats[firstTeam].creation += player1.creation;
        teamStats[firstTeam].offense += player1.offense;

        teams[1 - firstTeam].players.push(player2);
        teams[1 - firstTeam].totalSkill += this.getPlayerSkill(player2);
        teamStats[1 - firstTeam].defense += player2.defense;
        teamStats[1 - firstTeam].creation += player2.creation;
        teamStats[1 - firstTeam].offense += player2.offense;

        assignedIds.add(id1);
        assignedIds.add(id2);
      }
    }

    // Obtener jugadores restantes (no asignados)
    const remainingPlayers = allPlayers.filter(p => !assignedIds.has(p.id));

    // Mezclar y ordenar por habilidad total
    const shuffledRemaining = this.shuffleArray(remainingPlayers);
    shuffledRemaining.sort((a, b) => this.getPlayerSkill(b) - this.getPlayerSkill(a));

    // Distribuir restantes balanceando por tipo de habilidad
    for (const player of shuffledRemaining) {
      // Calcular diferencias en cada habilidad
      const defDiff = Math.abs(teamStats[0].defense - teamStats[1].defense);
      const creDiff = Math.abs(teamStats[0].creation - teamStats[1].creation);
      const offDiff = Math.abs(teamStats[0].offense - teamStats[1].offense);
      const totalDiff = Math.abs(teams[0].totalSkill - teams[1].totalSkill);

      // Calcular score de desbalance para cada equipo si agregamos el jugador
      const score0 = this.calculateImbalanceScore(
        teamStats[0].defense + player.defense,
        teamStats[1].defense,
        teamStats[0].creation + player.creation,
        teamStats[1].creation,
        teamStats[0].offense + player.offense,
        teamStats[1].offense
      );

      const score1 = this.calculateImbalanceScore(
        teamStats[0].defense,
        teamStats[1].defense + player.defense,
        teamStats[0].creation,
        teamStats[1].creation + player.creation,
        teamStats[0].offense,
        teamStats[1].offense + player.offense
      );

      // Elegir el equipo que minimiza el desbalance
      let targetTeam = score0 <= score1 ? 0 : 1;

      // Verificar restricciones antes de asignar
      if (!this.canAddToTeam(player, teams[targetTeam])) {
        targetTeam = 1 - targetTeam;
      }

      // Asignar jugador al equipo
      teams[targetTeam].players.push(player);
      teams[targetTeam].totalSkill += this.getPlayerSkill(player);
      teamStats[targetTeam].defense += player.defense;
      teamStats[targetTeam].creation += player.creation;
      teamStats[targetTeam].offense += player.offense;
    }

    // Mezclar jugadores dentro de cada equipo para variedad visual
    teams.forEach(team => {
      team.players = this.shuffleArray(team.players);
    });

    return teams;
  }

  private calculateImbalanceScore(
    def1: number, def2: number,
    cre1: number, cre2: number,
    off1: number, off2: number
  ): number {
    // Calcular diferencias absolutas en cada categoría
    const defDiff = Math.abs(def1 - def2);
    const creDiff = Math.abs(cre1 - cre2);
    const offDiff = Math.abs(off1 - off2);
    
    // Retornar la suma de diferencias (menor es mejor)
    return defDiff + creDiff + offDiff;
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
