package pe.edu.monkeytrueque.catalog;

import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.math.BigDecimal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/listings")
class ListingController {
  private static final int MAX_IMAGE_BASE64_CHARS = 13_400_000;
  private static final Logger LOGGER = LoggerFactory.getLogger(ListingController.class);
  private static final Set<String> KINDS = Set.of("object", "service");
  private static final Set<String> MODES = Set.of("trade", "sale", "gift");
  private static final Set<String> CATEGORIES = Set.of(
      "electronics", "clothing", "home", "beauty", "babies", "sports", "toys", "school",
      "books", "food", "other", "mobility", "decor", "services");
  private static final Set<String> DISTRICTS = Set.of(
      "ancon", "ate", "barranco", "brena", "carabayllo", "chaclacayo", "chorrillos", "cieneguilla",
      "comas", "el-agustino", "independencia", "jesus-maria", "la-molina", "la-victoria", "lima", "lince",
      "los-olivos", "lurigancho", "lurin", "magdalena-del-mar", "miraflores", "pachacamac", "pucusana",
      "pueblo-libre", "puente-piedra", "punta-hermosa", "punta-negra", "rimac", "san-bartolo", "san-borja",
      "san-isidro", "san-juan-de-lurigancho", "san-juan-de-miraflores", "san-luis", "san-martin-de-porres",
      "san-miguel", "santa-anita", "santa-maria-del-mar", "santa-rosa", "santiago-de-surco", "surquillo",
      "villa-el-salvador", "villa-maria-del-triunfo");
  private final ListingRepository repository;
  private final UserProfileRepository profiles;
  private final ObjectMapper mapper;
  private final CloudinaryImageStorage imageStorage;
  private final ModerationSanctionService sanctions;
  private final ExchangeActivity exchangeActivity;

  ListingController(ListingRepository repository, UserProfileRepository profiles, ObjectMapper mapper, CloudinaryImageStorage imageStorage,
      ModerationSanctionService sanctions, ExchangeActivity exchangeActivity) {
    this.repository = repository;
    this.profiles = profiles;
    this.mapper = mapper;
    this.imageStorage = imageStorage;
    this.sanctions = sanctions;
    this.exchangeActivity = exchangeActivity;
  }

  @GetMapping
  List<ListingView> all() {
    return repository.findPublicListings().stream().map(this::view).toList();
  }

  @GetMapping("/mine")
  List<ListingView> mine(@AuthenticationPrincipal Jwt jwt) {
    return repository.findByOwnerIdOrderByCreatedAtDesc(jwt.getSubject()).stream().map(this::view).toList();
  }

  @PutMapping("/mine/profile-image")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void syncProfileImage(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody OwnerImageUpdate request) {
    var listings = repository.findByOwnerIdOrderByCreatedAtDesc(jwt.getSubject());
    listings.forEach(listing -> listing.ownerImageUrl = request.imageUrl());
    repository.saveAll(listings);
  }

