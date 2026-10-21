import { Injectable, NgZone, inject, signal } from '@angular/core';

export interface AuthenticatedUser {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly imageUrl: string;
}

/** El token viaja en una cookie HttpOnly; el backend solo informa el usuario y cuándo vence la sesión. */
interface SessionResponse { readonly user: AuthenticatedUser; readonly expiresAt: string; }

/** Mayor espera que admite setTimeout (unos 24 días). */
const MAX_TIMEOUT_MS = 2_147_483_647;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly redirectKey = 'monkeytrueque.signInRedirect';
  /** Clave donde las versiones anteriores guardaban el token; se borra al iniciar. */
  private readonly legacyTokenKey = 'monkeytrueque.sessionToken';
  private readonly zone = inject(NgZone);
  private readonly catalogUrl = document.querySelector<HTMLMetaElement>('meta[name="catalog-api-url"]')?.content || 'http://localhost:8081';
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  readonly configured = true;
  readonly status = signal<'unconfigured' | 'loading' | 'ready' | 'error'>('loading');
  readonly user = signal<AuthenticatedUser | null>(null);
  /** Momento en que vence la sesión actual. */
  readonly expiresAt = signal<Date | null>(null);

  constructor() {
    try { localStorage.removeItem(this.legacyTokenKey); } catch { /* No había token guardado. */ }
    void this.restoreSession();
  }

  async openSignIn(redirectPath = '/'): Promise<void> {
    this.rememberRedirect(redirectPath);
    if (window.location.pathname !== '/acceso') window.location.assign('/acceso');
  }

  async signIn(username: string, password: string): Promise<void> {
    this.saveSession(await this.post<SessionResponse>('/api/auth/login', { username, password }));
  }

  async signUp(name: string, username: string, password: string): Promise<void> {
    this.saveSession(await this.post<SessionResponse>('/api/auth/register', { name, username, password }));
  }

  signInRedirectUrl(): string {
    let path = '/';
    try {
      const stored = sessionStorage.getItem(this.redirectKey);
      sessionStorage.removeItem(this.redirectKey);
      if (stored?.startsWith('/') && !stored.startsWith('//')) path = stored;
    } catch { /* Conserva la ruta inicial. */ }
    return path;
  }

  async signOut(): Promise<void> {
    // La cookie es HttpOnly: solo el backend puede borrarla.
    await fetch(`${this.catalogUrl}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined);
    this.clearSession();
  }

  async openUserProfile(): Promise<void> { window.location.assign('/cuenta/configuracion'); }

  async updateProfile(displayName: string, imageFile?: File): Promise<AuthenticatedUser> {
    this.requireSession();
    const imageData = imageFile ? await this.fileAsDataUrl(imageFile) : null;
    const response = await fetch(`${this.catalogUrl}/api/auth/profile`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: displayName, imageData }),
    });
    if (response.status === 401) this.sessionExpired();
    const body = await this.readResponse<AuthenticatedUser>(response);
    this.zone.run(() => this.user.set(body));
    return body;
  }

  /** Las peticiones protegidas solo tienen sentido con una sesión abierta. */
  requireSession(): void {
    if (!this.user()) throw new Error('Inicia sesión para continuar.');
  }

  /**
   * La sesión venció (por tiempo o porque el backend rechazó el token):
   * se cierra y se vuelve al inicio de sesión con el aviso correspondiente.
   */
  sessionExpired(): void {
    if (!this.user()) return;
    this.rememberRedirect(window.location.pathname + window.location.search);
    this.clearSession();
    window.location.assign('/acceso?sesionVencida=true');
  }

  private async restoreSession(): Promise<void> {
    try {
      const response = await fetch(`${this.catalogUrl}/api/auth/me`, { credentials: 'include' });
      if (!response.ok) throw new Error('Sin sesión');
      this.saveSession(await response.json() as SessionResponse);
    } catch {
      this.zone.run(() => { this.user.set(null); this.status.set('ready'); });
    }
  }

  private saveSession(response: SessionResponse): void {
    const expiresAt = new Date(response.expiresAt);
    this.zone.run(() => { this.user.set(response.user); this.expiresAt.set(expiresAt); this.status.set('ready'); });
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    const remaining = Math.min(Math.max(expiresAt.getTime() - Date.now(), 0), MAX_TIMEOUT_MS);
    this.expiryTimer = setTimeout(() => this.zone.run(() => this.sessionExpired()), remaining);
  }

  private clearSession(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = undefined;
    this.zone.run(() => { this.user.set(null); this.expiresAt.set(null); });
  }

  private rememberRedirect(path: string): void {
    const safePath = path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/acceso') ? path : '/';
    try { sessionStorage.setItem(this.redirectKey, safePath); } catch { /* Usa la ruta inicial si el almacenamiento no está disponible. */ }
  }

  private async post<T>(path: string, payload: object): Promise<T> {
    const response = await fetch(`${this.catalogUrl}${path}`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    return this.readResponse<T>(response, path);
  }

  private async readResponse<T>(response: Response, path = ''): Promise<T> {
    const text = await response.text();
    let payload: unknown = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
    if (!response.ok) {
      const detail = payload && typeof payload === 'object' ? String((payload as Record<string, unknown>)['detail'] ?? (payload as Record<string, unknown>)['message'] ?? '') : '';
      if (response.status === 409 && path === '/api/auth/register') throw new Error('Ese nombre de usuario ya está ocupado. Elige otro.');
      if (response.status === 400 && path === '/api/auth/register') throw new Error(detail || 'Revisa el usuario y usa una contraseña de al menos 8 caracteres.');
      if (response.status === 401 && path === '/api/auth/login') throw new Error('El usuario o la contraseña son incorrectos.');
      throw new Error(detail || 'No se pudo conectar con el servidor. Inténtalo de nuevo.');
    }
    return payload as T;
  }

  private fileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(file);
    });
  }
}
