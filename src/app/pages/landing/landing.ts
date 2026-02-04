import { Component, inject, OnInit } from '@angular/core';
import { PlayerList } from '../../components/player-list/player-list';
import { PlayerForm } from '../../components/player-form/player-form';
import { TeamGenerator } from '../../components/team-generator/team-generator';
import { GoalkeeperList } from '../../components/goalkeeper-list/goalkeeper-list';
import { PlayerService } from '../../services/player.service';

@Component({
  selector: 'app-landing',
  imports: [PlayerList, PlayerForm, TeamGenerator, GoalkeeperList],
  templateUrl: './landing.html',
  styleUrl: './landing.scss'
})
export class Landing implements OnInit {
  private readonly playerService = inject(PlayerService);

  async ngOnInit(): Promise<void> {
    await this.playerService.initializePlayers();
  }
}
