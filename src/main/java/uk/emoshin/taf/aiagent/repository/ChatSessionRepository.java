package uk.emoshin.taf.aiagent.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import uk.emoshin.taf.aiagent.domain.ChatSessionEntity;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChatSessionRepository extends JpaRepository<ChatSessionEntity, UUID> {

    @EntityGraph(attributePaths = "messages")
    List<ChatSessionEntity> findByUserIdAndDeletedFalseOrderByUpdatedAtDesc(UUID userId);

    @EntityGraph(attributePaths = {"messages", "user"})
    List<ChatSessionEntity> findByUserIdOrderByUpdatedAtDesc(UUID userId);

    @EntityGraph(attributePaths = {"messages", "user"})
    List<ChatSessionEntity> findAllByOrderByUpdatedAtDesc();

    @EntityGraph(attributePaths = {"messages", "user"})
    Optional<ChatSessionEntity> findWithDetailsById(UUID id);

    @EntityGraph(attributePaths = "messages")
    Optional<ChatSessionEntity> findByIdAndUserId(UUID id, UUID userId);

    long countByUserId(UUID userId);
}
