package pe.edu.monkeytrueque.exchange;

import java.time.Instant;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/profiles")
class PublicReputationController {
  private final ExchangeRepository exchanges;

  PublicReputationController(ExchangeRepository exchanges) { this.exchanges = exchanges; }

  @GetMapping("/{userId}/reputation")
  ReputationView reputation(@PathVariable String userId) {
    List<ExchangeEntity> history = exchanges.findByOwnerIdOrProposerIdOrderByCreatedAtDesc(userId, userId);
    List<PublicReview> reviews = history.stream().flatMap(exchange -> {
      var received = new java.util.ArrayList<PublicReview>(2);
      if (exchange.proposerId.equals(userId) && exchange.ownerRating != null)
        received.add(new PublicReview(exchange.id, "owner", exchange.listingId, exchange.ownerRating, exchange.ownerReviewHidden ? null : exchange.ownerReview, exchange.listingTitle, exchange.createdAt, exchange.ownerReviewHidden));
      if (exchange.ownerId.equals(userId) && exchange.proposerRating != null)
        received.add(new PublicReview(exchange.id, "proposer", exchange.listingId, exchange.proposerRating, exchange.proposerReviewHidden ? null : exchange.proposerReview, exchange.listingTitle, exchange.createdAt, exchange.proposerReviewHidden));
      return received.stream();
    }).toList();
    long completed = history.stream().filter(exchange -> exchange.ownerConfirmed && exchange.proposerConfirmed).count();
    // Una reseña ocultada por moderación no debe influir en la reputación.
    List<PublicReview> counted = reviews.stream().filter(review -> !review.moderated()).toList();
    double average = counted.stream().mapToInt(PublicReview::rating).average().orElse(0);
    return new ReputationView(average, counted.size(), completed, reviews);
  }

  record PublicReview(String exchangeId, String participant, String listingId, int rating, String review, String listingTitle, Instant createdAt, boolean moderated) {}
  record ReputationView(double averageRating, int reviewCount, long completedCount, List<PublicReview> reviews) {}
}
