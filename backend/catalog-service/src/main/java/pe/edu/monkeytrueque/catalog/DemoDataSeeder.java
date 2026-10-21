package pe.edu.monkeytrueque.catalog;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Component
@Order(2)
class DemoDataSeeder implements ApplicationRunner {
  private static final String DEMO_MODERATOR = "demo_moderador";
  private static final String DEMO_USER = "demo_usuario";
  private static final String DEMO_NEIGHBOR = "demo_vecina";
  private final JdbcTemplate jdbc;
  private final PasswordEncoder passwords;
  private final ObjectMapper mapper;
  private final boolean enabled;

  DemoDataSeeder(JdbcTemplate jdbc, PasswordEncoder passwords, ObjectMapper mapper,
      @Value("${app.demo-data.enabled:false}") boolean enabled) {
    this.jdbc = jdbc;
    this.passwords = passwords;
    this.mapper = mapper;
    this.enabled = enabled;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (!enabled) return;

    String moderatorId = ensureUser(DEMO_MODERATOR, "Moderador123*", "Valeria Torres", "moderator");
    String userId = ensureUser(DEMO_USER, "Usuario123*", "Mateo Rojas", null);
    String neighborId = ensureUser(DEMO_NEIGHBOR, "Vecina123*", "Lucía Fernández", null);

    List<DemoListing> demoListings = List.of(
        new DemoListing("mochila-escolar-demo", neighborId, "Lucía Fernández", "Mochila escolar en buen estado",
            "Mochila amplia, limpia y con cierres funcionando. Ideal para el inicio de clases.", "object", "trade", null,
            "school", "Buen estado", "surquillo", "Útiles escolares o libros", "object", false, null,
            "https://images.unsplash.com/photo-1588072432837-0e9495d22363?auto=format&fit=crop&w=900&q=85",
            "Mochila escolar floreada, foto de demostración"),
        new DemoListing("lampara-escritorio-demo", neighborId, "Lucía Fernández", "Lámpara de escritorio",
            "Lámpara articulada y funcional. Tiene marcas leves de uso en la base.", "object", "sale", "35.00",
            "home", "Funciona con marcas de uso", "miraflores", "Organizador de escritorio", "object,service", false, null,
            "https://images.unsplash.com/photo-1713879429592-bd55b09d8015?auto=format&fit=crop&w=900&q=85",
            "Lámpara de escritorio sobre una mesa"),
        new DemoListing("bicicleta-urbana-demo", userId, "Mateo Rojas", "Bicicleta urbana rodado 26",
            "Cambios funcionales y frenos revisados. Tiene un rasguño pequeño en el cuadro.", "object", "trade", null,
            "mobility", "Funciona con marcas de uso", "barranco", "Mantenimiento de laptop o casco urbano", "object,service", false, null,
            "https://images.unsplash.com/photo-1693438129189-cb04cc0d153d?auto=format&fit=crop&w=900&q=85",
            "Bicicleta urbana de perfil en un patio"),
        new DemoListing("libros-diseno-demo", userId, "Mateo Rojas", "Libros de diseño y fotografía",
            "Tres libros en buen estado; uno tiene algunas anotaciones a lápiz.", "object", "trade", null,
            "books", "Buen estado", "pueblo-libre", "Maceta mediana o clases de dibujo", "object,service", false, null,
            "https://images.unsplash.com/photo-1700426833922-94e0de183ddb?auto=format&fit=crop&w=900&q=85",
            "Libros apilados sobre un escritorio"),
        new DemoListing("ventilador-oculto-demo", userId, "Mateo Rojas", "Ventilador compacto de mesa",
            "Ventilador de tres velocidades; publicación de demostración para mostrar una medida de moderación.", "object", "trade", null,
            "home", "Funciona con marcas de uso", "surquillo", "Libros de poesía", "object", true,
            "La publicación no indica el estado real del producto. Agrega fotos y describe sus marcas de uso.",
            "https://images.unsplash.com/photo-1682562837524-16133e2e8cf3?auto=format&fit=crop&w=900&q=85",
            "Ventilador doméstico de mesa"));

    demoListings.forEach(this::ensureListing);
    ensureExampleReport(userId, id("listing", "lampara-escritorio-demo"));
    ensureModeratorAccount(moderatorId);
  }

  private String ensureUser(String username, String password, String displayName, String staffRole) {
    List<String> existing = jdbc.query("SELECT user_id FROM app_users WHERE username = ?",
        (rs, row) -> rs.getString(1), username);
    if (!existing.isEmpty()) return existing.getFirst();

    String userId = id("user", username);
    jdbc.update("INSERT INTO app_users (user_id, username, password_hash) VALUES (?, ?, ?)",
        userId, username, passwords.encode(password));
    jdbc.update("INSERT INTO user_profiles (user_id, display_name, member_since) VALUES (?, ?, CURRENT_TIMESTAMP(6))",
        userId, displayName);
    if (staffRole != null) {
      jdbc.update("INSERT INTO moderation_staff (user_id, role, added_by) VALUES (?, ?, 'demo-seed')",
          userId, staffRole);
    }
    return userId;
  }

  private void ensureModeratorAccount(String moderatorId) {
    jdbc.update("INSERT IGNORE INTO moderation_staff (user_id, role, added_by) VALUES (?, 'moderator', 'demo-seed')", moderatorId);
  }

  private void ensureListing(DemoListing listing) {
    if (Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM listings WHERE id = ?)", Boolean.class,
        id("listing", listing.key())))) return;
    String photos;
    try {
      photos = mapper.writeValueAsString(List.of(new ListingController.Photo(listing.photoUrl(), listing.photoAlt(), "Foto de demostración", null)));
    } catch (JacksonException ex) {
      throw new IllegalStateException("No se pudieron preparar las fotos de demostración", ex);
    }
    jdbc.update("INSERT INTO listings (id, owner_id, owner_name, title, description, kind, listing_mode, sale_price, category, item_condition, district_id, acceptance_summary, accepts, photos_json, available, moderation_hidden, moderation_hidden_reason) "
        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)",
        id("listing", listing.key()), listing.ownerId(), listing.ownerName(), listing.title(), listing.description(),
        listing.kind(), listing.mode(), listing.price(), listing.category(), listing.condition(), listing.districtId(),
        listing.acceptanceSummary(), listing.accepts(), photos, listing.hidden(), listing.hiddenReason());
  }

  private void ensureExampleReport(String reporterId, String listingId) {
    String reportId = id("report", "wrong-category-demo");
    if (Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM reports WHERE id = ?)", Boolean.class, reportId))) return;
    String evidence = "{\"targetType\":\"listing\",\"targetId\":\"" + listingId + "\",\"title\":\"Lámpara de escritorio\",\"description\":\"Publicación de demostración\"}";
    jdbc.update("INSERT INTO reports (id, reporter_id, listing_id, target_type, target_id, reason, details, status, priority, evidence_snapshot) "
        + "VALUES (?, ?, ?, 'listing', ?, 'wrong-category', ?, 'open', 'normal', ?)",
        reportId, reporterId, listingId, listingId,
        "Ejemplo de reporte para probar la revisión de publicaciones.", evidence);
  }

  static String id(String type, String key) {
    return UUID.nameUUIDFromBytes(("monkeytrueque-demo:" + type + ":" + key).getBytes(StandardCharsets.UTF_8)).toString();
  }

  private record DemoListing(String key, String ownerId, String ownerName, String title, String description,
      String kind, String mode, String price, String category, String condition, String districtId,
      String acceptanceSummary, String accepts, boolean hidden, String hiddenReason, String photoUrl, String photoAlt) {}
}
