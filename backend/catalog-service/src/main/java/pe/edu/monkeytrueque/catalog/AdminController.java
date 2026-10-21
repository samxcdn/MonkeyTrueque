package pe.edu.monkeytrueque.catalog;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.core.type.TypeReference;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin")
class AdminController {
  private static final Set<String> REPORT_STATUSES = Set.of("open", "in-review", "waiting-information", "resolved", "dismissed", "escalated", "duplicate");
  private static final Set<String> PRIORITIES = Set.of("low", "normal", "high", "urgent");
  private final AdminAccess access;
  private final ListingRepository listings;
  private final ReportRepository reports;
  private final JdbcTemplate jdbc;
  private final ObjectMapper mapper;
  @Autowired private CloudinaryImageStorage imageStorage;
  @Autowired private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

  AdminController(AdminAccess access, ListingRepository listings, ReportRepository reports, JdbcTemplate jdbc, ObjectMapper mapper) {
    this.access = access;
    this.listings = listings;
    this.reports = reports;
    this.jdbc = jdbc;
    this.mapper = mapper;
  }

  @GetMapping("/me")
  Map<String, Object> me(@AuthenticationPrincipal Jwt jwt) {
    return Map.of("admin", access.isAdmin(jwt), "moderator", access.isModerator(jwt), "role", access.role(jwt));
  }

  @GetMapping("/listings")
  List<AdminListing> listings(@AuthenticationPrincipal Jwt jwt) {
    access.requireStaff(jwt);
    return listings.findTop100ByOrderByCreatedAtDesc().stream().map(this::adminListing).toList();
  }

  private AdminListing adminListing(ListingEntity listing) {
    String photoUrl = null;
    List<String> photoUrls = List.of();
    try {
      var photos = mapper.readValue(listing.photosJson, new TypeReference<List<Map<String, String>>>() {});
      if (photos != null && !photos.isEmpty()) {
        photoUrls = photos.stream().map(photo -> photo.get("src")).filter(src -> src != null && !src.isBlank()).toList();
        if (!photoUrls.isEmpty()) photoUrl = photoUrls.getFirst();
      }
    } catch (Exception ignored) { /* Keep moderation lists usable if an older listing has malformed photo data. */ }
    return new AdminListing(listing.id, listing.title, listing.ownerId, listing.ownerName, listing.districtId,
        listing.available, listing.moderationHidden, listing.createdAt, photoUrl, photoUrls);
  }

  @GetMapping("/users")
  List<AdminUser> users(@AuthenticationPrincipal Jwt jwt) {
    access.requireStaff(jwt);
    List<AdminUser> users = jdbc.query("SELECT u.user_id, COALESCE(p.display_name, MAX(l.owner_name), 'Usuario') AS display_name, " +
        "au.username, p.phone_number, p.department, p.country_code, p.designation, p.description, COALESCE(p.image_url, MAX(l.owner_image_url)) AS image_url, COALESCE(p.member_since, MIN(l.created_at)) AS member_since, " +
        "COUNT(DISTINCT l.id) AS listing_count, COUNT(DISTINCT r.id) AS report_count " +
        "FROM (SELECT owner_id AS user_id FROM listings UNION SELECT target_id AS user_id FROM reports WHERE target_type = 'user' UNION SELECT user_id FROM user_profiles) u " +
        "LEFT JOIN user_profiles p ON p.user_id = u.user_id LEFT JOIN app_users au ON au.user_id = u.user_id LEFT JOIN listings l ON l.owner_id = u.user_id " +
        "LEFT JOIN reports r ON r.target_type = 'user' AND r.target_id = u.user_id GROUP BY u.user_id, p.display_name, au.username, p.phone_number, p.department, p.country_code, p.designation, p.description, p.image_url, p.member_since ORDER BY report_count DESC, listing_count DESC LIMIT 200",
        (rs, row) -> {
          var memberSince = rs.getTimestamp("member_since");
          return new AdminUser(rs.getString("user_id"), rs.getString("display_name"), rs.getString("username"), rs.getString("phone_number"), rs.getString("department"), rs.getString("country_code"), rs.getString("designation"), rs.getString("description"),
              rs.getLong("listing_count"), rs.getLong("report_count"), rs.getString("image_url"), memberSince == null ? null : memberSince.toInstant());
        });
    return users;
  }

