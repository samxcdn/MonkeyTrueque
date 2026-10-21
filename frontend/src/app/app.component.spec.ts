import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PageAnalyticsService } from './core/data/page-analytics.service';
import { AdminApiService, type StaffRole } from './core/data/admin-api.service';
import { AuthService } from './core/auth/auth.service';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  const user = signal<{ id: string } | null>(null);
  const authStatus = signal<'unconfigured' | 'loading' | 'ready' | 'error'>('unconfigured');
  let staffRole: jasmine.Spy;

  beforeEach(async () => {
    user.set(null);
    authStatus.set('unconfigured');
    staffRole = jasmine.createSpy('staffRole').and.resolveTo('none' as StaffRole);

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user, status: authStatus } },
        { provide: AdminApiService, useValue: { staffRole } },
        { provide: PageAnalyticsService, useValue: {} },
      ],
    }).compileComponents();
  });

  it('renders the root router outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });

  it('does not request a staff role before la sesi�n est� lista and a user is signed in', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(staffRole).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.staff-dashboard-fab')).toBeNull();
  });

  it('shows the admin shortcut after the API confirms an administrator role', async () => {
    user.set({ id: 'user_admin' });
    authStatus.set('ready');
    staffRole.and.resolveTo('admin' as StaffRole);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const shortcut: HTMLAnchorElement | null = fixture.nativeElement.querySelector('.staff-dashboard-fab');
    expect(staffRole).toHaveBeenCalledTimes(1);
    expect(shortcut).not.toBeNull();
    expect(shortcut?.getAttribute('href')).toBe('/admin');
  });

  it('shows the admin shortcut for moderators too', async () => {
    user.set({ id: 'user_moderator' });
    authStatus.set('ready');
    staffRole.and.resolveTo('moderator' as StaffRole);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.staff-dashboard-fab')).not.toBeNull();
  });

  it('keeps the admin shortcut hidden for regular users and failed role checks', async () => {
    user.set({ id: 'user_member' });
    authStatus.set('ready');
    staffRole.and.rejectWith(new Error('API unavailable'));
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.staff-dashboard-fab')).toBeNull();
  });
});
