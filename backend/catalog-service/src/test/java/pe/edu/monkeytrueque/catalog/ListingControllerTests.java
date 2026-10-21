package pe.edu.monkeytrueque.catalog;

import java.util.List;
import java.util.Optional;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ListingControllerTests {
  private final ListingRepository repository = mock(ListingRepository.class);
  private final UserProfileRepository profiles = mock(UserProfileRepository.class);
  private final CloudinaryImageStorage imageStorage = mock(CloudinaryImageStorage.class);
  private final ModerationSanctionService sanctions = mock(ModerationSanctionService.class);
  private final ExchangeActivity exchangeActivity = mock(ExchangeActivity.class);
  private final ListingController controller = new ListingController(repository, profiles, new ObjectMapper(), imageStorage, sanctions, exchangeActivity);

  @Test
  void createsListingForJwtSubjectAndRejectsInvalidPhotos() {
    when(repository.save(any(ListingEntity.class))).thenAnswer(call -> call.getArgument(0));
    var profile = new UserProfileEntity();
    profile.displayName = "Nombre del perfil";
    profile.imageUrl = "https://images.example/profile.png";
    when(profiles.findById("user_ana")).thenReturn(Optional.of(profile));
    when(imageStorage.storeDataUrl("data:image/png;base64,AAAA", "user_ana"))
        .thenReturn(new CloudinaryImageStorage.StoredImage("https://images.example/listing.png", "monkeytrueque/listings/photo-1"));
    var request = new ListingController.NewListing("Bicicleta", "En buen estado", "object", "trade", new BigDecimal("75.00"), "mobility",
        "Buen estado", "surquillo", null, "Libros", List.of("object"),
        List.of(new ListingController.Photo("data:image/png;base64,AAAA", "Bicicleta", "")));
    var listing = controller.create(jwt("user_ana"), request);
    assertEquals("user_ana", listing.ownerId());
    assertEquals("Nombre del perfil", listing.ownerName());
    assertEquals("https://images.example/profile.png", listing.ownerImageUrl());
    assertEquals("Bicicleta", listing.title());
    assertEquals(new BigDecimal("75.00"), listing.price());
    assertTrue(listing.photos().getFirst().src().startsWith("https://"));
    assertEquals("monkeytrueque/listings/photo-1", listing.photos().getFirst().publicId());
    verify(imageStorage).storeDataUrl("data:image/png;base64,AAAA", "user_ana");
    var invalid = new ListingController.NewListing("Bicicleta", "En buen estado", "object", "trade", null, "mobility",
        "Buen estado", "surquillo", null, "Libros", List.of("object"),
        List.of(new ListingController.Photo("javascript:alert(1)", "Bicicleta", "")));
    assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class,
        () -> controller.create(jwt("user_ana"), invalid)).getStatusCode());
  }

  @Test
  void removesUploadedImagesWhenSavingTheListingFails() {
    when(imageStorage.storeDataUrl("data:image/png;base64,AAAA", "user_ana"))
        .thenReturn(new CloudinaryImageStorage.StoredImage("https://images.example/listing.png", "photo-1"));
    when(repository.save(any(ListingEntity.class))).thenThrow(new IllegalStateException("database unavailable"));
    var request = new ListingController.NewListing("Bicicleta", "En buen estado", "object", "trade", new BigDecimal("75.00"), "mobility",
        "Buen estado", "surquillo", null, "Libros", List.of("object"),
        List.of(new ListingController.Photo("data:image/png;base64,AAAA", "Bicicleta", "")));

    var error = assertThrows(ResponseStatusException.class, () -> controller.create(jwt("user_ana"), request));

    assertEquals(HttpStatus.BAD_GATEWAY, error.getStatusCode());
    verify(imageStorage).delete("photo-1");
  }

  @Test
  void onlyOwnerCanDelete() {
    var listing = new ListingEntity();
    listing.id = "listing-1";
    listing.ownerId = "user_ana";
    listing.photosJson = "[]";
    when(repository.findById("listing-1")).thenReturn(Optional.of(listing));
    assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
        () -> controller.delete(jwt("user_beto"), "listing-1")).getStatusCode());
    verify(repository, never()).delete(any());
    controller.delete(jwt("user_ana"), "listing-1");
    verify(repository).delete(listing);
  }

  @Test
  void ownerCanUpdateListingWhileKeepingItsCloudinaryPhoto() {
    var listing = new ListingEntity();
    listing.id = "listing-1";
    listing.ownerId = "user_ana";
    listing.photosJson = "[{\"src\":\"https://res.cloudinary.com/demo/image/upload/v1/monkeytrueque/listings/user_ana/photo.jpg\",\"alt\":\"Foto\",\"credit\":\"\",\"publicId\":\"monkeytrueque/listings/user_ana/photo\"}]";
    when(repository.findById("listing-1")).thenReturn(Optional.of(listing));
    when(repository.save(any(ListingEntity.class))).thenAnswer(call -> call.getArgument(0));
    String url = "https://res.cloudinary.com/demo/image/upload/v1/monkeytrueque/listings/user_ana/photo.jpg";
    String publicId = "monkeytrueque/listings/user_ana/photo";
    when(imageStorage.belongsToOwner(url, publicId, "user_ana")).thenReturn(true);
    var request = new ListingController.NewListing("Bicicleta renovada", "En buen estado y lista para usar", "object", "trade", null,
        "mobility", "Buen estado", "surquillo", null, "Libros", List.of("object"),
        List.of(new ListingController.Photo(url, "Foto", "", publicId)));

    var updated = controller.update(jwt("user_ana"), "listing-1", request);

    assertEquals("Bicicleta renovada", updated.title());
    assertEquals(url, updated.photos().getFirst().src());
    verify(repository).save(listing);
    verify(imageStorage, never()).delete(anyString());
  }

  @Test
  void deletingListingAlsoDeletesItsCloudinaryPhoto() {
    var listing = new ListingEntity();
    listing.id = "listing-1";
    listing.ownerId = "user_ana";
    String url = "https://res.cloudinary.com/demo/image/upload/v1/monkeytrueque/listings/user_ana/photo.jpg";
    String publicId = "monkeytrueque/listings/user_ana/photo";
    listing.photosJson = "[{\"src\":\"" + url + "\",\"alt\":\"Foto\",\"credit\":\"\",\"publicId\":\"" + publicId + "\"}]";
    when(repository.findById("listing-1")).thenReturn(Optional.of(listing));
    when(imageStorage.isCloudinaryAsset(url, publicId)).thenReturn(true);

    controller.delete(jwt("user_ana"), "listing-1");

    verify(imageStorage).delete(publicId);
    verify(repository).delete(listing);
  }

  @Test
  void anotherUserCannotUpdateTheListing() {
    var listing = new ListingEntity();
    listing.id = "listing-1";
    listing.ownerId = "user_ana";
    listing.photosJson = "[]";
    when(repository.findById("listing-1")).thenReturn(Optional.of(listing));
    var request = new ListingController.NewListing("Bicicleta renovada", "En buen estado y lista para usar", "object", "trade", null,
        "mobility", "Buen estado", "surquillo", null, "Libros", List.of("object"),
        List.of(new ListingController.Photo("data:image/png;base64,AAAA", "Foto", "")));

    assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
        () -> controller.update(jwt("user_beto"), "listing-1", request)).getStatusCode());
    verify(repository, never()).save(any());
    verify(imageStorage, never()).storeDataUrl(anyString(), anyString());
  }

  @Test
  void listsOnlyPublicationsOwnedBySignedInUserIncludingCompletedOnes() {
    var listing = new ListingEntity();
    listing.id = "listing-1";
    listing.ownerId = "user_ana";
    listing.ownerName = "Ana";
    listing.title = "Bicicleta";
    listing.description = "En buen estado";
    listing.kind = "object";
    listing.category = "mobility";
    listing.condition = "Buen estado";
    listing.districtId = "surquillo";
    listing.acceptanceSummary = "Libros";
    listing.accepts = "object";
    listing.photosJson = "[]";
    listing.available = false;
    when(repository.findByOwnerIdOrderByCreatedAtDesc("user_ana")).thenReturn(List.of(listing));

    var results = controller.mine(jwt("user_ana"));

    assertEquals(1, results.size());
    assertEquals("listing-1", results.getFirst().id());
    assertFalse(results.getFirst().available());
    verify(repository).findByOwnerIdOrderByCreatedAtDesc("user_ana");
  }

  @Test
  void aListingWithDealsInProgressCannotBeDeleted() {
    var listing = new ListingEntity();
    listing.id = "listing-1";
    listing.ownerId = "user_ana";
    listing.photosJson = "[]";
    when(repository.findById("listing-1")).thenReturn(Optional.of(listing));
    when(exchangeActivity.activeDeals(eq("listing-1"), any())).thenReturn(1L);

    assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
        () -> controller.delete(jwt("user_ana"), "listing-1")).getStatusCode());
    verify(repository, never()).delete(any());
  }

  @Test
  void withDealsInProgressOnlyDetailsThatDoNotChangeTheDealCanBeEdited() {
    var listing = new ListingEntity();
    listing.id = "listing-1";
    listing.ownerId = "user_ana";
    listing.title = "Bicicleta";
    listing.kind = "object";
    listing.mode = "trade";
    listing.accepts = "object";
    listing.photosJson = "[]";
    when(repository.findById("listing-1")).thenReturn(Optional.of(listing));
    when(repository.save(any(ListingEntity.class))).thenAnswer(call -> call.getArgument(0));
    when(exchangeActivity.activeDeals(eq("listing-1"), any())).thenReturn(1L);
    when(imageStorage.storeDataUrl(anyString(), anyString())).thenReturn(new CloudinaryImageStorage.StoredImage("https://img.test/a.png", "id"));
    var photo = List.of(new ListingController.Photo("data:image/png;base64,AAAA", "Foto", ""));

    var renamed = new ListingController.NewListing("Bicicleta de carrera", "Descripción", "object", "trade", null,
        "mobility", "Buen estado", "surquillo", null, "Libros", List.of("object"), photo);
    assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
        () -> controller.update(jwt("user_ana"), "listing-1", renamed)).getStatusCode());
    var toSale = new ListingController.NewListing("Bicicleta", "Descripción", "object", "sale", new BigDecimal("50"),
        "mobility", "Buen estado", "surquillo", null, null, null, photo);
    assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
        () -> controller.update(jwt("user_ana"), "listing-1", toSale)).getStatusCode());

    var betterDescription = new ListingController.NewListing("Bicicleta", "Ahora con luces nuevas", "object", "trade", null,
        "mobility", "Como nueva", "surquillo", null, "Libros", List.of("object"), photo);
    assertEquals("Ahora con luces nuevas", controller.update(jwt("user_ana"), "listing-1", betterDescription).description());
  }

  @Test
  void listingsOfDeactivatedAccountsAreNoLongerAvailable() {
    var listing = new ListingEntity();
    listing.id = "listing-1";
    listing.ownerId = "user_ana";
    listing.available = true;
    listing.photosJson = "[]";
    when(repository.findById("listing-1")).thenReturn(Optional.of(listing));
    when(repository.countDeactivatedOwner("user_ana")).thenReturn(1L);

    assertEquals(HttpStatus.GONE, assertThrows(ResponseStatusException.class,
        () -> controller.one("listing-1")).getStatusCode());
  }

  private Jwt jwt(String subject) {
    return Jwt.withTokenValue("test").header("alg", "none").subject(subject).build();
  }
}
