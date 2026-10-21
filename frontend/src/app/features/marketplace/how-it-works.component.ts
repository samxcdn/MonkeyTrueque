import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandMarkComponent } from './brand-mark.component';
import { MarketplaceHeaderComponent } from './marketplace-header.component';

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [RouterLink, MarketplaceHeaderComponent, BrandMarkComponent],
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.scss',
})
export class HowItWorksComponent {}
