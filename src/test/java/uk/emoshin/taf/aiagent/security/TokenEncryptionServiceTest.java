package uk.emoshin.taf.aiagent.security;

import org.junit.jupiter.api.Test;
import uk.emoshin.taf.aiagent.config.AppProperties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TokenEncryptionServiceTest {

    @Test
    void encryptsAndDecryptsWithRandomIvAndMasksSafely() {
        AppProperties props = new AppProperties();
        props.getSecurity().setTokenEncryptionKey("unit-test-encryption-key-32-bytes!");

        TokenEncryptionService service = new TokenEncryptionService(props);
        String rawKey = "sk-proj-super-secret-value-9876";

        String encrypted1 = service.encrypt(rawKey);
        String encrypted2 = service.encrypt(rawKey);

        assertThat(encrypted1).isNotEqualTo(rawKey);
        assertThat(encrypted1).isNotEqualTo(encrypted2);
        assertThat(service.decrypt(encrypted1)).isEqualTo(rawKey);
        assertThat(service.decrypt(encrypted2)).isEqualTo(rawKey);

        assertThat(TokenEncryptionService.mask(rawKey)).isEqualTo("sk-pr••••••9876");
        assertThat(TokenEncryptionService.mask("short")).isEqualTo("••••••••");
        assertThatThrownBy(() -> service.encrypt("   ")).isInstanceOf(IllegalArgumentException.class);
    }
}