  @GetMapping("/staff")
  List<AdminStaff> staff(@AuthenticationPrincipal Jwt jwt) {
    access.requireAdmin(jwt);
    List<AdminStaff> staff = jdbc.query("SELECT p.user_id, COALESCE(s.role, 'none') AS role, s.added_by, COALESCE(s.created_at, p.member_since) AS created_at, p.display_name, au.username, p.image_url " +
            "FROM user_profiles p LEFT JOIN moderation_staff s ON s.user_id = p.user_id LEFT JOIN app_users au ON au.user_id = p.user_id UNION ALL " +
            "SELECT s.user_id, s.role, s.added_by, s.created_at, s.user_id AS display_name, au.username, NULL AS image_url " +
            "FROM moderation_staff s LEFT JOIN user_profiles p ON p.user_id = s.user_id LEFT JOIN app_users au ON au.user_id = s.user_id WHERE p.user_id IS NULL ORDER BY created_at DESC",
        (rs, row) -> new AdminStaff(rs.getString("user_id"), rs.getString("role"), rs.getString("added_by"), rs.getTimestamp("created_at").toInstant(),
            rs.getString("display_name"), rs.getString("username"), rs.getString("image_url")));
    return staff;
  }

  @GetMapping("/staff/{userId}/case-profile")
  CaseAssigneeProfile caseAssigneeProfile(@AuthenticationPrincipal Jwt jwt, @PathVariable String userId) {
    access.requireStaff(jwt);
    if (!access.isStaffId(userId)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    List<CaseAssigneeProfile> profiles = jdbc.query("SELECT COALESCE(NULLIF(p.display_name, ''), CASE s.role WHEN 'admin' THEN 'Administrador' ELSE 'Moderador' END) AS display_name, p.image_url, s.role FROM moderation_staff s LEFT JOIN user_profiles p ON p.user_id = s.user_id WHERE s.user_id = ?",
        (rs, row) -> new CaseAssigneeProfile(userId, rs.getString("display_name"), rs.getString("image_url"), rs.getString("role")), userId);
    if (profiles.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    return profiles.getFirst();
  }

  @PostMapping("/users")
  @Transactional
  AdminUser createUser(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateUser request) {
    access.requireAdmin(jwt);
    String username = request.username().trim().toLowerCase(java.util.Locale.ROOT);
    Integer exists = jdbc.queryForObject("SELECT COUNT(*) FROM app_users WHERE username = ?", Integer.class, username);
    if (exists != null && exists > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Ese nombre de usuario ya esta ocupado.");
    String userId = UUID.randomUUID().toString();
    String imageUrl = request.imageData() == null || request.imageData().isBlank() ? null : imageStorage.storeProfileDataUrl(request.imageData(), userId).url();
    jdbc.update("INSERT INTO app_users (user_id, username, password_hash) VALUES (?, ?, ?)", userId, username, passwordEncoder.encode(request.password()));
    jdbc.update("INSERT INTO user_profiles (user_id, display_name, phone_number, country_code, designation, image_url, description, member_since) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6))",
        userId, request.fullName().trim(), request.phone(), request.countryCode(), request.designation(), imageUrl, request.description());
    audit(jwt.getSubject(), "user-created", userId, username + " · " + (request.countryCode() == null ? "País no especificado" : request.countryCode()) + " / " + request.designation());
    return new AdminUser(userId, request.fullName().trim(), username, request.phone(), null, request.countryCode(), request.designation(), request.description(), 0, 0, imageUrl, Instant.now());
  }

  @PutMapping("/staff/{userId}/role")
  @Transactional
  AdminStaff changeStaffRole(@AuthenticationPrincipal Jwt jwt, @PathVariable String userId, @Valid @RequestBody StaffRoleChange request) {
    access.requireAdmin(jwt);
    if (!Set.of("admin", "moderator", "none").contains(request.role())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rol de equipo no válido");
    if (access.isBootstrapAdmin(userId) && !request.role().equals("admin")) throw new ResponseStatusException(HttpStatus.CONFLICT, "Este administrador se gestiona desde la configuración del servidor");
    var current = jdbc.query("SELECT role FROM moderation_staff WHERE user_id = ?", rs -> rs.next() ? rs.getString(1) : "none", userId);
    if (current.equals("admin") && !request.role().equals("admin")) {
      Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM moderation_staff WHERE role = 'admin'", Integer.class);
      if (count != null && count <= 1) throw new ResponseStatusException(HttpStatus.CONFLICT, "At least one administrator must remain");
    }
    if (request.role().equals("none")) jdbc.update("DELETE FROM moderation_staff WHERE user_id = ?", userId);
    else jdbc.update("INSERT INTO moderation_staff (user_id, role, added_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)", userId, request.role(), jwt.getSubject());
    audit(jwt.getSubject(), "staff-role-changed", userId, current + " -> " + request.role() + ": " + request.reason().trim());
    if (request.role().equals("none")) return jdbc.queryForObject("SELECT ? AS user_id, 'none' AS role, ? AS added_by, CURRENT_TIMESTAMP(6) AS created_at, COALESCE(p.display_name, ?) AS display_name, au.username, p.image_url FROM (SELECT 1) seed LEFT JOIN user_profiles p ON p.user_id = ? LEFT JOIN app_users au ON au.user_id = ?",
        (rs, row) -> new AdminStaff(rs.getString("user_id"), rs.getString("role"), rs.getString("added_by"), rs.getTimestamp("created_at").toInstant(), rs.getString("display_name"), rs.getString("username"), rs.getString("image_url")), userId, jwt.getSubject(), userId, userId, userId);
    return jdbc.queryForObject("SELECT s.user_id, s.role, s.added_by, s.created_at, p.display_name, au.username, p.image_url FROM moderation_staff s LEFT JOIN user_profiles p ON p.user_id = s.user_id LEFT JOIN app_users au ON au.user_id = s.user_id WHERE s.user_id = ?",
        (rs, row) -> new AdminStaff(rs.getString("user_id"), rs.getString("role"), rs.getString("added_by"), rs.getTimestamp("created_at").toInstant(), rs.getString("display_name"), rs.getString("username"), rs.getString("image_url")), userId);
  }

  @PatchMapping("/listings/{id}/visibility")
  @Transactional
  AdminListing visibility(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @Valid @RequestBody VisibilityChange request) {
    access.requireStaff(jwt);
    var listing = listings.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    boolean ownerIsModerating = jwt.getSubject().equals(listing.ownerId);
    if (ownerIsModerating && !access.isAdmin(jwt)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "No puedes moderar tu propia publicacion");
    }
    if (listing.moderationHidden != request.hidden()) {
      listing.moderationHidden = request.hidden();
      listing.moderationHiddenReason = request.hidden() ? request.note().trim() : null;
      audit(jwt.getSubject(), request.hidden() ? "listing-hidden" : "listing-restored", id, request.note());
    }
    return adminListing(listings.save(listing));
  }

  @GetMapping("/reports")
  List<ReportController.ReportView> reports(@AuthenticationPrincipal Jwt jwt) {
    access.requireStaff(jwt);
    return reports.findTop100ByArchivedFalseOrderByCreatedAtDesc().stream().map(ReportController.ReportView::from).toList();
  }

  @PatchMapping("/reports/{id}/archive")
  @Transactional
  ReportController.ReportView archiveReport(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody ArchiveChange request) {
    access.requireAdmin(jwt);
    var report = reports.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    if (report.archived == request.archived()) return ReportController.ReportView.from(report);
    report.archived = request.archived();
    report.archivedAt = request.archived() ? Instant.now() : null;
    report.archivedBy = request.archived() ? jwt.getSubject() : null;
    String eventAction = request.archived() ? "archived" : "unarchived";
    String eventDescription = request.archived() ? "Reporte archivado por administración" : "Reporte restaurado por administración";
    caseEvent(id, jwt.getSubject(), eventAction, null, null, eventDescription);
    audit(jwt.getSubject(), eventAction.equals("archived") ? "report-archived" : "report-restored", id, eventDescription);
    return ReportController.ReportView.from(reports.save(report));
  }

  @PatchMapping("/reports/{id}")
  @Transactional
  ReportController.ReportView review(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @Valid @RequestBody ReviewChange request) {
    access.requireStaff(jwt);
    if (!REPORT_STATUSES.contains(request.status())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Estado del caso no válido");
    if (request.resolution() == null || request.resolution().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Explica la resolución del caso");
    }
    if (request.status().equals("waiting-information") && (request.userResponse() == null || request.userResponse().isBlank())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escribe qué información necesitas de quien reportó");
    }
    var report = reports.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    requireCaseAssignment(jwt, report);
    if (jwt.getSubject().equals(report.reporterId) || jwt.getSubject().equals(report.targetId)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No puedes revisar un reporte tuyo o sobre tu cuenta");
    }
    String previous = report.status;
    report.status = request.status();
    report.resolution = request.resolution() == null ? "" : request.resolution().trim();
    report.userResponse = request.userResponse() == null ? report.userResponse : request.userResponse().trim();
    report.reviewedBy = jwt.getSubject();
    report.reviewedAt = Instant.now();
    caseEvent(report.id, jwt.getSubject(), "status-changed", previous, report.status, report.resolution);
    audit(jwt.getSubject(), "report-" + request.status(), id, report.resolution);
    return ReportController.ReportView.from(reports.save(report));
  }

  @PatchMapping("/reports/{id}/assignment")
  @Transactional
  ReportController.ReportView assign(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @Valid @RequestBody AssignmentChange request) {
    access.requireStaff(jwt);
    var report = reports.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    if (request.assignedTo() != null && !request.assignedTo().isBlank() && !access.isStaffId(request.assignedTo().trim())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned account is not an authorized staff member");
    }
    if (!access.isAdmin(jwt) && request.assignedTo() != null && !request.assignedTo().isBlank() && !jwt.getSubject().equals(request.assignedTo().trim())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Como moderador solo puedes asignarte casos a ti");
    }
    if (!access.isAdmin(jwt) && report.assignedTo != null && !report.assignedTo.equals(jwt.getSubject())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "This case is already assigned to another staff member");
    }
    String previous = report.assignedTo;
    String next = request.assignedTo() == null || request.assignedTo().isBlank() ? null : request.assignedTo().trim();
    if (!access.isAdmin(jwt)) {
      if (!java.util.Objects.equals(previous, next)) {
        int changed = jdbc.update("UPDATE reports SET assigned_to = ? WHERE id = ? AND (assigned_to IS NULL OR assigned_to = ?)", next, id, jwt.getSubject());
        if (changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "This case is already assigned to another staff member");
      }
    }
    report.assignedTo = next;
    caseEvent(id, jwt.getSubject(), "assigned", previous, report.assignedTo, request.reason());
    audit(jwt.getSubject(), "case-assigned", id, request.reason());
    return ReportController.ReportView.from(reports.save(report));
  }

  @PatchMapping("/reports/{id}/priority")
  @Transactional
  ReportController.ReportView priority(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @Valid @RequestBody PriorityChange request) {
    access.requireStaff(jwt);
    if (!PRIORITIES.contains(request.priority())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Prioridad no válida");
    var report = reports.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    requireCaseAssignment(jwt, report);
    String previous = report.priority;
    report.priority = request.priority();
    caseEvent(id, jwt.getSubject(), "priority-changed", previous, report.priority, request.reason());
    audit(jwt.getSubject(), "case-priority", id, request.reason());
    return ReportController.ReportView.from(reports.save(report));
  }

  @PostMapping("/reports/{id}/notes")
  @Transactional
  CaseNote addNote(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @Valid @RequestBody InternalNote request) {
    access.requireStaff(jwt);
    var report = reports.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    requireCaseAssignment(jwt, report);
    if (jwt.getSubject().equals(report.reporterId) || jwt.getSubject().equals(report.targetId)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No puedes agregar notas a un caso que te involucra");
    }
    var note = new CaseNote(UUID.randomUUID().toString(), id, jwt.getSubject(), request.note().trim(), Instant.now());
    jdbc.update("INSERT INTO moderation_case_notes (id, report_id, author_id, note) VALUES (?, ?, ?, ?)", note.id(), id, jwt.getSubject(), note.note());
    caseEvent(id, jwt.getSubject(), "internal-note", null, null, "Internal note added");
    return note;
  }

  @GetMapping("/reports/{id}/notes")
  List<CaseNote> notes(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    access.requireStaff(jwt);
    var report = reports.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    requireCaseAssignment(jwt, report);
    return jdbc.query("SELECT id, report_id, author_id, note, created_at FROM moderation_case_notes WHERE report_id = ? ORDER BY created_at ASC",
        (rs, row) -> new CaseNote(rs.getString("id"), rs.getString("report_id"), rs.getString("author_id"), rs.getString("note"), rs.getTimestamp("created_at").toInstant()), id);
  }

  @GetMapping("/reports/{id}/history")
  List<CaseEvent> history(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    access.requireStaff(jwt);
    var report = reports.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    requireCaseAssignment(jwt, report);
    return jdbc.query("SELECT id, report_id, actor_id, action, previous_value, new_value, reason, created_at FROM moderation_case_events WHERE report_id = ? ORDER BY created_at ASC",
        (rs, row) -> new CaseEvent(rs.getString("id"), rs.getString("report_id"), rs.getString("actor_id"), rs.getString("action"), rs.getString("previous_value"), rs.getString("new_value"), rs.getString("reason"), rs.getTimestamp("created_at").toInstant()), id);
  }

  @GetMapping("/actions")
  List<ModerationAction> actions(@AuthenticationPrincipal Jwt jwt) {
    access.requireAdmin(jwt);
    return findActions(null);
  }

  @GetMapping("/my-actions")
  List<ModerationAction> myActions(@AuthenticationPrincipal Jwt jwt) {
    access.requireStaff(jwt);
    return findActions(jwt.getSubject());
  }

  @PostMapping("/users/{userId}/sanctions")
  @Transactional
  AdminSanctionView sanction(@AuthenticationPrincipal Jwt jwt, @PathVariable String userId,
      @Valid @RequestBody SanctionChange request) {
    access.requireStaff(jwt);
    if (jwt.getSubject().equals(userId)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No puedes sancionar tu propia cuenta");
    if (!Set.of("publishing", "messaging", "all").contains(request.restrictionType())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo de medida no válido");
    if (request.reason() == null || request.reason().isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el motivo");
    int days = request.durationDays() == null ? 0 : request.durationDays();
    if (days < 0 || days > 365) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La duración debe ser de 1 a 365 días; solo un administrador puede aplicar una medida permanente");
    if (!access.isAdmin(jwt) && (request.restrictionType().equals("all") || days == 0 || days > 7)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Como moderador puedes aplicar medidas de hasta 7 días, y no de tipo total");
    }
    if (request.durationDays() != null && days == 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La duración debe ser mayor que cero");
    Integer accounts = jdbc.queryForObject("SELECT (SELECT COUNT(*) FROM app_users WHERE user_id = ?) + (SELECT COUNT(*) FROM user_profiles WHERE user_id = ?)",
        Integer.class, userId, userId);
    if (accounts == null || accounts == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "La cuenta no existe");
    if (access.isAdminId(userId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No se puede sancionar a un administrador");
    if (!access.isAdmin(jwt) && access.isStaffId(userId)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Los moderadores no pueden sancionar a otros miembros del equipo");
    }
    if (!access.isAdmin(jwt)) {
      Integer active = jdbc.queryForObject("SELECT COUNT(*) FROM moderation_sanctions WHERE user_id = ? AND revoked_at IS NULL "
          + "AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP(6))", Integer.class, userId);
      if (active != null && active > 0) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Esta cuenta ya tiene una medida activa. Si hace falta otra, la decide un administrador.");
      }
    }
    String id = UUID.randomUUID().toString();
    jdbc.update("INSERT INTO moderation_sanctions (id, user_id, restriction_type, reason, starts_at, expires_at, created_by) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP(6), ?, ?)",
        id, userId, request.restrictionType(), request.reason().trim(), days == 0 ? null : java.sql.Timestamp.from(Instant.now().plusSeconds(days * 86400L)), jwt.getSubject());
    audit(jwt.getSubject(), "sanction-created", id, request.restrictionType() + ": " + request.reason().trim());
    return jdbc.queryForObject("SELECT id, restriction_type, reason, starts_at, expires_at, created_by, revoked_at, revoked_by FROM moderation_sanctions WHERE id = ?",
        (rs, row) -> adminSanctionView(rs), id);
  }

  @GetMapping("/users/{userId}/account-status")
  AccountStatus accountStatus(@AuthenticationPrincipal Jwt jwt, @PathVariable String userId) {
    access.requireAdmin(jwt);
    List<Boolean> states = jdbc.query("SELECT deactivated FROM app_users WHERE user_id = ?", (rs, row) -> rs.getBoolean(1), userId);
    if (states.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "La cuenta no existe en este proyecto");
    return new AccountStatus(states.getFirst());
  }

  @PostMapping("/users/{userId}/deactivate")
  AccountStatus deactivateAccount(@AuthenticationPrincipal Jwt jwt, @PathVariable String userId,
      @Valid @RequestBody ReasonChange request) {
    access.requireAdmin(jwt);
    requireManageableAccount(jwt, userId);
    int changed = jdbc.update("UPDATE app_users SET deactivated = TRUE WHERE user_id = ?", userId);
    if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "La cuenta no existe en este proyecto");
    audit(jwt.getSubject(), "account-deactivated", userId, request.reason().trim());
    return new AccountStatus(true);
  }

  @PostMapping("/users/{userId}/reactivate")
  AccountStatus reactivateAccount(@AuthenticationPrincipal Jwt jwt, @PathVariable String userId,
      @Valid @RequestBody ReasonChange request) {
    access.requireAdmin(jwt);
    requireManageableAccount(jwt, userId);
    int changed = jdbc.update("UPDATE app_users SET deactivated = FALSE WHERE user_id = ?", userId);
    if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "La cuenta no existe en este proyecto");
    audit(jwt.getSubject(), "account-reactivated", userId, request.reason().trim());
    return new AccountStatus(false);
  }

  private void requireManageableAccount(Jwt jwt, String userId) {
    if (jwt.getSubject().equals(userId)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No puedes desactivar tu propia cuenta");
    if (access.isStaffId(userId)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Retira primero el acceso de equipo antes de gestionar esta cuenta");
  }

  @GetMapping("/users/{userId}/sanctions")
  List<AdminSanctionView> sanctions(@AuthenticationPrincipal Jwt jwt, @PathVariable String userId) {
    access.requireStaff(jwt);
    return jdbc.query("SELECT id, restriction_type, reason, starts_at, expires_at, created_by, revoked_at, revoked_by FROM moderation_sanctions WHERE user_id = ? ORDER BY starts_at DESC",
        (rs, row) -> adminSanctionView(rs), userId);
  }

  private AdminSanctionView adminSanctionView(java.sql.ResultSet rs) throws java.sql.SQLException {
    var expiry = rs.getTimestamp("expires_at");
    var revoked = rs.getTimestamp("revoked_at");
    return new AdminSanctionView(rs.getString("id"), rs.getString("restriction_type"), rs.getString("reason"),
        rs.getTimestamp("starts_at").toInstant(), expiry == null ? null : expiry.toInstant(), rs.getString("created_by"),
        revoked == null ? null : revoked.toInstant(), rs.getString("revoked_by"));
  }

  @PatchMapping("/users/{userId}/sanctions/{sanctionId}/revoke")
  @Transactional
  ResponseEntity<Map<String, String>> revokeSanction(@AuthenticationPrincipal Jwt jwt, @PathVariable String userId, @PathVariable String sanctionId,
      @Valid @RequestBody ReasonChange request) {
    access.requireStaff(jwt);
    if (request.reason() == null || request.reason().isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el motivo");
    if (jwt.getSubject().equals(userId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No puedes retirar una medida aplicada a tu propia cuenta");
    List<String> authors = jdbc.query("SELECT created_by FROM moderation_sanctions WHERE id = ? AND user_id = ?",
        (rs, row) -> rs.getString("created_by"), sanctionId, userId);
    if (authors.isEmpty()) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("detail", "La medida no pertenece a esta cuenta o ya no existe. Recarga el historial."));
    }
    if (!access.isAdmin(jwt) && !jwt.getSubject().equals(authors.getFirst())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo puedes retirar las medidas que aplicaste tú. Las demás las revisa un administrador o se resuelven por apelación.");
    }
    int changed = jdbc.update("UPDATE moderation_sanctions SET revoked_at = CURRENT_TIMESTAMP(6), revoked_by = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL", jwt.getSubject(), sanctionId, userId);
    if (changed == 0) {
      return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("detail", "La medida ya fue retirada. Recarga el historial para ver el estado actualizado."));
    }
    audit(jwt.getSubject(), "sanction-revoked", sanctionId, request.reason().trim());
    return ResponseEntity.ok(Map.of("status", "revoked"));
  }

  private List<ModerationAction> findActions(String staffId) {
    String sql = "WITH action_targets AS (SELECT a.*, COALESCE(CASE " +
        "WHEN a.action IN ('user-created','staff-role-changed','account-deactivated','account-reactivated') THEN a.target_id " +
        "WHEN a.action IN ('listing-hidden','listing-restored') THEN action_listing.owner_id " +
        "WHEN a.action IN ('sanction-created','sanction-revoked') THEN sanction.user_id " +
        "WHEN a.action LIKE 'appeal-%' THEN appeal.user_id " +
        "WHEN a.action LIKE 'report-%' OR a.action IN ('case-assigned','case-priority') THEN " +
        "CASE WHEN report.target_type = 'user' THEN report.target_id ELSE COALESCE(reported_listing.owner_id, target_listing.owner_id) END " +
        "END, '') AS affected_user_id FROM moderation_actions a " +
        "LEFT JOIN listings action_listing ON a.action IN ('listing-hidden','listing-restored') AND action_listing.id = a.target_id " +
        "LEFT JOIN moderation_sanctions sanction ON a.action IN ('sanction-created','sanction-revoked') AND sanction.id = a.target_id " +
        "LEFT JOIN moderation_appeals appeal ON a.action LIKE 'appeal-%' AND appeal.id = a.target_id " +
        "LEFT JOIN reports report ON (a.action LIKE 'report-%' OR a.action IN ('case-assigned','case-priority')) AND report.id = a.target_id " +
        "LEFT JOIN listings reported_listing ON report.listing_id = reported_listing.id " +
        "LEFT JOIN listings target_listing ON report.target_type = 'listing' AND target_listing.id = report.target_id " +
        ") SELECT a.id, a.admin_id, a.action, a.target_id, a.note, a.created_at, a.affected_user_id, " +
        "COALESCE(profile.display_name, listing_user.display_name, 'Usuario') AS affected_user_name, " +
        "COALESCE(profile.image_url, listing_user.image_url) AS affected_user_image " +
        "FROM action_targets a LEFT JOIN user_profiles profile ON profile.user_id = a.affected_user_id " +
        "LEFT JOIN (SELECT owner_id, MAX(owner_name) AS display_name, MAX(owner_image_url) AS image_url FROM listings GROUP BY owner_id) listing_user " +
        "ON listing_user.owner_id = a.affected_user_id " +
        (staffId == null ? "" : "WHERE a.admin_id = ? ") + "ORDER BY a.created_at DESC LIMIT 100";
    var mapper = (org.springframework.jdbc.core.RowMapper<ModerationAction>) (rs, row) -> new ModerationAction(
        rs.getString("id"), rs.getString("admin_id"), rs.getString("action"), rs.getString("target_id"), rs.getString("note"),
        rs.getTimestamp("created_at").toInstant(), rs.getString("affected_user_id"), rs.getString("affected_user_name"), rs.getString("affected_user_image"));
    return staffId == null ? jdbc.query(sql, mapper) : jdbc.query(sql, mapper, staffId);
  }

  private void requireCaseAssignment(Jwt jwt, ReportEntity report) {
    if (!access.isAdmin(jwt) && !jwt.getSubject().equals(report.assignedTo)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Asigna el caso a tu cuenta antes de trabajar en él");
    }
  }

  private void caseEvent(String reportId, String actorId, String action, String previous, String next, String reason) {
    jdbc.update("INSERT INTO moderation_case_events (id, report_id, actor_id, action, previous_value, new_value, reason) VALUES (?, ?, ?, ?, ?, ?, ?)",
        UUID.randomUUID().toString(), reportId, actorId, action, previous, next, reason == null ? "" : reason.trim());
  }

  private void audit(String staffId, String action, String targetId, String note) {
    jdbc.update("INSERT INTO moderation_actions (id, admin_id, action, target_id, note) VALUES (?, ?, ?, ?, ?)",
        UUID.randomUUID().toString(), staffId, action, targetId, note == null ? "" : note.trim());
  }

  record VisibilityChange(@jakarta.validation.constraints.NotNull Boolean hidden, @NotBlank(message = "La nota es obligatoria") @Size(max = 1000, message = "La nota no puede superar 1.000 caracteres") String note) {}
  record ReviewChange(@NotBlank(message = "La decisión es obligatoria") String status, @NotBlank(message = "La resolución es obligatoria") @Size(max = 1000, message = "La resolución no puede superar 1.000 caracteres") String resolution, @Size(max = 1000, message = "La respuesta para quien reportó no puede superar 1.000 caracteres") String userResponse) {
    ReviewChange(String status, String resolution) { this(status, resolution, null); }
  }
  record AssignmentChange(@Size(max = 100, message = "La persona asignada no puede superar 100 caracteres") String assignedTo, @NotBlank(message = "El motivo es obligatorio") @Size(max = 1000, message = "El motivo no puede superar 1.000 caracteres") String reason) {}
  record ArchiveChange(boolean archived) {}
  record PriorityChange(@NotBlank(message = "La prioridad es obligatoria") String priority, @NotBlank(message = "El motivo es obligatorio") @Size(max = 1000, message = "El motivo no puede superar 1.000 caracteres") String reason) {}
  record InternalNote(@NotBlank(message = "La nota es obligatoria") @Size(max = 2000, message = "La nota no puede superar 2.000 caracteres") String note) {}
  record SanctionChange(@NotBlank(message = "El tipo de medida es obligatorio") String restrictionType, @NotBlank(message = "El motivo es obligatorio") @Size(max = 1000, message = "El motivo no puede superar 1.000 caracteres") String reason, Integer durationDays) {}
  record AccountStatus(boolean deactivated) {}
  record ReasonChange(@NotBlank(message = "El motivo es obligatorio") @Size(max = 1000, message = "El motivo no puede superar 1.000 caracteres") String reason) {}
  record AdminSanctionView(String id, String restrictionType, String reason, Instant startsAt, Instant expiresAt,
      String createdBy, Instant revokedAt, String revokedBy) {}
  record StaffRoleChange(@NotBlank(message = "El rol es obligatorio") String role, @NotBlank(message = "El motivo es obligatorio") @Size(max = 1000, message = "El motivo no puede superar 1.000 caracteres") String reason) {}
  record CreateUser(@NotBlank(message = "El nombre completo es obligatorio") @Size(max = 120, message = "El nombre completo no puede superar 120 caracteres") String fullName,
      @NotBlank(message = "El nombre de usuario es obligatorio") @Pattern(regexp = "[A-Za-z0-9._-]{3,32}", message = "El nombre de usuario debe tener de 3 a 32 letras, números, puntos, guiones o guion bajo") String username,
      @NotBlank(message = "La contraseña es obligatoria") @Size(min = 8, max = 100, message = "La contraseña debe tener entre 8 y 100 caracteres") String password, @Size(max = 40, message = "El teléfono no puede superar 40 caracteres") String phone, @Pattern(regexp = "|[A-Za-z]{2}", message = "El código de país debe tener 2 letras") String countryCode, @NotBlank(message = "El cargo es obligatorio") @Size(max = 100, message = "El cargo no puede superar 100 caracteres") String designation,
      @Size(max = 500, message = "La descripción no puede superar 500 caracteres") String description, @Size(max = 10_000_000, message = "La imagen es demasiado grande") String imageData) {}
  record CaseNote(String id, String reportId, String authorId, String note, Instant createdAt) {}
  record CaseEvent(String id, String reportId, String actorId, String action, String previousValue, String newValue, String reason, Instant createdAt) {}
  record AdminListing(String id, String title, String ownerId, String ownerName, String districtId, boolean available, boolean moderationHidden, Instant createdAt, String photoUrl, List<String> photoUrls) {}
  record AdminUser(String userId, String displayName, String username, String phone, String department, String countryCode, String designation, String description, long listingCount, long reportCount, String imageUrl, Instant memberSince) {}
  record AdminStaff(String userId, String role, String addedBy, Instant createdAt, String displayName, String username, String imageUrl) {}
  record CaseAssigneeProfile(String userId, String displayName, String imageUrl, String role) {}
  record ModerationAction(String id, String adminId, String action, String targetId, String note, Instant createdAt,
      String affectedUserId, String affectedUserName, String affectedUserImageUrl) {}
}
