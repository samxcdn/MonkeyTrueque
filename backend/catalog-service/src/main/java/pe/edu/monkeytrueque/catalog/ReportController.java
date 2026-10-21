package pe.edu.monkeytrueque.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/reports")
class ReportController {
  private static final Set<String> REASONS = Set.of("condition", "wrong-category", "suspicious", "inappropriate", "scam", "harassment", "false-listing", "other");
  private static final Set<String> TARGET_TYPES = Set.of("listing", "user", "message", "review");
  private final ReportRepository reports;
  private final ListingRepository listings;
  private final UserProfileRepository profiles;
  private final ObjectMapper mapper;
  private final ModerationEvidenceService evidence;

  @Autowired
  ReportController(ReportRepository reports, ListingRepository listings, UserProfileRepository profiles, ObjectMapper mapper, ModerationEvidenceService evidence) {
    this.reports = reports;
    this.listings = listings;
    this.profiles = profiles;
    this.mapper = mapper;
    this.evidence = evidence;
  }

  ReportController(ReportRepository reports, ListingRepository listings, UserProfileRepository profiles, ObjectMapper mapper) {
    this(reports, listings, profiles, mapper, null);
  }

  ReportController(ReportRepository reports, ListingRepository listings) {
    this(reports, listings, null, new ObjectMapper());
  }

  @PostMapping
  @Transactional
  ResponseEntity<Void> create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody NewReport request) {
    if (!REASONS.contains(request.reason())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Motivo de reporte no válido");
    String type = request.targetType() == null || request.targetType().isBlank() ? "listing" : request.targetType();
    String targetId = request.targetId() == null || request.targetId().isBlank() ? request.listingId() : request.targetId();
    if (!TARGET_TYPES.contains(type)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Elemento reportado no válido");
    if (type.equals("listing") && (targetId == null || !listings.existsById(targetId))) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Publicación no encontrada");
    }
    if (type.equals("listing") && listings.findById(targetId).map(listing -> jwt.getSubject().equals(listing.ownerId)).orElse(false)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No puedes reportar tu propia publicación");
    }
    if (type.equals("user") && (targetId == null || targetId.equals(jwt.getSubject()))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No puedes reportar tu propia cuenta");
    }
    if ((type.equals("message") || type.equals("review")) && (targetId == null || targetId.isBlank())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica qué quieres reportar");
    }
    var report = new ReportEntity();
    report.id = UUID.randomUUID().toString();
    report.reporterId = jwt.getSubject();
    report.targetType = type;
    report.targetId = targetId;
    report.listingId = type.equals("listing") ? targetId : request.listingId();
    report.reason = request.reason();
    report.details = request.details() == null ? "" : request.details().trim();
    report.evidenceSnapshot = captureEvidence(report, request.evidence());
    reports.save(report);
    if (evidence != null) evidence.save("report", report.id, request.attachments());
    return ResponseEntity.noContent().build();
  }

  private String captureEvidence(ReportEntity report, String reporterEvidence) {
    try {
      Map<String, Object> snapshot = new LinkedHashMap<>();
      snapshot.put("targetType", report.targetType);
      snapshot.put("targetId", report.targetId);
      snapshot.put("capturedAt", Instant.now().toString());
      if (report.listingId != null) listings.findById(report.listingId).ifPresent(listing -> {
        snapshot.put("listingId", listing.id);
        snapshot.put("title", listing.title);
        snapshot.put("description", listing.description);
        snapshot.put("ownerId", listing.ownerId);
        snapshot.put("ownerName", listing.ownerName);
        snapshot.put("mode", listing.mode);
        snapshot.put("photosJson", listing.photosJson);
      });
      if ("user".equals(report.targetType) && profiles != null) profiles.findById(report.targetId).ifPresent(profile -> {
        snapshot.put("displayName", profile.displayName);
        snapshot.put("imageUrl", profile.imageUrl);
        snapshot.put("memberSince", profile.memberSince);
      });
      if (reporterEvidence != null && !reporterEvidence.isBlank()) snapshot.put("reporterEvidence", reporterEvidence.trim());
      return mapper.writeValueAsString(snapshot);
    } catch (JacksonException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No se pudo guardar la evidencia del reporte");
    }
  }

  record NewReport(String listingId, String targetType, String targetId, @NotBlank(message = "El motivo es obligatorio") String reason,
      @Size(max = 1000, message = "El detalle no puede superar 1.000 caracteres") String details, @Size(max = 2000, message = "La evidencia no puede superar 2.000 caracteres") String evidence,
      @Valid @Size(max = 3, message = "Puedes adjuntar hasta 3 imágenes") List<ModerationEvidenceService.EvidenceImage> attachments) {
    NewReport(String listingId, String targetType, String targetId, String reason, String details, String evidence) { this(listingId, targetType, targetId, reason, details, evidence, null); }
    NewReport(String listingId, String reason, String details) { this(listingId, null, null, reason, details, null, null); }
  }

  record ReportView(String id, String reporterId, String listingId, String reason, String details,
      String status, String resolution, String reviewedBy, Instant createdAt, Instant reviewedAt,
      String targetType, String targetId, String priority, String assignedTo, String evidenceSnapshot, String userResponse) {
    static ReportView from(ReportEntity report) {
      return new ReportView(report.id, report.reporterId, report.listingId, report.reason, report.details,
          report.status, report.resolution, report.reviewedBy, report.createdAt, report.reviewedAt,
          report.targetType, report.targetId, report.priority, report.assignedTo, report.evidenceSnapshot, report.userResponse);
    }
  }
}
