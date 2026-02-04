export interface Player {
  id: string;
  name: string;
  defense: number;  // 1-5 estrellas
  creation: number; // 1-5 estrellas
  offense: number;  // 1-5 estrellas
  enabled: boolean;
  lastToggled?: number; // timestamp de la última vez que se cambió enabled
  order?: number; // orden de visualización
}

export interface Goalkeeper {
  id: string;
  name: string;
  skill: number; // 1-5 estrellas
  selected: boolean;
}

export interface Team {
  name: string;
  players: Player[];
  goalkeeper?: Goalkeeper;
  totalSkill: number;
}
