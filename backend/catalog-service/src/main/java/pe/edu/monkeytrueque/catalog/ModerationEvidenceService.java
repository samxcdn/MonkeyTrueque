package pe.edu.monkeytrueque.catalog;

import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
class ModerationEvidenceService {
  private static final int MAX_FILES = 3;
  private static final int MAX_BYTES = 1_572_864;
  private static final Set<String> MEDIA_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
  private final JdbcTemplate jdbc;

  ModerationEvidenceService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  void save(String ownerType, String ownerId, List<EvidenceImage> images) {
    if (images == null || images.isEmpty()) return;
    if (!Set.of("report", "appeal").contains(ownerType) || images.size() > MAX_FILES) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Adjunta hasta 3 imágenes por solicitud.");
    }
    List<ValidatedImage> validated = images.stream().map(this::validate).toList();
    for (ValidatedImage image : validated) {
      jdbc.update("INSERT INTO moderation_evidence_attachments (id, owner_type, owner_id, file_name, media_type, content) VALUES (?, ?, ?, ?, ?, ?)",
          UUID.randomUUID().toString(), ownerType, ownerId, image.fileName(), image.mediaType(), image.content());
    }
  }

  List<EvidenceImageView> find(String ownerType, String ownerId) {
    return jdbc.query("SELECT id, file_name, media_type, content FROM moderation_evidence_attachments WHERE owner_type = ? AND owner_id = ? ORDER BY created_at, id",
        (rs, row) -> {
          String mediaType = rs.getString("media_type");
          String data = "data:" + mediaType + ";base64," + Base64.getEncoder().encodeToString(rs.getBytes("content"));
          return new EvidenceImageView(rs.getString("id"), rs.getString("file_name"), mediaType, data);
        }, ownerType, ownerId);
  }

  private ValidatedImage validate(EvidenceImage image) {
    if (image == null || image.data() == null || image.data().length() > 2_100_000) throw invalidImage();
    int comma = image.data().indexOf(',');
    if (!image.data().startsWith("data:") || comma < 0) throw invalidImage();
    String header = image.data().substring(5, comma);
    String mediaType = header.endsWith(";base64") ? header.substring(0, header.length() - 7) : "";
    if (!MEDIA_TYPES.contains(mediaType)) throw invalidImage();
    byte[] bytes;
    try { bytes = Base64.getDecoder().decode(image.data().substring(comma + 1)); }
    catch (IllegalArgumentException exception) { throw invalidImage(); }
    if (bytes.length == 0 || bytes.length > MAX_BYTES || !matchesSignature(mediaType, bytes)) throw invalidImage();
    String fileName = image.fileName() == null ? "prueba" : image.fileName().replaceAll("[\\\\/\\p{Cntrl}]", "_").trim();
    if (fileName.isBlank()) fileName = "prueba";
    if (fileName.length() > 160) fileName = fileName.substring(0, 160);
    return new ValidatedImage(fileName, mediaType, bytes);
  }

  private boolean matchesSignature(String mediaType, byte[] bytes) {
    if (mediaType.equals("image/jpeg")) return bytes.length >= 3 && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8 && (bytes[2] & 0xff) == 0xff;
    if (mediaType.equals("image/png")) return bytes.length >= 8 && (bytes[0] & 0xff) == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4e && bytes[3] == 0x47 && bytes[4] == 0x0d && bytes[5] == 0x0a && bytes[6] == 0x1a && bytes[7] == 0x0a;
    return mediaType.equals("image/webp") && bytes.length >= 12 && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F' && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P';
  }

  private ResponseStatusException invalidImage() {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cada prueba debe ser una imagen JPG, PNG o WebP válida de hasta 1.5 MB.");
  }

  record EvidenceImage(@NotBlank(message = "El nombre del archivo es obligatorio") @Size(max = 160, message = "El nombre del archivo no puede superar 160 caracteres") String fileName, @NotBlank(message = "El archivo es obligatorio") @Size(max = 2_100_000, message = "El archivo es demasiado grande") String data) {}
  record EvidenceImageView(String id, String fileName, String mediaType, String data) {}
  private record ValidatedImage(String fileName, String mediaType, byte[] content) {}
}
