package uk.emoshin.taf.aiagent.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import uk.emoshin.taf.aiagent.domain.AgentProvider;
import uk.emoshin.taf.aiagent.domain.TokenUsageRecord;

import java.util.List;
import java.util.UUID;

public interface TokenUsageRecordRepository extends JpaRepository<TokenUsageRecord, UUID> {

    interface UserTotalsProjection {
        Long getPromptTokens();
        Long getCompletionTokens();
        Long getTotalTokens();
    }

    interface ModelUsageProjection {
        String getModel();
        AgentProvider getProvider();
        Long getPromptTokens();
        Long getCompletionTokens();
        Long getTotalTokens();
    }

    @Query("""
            SELECT COALESCE(SUM(t.promptTokens), 0) AS promptTokens,
                   COALESCE(SUM(t.completionTokens), 0) AS completionTokens,
                   COALESCE(SUM(t.totalTokens), 0) AS totalTokens
            FROM TokenUsageRecord t
            WHERE t.user.id = :userId
            """)
    UserTotalsProjection sumTotalsByUserId(@Param("userId") UUID userId);

    @Query("""
            SELECT t.model AS model,
                   t.provider AS provider,
                   COALESCE(SUM(t.promptTokens), 0) AS promptTokens,
                   COALESCE(SUM(t.completionTokens), 0) AS completionTokens,
                   COALESCE(SUM(t.totalTokens), 0) AS totalTokens
            FROM TokenUsageRecord t
            WHERE t.user.id = :userId
            GROUP BY t.model, t.provider
            ORDER BY totalTokens DESC
            """)
    List<ModelUsageProjection> sumByModelForUser(@Param("userId") UUID userId);

    @Query("""
            SELECT t.model AS model,
                   t.provider AS provider,
                   COALESCE(SUM(t.promptTokens), 0) AS promptTokens,
                   COALESCE(SUM(t.completionTokens), 0) AS completionTokens,
                   COALESCE(SUM(t.totalTokens), 0) AS totalTokens
            FROM TokenUsageRecord t
            GROUP BY t.model, t.provider
            ORDER BY totalTokens DESC
            """)
    List<ModelUsageProjection> sumGlobalByModel();
}
