package pe.edu.monkeytrueque.catalog;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
class AdminAccess {
  private final Set<String> adminIds;
  private final Set<String> moderatorIds;
  private final JdbcTemplate jdbc;

  @Autowired
  AdminAccess(JdbcTemplate jdbc) {
    this.adminIds = Set.of();
    this.moderatorIds = Set.of();
    this.jdbc = jdbc;
  }

  AdminAccess(String configuredAdminIds, String configuredModeratorIds) {
    this.adminIds = parseIds(configuredAdminIds);
    this.moderatorIds = parseIds(configuredModeratorIds);
    this.jdbc = null;
  }

  private static Set<String> parseIds(String configuredIds) {
    return Arrays.stream(configuredIds.split(",")).map(String::trim).filter(id -> !id.isEmpty()).collect(Collectors.toUnmodifiableSet());
  }

  private String roleFor(String userId) {
    if (jdbc == null) return adminIds.contains(userId) ? "admin" : moderatorIds.contains(userId) ? "moderator" : "none";
    return jdbc.query("SELECT role FROM moderation_staff WHERE user_id = ?", rs -> rs.next() ? rs.getString(1) : "none", userId);
  }

  boolean isAdmin(Jwt jwt) { return jwt != null && "admin".equals(roleFor(jwt.getSubject())); }
  boolean isModerator(Jwt jwt) { return jwt != null && "moderator".equals(roleFor(jwt.getSubject())); }
  boolean isStaff(Jwt jwt) { return isAdmin(jwt) || isModerator(jwt); }
  boolean isStaffId(String id) { return id != null && ("admin".equals(roleFor(id)) || "moderator".equals(roleFor(id))); }
  boolean isAdminId(String id) { return id != null && "admin".equals(roleFor(id)); }
  boolean isBootstrapAdmin(String id) { return id != null && adminIds.contains(id); }
  String role(Jwt jwt) { return isAdmin(jwt) ? "admin" : isModerator(jwt) ? "moderator" : "none"; }

  void requireStaff(Jwt jwt) {
    if (!isStaff(jwt)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Necesitas permisos de moderación");
  }

  void requireAdmin(Jwt jwt) {
    if (!isAdmin(jwt)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Necesitas permisos de administración");
  }
}
