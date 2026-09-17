import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, getDocs, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { environment } from '../../environments/environment';
import { Player, Goalkeeper } from '../models/player.model';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private app?: FirebaseApp;
  private db?: Firestore;
  private readonly playersCollection = 'players';
  private readonly goalkeepersCollection = 'goalkeepers';

  /** true only if the config is real and Firestore init did not fail (Req 1.4, 1.5). */
  readonly isAvailable: boolean;

  constructor() {
    if (this.hasPlaceholderConfig(environment.firebase)) {
      this.isAvailable = false;
      console.error('[FirebaseService] Config de Firebase con placeholders sin reemplazar; la app opera en modo local');
      return;
    }

    try {
      this.app = initializeApp(environment.firebase);
      this.db = getFirestore(this.app);
      this.isAvailable = true;
    } catch (error) {
      this.isAvailable = false;
      console.error('[FirebaseService] Error inicializando Firebase; la app opera en modo local', error);
    }
  }

  /**
   * Detects whether the Firebase config still contains unreplaced placeholder
   * markers (e.g. 'TU_API_KEY'). Heuristic: any string property that is empty
   * or starts with 'TU_' is considered a placeholder.
   */
  private hasPlaceholderConfig(config: Record<string, string>): boolean {
    return Object.values(config).some(
      value => typeof value === 'string' && (value.trim() === '' || value.startsWith('TU_'))
    );
  }

  async getPlayers(): Promise<Player[]> {
    if (!this.isAvailable || !this.db) return [];
    const playersRef = collection(this.db, this.playersCollection);
    const snapshot = await getDocs(playersRef);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Player));
  }

  async savePlayer(player: Player): Promise<void> {
    if (!this.isAvailable || !this.db) return;
    const playerRef = doc(this.db, this.playersCollection, player.id);
    const playerData: any = {
      name: player.name,
      defense: player.defense,
      creation: player.creation,
      offense: player.offense,
      enabled: player.enabled
    };

    if (player.image) playerData.image = player.image;
    if (player.order !== undefined) playerData.order = player.order;
    if (player.lastToggled !== undefined) playerData.lastToggled = player.lastToggled;

    await setDoc(playerRef, playerData);
  }

  async updatePlayer(player: Player): Promise<void> {
    if (!this.isAvailable || !this.db) return;
    const playerRef = doc(this.db, this.playersCollection, player.id);
    const playerData: any = {
      name: player.name,
      defense: player.defense,
      creation: player.creation,
      offense: player.offense,
      enabled: player.enabled
    };

    if (player.image) playerData.image = player.image;
    if (player.order !== undefined) playerData.order = player.order;
    if (player.lastToggled !== undefined) playerData.lastToggled = player.lastToggled;

    await updateDoc(playerRef, playerData);
  }

  async deletePlayer(id: string): Promise<void> {
    if (!this.isAvailable || !this.db) return;
    const playerRef = doc(this.db, this.playersCollection, id);
    await deleteDoc(playerRef);
  }

  async savePlayers(players: Player[]): Promise<void> {
    if (!this.isAvailable || !this.db) return;
    const promises = players.map(player => this.savePlayer(player));
    await Promise.all(promises);
  }

  async getGoalkeepers(): Promise<Goalkeeper[]> {
    if (!this.isAvailable || !this.db) return [];
    const goalkeepersRef = collection(this.db, this.goalkeepersCollection);
    const snapshot = await getDocs(goalkeepersRef);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Goalkeeper));
  }

  async saveGoalkeeper(goalkeeper: Goalkeeper): Promise<void> {
    if (!this.isAvailable || !this.db) return;
    const goalkeeperRef = doc(this.db, this.goalkeepersCollection, goalkeeper.id);
    const goalkeeperData: any = {
      name: goalkeeper.name,
      skill: goalkeeper.skill,
      selected: goalkeeper.selected
    };

    if (goalkeeper.image) goalkeeperData.image = goalkeeper.image;

    await setDoc(goalkeeperRef, goalkeeperData);
  }

  async saveGoalkeepers(goalkeepers: Goalkeeper[]): Promise<void> {
    if (!this.isAvailable || !this.db) return;
    const promises = goalkeepers.map(goalkeeper => this.saveGoalkeeper(goalkeeper));
    await Promise.all(promises);
  }
}
