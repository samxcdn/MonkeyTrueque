import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { ChartComponent } from 'ng-apexcharts';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { AuthService } from '../../core/auth/auth.service';
import { AdminApiError, AdminApiService } from '../../core/data/admin-api.service';
import { MarketplaceApiService } from '../../core/data/marketplace-api.service';
import { DEMO_DISTRICTS } from '../../core/data/demo-marketplace.data';
import type { Listing } from '../../core/models/marketplace.models';
import type { AdminAccountStatus, AdminAnalyticsSummary, AdminAppeal, AdminCaseEvent, AdminCaseNote, AdminEvidenceAttachment, AdminExchange, AdminExchangeDetail, AdminListing, AdminReport, AdminReview, AdminSanction, AdminStaff, AdminUser, AdminUserCreate, CaseAssigneeProfile, ModerationAction, ReviewModerationAction, StaffRole } from '../../core/data/admin-api.service';

type AdminTab = 'overview' | 'crm' | 'analytics' | 'reports' | 'case-history' | 'listings' | 'users' | 'users-grid' | 'user-detail' | 'user-add' | 'reviews' | 'appeals' | 'appeal-detail' | 'team' | 'exchanges' | 'activity' | 'notifications' | 'profile';
type UserModerationSection = 'access' | 'history' | 'apply';
type AccessState = 'checking' | 'signed-out' | 'forbidden' | 'ready' | 'error';
type AnalyticsPeriod = 'today' | 'week' | 'month' | 'year';
type AnalyticsBucket = { label: string; start: Date; end: Date };
type ReportEvidenceSnapshot = { targetType?: string; targetId?: string; ownerId?: string; capturedAt?: string; title?: string; description?: string; ownerName?: string; mode?: string; photosJson?: string; displayName?: string; imageUrl?: string; reporterEvidence?: string };
type LimaDistrictFeature = { properties: { IDDIST: string; NOMBDIST: string }; geometry: { type: string; coordinates: unknown } };
type LimaMapDistrict = { id: string; name: string; path: string; value: number; color: string };

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ChartComponent, MatDialogModule],
  templateUrl: './admin.component.html',
})
export class AdminComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(AdminApiService);
  private readonly dialog = inject(MatDialog);
  private readonly marketplaceApi = inject(MarketplaceApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private activeUserId: string | null = null;
  readonly currentUser = this.auth.user;
  readonly access = signal<AccessState>('checking');
  readonly staffRole = signal<StaffRole>('none');
  readonly isAdmin = computed(() => this.staffRole() === 'admin');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly tab = signal<AdminTab>('overview');
  readonly sidebarMenuGroup = signal('home');
  readonly darkMode = signal(localStorage.getItem('monkeytrueque.admin.theme') !== 'light');
  readonly menuOpen = signal(false);
  readonly sidebarCollapsed = signal(false);
  readonly sidebarGroups = signal<Record<string, boolean>>({ home: true, community: false, cases: false, administration: false });
  readonly profileMenuOpen = signal(false);
  readonly notificationsOpen = signal(false);
  readonly readReportNotificationIds = signal<string[]>([]);
  readonly readAppealNotificationIds = signal<string[]>([]);
  readonly deletedReportNotificationIds = signal<string[]>([]);
  readonly deletedAppealNotificationIds = signal<string[]>([]);
  readonly openUserGridMenuId = signal<string | null>(null);
  readonly ownProfile = signal<{ displayName: string; imageUrl: string | null; description: string | null; phone: string | null; countryCode: string | null; designation: string | null; memberSince: string } | null>(null);
  readonly ownProfileName = signal('');
  readonly ownProfileDescription = signal('');
  readonly ownProfilePhone = signal('');
  readonly ownProfileCountryCode = signal('');
  readonly ownProfileCountrySelectOpen = signal(false);
  readonly ownProfileCountrySelectSearch = signal('');
  readonly filteredOwnProfileCountries = computed(() => {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
    const query = normalize(this.ownProfileCountrySelectSearch().trim());
    return query ? this.phoneCountries.filter((country) => normalize(country.name).startsWith(query) || country.code.toLowerCase().startsWith(query)) : this.phoneCountries;
  });
  readonly ownProfilePhoneCountry = signal<CountryCode>('PE');
  readonly ownProfileCountryPickerOpen = signal(false);
  readonly ownProfileCountrySearch = signal('');
  readonly selectedOwnProfilePhoneCountry = computed(() => this.phoneCountries.find((country) => country.code === this.ownProfilePhoneCountry()) ?? this.phoneCountries[0]);
  readonly filteredOwnProfilePhoneCountries = computed(() => {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
    const query = normalize(this.ownProfileCountrySearch().trim());
    return query ? this.phoneCountries.filter((country) => normalize(country.name).startsWith(query) || country.code.toLowerCase().startsWith(query) || country.dialCode.startsWith(query)) : this.phoneCountries;
  });
  readonly selectedOwnProfileCountry = computed(() => this.phoneCountries.find((country) => country.code === this.ownProfileCountryCode()) ?? null);
  readonly ownProfileImage = signal('');
  readonly ownProfilePhoto = signal<File | null>(null);
  readonly ownProfileSaving = signal(false);
  readonly ownProfileMessage = signal('');
  readonly reports = signal<AdminReport[]>([]);
  readonly reportSearch = signal('');
  readonly reportStatusFilter = signal('all');
  readonly reportDateFrom = signal('');
  readonly reportDateTo = signal('');
  readonly listings = signal<AdminListing[]>([]);
  readonly listingSearch = signal('');
  readonly listingStatusFilter = signal('all');
  readonly listingDateFrom = signal('');
  readonly listingDateTo = signal('');
  readonly limaDistrictFeatures = signal<LimaDistrictFeature[]>([]);
  readonly hoveredMapTooltip = signal<{ district: LimaMapDistrict; x: number; y: number } | null>(null);
  readonly showDistrictMapModal = signal(false);
  readonly districtMapFeatures = computed<LimaMapDistrict[]>(() => {
    const features = this.limaDistrictFeatures();
    if (!features.length) return [];
    const coordinatePairs: number[][] = [];
    const collect = (value: unknown): void => {
      if (!Array.isArray(value)) return;
      if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') coordinatePairs.push(value as number[]);
      else value.forEach(collect);
    };
    features.forEach((feature) => collect(feature.geometry.coordinates));
    if (!coordinatePairs.length) return [];
    const minX = Math.min(...coordinatePairs.map((point) => point[0]));
    const maxX = Math.max(...coordinatePairs.map((point) => point[0]));
    const minY = Math.min(...coordinatePairs.map((point) => point[1]));
    const maxY = Math.max(...coordinatePairs.map((point) => point[1]));
    const scale = Math.min(460 / (maxX - minX), 310 / (maxY - minY));
    const offsetX = (500 - (maxX - minX) * scale) / 2;
    const offsetY = (350 - (maxY - minY) * scale) / 2;
    const project = (point: number[]) => [offsetX + (point[0] - minX) * scale, 350 - offsetY - (point[1] - minY) * scale];
    const counts = new Map<string, number>();
    for (const listing of this.listings()) {
      const district = DEMO_DISTRICTS.find((item) => item.id === listing.districtId);
      const key = this.districtKey(district?.name ?? listing.districtId ?? '');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return features.map((feature) => {
      const rings: number[][][][] = [];
      const geometry = feature.geometry.coordinates as number[][][] | number[][][][];
      const polygons = feature.geometry.type === 'MultiPolygon' ? geometry as number[][][][] : [geometry as number[][][]];
      for (const polygon of polygons) for (const ring of polygon) rings.push([ring]);
      const path = rings.map(([ring]) => ring.map((point, index) => {
        const [x, y] = project(point);
        return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ') + ' Z').join(' ');
      const name = feature.properties.NOMBDIST;
      const key = this.districtKey(name);
      const appDistrict = DEMO_DISTRICTS.find((item) => this.districtKey(item.name) === key || this.districtKey(item.id) === key);
      const id = appDistrict?.id ?? feature.properties.IDDIST;
      const appKey = this.districtKey(appDistrict?.name ?? name);
      return { id, name: appDistrict?.name ?? name, path, value: counts.get(appKey) ?? counts.get(key) ?? 0, color: '' };
    }).sort((a, b) => a.name.localeCompare(b.name, 'es')).map((district, index) => ({
      ...district,
      color: district.value > 0 ? `hsl(${Math.round(index * 137.508 % 360)} 72% 82%)` : 'rgba(59,130,246,.055)',
    }));
  });
  readonly publicListings = signal<Listing[]>([]);
  readonly exchanges = signal<AdminExchange[]>([]);
  readonly exchangeSearch = signal('');
  readonly exchangeStatusFilter = signal('all');
  readonly exchangeDateFrom = signal('');
  readonly exchangeDateTo = signal('');
  readonly actions = signal<ModerationAction[]>([]);
  readonly activitySearch = signal('');
  readonly activityTypeFilter = signal('all');
  readonly activityDateFrom = signal('');
  readonly activityDateTo = signal('');
  readonly users = signal<AdminUser[]>([]);
  readonly userSearch = signal('');
  readonly userReportFilter = signal('all');
  readonly userDateFrom = signal('');
  readonly userDateTo = signal('');
  readonly userPage = signal(1);
  readonly appeals = signal<AdminAppeal[]>([]);
  readonly appealSearch = signal('');
  readonly appealStatusFilter = signal('all');
  readonly appealDateFrom = signal('');
  readonly appealDateTo = signal('');
  readonly selectedAppealId = signal<string | null>(null);
  readonly selectedAppeal = computed(() => this.appeals().find((appeal) => appeal.id === this.selectedAppealId()) ?? null);
  readonly team = signal<AdminStaff[]>([]);
  readonly caseAssignees = computed(() => this.team().filter((staff) => staff.role === 'admin' || staff.role === 'moderator').sort((a, b) => a.displayName.localeCompare(b.displayName, 'es')));
  readonly caseAssigneeSearch = signal('');
  readonly caseAssigneeSearchOpen = signal(false);
  readonly caseParticipants = computed(() => {
    const report = this.selectedReport();
    if (!report) return new Set<string>();
    const participants = new Set<string>([report.reporterId]);
    if (report.targetType === 'user' && report.targetId) participants.add(report.targetId);
    const ownerId = this.reportSnapshot(report)?.ownerId;
    if (ownerId) participants.add(ownerId);
    return participants;
  });
  readonly filteredCaseAssignees = computed(() => {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
    const query = normalize(this.caseAssigneeSearch().trim());
    return this.caseAssignees().filter((staff) => !this.caseParticipants().has(staff.userId) && (!query || normalize(`${staff.displayName} ${staff.username ?? ''} ${staff.role === 'admin' ? 'administrador admin' : 'moderador moderator'}`).includes(query)));
  });
  readonly staffSearch = signal('');
  readonly staffRoleFilter = signal('all');
  readonly staffDateFrom = signal('');
  readonly staffDateTo = signal('');
  readonly filteredTeam = computed(() => {
    const query = this.staffSearch().trim().toLocaleLowerCase();
    const members = [...this.team()].sort((a, b) => a.displayName.localeCompare(b.displayName));
    return members.filter((member) => {
      const textMatches = !query || `${member.displayName} ${member.username ?? ''} ${member.userId} ${member.role}`.toLocaleLowerCase().includes(query);
      const roleMatches = this.staffRoleFilter() === 'all' || member.role === this.staffRoleFilter();
      return textMatches && roleMatches && this.inDateRange(member.createdAt, this.staffDateFrom(), this.staffDateTo());
    });
  });
  readonly visibleTeam = computed(() => {
    const editingId = this.editingStaffId();
    return editingId ? this.team().filter((member) => member.userId === editingId) : this.filteredTeam();
  });
  readonly newUserName = signal('');
  readonly newUserUsername = signal('');
  readonly newUserPassword = signal('');
  readonly newUserPhone = signal('');
  readonly newUserPhoneCountry = signal<CountryCode>('PE');
  readonly phoneCountryPickerOpen = signal(false);
  readonly phoneCountrySearch = signal('');
  readonly phoneCountries = getCountries().map((code) => ({
    code,
    name: new Intl.DisplayNames(['es'], { type: 'region' }).of(code) ?? code,
    dialCode: `+${getCountryCallingCode(code)}`,
  })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  readonly selectedPhoneCountry = computed(() => this.phoneCountries.find((country) => country.code === this.newUserPhoneCountry()) ?? this.phoneCountries[0]);
  readonly selectedNewUserCountry = computed(() => this.phoneCountries.find((country) => country.code === this.newUserCountryCode()) ?? null);
  readonly newUserCountryPickerOpen = signal(false);
  readonly newUserCountrySearch = signal('');
  readonly filteredNewUserCountries = computed(() => {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
    const query = normalize(this.newUserCountrySearch().trim());
    return query ? this.phoneCountries.filter((country) => normalize(country.name).startsWith(query) || country.code.toLowerCase().startsWith(query)) : this.phoneCountries;
  });
  readonly filteredPhoneCountries = computed(() => {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
    const query = normalize(this.phoneCountrySearch().trim());
    return query ? this.phoneCountries.filter((country) => normalize(country.name).startsWith(query) || country.code.toLowerCase().startsWith(query) || country.dialCode.startsWith(query)) : this.phoneCountries;
  });
  readonly newUserDepartment = signal('');
  readonly newUserCountryCode = signal('');
  readonly newUserDesignation = signal('');
  readonly newUserDescription = signal('');
  readonly newUserImageData = signal<string | null>(null);
  readonly newUserImagePreview = signal('');
  readonly reviews = signal<AdminReview[]>([]);
  readonly reviewSearch = signal('');
  readonly reviewVisibilityFilter = signal('all');
  readonly reviewDateFrom = signal('');
  readonly reviewDateTo = signal('');
  readonly visitAnalytics = signal<AdminAnalyticsSummary>({ totalVisits: 0, dailyVisits: [], sources: [], browsers: [], pages: [] });
  readonly communityPeriod = signal<AnalyticsPeriod>('week');
  readonly moderationPeriod = signal<AnalyticsPeriod>('week');
  readonly exchangePeriod = signal<AnalyticsPeriod>('week');
  readonly listingPeriod = signal<AnalyticsPeriod>('week');
  readonly visitPeriod = signal<'today' | 'week' | 'month'>('week');
  readonly analyticsLoaded = signal(false);
  readonly reviewActions = signal<ReviewModerationAction[]>([]);
  readonly reviewReason = signal('');
  readonly caseNotes = signal<AdminCaseNote[]>([]);
  readonly caseHistory = signal<AdminCaseEvent[]>([]);
  readonly caseHistoryLoading = signal(false);
  readonly reportReviewBusy = signal(false);
  readonly reportReviewFeedback = signal('');
  readonly reportReviewStatusDraft = signal<AdminReport['status'] | null>(null);
  readonly reportArchiveBusyId = signal<string | null>(null);
  readonly reportArchiveFeedback = signal('');
  readonly reportPendingArchive = signal<AdminReport | null>(null);
  readonly appealArchiveBusyId = signal<string | null>(null);
  readonly appealPendingArchive = signal<AdminAppeal | null>(null);
  readonly appealArchiveFeedback = signal('');
  readonly reportEvidence = signal<AdminEvidenceAttachment[]>([]);
  readonly reportEvidenceLoading = signal(false);
  readonly reportEvidenceError = signal('');
  readonly selectedEvidence = signal<AdminEvidenceAttachment | null>(null);
  readonly appealEvidence = signal<Record<string, AdminEvidenceAttachment[]>>({});
  readonly appealEvidenceLoading = signal<string | null>(null);
  readonly sanctions = signal<AdminSanction[]>([]);
  readonly accountDeactivated = signal<boolean | null>(null);
  readonly accountStatusFailed = signal(false);
  readonly selectedUserId = signal<string | null>(null);
  readonly userModerationSection = signal<UserModerationSection>('apply');
  readonly internalNote = signal('');
  readonly sanctionReason = signal('');
  readonly sanctionDuration = signal(3);
  readonly sanctionType = signal<AdminSanction['restrictionType']>('messaging');
  readonly appealResolutions = signal<Record<string, string>>({});
  readonly staffUserIdDraft = signal('');
  readonly staffRoleDraft = signal<AdminStaff['role']>('moderator');
  readonly staffReasonDraft = signal('');
  readonly editingStaffId = signal<string | null>(null);
  readonly selectedReportId = signal<string | null>(null);
  readonly selectedCaseAssignee = signal<CaseAssigneeProfile | null>(null);
  readonly selectedListingId = signal<string | null>(null);
  readonly selectedExchangeId = signal<string | null>(null);
  readonly exchangeDetail = signal<AdminExchangeDetail | null>(null);
  readonly resolution = signal('');
  readonly userResponse = signal('');
  readonly moderationNote = signal('');
  readonly selectedReport = computed(() => this.reports().find((item) => item.id === this.selectedReportId()) ?? null);
  readonly selectedReportReporter = computed(() => {
    const report = this.selectedReport();
    return report ? this.reporterProfile(report) : null;
  });
  readonly selectedListing = computed(() => this.listings().find((item) => item.id === this.selectedListingId()) ?? null);
  readonly selectedExchange = computed(() => this.exchanges().find((item) => item.id === this.selectedExchangeId()) ?? null);
  readonly selectedUser = computed(() => this.users().find((item) => item.userId === this.selectedUserId()) ?? null);
  readonly filteredReports = computed(() => {
    const query = this.reportSearch().trim().toLocaleLowerCase();
    return this.reports().filter((report) => {
      const reporter = this.reporterProfile(report).displayName;
      const text = `${report.id} ${reporter} ${report.reason} ${report.details} ${report.targetType} ${report.targetId ?? ''} ${this.listingTitle(report.listingId)}`.toLocaleLowerCase();
      return (!query || text.includes(query)) && (this.reportStatusFilter() === 'all' || report.status === this.reportStatusFilter()) && this.inDateRange(report.createdAt, this.reportDateFrom(), this.reportDateTo());
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
  readonly filteredListings = computed(() => {
    const query = this.listingSearch().trim().toLocaleLowerCase();
    return this.listings().filter((listing) => {
      const text = `${listing.title} ${listing.ownerName} ${listing.districtId} ${listing.ownerId}`.toLocaleLowerCase();
      const statusMatches = this.listingStatusFilter() === 'all' || (this.listingStatusFilter() === 'hidden' ? listing.moderationHidden : this.listingStatusFilter() === 'available' ? listing.available && !listing.moderationHidden : !listing.available && !listing.moderationHidden);
      return (!query || text.includes(query)) && statusMatches && this.inDateRange(listing.createdAt, this.listingDateFrom(), this.listingDateTo());
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
  readonly filteredExchanges = computed(() => {
    const query = this.exchangeSearch().trim().toLocaleLowerCase();
    return this.exchanges().filter((exchange) => {
      const text = `${exchange.listingTitle} ${exchange.offeredTitle} ${exchange.note} ${exchange.meetupPlace} ${exchange.ownerId} ${exchange.proposerId}`.toLocaleLowerCase();
      return (!query || text.includes(query)) && (this.exchangeStatusFilter() === 'all' || exchange.status === this.exchangeStatusFilter()) && this.inDateRange(exchange.createdAt, this.exchangeDateFrom(), this.exchangeDateTo());
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
  readonly filteredAppeals = computed(() => {
    const query = this.appealSearch().trim().toLocaleLowerCase();
    return this.appeals().filter((appeal) => {
      const text = `${appeal.userDisplayName} ${appeal.userId} ${appeal.explanation} ${appeal.resolution ?? ''} ${appeal.sanctionId}`.toLocaleLowerCase();
      return (!query || text.includes(query)) && (this.appealStatusFilter() === 'all' || appeal.status === this.appealStatusFilter()) && this.inDateRange(appeal.createdAt, this.appealDateFrom(), this.appealDateTo());
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
  readonly filteredReviews = computed(() => {
    const query = this.reviewSearch().trim().toLocaleLowerCase();
    return this.reviews().filter((review) => {
      const text = `${review.listingTitle} ${review.review ?? ''} ${review.reviewerId} ${review.reviewedUserId} ${review.rating}`.toLocaleLowerCase();
      const visibilityMatches = this.reviewVisibilityFilter() === 'all' || (this.reviewVisibilityFilter() === 'hidden' ? review.hidden : !review.hidden);
      return (!query || text.includes(query)) && visibilityMatches && this.inDateRange(review.createdAt, this.reviewDateFrom(), this.reviewDateTo());
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
  readonly filteredActions = computed(() => {
    const query = this.activitySearch().trim().toLocaleLowerCase();
    return this.actions().filter((action) => {
      const actor = this.moderationActor(action.adminId).name;
      const text = `${this.moderationActionName(action.action)} ${action.action} ${action.note} ${action.targetId} ${action.affectedUserName ?? ''} ${actor}`.toLocaleLowerCase();
      const kind = this.activityTypeFilter();
      const typeMatches = kind === 'all' || (kind === 'cases' ? /^(report-|case-|appeal-)/i.test(action.action) : kind === 'listings' ? action.action.toLowerCase().startsWith('listing-') : kind === 'users' ? /^(user-|staff-|sanction-)/i.test(action.action) : /^(review-)/i.test(action.action));
      return (!query || text.includes(query)) && typeMatches && this.inDateRange(action.createdAt, this.activityDateFrom(), this.activityDateTo());
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
  readonly filteredUsers = computed(() => {
    const query = this.userSearch().trim().toLocaleLowerCase();
    const users = [...this.users()].sort((a, b) => b.listingCount - a.listingCount || a.displayName.localeCompare(b.displayName));
    return users.filter((user) => {
      const textMatches = !query || `${user.displayName} ${user.username ?? ''}`.toLocaleLowerCase().includes(query);
      const reportsMatch = this.userReportFilter() === 'all' || (this.userReportFilter() === 'reported' ? user.reportCount > 0 : user.reportCount === 0);
      const dateMatches = !this.userDateFrom() && !this.userDateTo() || !!user.memberSince && this.inDateRange(user.memberSince, this.userDateFrom(), this.userDateTo());
      return textMatches && reportsMatch && dateMatches;
    });
  });
  readonly pagedUsers = computed(() => this.filteredUsers().slice((this.userPage() - 1) * 10, this.userPage() * 10));
  readonly userPageCount = computed(() => Math.max(1, Math.ceil(this.filteredUsers().length / 10)));
  readonly userPageNumbers = computed(() => Array.from({ length: this.userPageCount() }, (_, index) => index + 1));
  readonly userRangeStart = computed(() => this.filteredUsers().length ? (this.userPage() - 1) * 10 + 1 : 0);
  readonly userRangeEnd = computed(() => Math.min(this.userPage() * 10, this.filteredUsers().length));
  readonly selectedUserListingCount = computed(() => this.selectedUser() ? this.listings().filter((listing) => listing.ownerId === this.selectedUser()!.userId).length : 0);
  readonly selectedUserReportCount = computed(() => this.selectedUser() ? this.reports().filter((report) => report.reporterId === this.selectedUser()!.userId || report.targetId === this.selectedUser()!.userId).length : 0);
  readonly openReports = computed(() => this.reports().filter((report) => ['open', 'in-review', 'waiting-information', 'escalated'].includes(report.status)).length);
  readonly activeReportNotifications = computed(() => this.reports().filter((report) => ['open', 'in-review', 'waiting-information', 'escalated'].includes(report.status)));
  readonly unreadReportNotifications = computed(() => this.activeReportNotifications().filter((report) => !this.readReportNotificationIds().includes(report.id)));
  readonly unreadReportCount = computed(() => this.unreadReportNotifications().length);
  readonly activeAppealNotifications = computed(() => this.appeals().filter((appeal) => appeal.status === 'open'));
  readonly unreadAppealNotifications = computed(() => this.activeAppealNotifications().filter((appeal) => !this.readAppealNotificationIds().includes(appeal.id)));
  readonly unreadAppealCount = computed(() => this.unreadAppealNotifications().length);
  readonly unreadNotificationCount = computed(() => this.unreadReportCount() + this.unreadAppealCount());
  readonly reportNotifications = computed(() => this.unreadReportNotifications().slice(0, 6));
  readonly appealNotifications = computed(() => this.unreadAppealNotifications().slice(0, 6));
  readonly reportNotificationHistory = computed(() => this.activeReportNotifications().filter((report) => !this.deletedReportNotificationIds().includes(report.id)));
  readonly appealNotificationHistory = computed(() => this.activeAppealNotifications().filter((appeal) => !this.deletedAppealNotificationIds().includes(appeal.id)));
  readonly hiddenListings = computed(() => this.listings().filter((listing) => listing.moderationHidden).length);
  readonly totalReports = computed(() => this.reports().length);
  readonly visibleListings = computed(() => this.listings().filter((listing) => listing.available && !listing.moderationHidden).length);
  readonly completedExchanges = computed(() => this.exchanges().filter((exchange) => exchange.status === 'confirmed-by-both' || exchange.status === 'rated').length);
  readonly reportBreakdown = computed(() => [
    { label: 'Pendientes', value: this.reports().filter((item) => ['open', 'waiting-information', 'escalated'].includes(item.status)).length, color: '#f59e0b' },
    { label: 'En revisión', value: this.reports().filter((item) => item.status === 'in-review').length, color: '#05bbfb' },
    { label: 'Resueltos', value: this.reports().filter((item) => item.status === 'resolved').length, color: '#22c55e' },
    { label: 'Descartados', value: this.reports().filter((item) => ['dismissed', 'duplicate'].includes(item.status)).length, color: '#a78bfa' },
  ]);
  readonly listingBreakdown = computed(() => [
    { label: 'Disponibles', value: this.visibleListings(), color: '#05bbfb' },
    { label: 'Ocultas', value: this.hiddenListings(), color: '#f59e0b' },
    { label: 'Intercambiadas', value: this.listings().filter((item) => !item.available).length, color: '#22c55e' },
  ]);
  readonly listingTrend = computed(() => this.monthTrend(this.listings()));
  readonly reportTrend = computed(() => this.monthTrend(this.reports()));
  readonly exchangeTrend = computed(() => this.monthTrend(this.exchanges()));
  readonly ratingAverage = computed(() => {
    const reviews = this.reviews();
    return reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : '—';
  });
  readonly ratingBreakdown = computed(() => [5, 4, 3, 2, 1].map((rating) => ({ rating, value: this.reviews().filter((item) => item.rating === rating).length })));
  readonly exchangeBreakdown = computed(() => {
    const groups = [
      { label: 'En coordinación', value: this.exchanges().filter((item) => !['confirmed-by-both', 'rated', 'cancelled', 'completed'].includes(item.status)).length, color: '#5547e8' },
      { label: 'Completados', value: this.completedExchanges(), color: '#12b8d0' },
      { label: 'Cancelados', value: this.exchanges().filter((item) => item.status === 'cancelled').length, color: '#f46d72' },
    ];
    return groups;
  });
  readonly exchangeDonut = computed(() => this.donutBackground(this.exchangeBreakdown()));
  readonly topDistricts = computed(() => {
    const counts = new Map<string, number>();
    for (const listing of this.listings()) counts.set(listing.districtId || 'Sin distrito', (counts.get(listing.districtId || 'Sin distrito') ?? 0) + 1);
    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  });
  readonly districtMapLegend = computed(() => [...this.districtMapFeatures()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'es')));
  readonly districtMapTopLegend = computed(() => this.districtMapLegend().slice(0, 8));
  readonly recentReports = computed(() => [...this.reports()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5));
  readonly moderationTrend = computed(() => {
    const buckets = this.periodBuckets(this.moderationPeriod());
    const actions = this.actions();
    const groupMatches: Record<string, (action: ModerationAction) => boolean> = {
      Casos: (action) => /^(report-|case-|appeal-)/i.test(action.action),
      Publicaciones: (action) => action.action.toLowerCase().startsWith('listing-'),
      Cuentas: (action) => /^(user-|staff-|sanction-)/i.test(action.action),
      Otros: (action) => !/^(report-|case-|appeal-|listing-|user-|staff-|sanction-)/i.test(action.action),
    };
    return { labels: buckets.map((bucket) => bucket.label), series: Object.entries(groupMatches).map(([name, matches]) => ({ name, data: buckets.map((bucket) => actions.filter((action) => { const date = new Date(action.createdAt); return matches(action) && date >= bucket.start && date < bucket.end; }).length) })) };
  });
  readonly moderationWeekChartSeries = computed(() => this.moderationTrend().series);
  readonly moderationWeekChartLabels = computed(() => this.moderationTrend().labels);
  readonly exchangePeriodTrend = computed(() => {
    const buckets = this.periodBuckets(this.exchangePeriod());
    const records = this.exchanges();
    const groups = [
      { name: 'En coordinación', matches: (status: string) => !['confirmed-by-both', 'rated', 'completed', 'cancelled'].includes(status) },
      { name: 'Completados', matches: (status: string) => ['confirmed-by-both', 'rated', 'completed'].includes(status) },
      { name: 'Cancelados', matches: (status: string) => status === 'cancelled' },
    ];
    return {
      labels: buckets.map((bucket) => bucket.label),
      series: groups.map((group) => ({ name: group.name, data: buckets.map((bucket) => records.filter((record) => { const date = new Date(record.createdAt); return group.matches(record.status) && date >= bucket.start && date < bucket.end; }).length) })),
    };
  });
  readonly listingPeriodTrend = computed(() => {
    const buckets = this.periodBuckets(this.listingPeriod());
    const records = this.listings();
    const groups = [
      { name: 'Disponibles', matches: (listing: AdminListing) => listing.available && !listing.moderationHidden },
      { name: 'Ocultas', matches: (listing: AdminListing) => listing.moderationHidden },
      { name: 'Completadas', matches: (listing: AdminListing) => !listing.available && !listing.moderationHidden },
    ];
    return {
      labels: buckets.map((bucket) => bucket.label),
      series: groups.map((group) => ({ name: group.name, data: buckets.map((bucket) => records.filter((record) => { const date = new Date(record.createdAt); return group.matches(record) && date >= bucket.start && date < bucket.end; }).length) })),
    };
  });
  readonly recentListings = computed(() => {
    const visualById = new Map(this.publicListings().map((listing) => [listing.id, listing]));
    return [...this.listings()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map((listing) => ({
      ...listing,
      photoUrl: listing.photoUrl || visualById.get(listing.id)?.photos?.[0]?.src || null,
    }));
  });
  readonly recentExchanges = computed(() => [...this.exchanges()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8));
  readonly topUsers = computed(() => {
    const listingByOwner = new Map(this.publicListings().filter((listing) => listing.ownerId && listing.ownerImageUrl).map((listing) => [listing.ownerId!, listing.ownerImageUrl!]));
    return [...this.users()].sort((a, b) => b.listingCount - a.listingCount).slice(0, 5).map((user) => ({
      ...user,
      imageUrl: user.imageUrl || listingByOwner.get(user.userId) || null,
    }));
  });
  readonly reportDonut = computed(() => {
    return this.donutBackground(this.reportBreakdown());
  });

  readonly reportChartSeries = computed(() => {
    const values = this.reportBreakdown().map((item) => item.value);
    return values.some((value) => value > 0) ? values : [1];
  });
  readonly reportChartLabels = computed(() => this.totalReports() ? this.reportBreakdown().map((item) => item.label) : ['Sin reportes']);
  readonly reportChartColors = computed(() => this.totalReports() ? this.reportBreakdown().map((item) => item.color) : [this.darkMode() ? '#3b4657' : '#dbe4ef']);
  readonly listingChartSeries = computed(() => [{ name: 'Publicaciones', data: this.listingBreakdown().map((item) => item.value) }]);
  readonly listingChartLabels = computed(() => this.listingBreakdown().map((item) => item.label));
  readonly listingTrendChartSeries = computed(() => [this.communityTrend().series[0]]);
  readonly communityTrend = computed(() => {
    const period = this.communityPeriod();
    const buckets = this.periodBuckets(period);
    const groups = [
      { name: 'Publicaciones', records: this.listings() },
      { name: 'Intercambios', records: this.exchanges() },
      { name: 'Reportes', records: this.reports() },
    ];
    return {
      labels: buckets.map((bucket) => bucket.label),
      series: groups.map((group) => ({ name: group.name, data: buckets.map((bucket) => group.records.filter((record) => { const date = new Date(record.createdAt); return date >= bucket.start && date < bucket.end; }).length) })),
    };
  });
  readonly activityTrendChartSeries = computed(() => this.communityTrend().series);
  readonly weekdayActivity = computed(() => {
    const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const records = [this.listings(), this.exchanges(), this.reports()];
    return { labels, series: records.map((group, index) => ({ name: ['Publicaciones', 'Intercambios', 'Reportes'][index], data: labels.map((_, day) => group.filter((item) => new Date(item.createdAt).getDay() === day).length) })) };
  });
  readonly listingTrendChartLabels = computed(() => this.communityTrend().labels);
  readonly dailyVisitTrend = computed(() => {
    const buckets = this.periodBuckets(this.visitPeriod());
    const visits = this.visitAnalytics().dailyVisits;
    return {
      labels: buckets.map((bucket) => bucket.label),
      values: buckets.map((bucket) => visits.filter((visit) => {
        const date = new Date(`${visit.date}T00:00:00`);
        return date >= bucket.start && date < bucket.end;
      }).reduce((total, visit) => total + visit.count, 0)),
    };
  });
  readonly exchangeChartSeries = computed(() => this.exchangeBreakdown().map((item) => item.value));
  readonly exchangeChartLabels = computed(() => this.exchangeBreakdown().map((item) => item.label));
  readonly ratingChartSeries = computed(() => [{ name: 'Reseñas', data: this.ratingBreakdown().map((item) => item.value) }]);
  readonly ratingChartLabels = computed(() => this.ratingBreakdown().map((item) => `${item.rating} estrellas`));
  readonly districtChartSeries = computed(() => [{ name: 'Publicaciones', data: this.topDistricts().map((item) => item.value) }]);
  readonly districtChartLabels = computed(() => this.topDistricts().map((item) => item.label));
  readonly activeUsersChartSeries = computed(() => [{ name: 'Publicaciones', data: this.topUsers().map((item) => item.listingCount) }]);
  readonly activeUsersChartLabels = computed(() => this.topUsers().map((item) => item.displayName));
  readonly trafficSources = computed(() => this.visitAnalytics().sources.map((item) => ({ ...item, label: ({ direct: 'Directo', google: 'Google', bing: 'Bing', yahoo: 'Yahoo', duckduckgo: 'DuckDuckGo', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', x: 'X', whatsapp: 'WhatsApp', linkedin: 'LinkedIn', youtube: 'YouTube', referral: 'Otros sitios' } as Record<string, string>)[item.key] ?? item.key })));
  readonly browserUsage = computed(() => this.visitAnalytics().browsers.map((item) => ({ ...item, label: ({ brave: 'Brave', chrome: 'Google Chrome', edge: 'Microsoft Edge', firefox: 'Mozilla Firefox', safari: 'Safari', opera: 'Opera', other: 'Otros' } as Record<string, string>)[item.key] ?? item.key })).sort((a, b) => b.count - a.count));
  browserLogoSrc(key: string): string { return `/brand/browser-logos/${['brave', 'chrome', 'edge', 'firefox', 'safari', 'opera'].includes(key) ? key : 'other'}.${['firefox', 'safari'].includes(key) ? 'png' : 'svg'}`; }
  browserShare(count: number): number { const total = this.visitAnalytics().totalVisits; return total > 0 ? Math.min(100, count / total * 100) : 0; }
  readonly popularPages = computed(() => this.visitAnalytics().pages.map((item) => ({ ...item, label: ({ home: 'Inicio', explore: 'Explorar', product: 'Detalle de publicación', publish: 'Publicar', messages: 'Mensajes', account: 'Cuenta', info: 'Información', other: 'Otras páginas' } as Record<string, string>)[item.key] ?? item.key })));
  readonly trafficSourceChartSeries = computed(() => [{ name: 'Visitas', data: this.trafficSources().map((item) => item.count) }]);
  readonly crmTrafficSeries = computed(() => this.trafficSources().map((item) => item.count));
  readonly trafficSourceChartLabels = computed(() => this.trafficSources().map((item) => item.label));
  readonly popularPagesChartSeries = computed(() => [{ name: 'Visitas', data: this.popularPages().map((item) => item.count) }]);
  readonly popularPagesChartLabels = computed(() => this.popularPages().map((item) => item.label));
  readonly dailyVisitChartSeries = computed(() => [{ name: 'Visitas', data: this.dailyVisitTrend().values }]);
  readonly dailyVisitChartLabels = computed(() => this.dailyVisitTrend().labels);
  readonly reportMiniSeries = computed(() => [{ name: 'Reportes', data: this.reportTrend().map((item) => item.value) }]);
  readonly reportMiniLabels = computed(() => this.reportTrend().map((item) => item.label));
  readonly listingMiniSeries = computed(() => [{ name: 'Publicaciones', data: this.listingTrend().map((item) => item.value) }]);
  readonly listingMiniLabels = computed(() => this.listingTrend().map((item) => item.label));
  readonly exchangeMiniSeries = computed(() => [{ name: 'Intercambios', data: this.exchangeTrend().map((item) => item.value) }]);
  readonly exchangeMiniLabels = computed(() => this.exchangeTrend().map((item) => item.label));
  readonly ratingMiniSeries = computed(() => [{ name: 'Reseñas', data: this.ratingBreakdown().map((item) => item.value) }]);
  readonly ratingMiniLabels = computed(() => this.ratingBreakdown().map((item) => `${item.rating} estrellas`));

  readonly donutChart = { type: 'donut' as const, height: 300, width: '100%', background: 'transparent', foreColor: '#cbd5e1', fontFamily: 'inherit', toolbar: { show: false }, animations: { enabled: true, speed: 450 } };
  readonly reportWidgetPieChart = { type: 'pie' as const, height: 270, width: '100%', background: 'transparent', foreColor: '#64748b', fontFamily: 'inherit', toolbar: { show: false }, animations: { enabled: true, speed: 500 } };
  readonly moderationWidgetRadarChart = { type: 'radar' as const, height: 270, width: '100%', background: 'transparent', foreColor: '#64748b', fontFamily: 'inherit', toolbar: { show: false }, animations: { enabled: true, speed: 500 } };
  readonly piePlotOptions = { pie: { expandOnClick: true, customScale: 0.92 } };
  readonly radarStroke = { width: 2 };
  readonly radarFill = { opacity: 0.18 };
  readonly radarMarkers = { size: 3, hover: { size: 5 } };
  readonly radarLegend = { show: true, position: 'bottom' as const, labels: { colors: '#64748b' }, fontSize: '10px', itemMargin: { horizontal: 8, vertical: 2 } };
  readonly reportWidgetLegend = { show: true, position: 'bottom' as const, labels: { colors: '#64748b' }, fontSize: '11px', itemMargin: { horizontal: 10, vertical: 4 } };
  readonly trafficDonutChart = { type: 'donut' as const, height: 260, width: '100%', background: 'transparent', foreColor: '#64748b', fontFamily: 'inherit', toolbar: { show: false }, animations: { enabled: true, speed: 550 } };
  readonly donutPlotOptions = { pie: { donut: { size: '70%', labels: { show: true, total: { show: true, label: 'Total', color: '#94a3b8', formatter: (w: { globals: { seriesTotals: number[] } }) => String(w.globals.seriesTotals.reduce((sum, value) => sum + value, 0)) } } } } };
  readonly reportDonutPlotOptions = { pie: { donut: { size: '70%', labels: { show: true, total: { show: true, label: 'Total', color: '#94a3b8', formatter: () => String(this.totalReports()) } } } } };
  readonly donutDataLabels = { enabled: true, formatter: (value: number) => `${Math.round(value)}%`, style: { fontSize: '12px', fontWeight: 700 } };
  readonly hiddenDataLabels = { enabled: false };
  readonly donutLegend = { show: true, position: 'bottom' as const, labels: { colors: '#cbd5e1' }, fontSize: '12px', itemMargin: { horizontal: 10, vertical: 5 } };
  readonly donutTooltip = { theme: 'dark' as const, y: { formatter: (value: number) => `${value}` } };
  readonly hiddenTooltip = { enabled: false };
  readonly areaChart = { type: 'area' as const, height: 350, width: '100%', background: 'transparent', foreColor: '#cbd5e1', fontFamily: 'inherit', toolbar: { show: true, tools: { download: true, selection: false, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } }, zoom: { enabled: true, type: 'x' as const }, animations: { enabled: true, speed: 500 } };
  readonly areaStroke = { curve: 'smooth' as const, width: 3 };
  readonly areaFill = { type: 'gradient' as const, gradient: { shadeIntensity: 0.35, opacityFrom: 0.42, opacityTo: 0.04, stops: [0, 90, 100] } };
  readonly areaMarkers = { size: 5, strokeWidth: 2, hover: { size: 7 } };
  readonly areaGrid = { borderColor: 'rgba(148,163,184,.14)', strokeDashArray: 4, padding: { left: 12, right: 18 } };
  readonly barChart = { type: 'bar' as const, height: 300, width: '100%', background: 'transparent', foreColor: '#cbd5e1', fontFamily: 'inherit', toolbar: { show: false }, animations: { enabled: true, speed: 400 } };
  readonly timeColumnChart = { ...this.barChart, height: 270, stacked: true };
  readonly stackedColumnPlotOptions = { bar: { horizontal: false, borderRadius: 5, columnWidth: '48%', distributed: false } };
  readonly horizontalBarPlotOptions = { bar: { horizontal: true, borderRadius: 7, barHeight: '54%', distributed: true, dataLabels: { position: 'right' as const } } };
  readonly columnBarPlotOptions = { bar: { horizontal: false, borderRadius: 6, columnWidth: '42%', distributed: false } };
  readonly distributedColumnPlotOptions = { bar: { horizontal: false, borderRadius: 7, columnWidth: '46%', distributed: true, dataLabels: { position: 'top' as const } } };
  readonly barDataLabels = { enabled: true, offsetX: 7, style: { colors: ['#cbd5e1'], fontSize: '11px', fontWeight: 700 } };
  readonly columnDataLabels = { enabled: true, offsetY: -8, style: { colors: ['#64748b'], fontSize: '10px', fontWeight: 700 } };
  readonly barTooltip = { theme: 'dark' as const, y: { formatter: (value: number) => `${value}` } };
  readonly axisGrid = { borderColor: 'rgba(148,163,184,.14)', strokeDashArray: 4 };
  readonly axisLabels = { style: { colors: '#94a3b8', fontSize: '11px' } };
  readonly axisLegend = { show: false };
  readonly miniChart = { type: 'bar' as const, height: 52, width: 108, background: 'transparent', fontFamily: 'inherit', sparkline: { enabled: true }, toolbar: { show: false }, animations: { enabled: true, speed: 350 } };
  readonly miniPlotOptions = { bar: { columnWidth: '50%', borderRadius: 3 } };
  readonly miniTooltip = { enabled: true, theme: 'dark' as const, followCursor: true, x: { show: true }, y: { title: { formatter: (seriesName: string) => `${seriesName}: ` } } };

  private donutBackground(items: readonly { value: number; color: string }[]): string {
    const total = items.reduce((sum, item) => sum + item.value, 0);
    if (!total) return 'conic-gradient(#3b4657 0 100%)';
    let position = 0;
    const parts = items.map((item) => {
      const start = position;
      position += item.value / total * 100;
      return `${item.color} ${start}% ${position}%`;
    });
    return `conic-gradient(${parts.join(', ')})`;
  }

  private periodBuckets(period: AnalyticsPeriod): AnalyticsBucket[] {
    const now = new Date();
    const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (period === 'today') return [{ label: 'Hoy', start: dayStart(now), end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) }];
    if (period === 'week') return Array.from({ length: 7 }, (_, index) => {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + index);
      return { label: new Intl.DateTimeFormat('es-PE', { weekday: 'short' }).format(start).replace('.', ''), start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) };
    });
    if (period === 'month') {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return Array.from({ length: Math.ceil(daysInMonth / 7) }, (_, index) => {
        const firstDay = index * 7 + 1;
        const lastDay = Math.min(firstDay + 6, daysInMonth);
        return { label: `${firstDay}–${lastDay}`, start: new Date(now.getFullYear(), now.getMonth(), firstDay), end: new Date(now.getFullYear(), now.getMonth(), lastDay + 1) };
      });
    }
    return Array.from({ length: 12 }, (_, month) => ({ label: new Intl.DateTimeFormat('es-PE', { month: 'short' }).format(new Date(now.getFullYear(), month, 1)).replace('.', ''), start: new Date(now.getFullYear(), month, 1), end: new Date(now.getFullYear(), month + 1, 1) }));
  }

  private monthTrend(records: readonly { createdAt: string }[]): { label: string; value: number }[] {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1));
    return months.map((month) => ({
      label: new Intl.DateTimeFormat('es-PE', { month: 'short' }).format(month).replace('.', ''),
      value: records.filter((record) => { const date = new Date(record.createdAt); return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth(); }).length,
    }));
  }

  trendPercent(value: number, series: readonly { value: number }[]): number {
    const max = Math.max(1, ...series.map((item) => item.value));
    return Math.max(value ? 8 : 2, Math.round(value / max * 100));
  }

  private districtKey(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
  }

  showDistrictMapTooltip(district: LimaMapDistrict, event: MouseEvent | FocusEvent): void {
    const target = event.currentTarget as Element | null;
    const layout = target?.closest('.admin-district-map__layout')?.getBoundingClientRect();
    if (!layout) return;
    const bounds = target?.getBoundingClientRect();
    const mouse = event instanceof MouseEvent;
    const pointX = mouse ? event.clientX : (bounds?.left ?? layout.left) + (bounds?.width ?? 0) / 2;
    const pointY = mouse ? event.clientY : (bounds?.top ?? layout.top) + (bounds?.height ?? 0) / 2;
    const x = Math.max(4, Math.min(pointX - layout.left + 12, layout.width - 170));
    const y = Math.max(4, Math.min(pointY - layout.top + 12, layout.height - 54));
    this.hoveredMapTooltip.set({ district, x, y });
  }

  constructor() {
    void fetch('/data/lima-districts.geojson').then((response) => response.ok ? response.json() : null).then((data: { features?: LimaDistrictFeature[] } | null) => this.limaDistrictFeatures.set(data?.features ?? [])).catch(() => this.limaDistrictFeatures.set([]));
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const section = params.get('section');
      this.tab.set(section === 'crm' ? 'crm' : section === 'analitica' ? 'analytics' : section === 'reportes' ? 'reports' : section === 'historial-caso' ? 'case-history' : section === 'publicaciones' ? 'listings' : section === 'usuarios' ? 'users' : section === 'usuarios-cuadricula' ? 'users-grid' : section === 'usuario' ? 'user-detail' : section === 'agregar-usuario' ? 'user-add' : section === 'resenas' ? 'reviews' : section === 'apelaciones' ? 'appeals' : section === 'equipo' ? 'team' : section === 'intercambios' ? 'exchanges' : section === 'actividad' || section === 'mi-actividad' ? 'activity' : section === 'notificaciones' ? 'notifications' : section === 'perfil' ? 'profile' : 'overview');
      if (section !== 'usuario') this.selectedUserId.set(null);
      if (section === 'reportes') this.markAllReportNotificationsRead();
      if (section === 'apelaciones') this.markAllAppealNotificationsRead();
      this.openSidebarGroupForTab(this.tab());
      if (section === 'perfil') void this.loadOwnProfile();
      this.selectUserFromRoute();
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.selectUserFromRoute();
      this.selectedAppealId.set(params.get('appealId'));
      if (this.tab() === 'case-history') {
        const reportId = params.get('reportId');
        const report = this.reports().find((item) => item.id === reportId);
        if (report && this.selectedReportId() !== report.id) this.selectReport(report);
      }
      if (this.tab() === 'appeals') this.tab.set(params.get('appealId') ? 'appeal-detail' : 'appeals');
    });
    effect(() => {
      if (this.tab() !== 'case-history') return;
      const reportId = this.route.snapshot.queryParamMap.get('reportId');
      const report = this.reports().find((item) => item.id === reportId);
      if (report && this.selectedReportId() !== report.id) this.selectReport(report);
    });
    effect(() => {
      const user = this.auth.user();
      const status = this.auth.status();
      if (!user) {
        this.activeUserId = null;
        this.readReportNotificationIds.set([]);
        this.readAppealNotificationIds.set([]);
        this.deletedReportNotificationIds.set([]);
        this.deletedAppealNotificationIds.set([]);
        this.staffRole.set('none');
        this.access.set(status === 'loading' ? 'checking' : 'signed-out');
        this.reports.set([]);
        this.listings.set([]);
        this.exchanges.set([]);
        this.actions.set([]);
        return;
      }
      if (this.activeUserId === user.id) return;
      this.activeUserId = user.id;
      this.readReportNotificationIds.set(this.loadReadReportNotifications(user.id));
      this.readAppealNotificationIds.set(this.loadReadAppealNotifications(user.id));
      this.deletedReportNotificationIds.set(this.loadNotificationIds(`monkeytrueque.admin.deleted-notifications.${user.id}`));
      this.deletedAppealNotificationIds.set(this.loadNotificationIds(`monkeytrueque.admin.deleted-appeals.${user.id}`));
      this.access.set('checking');
      void this.initialize(user.id);
    });
  }

  async signIn(): Promise<void> {
    try { await this.auth.openSignIn(); }
    catch { this.error.set('No se pudo abrir el inicio de sesión.'); }
  }

  retry(): void {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    this.access.set('checking');
    void this.initialize(userId);
  }

  selectReport(report: AdminReport): void {
    this.selectedReportId.set(report.id);
    this.selectedCaseAssignee.set(null);
    if (report.assignedTo) {
      const knownAssignee = this.caseAssignee(report.assignedTo);
      if (knownAssignee?.displayName && knownAssignee.displayName !== report.assignedTo) {
        this.selectedCaseAssignee.set({ userId: knownAssignee.userId, displayName: knownAssignee.displayName, imageUrl: knownAssignee.imageUrl, role: knownAssignee.role });
      }
      void this.api.caseAssigneeProfile(report.assignedTo).then((profile) => {
        if (this.selectedReportId() === report.id) this.selectedCaseAssignee.set(profile);
      }).catch(() => undefined);
    }
    this.resolution.set(report.resolution ?? '');
    this.userResponse.set(report.userResponse ?? '');
    this.error.set('');
    this.reportReviewFeedback.set('');
    this.reportReviewStatusDraft.set(null);
    this.caseNotes.set([]);
    this.caseHistory.set([]);
    this.reportEvidence.set([]);
    this.reportEvidenceError.set('');
    void this.loadReportEvidence(report.id);
    if (this.isAdmin() || report.assignedTo === this.auth.user()?.id) {
      void this.api.caseNotes(report.id).then((items) => this.caseNotes.set(items)).catch(() => this.error.set('No se pudieron cargar las notas internas.'));
      this.caseHistoryLoading.set(true);
      void this.api.caseHistory(report.id).then((items) => { if (this.selectedReportId() === report.id) this.caseHistory.set(items); }).catch(() => this.error.set('No se pudo cargar el historial del caso.')).finally(() => { if (this.selectedReportId() === report.id) this.caseHistoryLoading.set(false); });
    }
  }

  backToReports(): void {
    this.selectedReportId.set(null);
    this.error.set('');
    this.reportEvidence.set([]);
    this.reportEvidenceError.set('');
    this.caseNotes.set([]);
    this.caseHistory.set([]);
  }

  requestArchiveReport(report: AdminReport): void {
    if (!this.isAdmin() || this.reportArchiveBusyId()) return;
    this.reportPendingArchive.set(report);
  }

  cancelArchiveReport(): void { this.reportPendingArchive.set(null); }

  async confirmArchiveReport(): Promise<void> {
    const report = this.reportPendingArchive();
    if (!report || !this.isAdmin() || this.reportArchiveBusyId()) return;
    this.reportArchiveBusyId.set(report.id);
    this.reportArchiveFeedback.set('');
    try {
      await this.api.archiveReport(report.id, true);
      this.reports.update((items) => items.filter((item) => item.id !== report.id));
      if (this.selectedReportId() === report.id) this.backToReports();
      this.reportPendingArchive.set(null);
      this.reportArchiveFeedback.set('Reporte archivado. Su historial se conservó.');
    } catch (error) {
      this.reportArchiveFeedback.set(error instanceof AdminApiError && error.detail ? `No se pudo archivar el reporte: ${error.detail}` : 'No se pudo archivar el reporte. Revisa la conexión e inténtalo de nuevo.');
    } finally { this.reportArchiveBusyId.set(null); }
  }

  requestArchiveAppeal(appeal: AdminAppeal): void {
    if (!this.isAdmin() || appeal.status === 'open' || this.appealArchiveBusyId()) return;
    this.appealArchiveFeedback.set('');
    this.appealPendingArchive.set(appeal);
  }

  cancelArchiveAppeal(): void { this.appealPendingArchive.set(null); }

  async confirmArchiveAppeal(): Promise<void> {
    const appeal = this.appealPendingArchive();
    if (!appeal || !this.isAdmin() || appeal.status === 'open' || this.appealArchiveBusyId()) return;
    this.appealArchiveBusyId.set(appeal.id);
    this.appealArchiveFeedback.set('');
    try {
      await this.api.archiveAppeal(appeal.id);
      this.appeals.update((items) => items.filter((item) => item.id !== appeal.id));
      if (this.selectedAppealId() === appeal.id) this.navigateSection('appeals');
      this.appealPendingArchive.set(null);
      this.appealArchiveFeedback.set('Apelación archivada. El registro de moderación se conservó.');
    } catch (error) {
      this.appealArchiveFeedback.set(error instanceof AdminApiError && error.detail ? `No se pudo archivar la apelación: ${error.detail}` : 'No se pudo archivar la apelación. Revisa la conexión e inténtalo de nuevo.');
    } finally { this.appealArchiveBusyId.set(null); }
  }

  canChangeReportStatus(report: AdminReport, status: AdminReport['status']): boolean {
    const assignedToCurrentUser = this.canReviewReport(report);
    const hasInternalReason = Boolean(this.resolution().trim());
    const hasReporterResponse = status !== 'waiting-information' || Boolean(this.userResponse().trim());
    return assignedToCurrentUser && hasInternalReason && hasReporterResponse && !this.reportReviewBusy();
  }

  canReviewReport(report: AdminReport): boolean {
    const currentUserId = this.auth.user()?.id;
    return !!currentUserId && !this.caseParticipants().has(currentUserId) && (this.isAdmin() || report.assignedTo === currentUserId);
  }

  currentUserParticipatesInReport(): boolean {
    const currentUserId = this.auth.user()?.id;
    return !!currentUserId && this.caseParticipants().has(currentUserId);
  }

  selectReportReviewStatus(status: AdminReport['status']): void {
    const report = this.selectedReport();
    if (!report || !this.canReviewReport(report) || this.reportReviewBusy()) return;
    this.reportReviewStatusDraft.set(status);
    this.reportReviewFeedback.set('');
  }

  canSaveReportReview(report: AdminReport): boolean {
    const status = this.reportReviewStatusDraft();
    return !!status && this.canChangeReportStatus(report, status);
  }

  saveReportReview(): void {
    const status = this.reportReviewStatusDraft();
    if (status) void this.review(status);
  }

  async loadReportEvidence(reportId: string): Promise<void> {
    this.reportEvidenceLoading.set(true);
    this.reportEvidenceError.set('');
    try {
      const items = await this.api.reportAttachments(reportId);
      if (this.selectedReportId() === reportId) this.reportEvidence.set(items);
    } catch (error) {
      if (this.selectedReportId() === reportId) {
        const detail = error instanceof Error ? error.message : '';
        this.reportEvidenceError.set(detail ? `No se pudieron cargar las pruebas adjuntas. ${detail}` : 'No se pudieron cargar las pruebas adjuntas. Revisa tu conexión e inténtalo de nuevo.');
      }
    } finally {
      if (this.selectedReportId() === reportId) this.reportEvidenceLoading.set(false);
    }
  }

  openEvidencePreview(attachment: AdminEvidenceAttachment): void { this.selectedEvidence.set(attachment); }
  closeEvidencePreview(): void { this.selectedEvidence.set(null); }
  openCaseHistory(report: AdminReport): void {
    if (!this.canReviewReport(report)) {
      this.error.set('Asígnate este reporte antes de consultar su historial.');
      return;
    }
    this.selectReport(report);
    this.tab.set('case-history');
    void this.router.navigate(['/admin/historial-caso'], { queryParams: { reportId: report.id } });
  }
  @HostListener('document:keydown.escape')
  closeEvidencePreviewWithEscape(): void {
    if (this.selectedEvidence()) this.closeEvidencePreview();
    if (this.reportPendingArchive()) this.cancelArchiveReport();
    if (this.appealPendingArchive()) this.cancelArchiveAppeal();
    if (this.phoneCountryPickerOpen()) {
      this.phoneCountryPickerOpen.set(false);
      this.phoneCountrySearch.set('');
    }
    if (this.ownProfileCountryPickerOpen()) { this.ownProfileCountryPickerOpen.set(false); this.ownProfileCountrySearch.set(''); }
    if (this.newUserCountryPickerOpen()) { this.newUserCountryPickerOpen.set(false); this.newUserCountrySearch.set(''); }
    if (this.ownProfileCountrySelectOpen()) { this.ownProfileCountrySelectOpen.set(false); this.ownProfileCountrySelectSearch.set(''); }
  }

  @HostListener('document:click', ['$event'])
  closePhoneCountryPickerOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (this.phoneCountryPickerOpen() && target instanceof Element && !target.closest('.admin-create-user__country-picker')) {
      this.phoneCountryPickerOpen.set(false);
      this.phoneCountrySearch.set('');
    }
    if (this.ownProfileCountryPickerOpen() && target instanceof Element && !target.closest('.admin-own-profile__country-picker')) {
      this.ownProfileCountryPickerOpen.set(false);
      this.ownProfileCountrySearch.set('');
    }
    if (this.newUserCountryPickerOpen() && target instanceof Element && !target.closest('.admin-create-user__country-select')) {
      this.newUserCountryPickerOpen.set(false);
      this.newUserCountrySearch.set('');
    }
    if (this.ownProfileCountrySelectOpen() && target instanceof Element && !target.closest('.admin-own-profile__country-select')) {
      this.ownProfileCountrySelectOpen.set(false);
      this.ownProfileCountrySelectSearch.set('');
    }
  }

  async toggleAppealEvidence(appeal: AdminAppeal): Promise<void> {
    if (this.appealEvidence()[appeal.id]) { this.appealEvidence.update((items) => { const next = { ...items }; delete next[appeal.id]; return next; }); return; }
    this.appealEvidenceLoading.set(appeal.id);
    try { const items = await this.api.appealAttachments(appeal.id); this.appealEvidence.update((current) => ({ ...current, [appeal.id]: items })); }
    catch { this.error.set('No se pudieron cargar las pruebas adjuntas de la apelación.'); }
    finally { this.appealEvidenceLoading.set(null); }
  }

  async addInternalNote(): Promise<void> {
    const report = this.selectedReport();
    const note = this.internalNote().trim();
    if (!report || !note || this.busy()) return;
    this.busy.set(true);
    try { const saved = await this.api.addCaseNote(report.id, note); this.caseNotes.update((items) => [...items, saved]); this.internalNote.set(''); }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 409) this.error.set('Asigna este reporte a tu cuenta antes de guardar una nota interna.');
      else if (error instanceof AdminApiError && error.status === 403) this.error.set('No puedes agregar notas internas a un reporte en el que participas.');
      else this.error.set('No se pudo guardar la nota interna. Revisa la conexión y vuelve a intentarlo.');
    }
    finally { this.busy.set(false); }
  }

  async claimCase(): Promise<void> {
    const report = this.selectedReport();
    const staffId = this.auth.user()?.id;
    if (!report || !staffId || this.busy()) return;
    this.error.set('');
    this.busy.set(true);
    try {
      const updated = await this.api.assignCase(report.id, staffId, 'Caso asignado al moderador actual');
      this.reports.update((items) => items.map((item) => item.id === updated.id ? updated : item));
      this.caseNotes.set(await this.api.caseNotes(report.id));
      this.caseHistory.set(await this.api.caseHistory(report.id));
    } catch { this.error.set('No se pudo asignar el caso a tu cuenta.'); }
    finally { this.busy.set(false); }
  }

  caseAssigneeLabel(userId: string | null): string {
    if (!userId) return 'Sin asignar';
    const staff = this.team().find((member) => member.userId === userId);
    return staff ? `${staff.displayName} · ${staff.role === 'admin' ? 'Administrador' : 'Moderador'}` : userId;
  }
  caseAssignee(userId: string | null): AdminStaff | null { return userId ? this.team().find((member) => member.userId === userId) ?? null : null; }
  caseAssigneeDisplay(userId: string | null): CaseAssigneeProfile | AdminStaff | null {
    if (!userId) return null;
    const selected = this.selectedCaseAssignee();
    if (selected?.userId === userId) return selected;
    const known = this.caseAssignee(userId);
    return known && known.displayName !== userId ? known : null;
  }

  closeCaseAssigneeSearch(): void { window.setTimeout(() => this.caseAssigneeSearchOpen.set(false), 120); }

  async changeCaseAssignment(report: AdminReport, assignedTo: string): Promise<void> {
    if (!this.isAdmin() || this.busy() || (assignedTo || null) === (report.assignedTo || null)) return;
    if (assignedTo && this.caseParticipants().has(assignedTo)) {
      this.error.set('No puedes asignar el reporte a una persona que participa en él.');
      return;
    }
    this.error.set('');
    this.busy.set(true);
    try {
      const updated = await this.api.assignCase(report.id, assignedTo || null, assignedTo ? 'Caso asignado por administración' : 'Caso desasignado por administración');
      this.reports.update((items) => items.map((item) => item.id === updated.id ? updated : item));
      this.selectedCaseAssignee.set(null);
      if (assignedTo) {
        const knownAssignee = this.caseAssignee(assignedTo);
        if (knownAssignee?.displayName && knownAssignee.displayName !== assignedTo) this.selectedCaseAssignee.set({ userId: knownAssignee.userId, displayName: knownAssignee.displayName, imageUrl: knownAssignee.imageUrl, role: knownAssignee.role });
        void this.api.caseAssigneeProfile(assignedTo).then((profile) => { if (this.selectedReportId() === report.id) this.selectedCaseAssignee.set(profile); }).catch(() => undefined);
      }
      this.caseAssigneeSearch.set('');
      this.caseAssigneeSearchOpen.set(false);
      this.caseHistory.set(await this.api.caseHistory(report.id));
    } catch {
      this.error.set('No se pudo actualizar la persona responsable del reporte.');
    } finally { this.busy.set(false); }
  }

  async changePriority(report: AdminReport, priority: AdminReport['priority'], select: HTMLSelectElement): Promise<void> {
    if (priority === report.priority) return;
    if (!this.canReviewReport(report)) {
      select.value = report.priority;
      this.error.set('Primero debes asignarte este caso para consultar sus notas y cambiar la prioridad.');
      return;
    }
    if (this.busy()) {
      select.value = report.priority;
      return;
    }
    let note = this.internalNote().trim();
    const hasUnsavedNote = !!note;
    if (!note) {
      try {
        const savedNotes = this.caseNotes().length ? this.caseNotes() : await this.api.caseNotes(report.id);
        this.caseNotes.set(savedNotes);
        note = savedNotes.at(-1)?.note.trim() || '';
      } catch {
        select.value = report.priority;
        this.error.set('No se pudieron consultar las notas internas; no se cambió la prioridad.');
        return;
      }
    }
    if (!note) {
      select.value = report.priority;
      this.error.set('Escribe y guarda un motivo en la nota interna antes de cambiar la prioridad.');
      return;
    }
    this.busy.set(true);
    let noteSaved = !hasUnsavedNote;
    try {
      if (hasUnsavedNote) {
        const savedNote = await this.api.addCaseNote(report.id, note);
        noteSaved = true;
        this.caseNotes.update((items) => [...items, savedNote]);
        this.internalNote.set('');
      }
      const updated = await this.api.setCasePriority(report.id, priority, note);
      this.reports.update((items) => items.map((item) => item.id === updated.id ? updated : item));
      void this.api.caseHistory(report.id).then((history) => this.caseHistory.set(history)).catch(() => undefined);
    } catch {
      select.value = report.priority;
      this.error.set(noteSaved
        ? 'La nota está guardada, pero no se pudo cambiar la prioridad. Puedes intentarlo de nuevo.'
        : 'No se pudo guardar la nota interna; no se cambió la prioridad.');
    }
    finally { this.busy.set(false); }
  }

  async selectUser(user: AdminUser): Promise<void> {
    this.selectedUserId.set(user.userId);
    this.userModerationSection.set('apply');
    this.sanctions.set([]);
    this.accountDeactivated.set(null);
    this.accountStatusFailed.set(false);
    const [sanctions, status, latestUsers] = await Promise.allSettled([this.api.sanctions(user.userId), this.api.accountStatus(user.userId), this.api.users()]);
    if (sanctions.status === 'fulfilled') this.sanctions.set(sanctions.value);
    else this.error.set('No se pudieron cargar las medidas de esta cuenta.');
    if (latestUsers.status === 'fulfilled') this.users.set(latestUsers.value);
    else this.error.set('No se pudieron actualizar los datos del perfil.');
    if (status.status === 'fulfilled') this.accountDeactivated.set(status.value.deactivated);
    else if (this.isAdmin()) {
      this.accountStatusFailed.set(true);
      this.error.set('No se pudo consultar el estado de la cuenta. Revisa que el backend esté activo y vuelve a intentarlo.');
    }
  }

  private selectUserFromRoute(): void {
    if (this.tab() !== 'user-detail') return;
    const userId = this.route.snapshot.queryParamMap.get('userId');
    const user = this.users().find((item) => item.userId === userId);
    if (user && this.selectedUserId() !== user.userId) void this.selectUser(user);
  }

  async openUserManagement(user: AdminUser): Promise<void> {
    await this.router.navigate(['/admin/usuario'], { queryParams: { userId: user.userId } });
  }

  listingPhoto(listing: AdminListing): string | null {
    return listing.photoUrl || this.publicListings().find((item) => item.id === listing.id)?.photos[0]?.src || null;
  }

  listingPhotos(listing: AdminListing): readonly string[] {
    const savedPhotos = listing.photoUrls?.filter((url) => !!url) ?? [];
    if (savedPhotos.length) return savedPhotos;
    return this.publicListings().find((item) => item.id === listing.id)?.photos.map((photo) => photo.src) ?? [];
  }

  reportSnapshot(report: AdminReport): ReportEvidenceSnapshot | null {
    if (!report.evidenceSnapshot) return null;
    try {
      const value: unknown = JSON.parse(report.evidenceSnapshot);
      return value && typeof value === 'object' ? value as ReportEvidenceSnapshot : null;
    } catch { return null; }
  }

  reportSnapshotPhotos(snapshot: ReportEvidenceSnapshot): string[] {
    if (!snapshot.photosJson) return [];
    try {
      const photos: unknown = JSON.parse(snapshot.photosJson);
      if (!Array.isArray(photos)) return [];
      return photos.map((photo) => {
        if (typeof photo === 'string') return photo;
        if (photo && typeof photo === 'object' && 'src' in photo && typeof photo.src === 'string') return photo.src;
        return '';
      }).filter((src): src is string => /^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(src));
    } catch { return []; }
  }

  openSnapshotPreview(src: string, index: number): void {
    this.selectedEvidence.set({ id: `snapshot-${index}`, fileName: `Foto de la publicación ${index + 1}`, mediaType: 'image', data: src });
  }

  setUserSearch(value: string): void { this.userSearch.set(value); this.userPage.set(1); }
  clearUserFilters(): void { this.userSearch.set(''); this.userReportFilter.set('all'); this.userDateFrom.set(''); this.userDateTo.set(''); this.userPage.set(1); }
  clearStaffFilters(): void { this.staffSearch.set(''); this.staffRoleFilter.set('all'); this.staffDateFrom.set(''); this.staffDateTo.set(''); }
  private inDateRange(value: string, from: string, to: string): boolean {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return false;
    const localDay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : localDay;
    return (!from || day >= from) && (!to || day <= to);
  }
  clearReportFilters(): void { this.reportSearch.set(''); this.reportStatusFilter.set('all'); this.reportDateFrom.set(''); this.reportDateTo.set(''); }
  clearListingFilters(): void { this.listingSearch.set(''); this.listingStatusFilter.set('all'); this.listingDateFrom.set(''); this.listingDateTo.set(''); }
  clearExchangeFilters(): void { this.exchangeSearch.set(''); this.exchangeStatusFilter.set('all'); this.exchangeDateFrom.set(''); this.exchangeDateTo.set(''); }
  clearAppealFilters(): void { this.appealSearch.set(''); this.appealStatusFilter.set('all'); this.appealDateFrom.set(''); this.appealDateTo.set(''); }
  appealRestrictionLabel(appeal: AdminAppeal): string {
    if (appeal.sanctionRestrictionType === 'messaging') return 'Restricción de mensajes';
    if (appeal.sanctionRestrictionType === 'publishing') return 'Restricción de publicaciones';
    return 'Suspensión general';
  }
  appealRestrictionScope(appeal: AdminAppeal): string {
    if (appeal.sanctionRestrictionType === 'messaging') return 'Limita el envío de mensajes.';
    if (appeal.sanctionRestrictionType === 'publishing') return 'Limita la creación de publicaciones.';
    return 'Limita el envío de mensajes y la creación de publicaciones.';
  }
  appealWasAppliedByCurrentUser(appeal: AdminAppeal): boolean { return appeal.sanctionCreatedBy === this.currentUser()?.id; }
  appealSanctionAuthorName(appeal: AdminAppeal): string {
    if (this.appealWasAppliedByCurrentUser(appeal)) return 'Tú';
    return this.users().find((user) => user.userId === appeal.sanctionCreatedBy)?.displayName
      || this.team().find((member) => member.userId === appeal.sanctionCreatedBy)?.displayName
      || 'Otro miembro del equipo';
  }
  hasAppealSanctionContext(appeal: AdminAppeal): boolean {
    return ['messaging', 'publishing', 'all'].includes(appeal.sanctionRestrictionType) && Boolean(appeal.sanctionReason?.trim() && appeal.sanctionStartsAt);
  }
  appealResolutionFor(id: string): string { return this.appealResolutions()[id] || ''; }
  setAppealResolution(id: string, value: string): void { this.appealResolutions.update((items) => ({ ...items, [id]: value })); }
  clearReviewFilters(): void { this.reviewSearch.set(''); this.reviewVisibilityFilter.set('all'); this.reviewDateFrom.set(''); this.reviewDateTo.set(''); }
  clearActivityFilters(): void { this.activitySearch.set(''); this.activityTypeFilter.set('all'); this.activityDateFrom.set(''); this.activityDateTo.set(''); }
  setUserPage(page: number): void { this.userPage.set(Math.min(this.userPageCount(), Math.max(1, page))); }

  async applySanction(): Promise<void> {
    const userId = this.selectedUserId();
    const reason = this.sanctionReason().trim();
    if (!userId || !reason || this.busy()) return;
    this.busy.set(true);
    try { await this.api.sanction(userId, this.sanctionType(), reason, this.sanctionDuration()); this.sanctionReason.set(''); this.sanctions.set(await this.api.sanctions(userId)); this.userModerationSection.set('history'); }
    catch { this.error.set('No se pudo aplicar la restricción. Revisa el límite de permisos de tu rol.'); }
    finally { this.busy.set(false); }
  }

  async revokeSanction(sanction: AdminSanction): Promise<void> {
    const userId = this.selectedUserId();
    if (!userId || this.busy()) return;
    const { RevokeSanctionDialogComponent } = await import('./revoke-sanction-dialog.component');
    const result = await firstValueFrom(this.dialog.open(RevokeSanctionDialogComponent, {
      data: { sanction }, width: 'min(500px, calc(100vw - 28px))', maxWidth: '500px',
      panelClass: ['monkeytrueque-dialog', 'revoke-sanction-dialog'], autoFocus: 'first-tabbable', restoreFocus: true,
    }).afterClosed());
    if (!result?.reason) return;
    this.busy.set(true);
    try { await this.api.revokeSanction(userId, sanction.id, result.reason); this.sanctions.set(await this.api.sanctions(userId)); }
    catch (error) {
      if (error instanceof AdminApiError && (error.status === 404 || error.status === 409)) {
        try { this.sanctions.set(await this.api.sanctions(userId)); } catch { /* Conserva el error original si no se puede actualizar la lista. */ }
      }
      this.error.set(error instanceof AdminApiError ? `No se pudo retirar la medida (HTTP ${error.status}, ${error.path}). ${error.detail}` : error instanceof Error ? error.message : 'No se pudo retirar la medida.');
    }
    finally { this.busy.set(false); }
  }

  isSanctionActive(sanction: AdminSanction): boolean {
    return !sanction.revokedAt && (!sanction.expiresAt || Date.parse(sanction.expiresAt) > Date.now());
  }

  async toggleAccountDeactivation(): Promise<void> {
    const userId = this.selectedUserId();
    const reason = this.sanctionReason().trim();
    const currentlyDeactivated = this.accountDeactivated();
    if (!userId || currentlyDeactivated === null || !reason || this.busy()) {
      if (!reason) this.error.set('Escribe un motivo antes de cambiar el acceso de la cuenta.');
      return;
    }
    const action = currentlyDeactivated ? 'reactivar' : 'desactivar';
    if (!window.confirm(`¿Confirmas ${action} la cuenta de ${this.selectedUser()?.displayName ?? 'este usuario'}?`)) return;
    this.busy.set(true);
    try {
      const status: AdminAccountStatus = currentlyDeactivated
        ? await this.api.reactivateAccount(userId, reason)
        : await this.api.deactivateAccount(userId, reason);
      this.accountDeactivated.set(status.deactivated);
      this.sanctionReason.set('');
    } catch { this.error.set('No se pudo actualizar el acceso de la cuenta. Comprueba la configuración de el backend y tus permisos.'); }
    finally { this.busy.set(false); }
  }

  async reviewAppeal(appeal: AdminAppeal, status: 'accepted' | 'rejected'): Promise<void> {
    const resolution = this.appealResolutionFor(appeal.id).trim();
    if (!resolution || this.busy()) { this.error.set('Escribe un motivo para resolver la apelación.'); return; }
    this.busy.set(true);
    try {
      const updated = await this.api.decideAppeal(appeal.id, status, resolution);
      this.appeals.update((items) => items.map((item) => item.id === updated.id ? updated : item));
      this.appealResolutions.update((items) => { const next = { ...items }; delete next[appeal.id]; return next; });
      this.actions.set(this.isAdmin() ? await this.api.actions() : await this.api.myActions());
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 403) this.error.set('No puedes resolver esta apelación porque aplicaste la sanción. Debe revisarla otro moderador o administrador.');
      else this.error.set(error instanceof Error ? error.message : 'No se pudo guardar la resolución de la apelación. Inténtalo de nuevo.');
    }
    finally { this.busy.set(false); }
  }

  async updateStaffRole(): Promise<void> {
    const userId = this.staffUserIdDraft().trim();
    const reason = this.staffReasonDraft().trim();
    if (!userId || !reason || this.busy()) { this.error.set('Indica el ID de usuario y el motivo del cambio.'); return; }
    this.busy.set(true);
    try {
      const saved = await this.api.changeStaffRole(userId, this.staffRoleDraft(), reason);
      this.team.update((items) => [...items.filter((item) => item.userId !== userId), saved]);
      this.staffReasonDraft.set('');
      this.editingStaffId.set(null);
    } catch { this.error.set('No se pudo modificar el equipo. Se protege al último administrador y a los administradores de arranque.'); }
    finally { this.busy.set(false); }
  }

  async createNewUser(): Promise<void> {
    if (this.busy()) return;
    const rawPhone = this.newUserPhone().trim();
    let formattedPhone = '';
    if (rawPhone) {
      const parsedPhone = parsePhoneNumberFromString(rawPhone, this.newUserPhoneCountry());
      if (!parsedPhone?.isValid()) {
        this.error.set('El teléfono no parece válido para el país seleccionado. Revisa el número o déjalo vacío.');
        return;
      }
      formattedPhone = parsedPhone.number;
    }
    const payload: AdminUserCreate = {
      fullName: this.newUserName().trim(), username: this.newUserUsername().trim(), password: this.newUserPassword(), phone: formattedPhone,
      countryCode: this.newUserCountryCode(), designation: this.newUserDesignation().trim(),
      description: this.newUserDescription().trim(), imageData: this.newUserImageData(),
    };
    if (!payload.fullName || !payload.username || !payload.designation || payload.password.length < 8) { this.error.set('Completa los campos obligatorios y usa una contraseña de al menos 8 caracteres.'); return; }
    this.busy.set(true);
    this.error.set('');
    try {
      const created = await this.api.createUser(payload);
      this.users.update((items) => [created, ...items.filter((item) => item.userId !== created.userId)]);
      this.team.update((items) => [{ userId: created.userId, displayName: created.displayName, username: payload.username, imageUrl: created.imageUrl, role: 'none', addedBy: null, createdAt: created.memberSince || new Date().toISOString() }, ...items.filter((item) => item.userId !== created.userId)]);
      this.resetNewUser();
      this.navigateSection('users');
      this.selectUser(created);
    } catch (error) {
      this.error.set(error instanceof AdminApiError && error.detail
        ? error.detail
        : 'No se pudo crear la cuenta. Comprueba los datos e inténtalo de nuevo.');
    } finally { this.busy.set(false); }
  }

  resetNewUser(): void {
    this.newUserName.set(''); this.newUserUsername.set(''); this.newUserPassword.set(''); this.newUserPhone.set(''); this.newUserPhoneCountry.set('PE'); this.newUserDepartment.set(''); this.newUserCountryCode.set('');
    this.phoneCountryPickerOpen.set(false); this.phoneCountrySearch.set('');
    this.newUserCountryPickerOpen.set(false); this.newUserCountrySearch.set('');
    this.newUserDesignation.set(''); this.newUserDescription.set(''); this.newUserImageData.set(null); this.newUserImagePreview.set('');
  }

  choosePhoneCountry(code: CountryCode): void {
    this.newUserPhoneCountry.set(code);
    this.phoneCountryPickerOpen.set(false);
    this.phoneCountrySearch.set('');
  }

  chooseOwnProfilePhoneCountry(code: CountryCode): void {
    this.ownProfilePhoneCountry.set(code);
    this.ownProfileCountryPickerOpen.set(false);
    this.ownProfileCountrySearch.set('');
  }

  toggleOwnProfilePhoneCountryPicker(): void { this.ownProfileCountryPickerOpen.update((open) => !open); }
  toggleOwnProfileCountrySelect(): void { this.ownProfileCountrySelectOpen.update((open) => !open); }
  chooseOwnProfileCountry(code: string): void { this.ownProfileCountryCode.set(code); this.ownProfileCountrySelectOpen.set(false); this.ownProfileCountrySelectSearch.set(''); }

  ownProfilePhoneCallingCode(): string {
    const value = this.ownProfile()?.phone;
    const parsed = value ? parsePhoneNumberFromString(value) : undefined;
    if (parsed) return `+${parsed.countryCallingCode}`;
    return value?.startsWith('+') ? '' : this.selectedOwnProfilePhoneCountry().dialCode;
  }

  ownProfileNationalPhone(): string {
    const value = this.ownProfile()?.phone;
    const parsed = value ? parsePhoneNumberFromString(value) : undefined;
    return parsed?.nationalNumber ?? value ?? '';
  }

  countryDisplayName(code: string | null | undefined): string | null {
    if (!code) return null;
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  }

  adminUserPhoneCallingCode(user: AdminUser): string {
    const parsed = user.phone ? parsePhoneNumberFromString(user.phone, user.countryCode as CountryCode | undefined) : undefined;
    if (parsed) return `+${parsed.countryCallingCode}`;
    return user.phone?.startsWith('+') ? '' : '';
  }

  adminUserNationalPhone(user: AdminUser): string {
    const parsed = user.phone ? parsePhoneNumberFromString(user.phone, user.countryCode as CountryCode | undefined) : undefined;
    return parsed?.nationalNumber ?? user.phone ?? '';
  }

  userRoleLabel(user: AdminUser): string {
    const role = this.team().find((member) => member.userId === user.userId)?.role;
    if (role === 'admin') return 'Administrador';
    if (role === 'moderator') return 'Moderador';
    return 'Miembro';
  }

  togglePhoneCountryPicker(): void {
    this.phoneCountryPickerOpen.update((open) => !open);
  }

  chooseNewUserCountry(code: string): void { this.newUserCountryCode.set(code); this.newUserCountryPickerOpen.set(false); this.newUserCountrySearch.set(''); }
  toggleNewUserCountryPicker(): void { this.newUserCountryPickerOpen.update((open) => !open); }

  readNewUserPhoto(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5_000_000) {
      this.error.set('Usa una imagen JPG, PNG o WebP de máximo 5 MB.');
      (event.target as HTMLInputElement).value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { const image = String(reader.result ?? ''); this.newUserImageData.set(image); this.newUserImagePreview.set(image); this.error.set(''); };
    reader.readAsDataURL(file);
  }

  editStaff(member: AdminStaff): void {
    this.editingStaffId.set(member.userId);
    this.staffUserIdDraft.set(member.userId);
    this.staffRoleDraft.set(member.role);
    this.staffReasonDraft.set('');
  }

  prepareStaffRoleEdit(member: AdminStaff, role: AdminStaff['role']): void {
    this.editStaff(member);
    this.staffRoleDraft.set(role);
  }

  cancelStaffEdit(): void {
    this.editingStaffId.set(null);
    this.staffReasonDraft.set('');
    this.error.set('');
  }

  async updateReviewVisibility(item: AdminReview): Promise<void> {
    const reason = this.reviewReason().trim();
    if (!reason || this.busy()) { this.error.set('Escribe el motivo antes de ocultar o restaurar el comentario.'); return; }
    this.busy.set(true);
    try {
      const updated = await this.api.reviewVisibility(item, !item.hidden, reason);
      this.reviews.update((items) => items.map((entry) => entry.exchangeId === updated.exchangeId && entry.participant === updated.participant ? updated : entry));
      this.reviewActions.set(await this.api.exchangeReviewActions());
      this.reviewReason.set('');
    } catch { this.error.set('No se pudo moderar la reseña. No puedes moderar una operación en la que participaste.'); }
    finally { this.busy.set(false); }
  }

  selectListing(listing: AdminListing): void {
    this.selectedListingId.set(listing.id);
    this.moderationNote.set('');
    this.error.set('');
  }

  backToListings(): void {
    this.selectedListingId.set(null);
    this.moderationNote.set('');
    this.error.set('');
  }

  async selectExchange(exchange: AdminExchange): Promise<void> {
    this.selectedExchangeId.set(exchange.id);
    this.exchangeDetail.set(null);
    this.error.set('');
    try {
      const detail = await this.api.exchangeDetail(exchange.id);
      if (this.selectedExchangeId() === exchange.id) this.exchangeDetail.set(detail);
    }
    catch { this.error.set('No se pudo cargar la conversación.'); }
  }

  backToExchanges(): void {
    this.selectedExchangeId.set(null);
    this.exchangeDetail.set(null);
    this.error.set('');
  }

  async review(status: AdminReport['status']): Promise<void> {
    const report = this.selectedReport();
    if (!report || this.reportReviewBusy()) return;
    const resolution = this.resolution().trim();
    if (!resolution) {
      this.error.set('Escribe el motivo interno antes de cambiar el estado del caso.');
      return;
    }
    if (status === 'waiting-information' && !this.userResponse().trim()) { this.error.set('Escribe qué información se solicita a la persona reportante.'); return; }
    this.reportReviewBusy.set(true);
    this.busy.set(true);
    this.error.set('');
    this.reportReviewFeedback.set('');
    try {
      const updated = await this.api.review(report.id, status, resolution, this.userResponse().trim());
      this.reports.update((items) => items.map((item) => item.id === updated.id ? updated : item));
      this.reportReviewFeedback.set(`Se guardó el cambio. Estado actual: ${this.reportStatus(updated.status)}.`);
      const refreshes = await Promise.allSettled([
        this.api.caseHistory(report.id),
        ...(this.isAdmin() ? [this.api.actions()] : []),
      ]);
      if (refreshes[0].status === 'fulfilled') this.caseHistory.set(refreshes[0].value);
      else this.error.set('La revisión se guardó, pero no se pudo actualizar el historial del caso.');
      if (this.isAdmin() && refreshes[1]?.status === 'fulfilled') this.actions.set(refreshes[1].value);
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 403) {
        this.error.set('No puedes revisar este caso porque lo enviaste tú o está relacionado con tu propia cuenta. Pídele a otro administrador o moderador que lo revise.');
        this.reportReviewFeedback.set('No se guardó: participas en este reporte. Asígnalo a otra persona del equipo.');
      } else if (error instanceof AdminApiError && error.detail && !error.detail.startsWith('{')) {
        this.error.set(`No se pudo guardar la revisión: ${error.detail}`);
        this.reportReviewFeedback.set(`No se guardó: ${error.detail}`);
      } else if (error instanceof AdminApiError) {
        this.error.set(`No se pudo guardar la revisión (error ${error.status}). Revisa que el caso esté asignado y que el motivo esté completo.`);
        this.reportReviewFeedback.set(`No se guardó la revisión (error ${error.status}). Revisa la asignación del caso.`);
      } else {
        this.error.set('No se pudo guardar la revisión. Revisa tu conexión e inténtalo de nuevo.');
        this.reportReviewFeedback.set('No se guardó la revisión. Revisa tu conexión e inténtalo de nuevo.');
      }
    }
    finally { this.reportReviewBusy.set(false); this.busy.set(false); }
  }

  async changeVisibility(): Promise<void> {
    const listing = this.selectedListing();
    if (!listing || this.busy()) return;
    const note = this.moderationNote().trim();
    if (!note) { this.error.set('Escribe un motivo para dejar constancia.'); return; }
    this.busy.set(true);
    this.error.set('');
    let updated: AdminListing;
    try {
      updated = await this.api.visibility(listing.id, !listing.moderationHidden, note);
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 409) {
        this.error.set('No puedes cambiar la visibilidad de una publicación tuya.');
      } else if (error instanceof AdminApiError && error.status === 403) {
        this.error.set('Tu rol de moderador no tiene acceso activo en el servidor. Revisa que tu cuenta siga asignada como Moderador en “Roles y acceso”.');
      } else {
        this.error.set(error instanceof AdminApiError && error.detail ? `No se pudo cambiar la visibilidad: ${error.detail}` : 'No se pudo cambiar la visibilidad. Revisa tu conexión e inténtalo de nuevo.');
      }
      this.busy.set(false);
      return;
    }

    this.listings.update((items) => items.map((item) => item.id === updated.id ? updated : item));
    this.moderationNote.set('');
    if (this.isAdmin()) {
      try {
        this.actions.set(await this.api.actions());
      } catch {
        this.error.set('La publicación cambió de visibilidad, pero no se pudo actualizar el historial.');
      }
    }
    this.busy.set(false);
  }

  navigateSection(section: AdminTab): void {
    this.menuOpen.set(false);
    if (!this.isAdmin() && (section === 'team' || section === 'exchanges')) section = 'overview';
    if (section === 'reports') this.markAllReportNotificationsRead();
    if (section === 'appeals') this.markAllAppealNotificationsRead();
    const paths: Record<AdminTab, string> = { overview: '/admin', crm: '/admin/crm', analytics: '/admin/analitica', reports: '/admin/reportes', 'case-history': '/admin/historial-caso', listings: '/admin/publicaciones', users: '/admin/usuarios', 'users-grid': '/admin/usuarios-cuadricula', 'user-detail': '/admin/usuario', 'user-add': '/admin/agregar-usuario', reviews: '/admin/resenas', appeals: '/admin/apelaciones', 'appeal-detail': '/admin/apelaciones', team: '/admin/equipo', exchanges: '/admin/intercambios', activity: '/admin/actividad', notifications: '/admin/notificaciones', profile: '/admin/perfil' };
    if (!this.isAdmin() && (section === 'team' || section === 'exchanges')) section = 'overview';
    this.openSidebarGroupForTab(section);
    if (section === 'appeals') {
      this.selectedAppealId.set(null);
      this.tab.set('appeals');
      void this.router.navigate([paths[section]], { queryParams: { appealId: null } });
    } else void this.router.navigateByUrl(paths[section]);
  }

  openAppeal(appeal: AdminAppeal): void {
    this.markAppealNotificationRead(appeal);
    this.selectedAppealId.set(appeal.id);
    this.tab.set('appeal-detail');
    void this.router.navigate(['/admin/apelaciones'], { queryParams: { appealId: appeal.id } });
  }

  toggleMenu(): void { this.menuOpen.update((open) => !open); }
  toggleSidebar(): void { this.sidebarCollapsed.update((collapsed) => !collapsed); }
  toggleSidebarGroup(group: string): void {
    this.sidebarGroups.update((groups) => {
      const shouldExpand = !groups[group];
      return Object.fromEntries(Object.keys(groups).map((key) => [key, key === group && shouldExpand]));
    });
  }
  selectSidebarGroup(group: string): void {
    this.sidebarMenuGroup.set(group);
    this.sidebarGroups.update((groups) => Object.fromEntries(Object.keys(groups).map((key) => [key, key === group])));
  }
  sidebarGroupExpanded(group: string): boolean { return this.sidebarGroups()[group] ?? false; }
  private openSidebarGroupForTab(section: AdminTab): void {
    const group = ['overview', 'crm', 'analytics'].includes(section) ? 'home' : ['reports', 'listings', 'users', 'users-grid', 'user-detail', 'user-add', 'reviews'].includes(section) ? 'community' : ['appeals', 'exchanges'].includes(section) ? 'cases' : 'administration';
    this.sidebarMenuGroup.set(group);
    this.sidebarGroups.update((groups) => Object.fromEntries(Object.keys(groups).map((key) => [key, key === group])));
  }
  closeMenu(): void { this.menuOpen.set(false); }
  toggleProfileMenu(): void { this.notificationsOpen.set(false); this.profileMenuOpen.update((open) => !open); }
  toggleNotifications(): void { this.profileMenuOpen.set(false); this.notificationsOpen.update((open) => !open); }
  isReportNotificationRead(report: AdminReport): boolean { return this.readReportNotificationIds().includes(report.id); }
  markReportNotificationRead(report: AdminReport): void {
    if (this.isReportNotificationRead(report)) return;
    const ids = [...this.readReportNotificationIds(), report.id];
    this.readReportNotificationIds.set(ids);
    const userId = this.currentUser()?.id;
    if (userId) localStorage.setItem(`monkeytrueque.admin.read-notifications.${userId}`, JSON.stringify(ids));
  }
  markAllReportNotificationsRead(): void {
    const ids = [...new Set([...this.readReportNotificationIds(), ...this.activeReportNotifications().map((report) => report.id)])];
    this.readReportNotificationIds.set(ids);
    const userId = this.currentUser()?.id;
    if (userId) localStorage.setItem(`monkeytrueque.admin.read-notifications.${userId}`, JSON.stringify(ids));
  }
  isAppealNotificationRead(appeal: AdminAppeal): boolean { return this.readAppealNotificationIds().includes(appeal.id); }
  markAppealNotificationRead(appeal: AdminAppeal): void {
    if (this.isAppealNotificationRead(appeal)) return;
    const ids = [...this.readAppealNotificationIds(), appeal.id];
    this.readAppealNotificationIds.set(ids);
    const userId = this.currentUser()?.id;
    if (userId) localStorage.setItem(`monkeytrueque.admin.read-appeals.${userId}`, JSON.stringify(ids));
  }
  markAllAppealNotificationsRead(): void {
    const ids = [...new Set([...this.readAppealNotificationIds(), ...this.activeAppealNotifications().map((appeal) => appeal.id)])];
    this.readAppealNotificationIds.set(ids);
    const userId = this.currentUser()?.id;
    if (userId) localStorage.setItem(`monkeytrueque.admin.read-appeals.${userId}`, JSON.stringify(ids));
  }
  markAllNotificationsRead(): void {
    this.markAllReportNotificationsRead();
    this.markAllAppealNotificationsRead();
  }
  deleteReportNotification(report: AdminReport): void {
    const userId = this.currentUser()?.id;
    if (!userId) return;
    const ids = [...new Set([...this.deletedReportNotificationIds(), report.id])];
    this.deletedReportNotificationIds.set(ids);
    localStorage.setItem(`monkeytrueque.admin.deleted-notifications.${userId}`, JSON.stringify(ids));
    if (!this.isReportNotificationRead(report)) this.markReportNotificationRead(report);
  }
  deleteAppealNotification(appeal: AdminAppeal): void {
    const userId = this.currentUser()?.id;
    if (!userId) return;
    const ids = [...new Set([...this.deletedAppealNotificationIds(), appeal.id])];
    this.deletedAppealNotificationIds.set(ids);
    localStorage.setItem(`monkeytrueque.admin.deleted-appeals.${userId}`, JSON.stringify(ids));
    if (!this.isAppealNotificationRead(appeal)) this.markAppealNotificationRead(appeal);
  }
  private loadNotificationIds(key: string): string[] {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? '[]');
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
    } catch { return []; }
  }
  private loadReadReportNotifications(userId: string): string[] {
    try {
      const value = JSON.parse(localStorage.getItem(`monkeytrueque.admin.read-notifications.${userId}`) ?? '[]');
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
    } catch { return []; }
  }
  private loadReadAppealNotifications(userId: string): string[] {
    try {
      const value = JSON.parse(localStorage.getItem(`monkeytrueque.admin.read-appeals.${userId}`) ?? '[]');
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
    } catch { return []; }
  }
  openReportNotification(report: AdminReport): void {
    this.markReportNotificationRead(report);
    this.notificationsOpen.set(false);
    this.selectReport(report);
    this.navigateSection('reports');
  }
  toggleUserGridMenu(userId: string): void { this.openUserGridMenuId.update((openId) => openId === userId ? null : userId); }
  closeUserGridMenu(): void { this.openUserGridMenuId.set(null); }
  closeProfileMenu(): void { this.profileMenuOpen.set(false); this.notificationsOpen.set(false); }
  async loadOwnProfile(): Promise<void> {
    const user = this.currentUser();
    if (!user) return;
    const adminRecord = this.users().find((item) => item.userId === user.id);
    const staffRecord = this.team().find((item) => item.userId === user.id);
    const listingImage = this.publicListings().find((item) => item.ownerId === user.id)?.ownerImageUrl;
    this.ownProfileName.set(adminRecord?.displayName || staffRecord?.displayName || user.name);
    this.ownProfileImage.set(user.imageUrl || adminRecord?.imageUrl || staffRecord?.imageUrl || listingImage || '');
    this.ownProfilePhone.set(adminRecord?.phone ?? '');
    const parsedPhone = adminRecord?.phone ? parsePhoneNumberFromString(adminRecord.phone) : undefined;
    this.ownProfilePhoneCountry.set(parsedPhone?.country ?? 'PE');
    if (parsedPhone) this.ownProfilePhone.set(parsedPhone.nationalNumber);
    const profile = await this.marketplaceApi.profile(user.id).catch(() => null);
    if (this.currentUser()?.id === user.id && profile) {
      this.ownProfile.set({ displayName: profile.displayName, imageUrl: profile.imageUrl, description: profile.description, phone: adminRecord?.phone ?? null, countryCode: profile.countryCode ?? null, designation: adminRecord?.designation ?? null, memberSince: profile.memberSince });
      this.ownProfileCountryCode.set(profile.countryCode ?? '');
      this.ownProfileDescription.set(profile.description ?? '');
      this.ownProfileName.set(profile.displayName || user.name);
      this.ownProfileImage.set(profile.imageUrl || user.imageUrl || adminRecord?.imageUrl || staffRecord?.imageUrl || listingImage || '');
    }
  }
  onOwnProfilePhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5_000_000) {
      this.ownProfileMessage.set('Elige una imagen JPG, PNG o WebP de hasta 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { this.ownProfilePhoto.set(file); this.ownProfileImage.set(String(reader.result ?? '')); this.ownProfileMessage.set(''); };
    reader.onerror = () => this.ownProfileMessage.set('No se pudo leer la imagen. Inténtalo de nuevo.');
    reader.readAsDataURL(file);
  }
  async saveOwnProfile(): Promise<void> {
    const user = this.currentUser();
    const name = this.ownProfileName().trim();
    const description = this.ownProfileDescription().trim();
    if (!user) return;
    if (!name || name.length > 120) { this.ownProfileMessage.set('Escribe un nombre de hasta 120 caracteres.'); return; }
    if (description.length > 500) { this.ownProfileMessage.set('La descripción puede tener hasta 500 caracteres.'); return; }
    const phone = this.ownProfilePhone().trim();
    const countryCode = this.ownProfileCountryCode();
    let formattedPhone = '';
    if (phone) {
      const parsedPhone = parsePhoneNumberFromString(phone, this.ownProfilePhoneCountry());
      if (!parsedPhone?.isValid()) { this.ownProfileMessage.set('El teléfono no parece válido para el país seleccionado.'); return; }
      formattedPhone = parsedPhone.number;
    }
    this.ownProfileSaving.set(true);
    this.ownProfileMessage.set('');
    try {
      const updated = await this.auth.updateProfile(name, this.ownProfilePhoto() ?? undefined);
      const saved = await this.marketplaceApi.syncMyProfile(updated.name, updated.imageUrl, description, undefined, undefined, formattedPhone, undefined, countryCode);
      this.ownProfile.update((previous) => ({ displayName: saved.displayName, imageUrl: saved.imageUrl, description: saved.description, phone: formattedPhone || null, countryCode: countryCode || null, designation: previous?.designation ?? null, memberSince: saved.memberSince }));
      this.ownProfileName.set(updated.name);
      this.ownProfileImage.set(updated.imageUrl);
      this.ownProfilePhoto.set(null);
      if (updated.imageUrl) await this.marketplaceApi.syncMyProfileImage(updated.imageUrl).catch(() => undefined);
      this.ownProfileMessage.set('Tu perfil se guardó correctamente.');
    } catch (error) {
      this.ownProfileMessage.set(error instanceof Error ? error.message : 'No se pudieron guardar los cambios.');
    } finally { this.ownProfileSaving.set(false); }
  }
  cancelOwnProfile(): void {
    const user = this.currentUser();
    if (!user) return;
    this.ownProfileName.set(this.ownProfile()?.displayName ?? user.name);
    this.ownProfileDescription.set(this.ownProfile()?.description ?? '');
    this.ownProfileImage.set(this.ownProfile()?.imageUrl || user.imageUrl);
    this.ownProfilePhoto.set(null);
    this.ownProfileMessage.set('');
  }
  userInitials(): string {
    return (this.currentUser()?.name || this.currentUser()?.username || 'M').trim().charAt(0).toUpperCase();
  }
  async signOut(): Promise<void> {
    this.closeProfileMenu();
    try { await this.auth.signOut(); }
    catch { this.error.set('No se pudo cerrar la sesión. Inténtalo de nuevo.'); }
  }

  chartPercent(value: number, total: number): number {
    return total ? Math.max(value ? 5 : 0, Math.round(value / total * 100)) : 0;
  }

  toggleTheme(): void {
    const enabled = !this.darkMode();
    this.darkMode.set(enabled);
    localStorage.setItem('monkeytrueque.admin.theme', enabled ? 'dark' : 'light');
  }

  reportReason(reason: string): string {
    return ({ condition: 'Estado distinto al descrito', 'wrong-category': 'Categoría incorrecta',
      suspicious: 'Actividad sospechosa', inappropriate: 'Contenido inapropiado', scam: 'Intento de estafa',
      harassment: 'Acoso o spam', 'false-listing': 'Publicación falsa', other: 'Otro motivo' } as Record<string, string>)[reason] ?? reason;
  }

  reporterProfile(report: AdminReport): { displayName: string; imageUrl: string | null } {
    const user = this.users().find((item) => item.userId === report.reporterId);
    const listing = this.publicListings().find((item) => item.ownerId === report.reporterId);
    return {
      displayName: user?.displayName || listing?.ownerName || 'Miembro de MonkeyTrueque',
      imageUrl: user?.imageUrl || listing?.ownerImageUrl || null,
    };
  }

  reportStatus(status: string): string {
    return ({ open: 'Pendiente', 'in-review': 'En revisión', 'waiting-information': 'Esperando información', escalated: 'Escalado', duplicate: 'Duplicado', resolved: 'Resuelto',
      dismissed: 'Descartado' } as Record<string, string>)[status] ?? status;
  }

  moderationActionName(action: string): string {
    const labels: Record<string, string> = {
      'staff-role-changed': 'Cambio de rol',
      'user-created': 'Usuario creado',
      'listing-hidden': 'Publicación ocultada',
      'listing-restored': 'Publicación restaurada',
      'case-assigned': 'Caso asignado',
      'case-priority': 'Prioridad del caso actualizada',
      'sanction-created': 'Restricción aplicada',
      'sanction-revoked': 'Restricción retirada',
      'appeal-accepted': 'Apelación aceptada',
      'appeal-rejected': 'Apelación rechazada',
      'review-hidden': 'Reseña ocultada',
      'review-restored': 'Reseña restaurada',
    };
    if (labels[action]) return labels[action];
    if (action.startsWith('report-')) return `Reporte ${this.reportStatus(action.slice('report-'.length)).toLocaleLowerCase()}`;
    const words = action.replace(/-/g, ' ');
    return words.charAt(0).toLocaleUpperCase() + words.slice(1);
  }

  moderationActionDetail(action: ModerationAction): string {
    const note = action.note?.trim();
    if (!note) return 'No se añadió un motivo.';
    if (action.action === 'staff-role-changed') {
      const match = note.match(/^([a-z-]+)\s*->\s*([a-z-]+)\s*:\s*(.*)$/i);
      if (match) {
        const roleName = (role: string) => ({ none: 'Sin acceso al panel', moderator: 'Moderador', admin: 'Administrador' } as Record<string, string>)[role.toLowerCase()] ?? role;
        return `Rol actualizado: ${roleName(match[1])} → ${roleName(match[2])}. Motivo: ${match[3] || 'No indicado.'}`;
      }
    }
    if (action.action === 'sanction-created') {
      const separator = note.indexOf(':');
      if (separator >= 0) {
        const restriction = note.slice(0, separator).trim().toLowerCase();
        const reason = note.slice(separator + 1).trim();
        const restrictionDescription = ({ messaging: 'Se limitó el envío de mensajes', publishing: 'Se limitó la creación de publicaciones', all: 'Se suspendió la cuenta' } as Record<string, string>)[restriction];
        if (restrictionDescription) return `${restrictionDescription}. Motivo: ${reason || 'No indicado.'}`;
      }
    }
    return note;
  }

  moderationActor(userId: string): { name: string; imageUrl: string | null; initials: string } {
    const staff = this.team().find((member) => member.userId === userId);
    const user = this.users().find((member) => member.userId === userId);
    const current = this.currentUser();
    const name = staff?.displayName || user?.displayName || (current?.id === userId ? current.name : '') || 'Miembro del equipo';
    const imageUrl = staff?.imageUrl || user?.imageUrl || (current?.id === userId ? current.imageUrl : null) || null;
    const initials = name.trim().charAt(0).toUpperCase() || 'M';
    return { name, imageUrl, initials };
  }

  caseEventName(action: string): string {
    return ({ 'status-changed': 'Estado actualizado', assigned: 'Caso asignado', 'priority-changed': 'Prioridad actualizada', 'internal-note': 'Nota privada agregada', archived: 'Reporte archivado', unarchived: 'Reporte restaurado' } as Record<string, string>)[action] ?? action;
  }

  caseEventValue(action: string, value: string | null): string {
    if (action === 'assigned') return value ? this.moderationActor(value).name : 'Sin asignar';
    if (action === 'status-changed') return ({ open: 'Pendiente', 'in-review': 'En revisión', 'waiting-information': 'Esperando información', escalated: 'Derivado a revisión', duplicate: 'Reporte duplicado', resolved: 'Resuelto', dismissed: 'Descartado' } as Record<string, string>)[value ?? ''] ?? value ?? 'Sin estado';
    if (action === 'priority-changed') return ({ low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente' } as Record<string, string>)[value ?? ''] ?? value ?? 'Sin prioridad';
    return value || '—';
  }

  caseEventReason(action: string, reason: string): string {
    if (action === 'internal-note') return 'Se agregó una nota privada al caso.';
    if (action === 'archived') return 'El reporte se retiró de la lista de recientes y su historial se conservó.';
    if (action === 'unarchived') return 'El reporte se devolvió a la lista de recientes.';
    return ({ 'Case assigned by administration': 'Asignación realizada por administración.', 'Case assigned to moderator': 'Caso asignado al moderador responsable.', 'Case unassigned by administration': 'Caso desasignado por administración.' } as Record<string, string>)[reason] ?? reason;
  }

  exchangeStatus(status: string): string {
    return ({ 'proposal-sent': 'Propuesta', 'meetup-agreed': 'Encuentro acordado',
      'confirmed-by-one': 'Una confirmación', 'confirmed-by-both': 'Entrega confirmada',
      rated: 'Finalizado' } as Record<string, string>)[status] ?? status;
  }

  exchangeProposer(exchange: AdminExchange): AdminUser | undefined {
    return this.users().find((user) => user.userId === exchange.proposerId);
  }

  exchangeOwner(exchange: AdminExchange): AdminUser | undefined {
    return this.users().find((user) => user.userId === exchange.ownerId);
  }

  exchangeProposerName(exchange: AdminExchange): string {
    return this.exchangeProposer(exchange)?.displayName || `Usuario ${exchange.proposerId.slice(0, 8)}`;
  }

  exchangeOwnerName(exchange: AdminExchange): string {
    return this.exchangeOwner(exchange)?.displayName || `Usuario ${exchange.ownerId.slice(0, 8)}`;
  }

  exchangeUserName(userId: string): string {
    return this.users().find((user) => user.userId === userId)?.displayName || userId;
  }

  staffLocation(userId: string): string {
    const latestListing = this.listings().filter((listing) => listing.ownerId === userId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    if (!latestListing) return 'Sin publicaciones';
    return DEMO_DISTRICTS.find((district) => district.id === latestListing.districtId)?.name ?? latestListing.districtId;
  }

  listingTitle(id: string | null): string {
    return id ? this.listings().find((item) => item.id === id)?.title ?? `Publicación ${id.slice(0, 8)}` : 'Reporte general';
  }

  focusListing(id: string): void {
    const listing = this.listings().find((item) => item.id === id);
    if (listing) { this.selectListing(listing); void this.router.navigateByUrl('/admin/publicaciones'); }
  }

  private async initialize(userId: string): Promise<void> {
    try {
      const role = await this.api.staffRole();
      if (this.auth.user()?.id !== userId) return;
      if (role === 'none') { this.access.set('forbidden'); return; }
      this.staffRole.set(role);
      if (role !== 'admin' && (this.tab() === 'team' || this.tab() === 'exchanges')) this.navigateSection('overview');
      this.access.set('ready');
      await this.loadData();
      if (this.tab() === 'profile') await this.loadOwnProfile();
      this.selectUserFromRoute();
    } catch (error) {
      if (this.auth.user()?.id === userId) {
        this.access.set('error');
        this.error.set(error instanceof AdminApiError
          ? `El servidor respondió ${error.status}${error.detail ? `: ${error.detail}` : ` en ${error.path}.`}`
          : error instanceof Error ? error.message : 'No se pudo comprobar el acceso. Revisa tu sesión y vuelve a intentarlo.');
      }
    }
  }

  private async loadData(): Promise<void> {
    const requestedUserId = this.auth.user()?.id;
    if (!requestedUserId) return;
    this.busy.set(true);
    this.error.set('');
    const failedRequests: string[] = [];
    const results = await Promise.allSettled([this.api.reports(), this.api.listings(), this.api.users(), this.marketplaceApi.listings()] as const);
    if (this.auth.user()?.id !== requestedUserId) return;
    if (results[0].status === 'fulfilled') {
      this.reports.set(results[0].value);
      if (this.tab() === 'reports') this.markAllReportNotificationsRead();
    }
    else failedRequests.push(this.describeFailure('reportes', results[0].reason));
    if (results[1].status === 'fulfilled') this.listings.set(results[1].value);
    else failedRequests.push(this.describeFailure('publicaciones', results[1].reason));
    if (results[2].status === 'fulfilled') this.users.set(results[2].value);
    else failedRequests.push(this.describeFailure('usuarios', results[2].reason));
    if (results[3].status === 'fulfilled') this.publicListings.set(results[3].value);
    if (results[2].status === 'fulfilled') {
      const activeUsers = [...results[2].value].sort((a, b) => b.listingCount - a.listingCount).slice(0, 5);
      const profileResults = await Promise.allSettled(activeUsers.map((user) => this.marketplaceApi.profile(user.userId)));
      if (this.auth.user()?.id !== requestedUserId) return;
      const profileImages = new Map(activeUsers.flatMap((user, index) => {
        const profile = profileResults[index];
        return profile.status === 'fulfilled' && profile.value.imageUrl ? [[user.userId, profile.value.imageUrl] as const] : [];
      }));
      if (profileImages.size) this.users.update((users) => users.map((user) => ({ ...user, imageUrl: user.imageUrl || profileImages.get(user.userId) || null })));
    }
    if (this.isAdmin()) {
      const adminResults = await Promise.allSettled([this.api.exchanges(), this.api.actions(), this.api.appeals(), this.api.staff()] as const);
      if (this.auth.user()?.id !== requestedUserId) return;
      if (adminResults[0].status === 'fulfilled') this.exchanges.set(adminResults[0].value);
      else failedRequests.push(this.describeFailure('intercambios', adminResults[0].reason));
      if (adminResults[1].status === 'fulfilled') this.actions.set(adminResults[1].value);
      else failedRequests.push(this.describeFailure('actividad administrativa', adminResults[1].reason));
      if (adminResults[2].status === 'fulfilled') {
        this.appeals.set(adminResults[2].value);
        if (this.tab() === 'appeals') this.markAllAppealNotificationsRead();
      }
      else failedRequests.push(this.describeFailure('apelaciones', adminResults[2].reason));
      if (adminResults[3].status === 'fulfilled') this.team.set(adminResults[3].value);
      else failedRequests.push(this.describeFailure('equipo', adminResults[3].reason));
    } else {
      this.exchanges.set([]);
      const [actions, appeals] = await Promise.allSettled([this.api.myActions(), this.api.appeals()] as const);
      if (actions.status === 'fulfilled') this.actions.set(actions.value);
      else failedRequests.push(this.describeFailure('mi actividad', actions.reason));
      if (appeals.status === 'fulfilled') {
        this.appeals.set(appeals.value);
        if (this.tab() === 'appeals') this.markAllAppealNotificationsRead();
      }
      else failedRequests.push(this.describeFailure('apelaciones', appeals.reason));
    }
    const reviewResults = await Promise.allSettled([this.api.reviews(), this.api.exchangeReviewActions()] as const);
    if (this.auth.user()?.id !== requestedUserId) return;
    if (reviewResults[0].status === 'fulfilled') this.reviews.set(reviewResults[0].value);
    else failedRequests.push(this.describeFailure('reseñas', reviewResults[0].reason));
    if (reviewResults[1].status === 'fulfilled') {
      this.reviewActions.set(reviewResults[1].value);
      const reviewAudit = reviewResults[1].value.map((item) => {
        const affectedUserId = this.reviews().find((review) => review.exchangeId === item.exchangeId && review.participant === item.participant)?.reviewedUserId ?? null;
        const affected = affectedUserId ? this.users().find((user) => user.userId === affectedUserId) : undefined;
        return { id: `review-${item.id}`, adminId: item.staffId, action: item.action, targetId: `${item.exchangeId} · ${item.participant}`, note: item.reason, createdAt: item.createdAt, affectedUserId, affectedUserName: affected?.displayName ?? null, affectedUserImageUrl: affected?.imageUrl ?? null };
      });
      this.actions.update((items) => [...items.filter((item) => !item.id.startsWith('review-')), ...reviewAudit].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100));
    } else failedRequests.push(this.describeFailure('historial de reseñas', reviewResults[1].reason));
    const analyticsResult = await Promise.allSettled([this.api.analyticsVisits()] as const);
    if (this.auth.user()?.id !== requestedUserId) return;
    if (analyticsResult[0].status === 'fulfilled') {
      this.visitAnalytics.set(analyticsResult[0].value);
      this.analyticsLoaded.set(true);
    } else this.analyticsLoaded.set(false);
    if (failedRequests.length) {
      this.error.set(`No se pudo cargar: ${failedRequests.join(' · ')}. Revisa que los dos servicios estén actualizados y vuelve a intentar.`);
    }
    this.busy.set(false);
  }

  private describeFailure(area: string, error: unknown): string {
    if (error instanceof AdminApiError) return `${area} (${error.status} ${error.path})`;
    return `${area} (sin respuesta del servidor)`;
  }
}
