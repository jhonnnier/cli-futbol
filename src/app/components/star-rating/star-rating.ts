import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-star-rating',
  template: `
    <div class="star-rating">
      @for (star of stars; track star) {
        <button
          type="button"
          class="star"
          [class.filled]="star <= value()"
          [disabled]="readonly()"
          (click)="onStarClick(star)"
        >
          ★
        </button>
      }
    </div>
  `,
  styles: [`
    .star-rating {
      display: inline-flex;
      gap: 2px;
    }
    .star {
      background: none;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      color: #444;
      transition: color 0.2s, transform 0.2s;
      padding: 0;
    }
    .star.filled {
      color: #ffc107;
    }
    .star:not(:disabled):hover {
      transform: scale(1.2);
    }
    .star:disabled {
      cursor: default;
    }
  `]
})
export class StarRating {
  readonly value = input<number>(0);
  readonly readonly = input<boolean>(false);
  readonly valueChange = output<number>();

  readonly stars = [1, 2, 3, 4, 5];

  onStarClick(star: number): void {
    if (!this.readonly()) {
      this.valueChange.emit(star);
    }
  }
}
