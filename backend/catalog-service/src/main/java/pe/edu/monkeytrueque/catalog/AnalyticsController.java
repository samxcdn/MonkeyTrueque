package pe.edu.monkeytrueque.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
class AnalyticsController {
  private static final String PAGE_KEY_PATTERN = "home|explore|product|publish|messages|account|info|other";
  private static final String SOURCE_PATTERN = "direct|google|bing|yahoo|duckduckgo|facebook|instagram|tiktok|x|whatsapp|linkedin|youtube|referral|internal";
  private final JdbcTemplate jdbc;
  private final AdminAccess access;

  AnalyticsController(JdbcTemplate jdbc, AdminAccess access) {
    this.jdbc = jdbc;
    this.access = access;
  }

  @PostMapping("/api/analytics/visits")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void recordVisit(@Valid @RequestBody VisitRequest request,
      @RequestHeader(value = "User-Agent", required = false) String userAgent,
      @RequestHeader(value = "Sec-CH-UA", required = false) String clientHints) {
    jdbc.update("INSERT INTO analytics_daily_visits (visit_date, browser, source_type, page_key, visit_count) " +
            "VALUES (CURRENT_DATE, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE visit_count = visit_count + 1",
        browserFamily(userAgent, clientHints, request.browser()), request.source(), request.pageKey());
  }

  @GetMapping("/api/admin/analytics/visits")
  AnalyticsSummary visits(@AuthenticationPrincipal Jwt jwt) {
    access.requireStaff(jwt);
    Long total = jdbc.queryForObject("SELECT COALESCE(SUM(visit_count), 0) FROM analytics_daily_visits " +
        "WHERE visit_date >= CURRENT_DATE - INTERVAL 29 DAY", Long.class);
    var daily = jdbc.query("SELECT visit_date, SUM(visit_count) AS visits FROM analytics_daily_visits " +
            "WHERE visit_date >= CURRENT_DATE - INTERVAL 29 DAY GROUP BY visit_date ORDER BY visit_date",
        (rs, row) -> new DailyCount(rs.getString("visit_date"), rs.getLong("visits")));
    var sources = breakdown("source_type", "source_type <> 'internal'");
    var browsers = breakdown("browser", "1 = 1");
    var pages = breakdown("page_key", "1 = 1");
    return new AnalyticsSummary(total == null ? 0 : total, daily, sources, browsers, pages);
  }

  private List<Count> breakdown(String column, String condition) {
    return jdbc.query("SELECT " + column + " AS item, SUM(visit_count) AS total FROM analytics_daily_visits " +
            "WHERE visit_date >= CURRENT_DATE - INTERVAL 29 DAY AND " + condition + " " +
            "GROUP BY " + column + " ORDER BY total DESC",
        (rs, row) -> new Count(rs.getString("item"), rs.getLong("total")));
  }

  private static String browserFamily(String userAgent, String clientHints, String browserHint) {
    if ("brave".equals(browserHint) || (clientHints != null && clientHints.toLowerCase().contains("brave"))) return "brave";
    if (userAgent == null || userAgent.isBlank()) return "other";
    var agent = userAgent.toLowerCase();
    if (agent.contains("edg/")) return "edge";
    if (agent.contains("opr/") || agent.contains("opera")) return "opera";
    if (agent.contains("firefox/")) return "firefox";
    if (agent.contains("chrome/") || agent.contains("crios/")) return "chrome";
    if (agent.contains("safari/")) return "safari";
    return "other";
  }

  record VisitRequest(
      @NotBlank(message = "La página es obligatoria") @Pattern(regexp = PAGE_KEY_PATTERN, message = "La página no tiene un formato válido") String pageKey,
      @NotBlank(message = "El origen de la visita es obligatorio") @Pattern(regexp = SOURCE_PATTERN, message = "El origen de la visita no tiene un formato válido") String source,
      @Pattern(regexp = "brave", message = "El navegador no tiene un formato válido") String browser) {}

  record Count(String key, long count) {}
  record DailyCount(String date, long count) {}
  record AnalyticsSummary(long totalVisits, List<DailyCount> dailyVisits, List<Count> sources,
      List<Count> browsers, List<Count> pages) {}
}
