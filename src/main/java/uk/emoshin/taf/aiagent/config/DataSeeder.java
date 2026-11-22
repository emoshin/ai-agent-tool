package uk.emoshin.taf.aiagent.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import uk.emoshin.taf.aiagent.domain.AppUser;
import uk.emoshin.taf.aiagent.domain.UserRole;
import uk.emoshin.taf.aiagent.domain.UserStatus;
import uk.emoshin.taf.aiagent.repository.AppUserRepository;

import java.time.Instant;
import java.util.UUID;

@Component
public class DataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final AppProperties appProperties;
    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(
            AppProperties appProperties,
            AppUserRepository appUserRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.appProperties = appProperties;
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!appProperties.getSeed().isEnabled()) {
            return;
        }
        if (appUserRepository.count() > 0) {
            return;
        }

        long now = Instant.now().toEpochMilli();

        AppUser admin = new AppUser();
        admin.setId(UUID.randomUUID());
        admin.setName("System Administrator");
        admin.setSubtitle("Administrator");
        admin.setEmail("admin@ai-agent-tool.dev");
        admin.setPasswordHash(passwordEncoder.encode("admin123"));
        admin.setRole(UserRole.ADMIN);
        admin.setStatus(UserStatus.ACTIVE);
        admin.setTokenLimit(1_000_000L);
        admin.setCreatedAt(now);
        admin.setLastActiveAt(now);

        appUserRepository.save(admin);
        log.info("Seeded default admin account: admin@ai-agent-tool.dev");
    }
}
