package pe.edu.monkeytrueque.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ReportControllerTests {
  private final ReportRepository reports = mock(ReportRepository.class);
  private final ListingRepository listings = mock(ListingRepository.class);
  private final UserProfileRepository profiles = mock(UserProfileRepository.class);
  private final ReportController controller = new ReportController(reports, listings, profiles, new ObjectMapper());

  @Test
  void reportIsAttributedToAuthenticatedUser() {
    when(listings.existsById("listing-1")).thenReturn(true);
    when(reports.save(any(ReportEntity.class))).thenAnswer(call -> call.getArgument(0));
    var response = controller.create(jwt("user_reporter"),
        new ReportController.NewReport("listing-1", "suspicious", "Pide dinero por adelantado"));
    assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
    assertNull(response.getBody());
    var report = org.mockito.ArgumentCaptor.forClass(ReportEntity.class);
    verify(reports).save(report.capture());
    assertEquals("user_reporter", report.getValue().reporterId);
    assertEquals("listing-1", report.getValue().listingId);
    assertEquals("open", report.getValue().status);
  }

  @Test
  void unknownListingCannotBeReportedAsAnotherListing() {
    assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class,
        () -> controller.create(jwt("user_reporter"),
            new ReportController.NewReport("missing", "other", "Consulta"))).getStatusCode());
    verifyNoInteractions(reports);
  }

  @Test
  void userReportStoresTargetAndEvidenceSnapshot() {
    when(reports.save(any(ReportEntity.class))).thenAnswer(call -> call.getArgument(0));
    var response = controller.create(jwt("reporter"), new ReportController.NewReport(null, "user", "reported-user", "harassment", "Context", "Chat excerpt"));
    assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
    assertNull(response.getBody());
    var report = org.mockito.ArgumentCaptor.forClass(ReportEntity.class);
    verify(reports).save(report.capture());
    assertEquals("user", report.getValue().targetType);
    assertEquals("reported-user", report.getValue().targetId);
    assertTrue(report.getValue().evidenceSnapshot.contains("Chat excerpt"));
  }

  @Test
  void userCannotReportTheirOwnAccount() {
    assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class,
        () -> controller.create(jwt("same-user"), new ReportController.NewReport(null, "user", "same-user", "other", "", null))).getStatusCode());
    verifyNoInteractions(reports);
  }

  private Jwt jwt(String subject) {
    return Jwt.withTokenValue("test").header("alg", "none").subject(subject).build();
  }
}
