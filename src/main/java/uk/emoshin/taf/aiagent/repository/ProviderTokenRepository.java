package uk.emoshin.taf.aiagent.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uk.emoshin.taf.aiagent.domain.AgentProvider;
import uk.emoshin.taf.aiagent.domain.ProviderToken;

public interface ProviderTokenRepository extends JpaRepository<ProviderToken, AgentProvider> {
}
