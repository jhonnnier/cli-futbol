import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, getDocs, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { environment } from '../../environments/environment';
import { Player } from '../models/player.model';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private app: FirebaseApp;
  private db: Firestore;
  private readonly playersCollection = 'players';

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.db = getFirestore(this.app);
  }

  async getPlayers(): Promise<Player[]> {
    const playersRef = collection(this.db, this.playersCollection);
    const snapshot = await getDocs(playersRef);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Player));
  }

  async savePlayer(player: Player): Promise<void> {
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
    const playerRef = doc(this.db, this.playersCollection, id);
    await deleteDoc(playerRef);
  }

  async savePlayers(players: Player[]): Promise<void> {
    const promises = players.map(player => this.savePlayer(player));
    await Promise.all(promises);
  }
}
