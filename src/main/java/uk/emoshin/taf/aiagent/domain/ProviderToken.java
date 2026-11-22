package uk.emoshin.taf.aiagent.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "provider_tokens")
public class ProviderToken {

    @Id
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AgentProvider provider;

    @Column(nullable = false, length = 120)
    private String label;

    @Column(name = "encrypted_api_key", nullable = false)
    private String encryptedApiKey;

    @Column(name = "base_url", nullable = false, length = 500)
    private String baseUrl;

    @Column(name = "updated_at", nullable = false)
    private long updatedAt;

    @Column(name = "updated_by_admin_id")
    private UUID updatedByAdminId;

    public AgentProvider getProvider() {
        return provider;
    }

    public void setProvider(AgentProvider provider) {
        this.provider = provider;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getEncryptedApiKey() {
        return encryptedApiKey;
    }

    public void setEncryptedApiKey(String encryptedApiKey) {
        this.encryptedApiKey = encryptedApiKey;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public long getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(long updatedAt) {
        this.updatedAt = updatedAt;
    }

    public UUID getUpdatedByAdminId() {
        return updatedByAdminId;
    }

    public void setUpdatedByAdminId(UUID updatedByAdminId) {
        this.updatedByAdminId = updatedByAdminId;
    }
}
