package uk.emoshin.taf.aiagent.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import uk.emoshin.taf.aiagent.config.AppProperties;
import uk.emoshin.taf.aiagent.domain.AppUser;
import uk.emoshin.taf.aiagent.domain.UserRole;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class JwtService {

    private static final String HMAC_ALG = "HmacSHA256";
    private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder URL_DECODER = Base64.getUrlDecoder();

    private final byte[] secretBytes;
    private final long expirationMs;
    private final ObjectMapper objectMapper;

    public JwtService(AppProperties properties, ObjectMapper objectMapper) {
        this.secretBytes = properties.getSecurity().getJwtSecret().getBytes(StandardCharsets.UTF_8);
        this.expirationMs = properties.getSecurity().getJwtExpirationMs();
        this.objectMapper = objectMapper;
    }

    public String generateToken(AppUser user) {
        try {
            long nowSec = Instant.now().getEpochSecond();
            long expSec = nowSec + Math.max(60, expirationMs / 1000L);

            String headerJson = objectMapper.writeValueAsString(Map.of("alg", "HS256", "typ", "JWT"));
            String payloadJson = objectMapper.writeValueAsString(Map.of(
                    "sub", user.getId().toString(),
                    "email", user.getEmail(),
                    "role", user.getRole().name(),
                    "iat", nowSec,
                    "exp", expSec
            ));

            String headerEncoded = URL_ENCODER.encodeToString(headerJson.getBytes(StandardCharsets.UTF_8));
            String payloadEncoded = URL_ENCODER.encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));
            String signingInput = headerEncoded + "." + payloadEncoded;
            String signature = sign(signingInput);
            return signingInput + "." + signature;
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to generate JWT token", ex);
        }
    }

    public Optional<JwtClaims> parseAndValidate(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                return Optional.empty();
            }

            String signingInput = parts[0] + "." + parts[1];
            String expectedSig = sign(signingInput);
            if (!MessageDigest.isEqual(
                    expectedSig.getBytes(StandardCharsets.UTF_8),
                    parts[2].getBytes(StandardCharsets.UTF_8))) {
                return Optional.empty();
            }

            byte[] payloadBytes = URL_DECODER.decode(parts[1]);
            Map<String, Object> claims = objectMapper.readValue(payloadBytes, new TypeReference<>() {});

            long exp = ((Number) claims.get("exp")).longValue();
            if (Instant.now().getEpochSecond() > exp) {
                return Optional.empty();
            }

            UUID userId = UUID.fromString(String.valueOf(claims.get("sub")));
            String email = String.valueOf(claims.get("email"));
            UserRole role = UserRole.valueOf(String.valueOf(claims.get("role")));
            return Optional.of(new JwtClaims(userId, email, role));
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private String sign(String data) throws GeneralSecurityException {
        Mac mac = Mac.getInstance(HMAC_ALG);
        mac.init(new SecretKeySpec(secretBytes, HMAC_ALG));
        byte[] rawSig = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        return URL_ENCODER.encodeToString(rawSig);
    }

    public record JwtClaims(UUID userId, String email, UserRole role) {
    }
}
