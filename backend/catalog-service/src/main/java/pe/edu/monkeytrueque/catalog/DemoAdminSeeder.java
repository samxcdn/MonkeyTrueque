package pe.edu.monkeytrueque.catalog;

import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(1)
class DemoAdminSeeder implements ApplicationRunner {
  private final JdbcTemplate jdbc;
  private final PasswordEncoder passwords;
  private final boolean enabled;
  private final String username;
  private final String password;

  DemoAdminSeeder(JdbcTemplate jdbc, PasswordEncoder passwords,
      @Value("${app.demo-admin.enabled:false}") boolean enabled,
      @Value("${app.demo-admin.username:admin}") String username,
      @Value("${app.demo-admin.password:}") String password) {
    this.jdbc = jdbc;
    this.passwords = passwords;
    this.enabled = enabled;
    this.username = username.trim().toLowerCase(java.util.Locale.ROOT);
    this.password = password;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (!enabled || !username.matches("[a-z0-9._-]{3,32}") || password.length() < 8) return;
    Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM app_users", Integer.class);
    if (count == null || count != 0) return;

    String userId = UUID.randomUUID().toString();
    jdbc.update("INSERT INTO app_users (user_id, username, password_hash) VALUES (?, ?, ?)",
        userId, username, passwords.encode(password));
    jdbc.update("INSERT INTO user_profiles (user_id, display_name, member_since) VALUES (?, ?, CURRENT_TIMESTAMP(6))",
        userId, "Administrador MonkeyTrueque");
    jdbc.update("INSERT INTO moderation_staff (user_id, role, added_by) VALUES (?, 'admin', 'demo-seed')", userId);
  }
}
