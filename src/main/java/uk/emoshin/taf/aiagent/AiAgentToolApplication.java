package uk.emoshin.taf.aiagent;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class AiAgentToolApplication {

    public static void main(String[] args) {
        SpringApplication.run(AiAgentToolApplication.class, args);
    }
}
