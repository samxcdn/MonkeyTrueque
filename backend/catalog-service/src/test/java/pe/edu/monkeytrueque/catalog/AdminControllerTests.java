package pe.edu.monkeytrueque.catalog;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AdminControllerTests {
  private final ListingRepository listings = mock(ListingRepository.class);
  private final ReportRepository reports = mock(ReportRepository.class);
  private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
  private final AdminAccess access = new AdminAccess("user_admin", "user_moderator");
  private final AdminController controller = new AdminController(access, listings, reports, jdbc, new ObjectMapper());

  @Test
  void adminPermissionComesFromServerAllowlist() {
    assertEquals(false, controller.me(jwt("user_normal")).get("admin"));
    assertEquals(true, controller.me(jwt("user_admin")).get("admin"));
    assertEquals("moderator", controller.me(jwt("user_moderator")).get("role"));
    verifyNoInteractions(listings, reports, jdbc);
  }

  @Test
  void moderatorCanReviewContentButCannotSeeStaffActivity() {
    var listing = new ListingEntity();
    listing.id = "listing-1";
    listing.title = "Bicicleta";
    when(listings.findById("listing-1")).thenReturn(Optional.of(listing));
    when(listings.save(any(ListingEntity.class))).thenAnswer(call -> call.getArgument(0));

    assertTrue(controller.visibility(jwt("user_moderator"), "listing-1",
        new AdminController.VisibilityChange(true, "Contenido reportado")).moderationHidden());
    assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
        () -> controller.actions(jwt("user_moderator"))).getStatusCode());
    verify(jdbc).update(any(String.class), any(), eq("user_moderator"), eq("listing-hidden"),
        eq("listing-1"), eq("Contenido reportado"));
  }

  @Test
  void moderatorCanRevokeMistakenSanctionWithAuditedReason() {
    doReturn(List.of("user_moderator")).when(jdbc).query(any(String.class), any(RowMapper.class), any(), any());
    when(jdbc.update(any(String.class), any(), any(), any())).thenReturn(1);
    var reason = new AdminController.ReasonChange("Medida aplicada por error; revisé el caso.");

    var response = controller.revokeSanction(jwt("user_moderator"), "user_member", "sanction-1", reason);
    assertEquals(HttpStatus.OK, response.getStatusCode());
    assertEquals("revoked", response.getBody().get("status"));
    verify(jdbc).update(any(String.class), eq("user_moderator"), eq("sanction-1"), eq("user_member"));
    verify(jdbc).update(contains("moderation_actions"), any(), eq("user_moderator"), eq("sanction-revoked"), eq("sanction-1"), eq(reason.reason()));
    assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
        () -> controller.revokeSanction(jwt("user_normal"), "user_member", "sanction-1", reason)).getStatusCode());
  }

  @Test
  void alreadyRevokedSanctionReturnsConflictInsteadOfGenericNotFound() {
    doReturn(List.of("user_moderator")).when(jdbc).query(any(String.class), any(RowMapper.class), any(), any());
    when(jdbc.update(any(String.class), any(), any(), any())).thenReturn(0);
    var reason = new AdminController.ReasonChange("Retiro duplicado");

    var response = controller.revokeSanction(jwt("user_moderator"), "user_member", "sanction-1", reason);

    assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
    assertEquals("La medida ya fue retirada. Recarga el historial para ver el estado actualizado.", response.getBody().get("detail"));
    verify(jdbc, never()).update(contains("moderation_actions"), any(), any(), any(), any(), any());
  }

  @Test
  void onlyAdminsCanDeactivateNonStaffAccountsAndLocalAccountMustExist() {
    var reason = new AdminController.ReasonChange("Incumplimiento reiterado de las normas");
    assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
        () -> controller.deactivateAccount(jwt("user_moderator"), "user_member", reason)).getStatusCode());
    assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class,
        () -> controller.deactivateAccount(jwt("user_admin"), "user_admin", reason)).getStatusCode());
    assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
        () -> controller.deactivateAccount(jwt("user_admin"), "user_moderator", reason)).getStatusCode());
    assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class,
        () -> controller.deactivateAccount(jwt("user_admin"), "user_member", reason)).getStatusCode());
    assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class,
        () -> controller.accountStatus(jwt("user_admin"), "user_admin")).getStatusCode());
  }

  @Test
  void onlyAdminCanHideListingAndActionIsAudited() {
    var listing = new ListingEntity();
    listing.id = "listing-1";
    listing.title = "Bicicleta";
    when(listings.findById("listing-1")).thenReturn(Optional.of(listing));
    when(listings.save(any(ListingEntity.class))).thenAnswer(call -> call.getArgument(0));
    var request = new AdminController.VisibilityChange(true, "Foto inapropiada");
    assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
        () -> controller.visibility(jwt("user_normal"), "listing-1", request)).getStatusCode());
    assertFalse(listing.moderationHidden);
    assertTrue(controller.visibility(jwt("user_admin"), "listing-1", request).moderationHidden());
    verify(jdbc).update(any(String.class), any(), eq("user_admin"), eq("listing-hidden"),
        eq("listing-1"), eq("Foto inapropiada"));
  }

  @Test
  void adminCanModerateOwnListingButModeratorCannot() {
    var listing = new ListingEntity();
    listing.id = "listing-1";
    listing.title = "Bicicleta";
    listing.ownerId = "user_admin";
    when(listings.findById("listing-1")).thenReturn(Optional.of(listing));
    when(listings.save(any(ListingEntity.class))).thenAnswer(call -> call.getArgument(0));
    var request = new AdminController.VisibilityChange(true, "Revisión de contenido");

    assertTrue(controller.visibility(jwt("user_admin"), "listing-1", request).moderationHidden());
    verify(jdbc).update(any(String.class), any(), eq("user_admin"), eq("listing-hidden"),
        eq("listing-1"), eq("Revisión de contenido"));

    listing.ownerId = "user_moderator";
    assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
        () -> controller.visibility(jwt("user_moderator"), "listing-1", request)).getStatusCode());
  }

  @Test
  void closingReportRequiresExplanationAndAdminIdentity() {
    var report = new ReportEntity();
    report.id = "report-1";
    report.status = "open";
    when(reports.findById("report-1")).thenReturn(Optional.of(report));
    when(reports.save(any(ReportEntity.class))).thenAnswer(call -> call.getArgument(0));
    var change = new AdminController.ReviewChange("resolved", "Publicación retirada");
    assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
        () -> controller.review(jwt("user_normal"), "report-1", change)).getStatusCode());
    assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class,
        () -> controller.review(jwt("user_admin"), "report-1",
            new AdminController.ReviewChange("resolved", " "))).getStatusCode());
    var reviewed = controller.review(jwt("user_admin"), "report-1", change);
    assertEquals("resolved", reviewed.status());
    assertEquals("user_admin", reviewed.reviewedBy());
    verify(jdbc).update(any(String.class), any(), eq("user_admin"), eq("report-resolved"),
        eq("report-1"), eq("Publicación retirada"));
  }

  @Test
  void moderatorMustOwnCaseBeforeChangingItsStatus() {
    var report = new ReportEntity();
    report.id = "report-2";
    report.status = "open";
    when(reports.findById("report-2")).thenReturn(Optional.of(report));
    when(reports.save(any(ReportEntity.class))).thenAnswer(call -> call.getArgument(0));
    var change = new AdminController.ReviewChange("in-review", "Investigación iniciada");

    assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
        () -> controller.review(jwt("user_moderator"), "report-2", change)).getStatusCode());
    report.assignedTo = "another_moderator";
    assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
        () -> controller.review(jwt("user_moderator"), "report-2", change)).getStatusCode());

    report.assignedTo = "user_moderator";
    assertEquals("in-review", controller.review(jwt("user_moderator"), "report-2", change).status());
  }

  @Test
  void onlyAdminCanArchiveReportAndHistoryIsRecordedForRestore() {
    var report = new ReportEntity();
    report.id = "report-archive";
    when(reports.findById(report.id)).thenReturn(Optional.of(report));
    when(reports.save(any(ReportEntity.class))).thenAnswer(call -> call.getArgument(0));

    assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
        () -> controller.archiveReport(jwt("user_moderator"), report.id, new AdminController.ArchiveChange(true))).getStatusCode());

    controller.archiveReport(jwt("user_admin"), report.id, new AdminController.ArchiveChange(true));
    assertTrue(report.archived);
    assertEquals("user_admin", report.archivedBy);
    assertNotNull(report.archivedAt);
    verify(jdbc).update(contains("moderation_case_events"), any(String.class), eq(report.id), eq("user_admin"), eq("archived"), isNull(), isNull(), any(String.class));

    controller.archiveReport(jwt("user_admin"), report.id, new AdminController.ArchiveChange(false));
    assertFalse(report.archived);
    assertNull(report.archivedBy);
    assertNull(report.archivedAt);
  }

  @Test
  void moderatorsCanOnlyRevokeTheirOwnMeasuresAndNobodyRevokesTheirOwnSanction() {
    doReturn(List.of("user_admin")).when(jdbc).query(any(String.class), any(RowMapper.class), any(), any());
    var reason = new AdminController.ReasonChange("Ya no aplica");

    assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
        () -> controller.revokeSanction(jwt("user_moderator"), "user_member", "sanction-1", reason)).getStatusCode());
    assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
        () -> controller.revokeSanction(jwt("user_moderator"), "user_moderator", "sanction-1", reason)).getStatusCode());
    verify(jdbc, never()).update(contains("revoked_at"), any(), any(), any());
  }

  @Test
  void staffCannotBeSanctionedByModeratorsAndAdminsCannotBeSanctionedAtAll() {
    var team = new AdminController(new AdminAccess("user_admin,user_boss", "user_moderator,user_helper"), listings, reports, jdbc, new ObjectMapper());
    when(jdbc.queryForObject(contains("app_users"), eq(Integer.class), any(), any())).thenReturn(1);
    var change = new AdminController.SanctionChange("messaging", "Spam", 3);

    assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
        () -> team.sanction(jwt("user_moderator"), "user_admin", change)).getStatusCode());
    assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
        () -> team.sanction(jwt("user_moderator"), "user_helper", change)).getStatusCode());
    assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
        () -> team.sanction(jwt("user_admin"), "user_boss", change)).getStatusCode());
    verify(jdbc, never()).update(contains("INSERT INTO moderation_sanctions"), any(), any(), any(), any(), any(), any());
  }

  @Test
  void moderatorsCannotStackMeasuresOnTheSameAccount() {
    when(jdbc.queryForObject(contains("app_users"), eq(Integer.class), any(), any())).thenReturn(1);
    when(jdbc.queryForObject(contains("moderation_sanctions WHERE user_id"), eq(Integer.class), any())).thenReturn(1);

    assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
        () -> controller.sanction(jwt("user_moderator"), "user_member", new AdminController.SanctionChange("publishing", "Spam", 7))).getStatusCode());
    verify(jdbc, never()).update(contains("INSERT INTO moderation_sanctions"), any(), any(), any(), any(), any(), any());
  }

  @Test
  void accountsThatDoNotExistCannotBeSanctioned() {
    when(jdbc.queryForObject(contains("app_users"), eq(Integer.class), any(), any())).thenReturn(0);

    assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class,
        () -> controller.sanction(jwt("user_admin"), "nadie", new AdminController.SanctionChange("messaging", "Spam", 3))).getStatusCode());
  }

  private Jwt jwt(String subject) {
    return Jwt.withTokenValue("test").header("alg", "none").subject(subject).build();
  }
}
