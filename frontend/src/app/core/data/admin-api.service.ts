import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export interface AdminListing {
  readonly id: string;
  readonly title: string;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly districtId: string;
  readonly photoUrl: string | null;
  readonly photoUrls: readonly string[];
  readonly available: boolean;
  readonly moderationHidden: boolean;
  readonly createdAt: string;
}

export interface AdminAnalyticsCount { readonly key: string; readonly count: number; }
export interface AdminAnalyticsDailyCount { readonly date: string; readonly count: number; }
export interface AdminAnalyticsSummary {
  readonly totalVisits: number;
  readonly dailyVisits: readonly AdminAnalyticsDailyCount[];
  readonly sources: readonly AdminAnalyticsCount[];
  readonly browsers: readonly AdminAnalyticsCount[];
  readonly pages: readonly AdminAnalyticsCount[];
}

export interface AdminReport {
  readonly id: string;
  readonly reporterId: string;
  readonly listingId: string | null;
  readonly reason: string;
  readonly details: string;
  readonly status: 'open' | 'in-review' | 'waiting-information' | 'resolved' | 'dismissed' | 'escalated' | 'duplicate';
  readonly resolution: string | null;
  readonly reviewedBy: string | null;
  readonly createdAt: string;
  readonly reviewedAt: string | null;
  readonly targetType: 'listing' | 'user' | 'message' | 'review';
  readonly targetId: string | null;
  readonly priority: 'low' | 'normal' | 'high' | 'urgent';
  readonly assignedTo: string | null;
  readonly evidenceSnapshot: string | null;
  readonly userResponse: string | null;
}

export interface AdminCaseNote { readonly id: string; readonly reportId: string; readonly authorId: string; readonly note: string; readonly createdAt: string; }
export interface AdminCaseEvent { readonly id: string; readonly reportId: string; readonly actorId: string; readonly action: string; readonly previousValue: string | null; readonly newValue: string | null; readonly reason: string; readonly createdAt: string; }
export interface AdminAppeal { readonly id: string; readonly sanctionId: string; readonly userId: string; readonly userDisplayName: string; readonly userUsername: string | null; readonly userImageUrl: string | null; readonly explanation: string; readonly status: string; readonly reviewedBy: string | null; readonly resolution: string | null; readonly createdAt: string; readonly reviewedAt: string | null; readonly sanctionRestrictionType: 'publishing' | 'messaging' | 'all'; readonly sanctionReason: string; readonly sanctionStartsAt: string; readonly sanctionExpiresAt: string | null; readonly sanctionCreatedBy: string; }
export interface AdminEvidenceAttachment { readonly id: string; readonly fileName: string; readonly mediaType: string; readonly data: string; }
export interface AdminSanction { readonly id: string; readonly restrictionType: 'publishing' | 'messaging' | 'all'; readonly reason: string; readonly startsAt: string; readonly expiresAt: string | null; readonly createdBy: string; readonly revokedAt: string | null; readonly revokedBy: string | null; }
export interface AdminAccountStatus { readonly deactivated: boolean; }
export interface AdminUser { readonly userId: string; readonly displayName: string; readonly username: string | null; readonly phone: string | null; readonly department: string | null; readonly countryCode: string | null; readonly designation: string | null; readonly description: string | null; readonly listingCount: number; readonly reportCount: number; readonly imageUrl: string | null; readonly memberSince: string | null; }
export interface AdminStaff { readonly userId: string; readonly role: 'admin' | 'moderator' | 'none'; readonly addedBy: string | null; readonly createdAt: string; readonly displayName: string; readonly username: string | null; readonly imageUrl: string | null; }
export interface CaseAssigneeProfile { readonly userId: string; readonly displayName: string; readonly imageUrl: string | null; readonly role: 'admin' | 'moderator' | 'none'; }
export interface AdminUserCreate { readonly fullName: string; readonly username: string; readonly password: string; readonly phone: string; readonly countryCode: string; readonly designation: string; readonly description: string; readonly imageData: string | null; }

export interface AdminExchange {
  readonly id: string;
  readonly listingId: string;
  readonly listingTitle: string;
  readonly offeredTitle: string;
  readonly ownerId: string;
  readonly proposerId: string;
  readonly status: string;
  readonly note: string;
  readonly meetupPlace: string;
  readonly meetupDate: string;
  readonly meetupTime: string;
  readonly ownerConfirmed: boolean;
  readonly proposerConfirmed: boolean;
  readonly createdAt: string;
}

