package pe.edu.monkeytrueque.catalog;

import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
class CloudinaryImageStorage {
  private static final int MAX_IMAGE_BYTES = 10_000_000;
  private static final Logger LOGGER = LoggerFactory.getLogger(CloudinaryImageStorage.class);
  private final RestClient client;
  private final String cloudName;
  private final String apiKey;
  private final String apiSecret;

  CloudinaryImageStorage(RestClient.Builder builder,
      @Value("${cloudinary.cloud-name:}") String cloudName,
      @Value("${cloudinary.api-key:}") String apiKey,
      @Value("${cloudinary.api-secret:}") String apiSecret) {
    this.client = builder.build();
    this.cloudName = cloudName;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  StoredImage storeDataUrl(String dataUrl, String ownerId) {
    return storeDataUrlInFolder(dataUrl, "monkeytrueque/listings/" + ownerId);
  }

  StoredImage storeProfileDataUrl(String dataUrl, String userId) {
    return storeDataUrlInFolder(dataUrl, "monkeytrueque/profiles/" + userId);
  }

  private StoredImage storeDataUrlInFolder(String dataUrl, String folder) {
    ensureConfigured();
    int comma = dataUrl.indexOf(',');
    String mimeType = dataUrl.substring("data:".length(), dataUrl.indexOf(';'));
    byte[] bytes;
    try {
      bytes = Base64.getDecoder().decode(dataUrl.substring(comma + 1));
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La imagen no tiene un formato válido");
    }

    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "La imagen no puede superar los 10 MB.");
    }

    var image = new ByteArrayResource(bytes) {
      @Override public String getFilename() { return "listing-image"; }
    };
    var parts = new MultipartBodyBuilder();
    parts.part("file", image).contentType(MediaType.parseMediaType(mimeType));
    parts.part("public_id", folder + "/" + UUID.randomUUID());

    try {
      Map<String, Object> response = client.post()
          .uri("https://api.cloudinary.com/v1_1/{cloudName}/image/upload", cloudName)
          .headers(headers -> headers.setBasicAuth(apiKey, apiSecret))
          .contentType(MediaType.MULTIPART_FORM_DATA)
          .body(parts.build())
          .retrieve()
          .body(new ParameterizedTypeReference<>() {});
      if (response == null || !(response.get("secure_url") instanceof String url)
          || !(response.get("public_id") instanceof String publicId)) {
        throw new IllegalStateException("Cloudinary devolvió una respuesta incompleta");
      }
      return new StoredImage(url, publicId);
    } catch (RuntimeException exception) {
      LOGGER.warn("Falló la carga de imagen a Cloudinary: {}", exception.getMessage(), exception);
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
          "No se pudo guardar la foto en Cloudinary. Revisa las credenciales y vuelve a intentarlo.");
    }
  }

  void delete(String publicId) {
    if (publicId == null || publicId.isBlank()) return;
    ensureConfigured();
    var parts = new MultipartBodyBuilder();
    parts.part("public_id", publicId);
    parts.part("invalidate", "true");
    client.post()
        .uri("https://api.cloudinary.com/v1_1/{cloudName}/image/destroy", cloudName)
        .headers(headers -> headers.setBasicAuth(apiKey, apiSecret))
        .contentType(MediaType.MULTIPART_FORM_DATA)
        .body(parts.build())
        .retrieve()
        .toBodilessEntity();
  }

  boolean belongsToOwner(String url, String publicId, String ownerId) {
    if (ownerId == null || !isCloudinaryAsset(url, publicId)) return false;
    String ownerFolder = "monkeytrueque/listings/" + ownerId + "/";
    return publicId.startsWith(ownerFolder);
  }

  boolean isCloudinaryAsset(String url, String publicId) {
    if (url == null || publicId == null || publicId.isBlank()) return false;
    String cloudPrefix = cloudName.isBlank() ? "https://res.cloudinary.com/" : "https://res.cloudinary.com/" + cloudName + "/";
    return url.startsWith(cloudPrefix) && url.contains("/image/upload/") && url.contains("/" + publicId + ".");
  }

  private void ensureConfigured() {
    if (cloudName.isBlank() || apiKey.isBlank() || apiSecret.isBlank()) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
          "Configura Cloudinary en Spring antes de publicar fotos.");
    }
  }

  record StoredImage(String url, String publicId) {}
}
