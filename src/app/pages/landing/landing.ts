import { Component } from '@angular/core';
import { PlayerList } from '../../components/player-list/player-list';
import { PlayerForm } from '../../components/player-form/player-form';
import { TeamGenerator } from '../../components/team-generator/team-generator';
import { GoalkeeperList } from '../../components/goalkeeper-list/goalkeeper-list';

@Component({
  selector: 'app-landing',
  imports: [PlayerList, PlayerForm, TeamGenerator, GoalkeeperList],
  templateUrl: './landing.html',
  styleUrl: './landing.scss'
})
export class Landing {}
