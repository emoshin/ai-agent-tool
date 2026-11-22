import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { SimulatedBotAdapter, type BotAdapter } from './services/botClient';

describe('AI Bot Chat UI', () => {
  it('renders collapsible sidebar with chat list, user image, and center/right chat region', () => {
    render(<App botAdapters={{ simulated: new SimulatedBotAdapter(0) }} />);

    const sidebar = screen.getByLabelText('Chat sidebar');
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');

    // User avatar image is present in sidebar
    const avatar = screen.getByAltText('Alex Morgan avatar');
    expect(avatar).toBeInTheDocument();

    // Seeded chats appear in sidebar
    expect(screen.getByText('Getting started with AI Bot UI')).toBeInTheDocument();
    expect(screen.getByText('SSE streaming contract for Java backend')).toBeInTheDocument();

    // Chat region is rendered
    expect(screen.getByPlaceholderText('Message AI Bot...')).toBeInTheDocument();
  });

  it('collapses and expands the left sidebar', async () => {
    const user = userEvent.setup();
    render(<App botAdapters={{ simulated: new SimulatedBotAdapter(0) }} />);

    const sidebar = screen.getByLabelText('Chat sidebar');
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(sidebar).toHaveAttribute('data-collapsed', 'true');

    const expandButton = screen.getByRole('button', { name: 'Expand sidebar' });
    expect(expandButton).toBeInTheDocument();

    await user.click(expandButton);
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');
  });

  it('creates a new chat, sends a message, and streams AI bot response', async () => {
    const user = userEvent.setup();
    const fastMockAdapter: BotAdapter = {
      async sendMessage({ onToken }) {
        onToken('Hello ');
        onToken('from AI Bot!');
      },
    };

    render(<App botAdapters={{ simulated: fastMockAdapter }} />);

    await user.click(screen.getByRole('button', { name: 'New chat' }));
    expect(screen.getByText('What can I help with?')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Message AI Bot...');
    await user.type(input, 'Test prompt for AI{Enter}');

    const userBubble = screen.getByTestId('user-message');
    expect(within(userBubble).getByText('Test prompt for AI')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Hello from AI Bot!')).toBeInTheDocument();
    });

    // Chat title updates in sidebar from the first message
    expect(screen.getByRole('button', { name: 'Test prompt for AI' })).toBeInTheDocument();
  });

  it('allows configuring REST/SSE API mode and user profile in Settings', async () => {
    const user = userEvent.setup();
    render(<App botAdapters={{ simulated: new SimulatedBotAdapter(0) }} />);

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /REST \/ SSE API/i }));
    const endpointInput = screen.getByLabelText(/Endpoint URL/i);
    await user.clear(endpointInput);
    await user.type(endpointInput, 'http://localhost:8080/api/bot');

    const nameInput = screen.getByLabelText('Display Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Jane Doe');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('REST / SSE API')).toBeInTheDocument();
  });

  it('supports renaming and deleting chats from the sidebar', async () => {
    const user = userEvent.setup();
    render(<App botAdapters={{ simulated: new SimulatedBotAdapter(0) }} />);

    await user.click(screen.getByRole('button', { name: 'Rename Getting started with AI Bot UI' }));
    const renameInput = screen.getByLabelText('Rename chat title');
    await user.clear(renameInput);
    await user.type(renameInput, 'Renamed Conversation{Enter}');

    expect(screen.getByText('Renamed Conversation')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Renamed Conversation' }));
    expect(screen.queryByText('Renamed Conversation')).not.toBeInTheDocument();
  });

  it('stops an active streaming response when clicking Stop generating', async () => {
    const user = userEvent.setup();
    const abortSpy = vi.fn();

    const hangingAdapter: BotAdapter = {
      sendMessage({ signal, onToken }) {
        onToken('Partial reply...');
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            abortSpy();
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      },
    };

    render(<App botAdapters={{ simulated: hangingAdapter }} />);
    await user.click(screen.getByRole('button', { name: 'New chat' }));

    const input = screen.getByPlaceholderText('Message AI Bot...');
    await user.type(input, 'Stream forever{Enter}');

    const stopBtn = await screen.findByRole('button', { name: 'Stop generating' });
    await user.click(stopBtn);

    expect(abortSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();
    });
    expect(screen.getByText('Partial reply...')).toBeInTheDocument();
  });

  it('allows model selection only in a new chat, locks it once messages exist, and shows ChatGPT/Claude icons', async () => {
    const user = userEvent.setup();
    const sentModels: string[] = [];
    const spyAdapter: BotAdapter = {
      async sendMessage({ model, onToken }) {
        sentModels.push(model);
        onToken(`Reply using ${model}`);
      },
    };

    render(<App botAdapters={{ simulated: spyAdapter }} />);

    // Existing seeded chats: first uses gpt-4o (ChatGPT icon), second uses claude-sonnet-4 (Claude icon)
    const chatGptItem = screen.getByRole('button', { name: 'Getting started with AI Bot UI' });
    expect(within(chatGptItem).getByTestId('chatgpt-icon')).toBeInTheDocument();

    const claudeItem = screen.getByRole('button', { name: 'SSE streaming contract for Java backend' });
    expect(within(claudeItem).getByTestId('claude-icon')).toBeInTheDocument();

    // Existing chat has locked model badge and no interactive selector
    expect(screen.getByTestId('locked-model-badge')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select model for new chat' })).not.toBeInTheDocument();

    // Start a new chat -> model selector becomes available
    await user.click(screen.getByRole('button', { name: 'New chat' }));
    const selectorBtn = screen.getByRole('button', { name: 'Select model for new chat' });
    expect(selectorBtn).toBeInTheDocument();

    // Choose Anthropic Claude Sonnet 4
    await user.click(selectorBtn);
    await user.click(screen.getByRole('option', { name: /Claude Sonnet 4/i }));
    expect(selectorBtn).toHaveTextContent('Claude Sonnet 4');

    // Send first message -> locks the model to Claude Sonnet 4
    const input = screen.getByPlaceholderText('Message AI Bot...');
    await user.type(input, 'Hello Claude{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Reply using claude-sonnet-4')).toBeInTheDocument();
    });
    expect(sentModels).toEqual(['claude-sonnet-4']);

    // Selector is gone and replaced by locked badge showing Claude Sonnet 4
    expect(screen.queryByRole('button', { name: 'Select model for new chat' })).not.toBeInTheDocument();
    const lockedBadge = screen.getByTestId('locked-model-badge');
    expect(lockedBadge).toHaveTextContent('Claude Sonnet 4');
    expect(within(lockedBadge).getByTestId('claude-icon')).toBeInTheDocument();

    // Follow-up message in same chat continues using claude-sonnet-4
    await user.type(input, 'Follow up{Enter}');
    await waitFor(() => {
      expect(sentModels).toEqual(['claude-sonnet-4', 'claude-sonnet-4']);
    });

    // New sidebar chat item displays Claude icon
    const newChatItem = screen.getByRole('button', { name: 'Hello Claude' });
    expect(within(newChatItem).getByTestId('claude-icon')).toBeInTheDocument();
  });
});
