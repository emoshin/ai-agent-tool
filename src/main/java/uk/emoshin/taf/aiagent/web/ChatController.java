package uk.emoshin.taf.aiagent.web;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uk.emoshin.taf.aiagent.dto.ChatDtos.ChatRequest;
import uk.emoshin.taf.aiagent.dto.ChatDtos.ChatSessionResponse;
import uk.emoshin.taf.aiagent.dto.ChatDtos.RenameChatRequest;
import uk.emoshin.taf.aiagent.proxy.ChatProxyService;
import uk.emoshin.taf.aiagent.security.UserPrincipal;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ChatController {

    private final ChatProxyService chatProxyService;

    public ChatController(ChatProxyService chatProxyService) {
        this.chatProxyService = chatProxyService;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @PostMapping("/chat")
    public Object chat(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ChatRequest request
    ) {
        if (request.stream()) {
            return chatProxyService.streamChat(principal.getId(), request);
        }
        return ResponseEntity.ok(chatProxyService.completeChat(principal.getId(), request));
    }

    @GetMapping("/chats")
    public ResponseEntity<List<ChatSessionResponse>> listChats(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(chatProxyService.listUserChats(principal.getId()));
    }

    @PatchMapping("/chats/{chatId}")
    public ResponseEntity<ChatSessionResponse> renameChat(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID chatId,
            @Valid @RequestBody RenameChatRequest request
    ) {
        return ResponseEntity.ok(chatProxyService.renameUserChat(principal.getId(), chatId, request.title()));
    }

    @DeleteMapping("/chats/{chatId}")
    public ResponseEntity<Void> deleteChat(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID chatId
    ) {
        chatProxyService.deleteUserChat(principal.getId(), chatId);
        return ResponseEntity.noContent().build();
    }
}
