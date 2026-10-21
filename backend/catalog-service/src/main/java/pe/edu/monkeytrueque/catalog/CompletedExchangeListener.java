package pe.edu.monkeytrueque.catalog;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class CompletedExchangeListener {
  private static final Logger log = LoggerFactory.getLogger(CompletedExchangeListener.class);
  private final ListingRepository listings;

  CompletedExchangeListener(ListingRepository listings) { this.listings = listings; }

  @RabbitListener(queues = ExchangeEvents.QUEUE)
  @Transactional
  public void complete(String payload) {
    String[] ids = payload.split("\\|", -1);
    if (ids.length != 2) throw new IllegalArgumentException("Evento de intercambio inválido");
    UUID.fromString(ids[0]);
    UUID.fromString(ids[1]);
    var listing = listings.findById(ids[1]).orElseThrow(
        () -> new IllegalStateException("No existe la publicación del intercambio " + ids[0]));
    if (listing.available) {
      listing.available = false;
      listings.save(listing);
      log.info("Publicación {} cerrada por intercambio {}", ids[1], ids[0]);
    }
  }
}
