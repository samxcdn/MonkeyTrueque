import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { AdminApiError, AdminApiService } from './admin-api.service';

describe('AdminApiService', () => {
  let service: AdminApiService;
  let sessionExpired: jasmine.Spy;

  beforeEach(() => {
    sessionExpired = jasmine.createSpy('sessionExpired');
    TestBed.configureTestingModule({
      providers: [
        AdminApiService,
        { provide: AuthService, useValue: { requireSession: () => undefined, sessionExpired } },
      ],
    });
    service = TestBed.inject(AdminApiService);
  });

  it('sends the session cookie instead of exposing the token to JavaScript', async () => {
    const response = new Response(JSON.stringify({ role: 'admin' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const fetchSpy = spyOn(globalThis, 'fetch').and.resolveTo(response);

    await expectAsync(service.staffRole()).toBeResolvedTo('admin');

    const [url, options] = fetchSpy.calls.mostRecent().args;
    const headers = options?.headers as Record<string, string>;
    expect(String(url)).toContain('/api/admin/me');
    expect(options?.credentials).toBe('include');
    expect(headers['Authorization']).toBeUndefined();
  });

  it('treats a forbidden staff check as a regular account', async () => {
    spyOn(globalThis, 'fetch').and.resolveTo(new Response(null, { status: 403 }));

    await expectAsync(service.staffRole()).toBeResolvedTo('none');
  });

  it('does not turn an unauthorized session into a regular account result', async () => {
    spyOn(globalThis, 'fetch').and.resolveTo(new Response(null, { status: 401 }));

    let thrown: unknown;
    try {
      await service.staffRole();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toEqual(jasmine.any(AdminApiError));
    expect((thrown as AdminApiError).status).toBe(401);
    expect(sessionExpired).toHaveBeenCalled();
  });
});