export interface AdminExchangeDetail {
  readonly exchange: AdminExchange;
  readonly messages: readonly { id: string; sender: string; text: string; createdAt: string }[];
}
export interface AdminReview { readonly exchangeId: string; readonly participant: 'owner' | 'proposer'; readonly reviewerId: string; readonly reviewedUserId: string; readonly listingTitle: string; readonly rating: number; readonly review: string | null; readonly hidden: boolean; readonly moderationReason: string | null; readonly createdAt: string; }
export interface ReviewModerationAction { readonly id: string; readonly staffId: string; readonly action: string; readonly exchangeId: string; readonly participant: string; readonly reason: string; readonly createdAt: string; }

export interface ModerationAction {
  readonly id: string;
  readonly adminId: string;
  readonly action: string;
  readonly targetId: string;
  readonly note: string;
  readonly createdAt: string;
  readonly affectedUserId: string | null;
  readonly affectedUserName: string | null;
  readonly affectedUserImageUrl: string | null;
}

export type StaffRole = 'admin' | 'moderator' | 'none';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly auth = inject(AuthService);
  private readonly catalog = document.querySelector<HTMLMetaElement>('meta[name="catalog-api-url"]')?.content || 'http://localhost:8081';
  private readonly exchange = document.querySelector<HTMLMetaElement>('meta[name="exchange-api-url"]')?.content || 'http://localhost:8082';

  async isAdmin(): Promise<boolean> {
    return (await this.staffRole()) === 'admin';
  }

  async staffRole(): Promise<StaffRole> {
    try {
      const result = await this.call<{ role?: StaffRole; admin?: boolean }>(`${this.catalog}/api/admin/me`);
      return result.role ?? (result.admin ? 'admin' : 'none');
    }
    catch (error) { if (error instanceof AdminApiError && error.status === 403) return 'none'; throw error; }
  }

  analyticsVisits(): Promise<AdminAnalyticsSummary> { return this.call(`${this.catalog}/api/admin/analytics/visits`); }

  reports(): Promise<AdminReport[]> { return this.call(`${this.catalog}/api/admin/reports`); }
  archiveReport(id: string, archived = true): Promise<AdminReport> { return this.call(`${this.catalog}/api/admin/reports/${encodeURIComponent(id)}/archive`, 'PATCH', { archived }); }
  reportAttachments(id: string): Promise<AdminEvidenceAttachment[]> { return this.call(`${this.catalog}/api/admin/reports/${encodeURIComponent(id)}/attachments`); }
  caseNotes(id: string): Promise<AdminCaseNote[]> { return this.call(`${this.catalog}/api/admin/reports/${encodeURIComponent(id)}/notes`); }
  caseHistory(id: string): Promise<AdminCaseEvent[]> { return this.call(`${this.catalog}/api/admin/reports/${encodeURIComponent(id)}/history`); }
  addCaseNote(id: string, note: string): Promise<AdminCaseNote> { return this.call(`${this.catalog}/api/admin/reports/${encodeURIComponent(id)}/notes`, 'POST', { note }); }
  assignCase(id: string, assignedTo: string | null, reason: string): Promise<AdminReport> { return this.call(`${this.catalog}/api/admin/reports/${encodeURIComponent(id)}/assignment`, 'PATCH', { assignedTo, reason }); }
  setCasePriority(id: string, priority: AdminReport['priority'], reason: string): Promise<AdminReport> { return this.call(`${this.catalog}/api/admin/reports/${encodeURIComponent(id)}/priority`, 'PATCH', { priority, reason }); }
  listings(): Promise<AdminListing[]> { return this.call(`${this.catalog}/api/admin/listings`); }
  users(): Promise<AdminUser[]> { return this.call(`${this.catalog}/api/admin/users`); }
  staff(): Promise<AdminStaff[]> { return this.call(`${this.catalog}/api/admin/staff`); }
  caseAssigneeProfile(userId: string): Promise<CaseAssigneeProfile> { return this.call(`${this.catalog}/api/admin/staff/${encodeURIComponent(userId)}/case-profile`); }
  changeStaffRole(userId: string, role: AdminStaff['role'], reason: string): Promise<AdminStaff> {
    return this.call(`${this.catalog}/api/admin/staff/${encodeURIComponent(userId)}/role`, 'PUT', { role, reason });
  }
  createUser(user: AdminUserCreate): Promise<AdminUser> { return this.call(`${this.catalog}/api/admin/users`, 'POST', user); }
  exchanges(): Promise<AdminExchange[]> { return this.call(`${this.exchange}/api/admin/exchanges`); }
  exchangeDetail(id: string): Promise<AdminExchangeDetail> { return this.call(`${this.exchange}/api/admin/exchanges/${encodeURIComponent(id)}`); }
  reviews(): Promise<AdminReview[]> { return this.call(`${this.exchange}/api/admin/exchanges/reviews`); }
  exchangeReviewActions(): Promise<ReviewModerationAction[]> { return this.call(`${this.exchange}/api/admin/exchanges/reviews/actions`); }
  reviewVisibility(item: AdminReview, hidden: boolean, reason: string): Promise<AdminReview> {
    return this.call(`${this.exchange}/api/admin/exchanges/reviews/${encodeURIComponent(item.exchangeId)}/${item.participant}/visibility`, 'PATCH', { hidden, reason });
  }
  actions(): Promise<ModerationAction[]> { return this.call(`${this.catalog}/api/admin/actions`); }
  visibility(id: string, hidden: boolean, note: string): Promise<AdminListing> {
    return this.call(`${this.catalog}/api/admin/listings/${encodeURIComponent(id)}/visibility`, 'PATCH', { hidden, note });
  }
  review(id: string, status: AdminReport['status'], resolution: string, userResponse?: string): Promise<AdminReport> {
    return this.call(`${this.catalog}/api/admin/reports/${encodeURIComponent(id)}`, 'PATCH', { status, resolution, userResponse });
  }
  sanction(userId: string, restrictionType: AdminSanction['restrictionType'], reason: string, durationDays?: number): Promise<AdminSanction> {
    return this.call(`${this.catalog}/api/admin/users/${encodeURIComponent(userId)}/sanctions`, 'POST', { restrictionType, reason, durationDays });
  }
  sanctions(userId: string): Promise<AdminSanction[]> { return this.call(`${this.catalog}/api/admin/users/${encodeURIComponent(userId)}/sanctions`); }
  accountStatus(userId: string): Promise<AdminAccountStatus> { return this.call(`${this.catalog}/api/admin/users/${encodeURIComponent(userId)}/account-status`); }
  deactivateAccount(userId: string, reason: string): Promise<AdminAccountStatus> { return this.call(`${this.catalog}/api/admin/users/${encodeURIComponent(userId)}/deactivate`, 'POST', { reason }); }
  reactivateAccount(userId: string, reason: string): Promise<AdminAccountStatus> { return this.call(`${this.catalog}/api/admin/users/${encodeURIComponent(userId)}/reactivate`, 'POST', { reason }); }
  revokeSanction(userId: string, sanctionId: string, reason: string): Promise<void> {
    return this.call(`${this.catalog}/api/admin/users/${encodeURIComponent(userId)}/sanctions/${encodeURIComponent(sanctionId)}/revoke`, 'PATCH', { reason });
  }
  appeals(): Promise<AdminAppeal[]> { return this.call(`${this.catalog}/api/admin/appeals`); }
  appealAttachments(id: string): Promise<AdminEvidenceAttachment[]> { return this.call(`${this.catalog}/api/admin/appeals/${encodeURIComponent(id)}/attachments`); }
  decideAppeal(id: string, status: 'accepted' | 'rejected', resolution: string): Promise<AdminAppeal> {
    return this.call(`${this.catalog}/api/admin/appeals/${encodeURIComponent(id)}`, 'PATCH', { status, resolution });
  }
  archiveAppeal(id: string): Promise<void> { return this.call(`${this.catalog}/api/admin/appeals/${encodeURIComponent(id)}/archive`, 'PATCH', {}); }
  myActions(): Promise<ModerationAction[]> { return this.call(`${this.catalog}/api/admin/my-actions`); }

  private async call<T>(url: string, method = 'GET', body?: object): Promise<T> {
    this.auth.requireSession();
    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 401) this.auth.sessionExpired();
    if (!response.ok) {
      const responseText = await response.text();
      let detail = responseText || response.headers.get('www-authenticate') || '';
      try {
        const payload: unknown = JSON.parse(responseText);
        if (payload && typeof payload === 'object') {
          const record = payload as Record<string, unknown>;
          detail = String(record['detail'] ?? record['message'] ?? record['error'] ?? responseText);
        }
      } catch { /* Conserva el texto plano de error si el servidor no devuelve JSON. */ }
      throw new AdminApiError(response.status, new URL(url).pathname, detail.slice(0, 500));
    }
    return response.json() as Promise<T>;
  }
}

export class AdminApiError extends Error {
  constructor(readonly status: number, readonly path: string, readonly detail = '') {
    super(detail ? `Error ${status}: ${detail}` : `Error ${status} en ${path}`);
  }
}
