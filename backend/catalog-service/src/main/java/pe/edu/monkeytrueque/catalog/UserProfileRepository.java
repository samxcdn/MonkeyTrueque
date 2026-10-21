package pe.edu.monkeytrueque.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

interface UserProfileRepository extends JpaRepository<UserProfileEntity, String> {}
