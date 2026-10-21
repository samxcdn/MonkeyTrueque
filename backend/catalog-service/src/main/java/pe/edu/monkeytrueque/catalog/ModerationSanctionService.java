package pe.edu.monkeytrueque.catalog;

import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
class ModerationSanctionService {
  private final JdbcTemplate jdbc;

  ModerationSanctionService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  void requireAllowed(String userId, String restrictionType) {
    Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM moderation_sanctions WHERE user_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP(6)) AND restriction_type IN (?, 'all')",
        Integer.class, userId, restrictionType);
    if (count != null && count > 0) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, restrictionType.equals("publishing")
          ? "Tu cuenta tiene temporalmente restringidas las publicaciones" : "Tu cuenta tiene temporalmente restringidos los mensajes");
    }
  }

  List<SanctionView> activeFor(String userId) {
    return jdbc.query("SELECT id, restriction_type, reason, starts_at, expires_at, created_by FROM moderation_sanctions WHERE user_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP(6)) ORDER BY starts_at DESC",
        (rs, row) -> new SanctionView(rs.getString("id"), rs.getString("restriction_type"), rs.getString("reason"),
            rs.getTimestamp("starts_at").toInstant(), rs.getTimestamp("expires_at") == null ? null : rs.getTimestamp("expires_at").toInstant(), rs.getString("created_by")), userId);
  }

  record SanctionView(String id, String restrictionType, String reason, Instant startsAt, Instant expiresAt, String createdBy) {}
}
