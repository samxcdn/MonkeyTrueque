package pe.edu.monkeytrueque.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
class AppealController {
  private final JdbcTemplate jdbc;
  private final AdminAccess access;
  private final ModerationEvidenceService evidence;

  AppealController(JdbcTemplate jdbc, AdminAccess access, ModerationEvidenceService evidence) { this.jdbc = jdbc; this.access = access; this.evidence = evidence; }

  @PostMapping("/api/appeals")
  @Transactional
  AppealView create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody NewAppeal request) {
    List<String> owned = jdbc.query("SELECT id FROM moderation_sanctions WHERE id = ? AND user_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP(6)) FOR UPDATE",
        (rs, row) -> rs.getString("id"), request.sanctionId(), jwt.getSubject());
    if (owned.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No encontramos una medida activa para apelar");
    Integer existing = jdbc.queryForObject("SELECT COUNT(*) FROM moderation_appeals WHERE sanction_id = ? AND status = 'open'", Integer.class, request.sanctionId());
    if (existing != null && existing > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya tienes una apelación abierta para esta medida");
    String id = UUID.randomUUID().toString();
    jdbc.update("INSERT INTO moderation_appeals (id, sanction_id, user_id, explanation) VALUES (?, ?, ?, ?)", id, request.sanctionId(), jwt.getSubject(), request.explanation().trim());
    evidence.save("appeal", id, request.attachments());
    return one(id);
  }

  @GetMapping("/api/appeals/mine")
  List<AppealView> mine(@AuthenticationPrincipal Jwt jwt) {
    return jdbc.query(appealSelect() + " WHERE a.user_id = ? ORDER BY a.created_at DESC LIMIT 100",
        this::mapAppeal, jwt.getSubject());
  }

  @GetMapping("/api/admin/appeals")
  List<AppealView> all(@AuthenticationPrincipal Jwt jwt) {
    access.requireStaff(jwt);
    return jdbc.query(appealSelect() + " WHERE a.archived = FALSE ORDER BY a.created_at DESC LIMIT 100", this::mapAppeal);
  }

  @PatchMapping("/api/admin/appeals/{id}/archive")
  @Transactional
  Map<String, String> archive(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    access.requireAdmin(jwt);
    List<String> statuses = jdbc.query("SELECT status FROM moderation_appeals WHERE id = ? AND archived = FALSE FOR UPDATE",
        (rs, row) -> rs.getString("status"), id);
    if (statuses.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Apelación no encontrada");
    if ("open".equals(statuses.getFirst())) throw new ResponseStatusException(HttpStatus.CONFLICT, "Resuelve la apelación antes de archivarla");
    int changed = jdbc.update("UPDATE moderation_appeals SET archived = TRUE, archived_at = CURRENT_TIMESTAMP(6), archived_by = ? WHERE id = ? AND archived = FALSE", jwt.getSubject(), id);
    if (changed > 0) jdbc.update("INSERT INTO moderation_actions (id, admin_id, action, target_id, note) VALUES (?, ?, 'appeal-archived', ?, ?)", UUID.randomUUID().toString(), jwt.getSubject(), id, "Apelación archivada por administración.");
    return Map.of("status", "archived");
  }

  @PatchMapping("/api/admin/appeals/{id}")
  @Transactional
  AppealView review(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @Valid @RequestBody AppealDecision request) {
    access.requireStaff(jwt);
    if (!Set.of("accepted", "rejected").contains(request.status())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Decisión de apelación no válida");
    List<MapRow> matches = jdbc.query("SELECT a.id, a.sanction_id, s.created_by FROM moderation_appeals a JOIN moderation_sanctions s ON s.id = a.sanction_id WHERE a.id = ?",
        (rs, row) -> new MapRow(rs.getString("id"), rs.getString("sanction_id"), rs.getString("created_by")), id);
    if (matches.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    MapRow appeal = matches.getFirst();
    if (jwt.getSubject().equals(appeal.sanctionAuthor())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Quien aplicó la medida no puede resolver su apelación");
    int changed = jdbc.update("UPDATE moderation_appeals SET status = ?, reviewed_by = ?, resolution = ?, reviewed_at = CURRENT_TIMESTAMP(6) WHERE id = ? AND status = 'open'",
        request.status(), jwt.getSubject(), request.resolution().trim(), id);
    if (changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Esta apelación ya fue revisada");
    if (request.status().equals("accepted")) {
      jdbc.update("UPDATE moderation_sanctions SET revoked_at = CURRENT_TIMESTAMP(6), revoked_by = ? WHERE id = ? AND revoked_at IS NULL", jwt.getSubject(), appeal.sanctionId());
    }
    jdbc.update("INSERT INTO moderation_actions (id, admin_id, action, target_id, note) VALUES (?, ?, ?, ?, ?)", UUID.randomUUID().toString(), jwt.getSubject(), "appeal-" + request.status(), id, request.resolution().trim());
    return one(id);
  }

  private AppealView one(String id) { return jdbc.queryForObject(appealSelect() + " WHERE a.id = ?", this::mapAppeal, id); }

  private String appealSelect() {
    return "SELECT a.id, a.sanction_id, a.user_id, a.explanation, a.status, a.reviewed_by, a.resolution, a.created_at, a.reviewed_at, "
        + "s.restriction_type AS sanction_restriction_type, s.reason AS sanction_reason, s.starts_at AS sanction_starts_at, s.expires_at AS sanction_expires_at, s.created_by AS sanction_created_by "
        + ", COALESCE(NULLIF(p.display_name, ''), l.owner_name, 'Miembro de MonkeyTrueque') AS appellant_display_name, COALESCE(u.username, '') AS appellant_username, COALESCE(p.image_url, l.owner_image_url) AS appellant_image_url "
        + "FROM moderation_appeals a JOIN moderation_sanctions s ON s.id = a.sanction_id "
        + "LEFT JOIN user_profiles p ON p.user_id = a.user_id "
        + "LEFT JOIN app_users u ON u.user_id = a.user_id "
        + "LEFT JOIN (SELECT owner_id, MAX(owner_name) AS owner_name, MAX(owner_image_url) AS owner_image_url FROM listings GROUP BY owner_id) l ON l.owner_id = a.user_id";
  }

  private AppealView mapAppeal(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
    return new AppealView(rs.getString("id"), rs.getString("sanction_id"), rs.getString("user_id"), rs.getString("explanation"), rs.getString("status"), rs.getString("reviewed_by"), rs.getString("resolution"), rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("reviewed_at") == null ? null : rs.getTimestamp("reviewed_at").toInstant(), rs.getString("sanction_restriction_type"), rs.getString("sanction_reason"), rs.getTimestamp("sanction_starts_at").toInstant(), rs.getTimestamp("sanction_expires_at") == null ? null : rs.getTimestamp("sanction_expires_at").toInstant(), rs.getString("appellant_display_name"), rs.getString("appellant_username"), rs.getString("appellant_image_url"), rs.getString("sanction_created_by"));
  }

  record NewAppeal(@NotBlank(message = "La medida es obligatoria") String sanctionId, @NotBlank(message = "La explicación es obligatoria") @Size(max = 2000, message = "La explicación no puede superar 2.000 caracteres") String explanation,
      @Valid @Size(max = 3, message = "Puedes adjuntar hasta 3 imágenes") List<ModerationEvidenceService.EvidenceImage> attachments) {
    NewAppeal(String sanctionId, String explanation) { this(sanctionId, explanation, null); }
  }
  record AppealDecision(@NotBlank(message = "La decisión es obligatoria") String status, @NotBlank(message = "La resolución es obligatoria") @Size(max = 1000, message = "La resolución no puede superar 1.000 caracteres") String resolution) {}
  record AppealView(String id, String sanctionId, String userId, String explanation, String status,
      String reviewedBy, String resolution, Instant createdAt, Instant reviewedAt, String sanctionRestrictionType,
      String sanctionReason, Instant sanctionStartsAt, Instant sanctionExpiresAt, String userDisplayName, String username, String userImageUrl,
      String sanctionCreatedBy) {}
  private record MapRow(String id, String sanctionId, String sanctionAuthor) {}
}
