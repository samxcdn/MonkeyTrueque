import { AfterViewInit, Component, DestroyRef, ElementRef, inject } from '@angular/core';

@Component({
  selector: 'app-brand-mark',
  standalone: true,
  template: `
    <a class="brand" href="/" aria-label="MonkeyTrueque, inicio">
      <span class="brand__mark" aria-hidden="true"><img class="brand__mascot" src="/brand/monkeytrueque-crowned-head.png" alt="" width="128" height="128" /></span>
      <span class="brand__wordmark"><span>Monkey</span><span class="brand__swap">Trueque</span></span>
    </a>
  `,
  styles: [`
    .brand { display: inline-flex; align-items: center; gap: 7px; color: var(--mt-brand-brown); text-decoration: none; }
    .brand__mark { display: block; width: 42px; height: 42px; flex: none; overflow: visible; }
    .brand__mascot { display: block; width: 100%; height: 100%; object-fit: contain; transform: scale(1.04); }
    .brand__wordmark { display: inline-flex; align-items: center; font: 600 30px/1 var(--font-display, 'Khand', 'Arial Narrow', sans-serif); letter-spacing: -.025em; }
    .brand__swap { color: var(--mt-brand-chestnut); }
    :host-context(html.marketplace-dark) .brand { color: #f2e9dc; }
    :host-context(html.marketplace-dark) .brand__swap { color: #e6b657; }
    @media (max-width: 600px) {
      .brand__mark { width: 38px; height: 38px; }
      .brand__wordmark { font-size: 25px; }
    }
  `],
})
export class BrandMarkComponent implements AfterViewInit {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private destroyed = false;

  constructor() {
    this.destroyRef.onDestroy(() => { this.destroyed = true; });
  }

  async ngAfterViewInit(): Promise<void> {
    const { gsap } = await import('gsap');
    if (this.destroyed) return;
    const media = gsap.matchMedia(this.host.nativeElement);
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const intro = gsap.timeline({ defaults: { ease: 'power2.out' } });
      intro.fromTo('.brand__mark', { scale: 0.94, rotate: -4 }, { scale: 1, rotate: 0, duration: 0.48 })
        .fromTo('.brand__wordmark', { x: -8 }, { x: 0, duration: 0.38 }, '-=0.24');
      return () => intro.kill();
    });
    this.destroyRef.onDestroy(() => media.revert());
  }
}
