FROM maven:3-eclipse-temurin-25 AS builder
WORKDIR /workspace

COPY pom.xml .
RUN mvn -B -ntp dependency:go-offline

COPY src ./src
RUN mvn -B -ntp clean package -DskipTests

FROM eclipse-temurin:25-jre-alpine
WORKDIR /app

RUN apk add --no-cache curl \
    && addgroup -S appgroup \
    && adduser -S appuser -G appgroup

COPY --from=builder /workspace/target/ai-agent-tool-*.jar /app/app.jar

USER appuser:appgroup
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=5 \
  CMD curl -fsS http://localhost:8080/api/health || exit 1

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
