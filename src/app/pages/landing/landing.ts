import { Component } from '@angular/core';
import { PlayerList } from '../../components/player-list/player-list';
import { PlayerForm } from '../../components/player-form/player-form';
import { TeamGenerator } from '../../components/team-generator/team-generator';

@Component({
  selector: 'app-landing',
  imports: [PlayerList, PlayerForm, TeamGenerator],
  templateUrl: './landing.html',
  styleUrl: './landing.scss'
})
export class Landing {}
