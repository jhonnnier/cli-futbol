export interface Player {
  id: string;
  name: string;
  defense: number;  // 1-5 estrellas
  creation: number; // 1-5 estrellas
  offense: number;  // 1-5 estrellas
  enabled: boolean;
}

export interface Team {
  name: string;
  players: Player[];
  totalSkill: number;
}
