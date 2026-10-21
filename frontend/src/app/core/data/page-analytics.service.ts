import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

type PageKey = 'home' | 'explore' | 'product' | 'publish' | 'messages' | 'account' | 'info' | 'other';
type SourceType = 'direct' | 'google' | 'bing' | 'yahoo' | 'duckduckgo' | 'facebook' | 'instagram' | 'tiktok' | 'x' | 'whatsapp' | 'linkedin' | 'youtube' | 'referral' | 'internal';

@Injectable({ providedIn: 'root' })
export class PageAnalyticsService {
  private readonly router = inject(Router);
  private readonly catalog = document.querySelector<HTMLMetaElement>('meta[name="catalog-api-url"]')?.content || 'http://localhost:8081';
  private sourceCaptured = false;
  private lastPage: PageKey | null = null;

  constructor() {
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.record(event.urlAfterRedirects));
    if (this.router.navigated) this.record(this.router.url);
  }

  private record(url: string): void {
    const pageKey = this.pageKey(url);
    if (!pageKey || pageKey === this.lastPage) return;
    this.lastPage = pageKey;
    const source = this.sourceCaptured ? 'internal' : this.initialSource();
    this.sourceCaptured = true;
    void this.recordBrowserVisit(pageKey, source);
  }

  private async recordBrowserVisit(pageKey: PageKey, source: SourceType): Promise<void> {
    const browser = await this.browserFamily();
    void fetch(`${this.catalog}/api/analytics/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageKey, source, browser }),
      keepalive: true,
    }).catch(() => undefined);
  }

  private async browserFamily(): Promise<string | null> {
    // Brave intentionally reports a Chromium based User-Agent for compatibility.
    const brave = (navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }).brave;
    if (!brave?.isBrave) return null;
    try { return await brave.isBrave() ? 'brave' : null; } catch { return null; }
  }

  private pageKey(url: string): PageKey | null {
    const path = new URL(url, window.location.origin).pathname;
    if (path.startsWith('/admin') || path.startsWith('/autenticacion')) return null;
    if (path === '/') return 'home';
    if (path.startsWith('/explorar')) return 'explore';
    if (path.startsWith('/producto/')) return 'product';
    if (path.startsWith('/publicar')) return 'publish';
    if (path.startsWith('/mensajes')) return 'messages';
    if (path.startsWith('/cuenta')) return 'account';
    if (path.startsWith('/como-funciona')) return 'info';
    return 'other';
  }

  private initialSource(): SourceType {
    const referrer = document.referrer;
    if (!referrer) return 'direct';
    try {
      const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
      if (host === window.location.hostname.toLowerCase()) return 'direct';
      if (/google\./.test(host)) return 'google';
      if (/bing\./.test(host)) return 'bing';
      if (/yahoo\./.test(host)) return 'yahoo';
      if (/duckduckgo\./.test(host)) return 'duckduckgo';
      if (/facebook\./.test(host)) return 'facebook';
      if (/instagram\./.test(host)) return 'instagram';
      if (/tiktok\./.test(host)) return 'tiktok';
      if (/^(x\.com|twitter\.|t\.co)/.test(host)) return 'x';
      if (/whatsapp\./.test(host)) return 'whatsapp';
      if (/linkedin\./.test(host)) return 'linkedin';
      if (/youtube\./.test(host)) return 'youtube';
      return 'referral';
    } catch {
      return 'direct';
    }
  }
}