  @GetMapping("/{id}")
  ListingView one(@PathVariable String id) {
    var listing = repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    if (!listing.available || listing.moderationHidden || repository.countDeactivatedOwner(listing.ownerId) > 0) {
      throw new ResponseStatusException(HttpStatus.GONE, "La publicación ya no está disponible");
    }
    return view(listing);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  ListingView create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody NewListing request) {
    sanctions.requireAllowed(jwt.getSubject(), "publishing");
    String mode = request.mode() == null ? "trade" : request.mode();
    if (!MODES.contains(mode) || !KINDS.contains(request.kind()) || !CATEGORIES.contains(request.category()) || !DISTRICTS.contains(request.districtId())
        || (mode.equals("trade") && (request.accepts() == null || request.accepts().isEmpty() || request.accepts().stream().anyMatch(kind -> !KINDS.contains(kind))))
        || (mode.equals("trade") && (request.acceptanceSummary() == null || request.acceptanceSummary().isBlank()))
        || (mode.equals("sale") && invalidRequiredPrice(request.price()))
        || (mode.equals("trade") && request.price() != null && request.price().signum() <= 0)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Categoría, distrito o tipo de trueque no válido");
    }
    if (request.photos() == null || request.photos().isEmpty() || request.photos().size() > 3) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Agrega entre una y tres fotos");
    }
    if (request.photos() != null && request.photos().stream().anyMatch(photo ->
        !photo.src().matches("^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$")
        || photo.src().length() > MAX_IMAGE_BASE64_CHARS)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Las fotos deben ser JPG, PNG o WebP de hasta 10 MB");
    }
    var listing = new ListingEntity();
    listing.id = UUID.randomUUID().toString();
    listing.ownerId = jwt.getSubject();
    applyOwnerProfile(listing, jwt);
    listing.title = request.title().trim();
    listing.description = request.description().trim();
    listing.kind = request.kind();
    listing.mode = mode;
    listing.price = mode.equals("gift") ? null : request.price();
    listing.category = request.category();
    listing.condition = request.condition();
    listing.districtId = request.districtId();
    listing.locationReference = cleanLocationReference(request.locationReference());
    listing.acceptanceSummary = mode.equals("trade") ? request.acceptanceSummary().trim() : "";
    listing.accepts = mode.equals("trade") ? String.join(",", request.accepts().stream().distinct().toList()) : "";
    List<CloudinaryImageStorage.StoredImage> uploaded = new java.util.ArrayList<>();
    try {
      List<Photo> storedPhotos = new java.util.ArrayList<>();
      for (Photo photo : request.photos()) {
        var stored = imageStorage.storeDataUrl(photo.src(), listing.ownerId);
        uploaded.add(stored);
        storedPhotos.add(new Photo(stored.url(), photo.alt(), photo.credit(), stored.publicId()));
      }
      listing.photosJson = mapper.writeValueAsString(storedPhotos);
      if (listing.photosJson.length() > 500_000) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Fotos demasiado grandes");
      return view(repository.save(listing));
    } catch (JacksonException ex) {
      cleanupUploadedImages(uploaded);
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fotos no válidas");
    } catch (RuntimeException ex) {
      cleanupUploadedImages(uploaded);
      if (ex instanceof ResponseStatusException responseStatusException) throw responseStatusException;
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "No se pudo crear la publicacion");
    }
  }

  private void cleanupUploadedImages(List<CloudinaryImageStorage.StoredImage> uploaded) {
    uploaded.forEach(image -> {
      try { imageStorage.delete(image.publicId()); }
      catch (RuntimeException ex) { LOGGER.warn("No se pudo retirar una foto subida sin publicacion asociada"); }
    });
  }

  @PutMapping("/{id}")
  ListingView update(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @Valid @RequestBody NewListing request) {
    sanctions.requireAllowed(jwt.getSubject(), "publishing");
    var listing = repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    if (!listing.ownerId.equals(jwt.getSubject())) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    if (!listing.available || listing.moderationHidden) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Esta publicación ya no se puede editar");
    }
    String mode = request.mode() == null ? "trade" : request.mode();
    if (!MODES.contains(mode) || !KINDS.contains(request.kind()) || !CATEGORIES.contains(request.category()) || !DISTRICTS.contains(request.districtId())
        || (mode.equals("trade") && (request.accepts() == null || request.accepts().isEmpty() || request.accepts().stream().anyMatch(kind -> !KINDS.contains(kind))))
        || (mode.equals("trade") && (request.acceptanceSummary() == null || request.acceptanceSummary().isBlank()))
        || (mode.equals("sale") && invalidRequiredPrice(request.price()))
        || (mode.equals("trade") && request.price() != null && request.price().signum() <= 0)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Categoría, distrito o tipo de publicación no válido");
    }
    if (request.photos() == null || request.photos().isEmpty() || request.photos().size() > 3) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Agrega entre una y tres fotos");
    }
    if (changesTheDeal(listing, request, mode) && exchangeActivity.activeDeals(listing.id, jwt) > 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "Tienes propuestas o acuerdos en curso para esta publicación. Solo puedes corregir la descripción, el estado, las fotos o la referencia hasta que los respondas o canceles.");
    }

    List<Photo> previousPhotos;
    try { previousPhotos = mapper.readValue(listing.photosJson, new TypeReference<>() {}); }
    catch (JacksonException ex) { throw new IllegalStateException("Fotos guardadas no válidas", ex); }
    List<Photo> updatedPhotos = new java.util.ArrayList<>();
    List<String> uploadedIds = new java.util.ArrayList<>();
    ListingEntity saved;
    try {
      for (Photo photo : request.photos()) {
        boolean alreadyAttached = previousPhotos.stream().anyMatch(previous ->
            java.util.Objects.equals(previous.src(), photo.src()) && java.util.Objects.equals(previous.publicId(), photo.publicId()));
        if (alreadyAttached || imageStorage.belongsToOwner(photo.src(), photo.publicId(), listing.ownerId)) {
          updatedPhotos.add(photo);
        } else {
          if (photo.src() == null || !photo.src().matches("^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$") || photo.src().length() > MAX_IMAGE_BASE64_CHARS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La foto debe ser la imagen actual o una JPG, PNG o WebP de hasta 10 MB");
          }
          var stored = imageStorage.storeDataUrl(photo.src(), listing.ownerId);
          uploadedIds.add(stored.publicId());
          updatedPhotos.add(new Photo(stored.url(), photo.alt(), photo.credit(), stored.publicId()));
        }
      }
      applyOwnerProfile(listing, jwt);
      listing.title = request.title().trim();
      listing.description = request.description().trim();
      listing.kind = request.kind();
      listing.mode = mode;
      listing.price = mode.equals("gift") ? null : request.price();
      listing.category = request.category();
      listing.condition = request.condition();
      listing.districtId = request.districtId();
      listing.locationReference = cleanLocationReference(request.locationReference());
      listing.acceptanceSummary = mode.equals("trade") ? request.acceptanceSummary().trim() : "";
      listing.accepts = mode.equals("trade") ? String.join(",", request.accepts().stream().distinct().toList()) : "";
      listing.photosJson = mapper.writeValueAsString(updatedPhotos);
      if (listing.photosJson.length() > 500_000) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Fotos demasiado grandes");
      saved = repository.save(listing);
    } catch (RuntimeException ex) {
      uploadedIds.forEach(imageStorage::delete);
      if (ex instanceof ResponseStatusException responseStatusException) throw responseStatusException;
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "No se pudo actualizar la publicación");
    }
    var retainedIds = updatedPhotos.stream().map(Photo::publicId).filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.toSet());
    previousPhotos.stream().filter(photo -> imageStorage.isCloudinaryAsset(photo.src(), photo.publicId()))
        .map(Photo::publicId).filter(publicId -> !retainedIds.contains(publicId)).forEach(publicId -> {
          try { imageStorage.delete(publicId); }
          catch (RuntimeException ex) { LOGGER.warn("No se pudo retirar una foto reemplazada de Cloudinary"); }
        });
    return view(saved);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    var listing = repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    if (!listing.ownerId.equals(jwt.getSubject())) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    if (exchangeActivity.activeDeals(listing.id, jwt) > 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "No puedes eliminar una publicación con propuestas o acuerdos en curso. Respóndelos o cancélalos primero.");
    }
    try {
      List<Photo> photos = mapper.readValue(listing.photosJson, new TypeReference<>() {});
      photos.stream().filter(photo -> imageStorage.isCloudinaryAsset(photo.src(), photo.publicId()))
          .forEach(photo -> imageStorage.delete(photo.publicId()));
    } catch (JacksonException ex) {
      throw new IllegalStateException("Fotos guardadas no válidas", ex);
    }
    repository.delete(listing);
  }

  private ListingView view(ListingEntity listing) {
    try {
      List<Photo> photos = mapper.readValue(listing.photosJson, new TypeReference<>() {});
    return new ListingView(listing.id, listing.ownerId, listing.ownerName, listing.ownerImageUrl, listing.title, listing.description,
          listing.kind, listing.mode, listing.price, listing.category, listing.condition, listing.districtId, listing.locationReference, 0, photos,
          listing.accepts.isBlank() ? List.of() : List.of(listing.accepts.split(",")), listing.acceptanceSummary, listing.available, listing.moderationHidden,
          listing.moderationHiddenReason);
    } catch (JacksonException ex) {
      throw new IllegalStateException("Fotos guardadas no válidas", ex);
    }
  }

  private void applyOwnerProfile(ListingEntity listing, Jwt jwt) {
    var profile = profiles.findById(jwt.getSubject());
    listing.ownerName = profile.map(value -> value.displayName)
        .filter(name -> name != null && !name.isBlank())
        .orElseGet(() -> {
          String tokenName = jwt.getClaimAsString("name");
          return tokenName == null || tokenName.isBlank() ? "Usuario de MonkeyTrueque" : tokenName.trim();
        });
    listing.ownerImageUrl = profile.map(value -> value.imageUrl).orElse(null);
  }

  /** Lo que la otra persona aceptó: qué se entrega, en qué modalidad y por cuánto. */
  private static boolean changesTheDeal(ListingEntity listing, NewListing request, String mode) {
    String accepts = mode.equals("trade") ? String.join(",", request.accepts().stream().distinct().toList()) : "";
    BigDecimal price = mode.equals("gift") ? null : request.price();
    return !java.util.Objects.equals(listing.title, request.title().trim()) || !java.util.Objects.equals(listing.mode, mode)
        || !java.util.Objects.equals(listing.kind, request.kind()) || !java.util.Objects.equals(listing.accepts, accepts)
        || !samePrice(listing.price, price);
  }

  private static boolean samePrice(BigDecimal first, BigDecimal second) {
    return first == null ? second == null : second != null && first.compareTo(second) == 0;
  }

  private boolean invalidRequiredPrice(java.math.BigDecimal price) {
    return price == null || price.signum() <= 0;
  }

  private String cleanLocationReference(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  record Photo(@NotBlank(message = "La foto es obligatoria") String src, @NotBlank(message = "La descripción de la foto es obligatoria") String alt, String credit, String publicId) {
    Photo(String src, String alt, String credit) { this(src, alt, credit, null); }
  }
  record OwnerImageUpdate(@NotBlank(message = "La URL de la imagen es obligatoria") @Size(max = 1000, message = "La URL de la imagen no puede superar 1.000 caracteres") String imageUrl) {}
  record NewListing(@NotBlank(message = "El título es obligatorio") @Size(max = 120, message = "El título no puede superar 120 caracteres") String title,
      @NotBlank(message = "La descripción es obligatoria") @Size(max = 2000, message = "La descripción no puede superar 2.000 caracteres") String description,
      @NotBlank(message = "El tipo de publicación es obligatorio") String kind, String mode, BigDecimal price, @NotBlank(message = "La categoría es obligatoria") String category, @NotBlank(message = "El estado del artículo es obligatorio") String condition,
      @NotBlank(message = "El distrito es obligatorio") String districtId, @Size(max = 160, message = "La referencia de ubicación no puede superar 160 caracteres") String locationReference, @Size(max = 300, message = "Lo que aceptas a cambio no puede superar 300 caracteres") String acceptanceSummary,
      List<String> accepts, List<@Valid Photo> photos) {}
  record ListingView(String id, String ownerId, String ownerName, String ownerImageUrl, String title, String description,
      String kind, String mode, BigDecimal price, String category, String condition, String districtId, String locationReference, double distanceKm,
      List<Photo> photos, List<String> accepts, String acceptanceSummary,
      boolean available, boolean moderationHidden, String moderationHiddenReason) {}
}
