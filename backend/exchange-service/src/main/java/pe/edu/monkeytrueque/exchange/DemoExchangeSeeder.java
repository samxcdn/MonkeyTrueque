package pe.edu.monkeytrueque.exchange;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(1)
class DemoExchangeSeeder implements ApplicationRunner {
  private final JdbcTemplate jdbc;
  private final boolean enabled;

  DemoExchangeSeeder(JdbcTemplate jdbc, @Value("${app.demo-data.enabled:false}") boolean enabled) {
    this.jdbc = jdbc;
    this.enabled = enabled;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (!enabled) return;

    String exchangeId = id("exchange", "proposal-bike-lamp");
    Integer exists = jdbc.queryForObject("SELECT COUNT(*) FROM exchanges WHERE id = ?", Integer.class, exchangeId);
    if (exists != null && exists > 0) return;

    String listingId = id("listing", "lampara-escritorio-demo");
    String ownerId = id("user", "demo_vecina");
    String proposerId = id("user", "demo_usuario");
    String conversationId = id("conversation", "proposal-bike-lamp");
    jdbc.update("INSERT IGNORE INTO conversations (id, listing_id, listing_title, listing_mode, owner_id, owner_name, visitor_id, visitor_name, status, updated_at) "
        + "VALUES (?, ?, ?, 'trade', ?, 'Lucía Fernández', ?, 'Mateo Rojas', 'active', CURRENT_TIMESTAMP(6))",
        conversationId, listingId, "Lámpara de escritorio", ownerId, proposerId);
    jdbc.update("INSERT INTO direct_messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, ?)",
        id("message", "proposal-bike-lamp"), conversationId, proposerId,
        "Hola, me interesa la lámpara. Puedo ofrecer un ajuste básico de bicicleta.");
    jdbc.update("INSERT INTO exchanges (id, conversation_id, listing_id, listing_title, owner_id, proposer_id, offered_title, offered_kind, note, status) "
        + "VALUES (?, ?, ?, ?, ?, ?, ?, 'service', ?, 'proposal-sent')",
        exchangeId, conversationId, listingId, "Lámpara de escritorio", ownerId, proposerId,
        "Ajuste básico de bicicleta", "Puedo revisar frenos y cambios. ¿Te interesa coordinar un encuentro?");
  }

  private static String id(String type, String key) {
    return UUID.nameUUIDFromBytes(("monkeytrueque-demo:" + type + ":" + key).getBytes(StandardCharsets.UTF_8)).toString();
  }
}
