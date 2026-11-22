package uk.emoshin.taf.aiagent.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uk.emoshin.taf.aiagent.domain.AppUser;

import java.util.Optional;
import java.util.UUID;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {
    Optional<AppUser> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);
}
