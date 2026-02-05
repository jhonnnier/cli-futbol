import { Component, inject, OnInit, OnDestroy, signal, HostListener } from '@angular/core';
import { PlayerList } from '../../components/player-list/player-list';
import { TeamGenerator } from '../../components/team-generator/team-generator';
import { GoalkeeperList } from '../../components/goalkeeper-list/goalkeeper-list';
import { PlayerService } from '../../services/player.service';

@Component({
  selector: 'app-landing',
  imports: [PlayerList, TeamGenerator, GoalkeeperList],
  templateUrl: './landing.html',
  styleUrl: './landing.scss'
})
export class Landing implements OnInit, OnDestroy {
  private readonly playerService = inject(PlayerService);
  readonly hideHeader = signal(false);

  async ngOnInit(): Promise<void> {
    await this.playerService.initializePlayers();
  }

  ngOnDestroy(): void {
  }

  @HostListener('window:scroll', [])
  onScroll(): void {
    const teamsSection = document.getElementById('teams');
    if (teamsSection) {
      const rect = teamsSection.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Hide header when teams section is in view (more than 30% visible)
      const isTeamsSectionVisible = rect.top < windowHeight * 0.7 && rect.bottom > windowHeight * 0.3;
      this.hideHeader.set(isTeamsSectionVisible);
    }
  }
}
