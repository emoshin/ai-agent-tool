import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { SimulatedBotAdapter } from '../../services/botClient';
import { DEFAULT_PROVIDER_TOKENS, submitProviderToken } from '../../services/providerTokensService';
import { INITIAL_MANAGED_USERS } from '../../utils/adminDefaults';
import { AdminPage } from './AdminPage';

describe('Admin Console', () => {
  it('opens Admin Console from chat UI, shows token consumption and estimated funds, and navigates back', async () => {
    const user = userEvent.setup();
    render(<App botAdapters={{ simulated: new SimulatedBotAdapter(0) }} />);

    await user.click(screen.getByRole('button', { name: 'Open admin console' }));

    expect(screen.getByRole('heading', { name: 'Admin Console' })).toBeInTheDocument();
    expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
    expect(screen.getByText('Marcus Vance')).toBeInTheDocument();
    expect(screen.getByText('184,000')).toBeInTheDocument();

    const spendCard = screen.getByTestId('admin-estimated-spend-card');
    expect(within(spendCard).getByText('Est. Funds Consumed')).toBeInTheDocument();
    expect(within(spendCard).getByText(/^\$\d+\.\d{2}$/)).toBeInTheDocument();

    // Marcus Vance has 112.5k input + 136.9k output tokens on claude-opus-4 ($15/$75) -> $11.96
    const marcusRow = screen.getByTestId('admin-user-row-user-marcus');
    expect(within(marcusRow).getByText('$11.96')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Back to Chat/i }));
    expect(screen.getByPlaceholderText('Message AI Bot...')).toBeInTheDocument();
  });

  it('adds a new user via Add User modal', async () => {
    const user = userEvent.setup();
    render(<App botAdapters={{ simulated: new SimulatedBotAdapter(0) }} />);

    await user.click(screen.getByRole('button', { name: 'Admin Console' }));
    await user.click(screen.getByRole('button', { name: /Add User/i }));

    await user.type(screen.getByLabelText('Full Name'), 'Jordan Lee');
    await user.type(screen.getByLabelText('Email Address'), 'jordan.lee@ai-agent-tool.dev');
    await user.selectOptions(screen.getByLabelText('Role'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    expect(screen.getByText('Jordan Lee')).toBeInTheDocument();
    expect(screen.getByText('jordan.lee@ai-agent-tool.dev')).toBeInTheDocument();
  });

  it('suspends, activates, and deletes users', async () => {
    const user = userEvent.setup();
    render(<App botAdapters={{ simulated: new SimulatedBotAdapter(0) }} />);

    await user.click(screen.getByRole('button', { name: 'Admin Console' }));

    // Suspend Elena Rostova
    await user.click(screen.getByRole('button', { name: 'Suspend Elena Rostova' }));
    const elenaRow = screen.getByTestId('admin-user-row-user-elena');
    expect(within(elenaRow).getByText('Suspended')).toBeInTheDocument();

    // Reactivate Elena Rostova
    await user.click(screen.getByRole('button', { name: 'Activate Elena Rostova' }));
    expect(within(elenaRow).getByText('Active')).toBeInTheDocument();

    // Delete Marcus Vance (with inline confirm)
    await user.click(screen.getByRole('button', { name: 'Delete Marcus Vance' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete Marcus Vance' }));
    expect(screen.queryByText('Marcus Vance')).not.toBeInTheDocument();
  });

  it('disables chat input when the current user is suspended and re-enables upon activation', async () => {
    const user = userEvent.setup();
    render(<App botAdapters={{ simulated: new SimulatedBotAdapter(0) }} />);

    await user.click(screen.getByRole('button', { name: 'Admin Console' }));
    await user.click(screen.getByRole('button', { name: 'Suspend Alex Morgan' }));
    await user.click(screen.getByRole('button', { name: /Back to Chat/i }));

    expect(screen.getByPlaceholderText('Account suspended — messaging disabled')).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Admin Console' }));
    await user.click(screen.getByRole('button', { name: 'Activate Alex Morgan' }));
    await user.click(screen.getByRole('button', { name: /Back to Chat/i }));

    expect(screen.getByPlaceholderText('Message AI Bot...')).toBeEnabled();
  });

  it('inspects a user chat history and token breakdown', async () => {
    const user = userEvent.setup();
    render(<App botAdapters={{ simulated: new SimulatedBotAdapter(0) }} />);

    await user.click(screen.getByRole('button', { name: 'Admin Console' }));
    await user.click(screen.getByRole('button', { name: 'View chats for Elena Rostova' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Elena Rostova — Chat History')).toBeInTheDocument();
    expect(
      within(dialog).getAllByText('Refactor Spring Boot WebFlux SSE controller').length
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(dialog).getByText(
        'How do I prevent SSE timeouts in Spring Boot when streaming long LLM responses?'
      )
    ).toBeInTheDocument();

    // Switch to second chat in inspector
    await user.click(within(dialog).getByText('PostgreSQL pgvector HNSW index tuning'));
    expect(
      within(dialog).getByText('What values of m and ef_construction work well for 500k embeddings?')
    ).toBeInTheDocument();
  });

  it('switches between User Statistics and API Tokens tabs and saves/removes ChatGPT and Claude tokens', async () => {
    const user = userEvent.setup();
    render(<App botAdapters={{ simulated: new SimulatedBotAdapter(0) }} />);

    await user.click(screen.getByRole('button', { name: 'Admin Console' }));

    const usersTab = screen.getByRole('tab', { name: /User Statistics/i });
    const tokensTab = screen.getByRole('tab', { name: /API Tokens/i });
    expect(usersTab).toHaveAttribute('aria-selected', 'true');
    expect(tokensTab).toHaveAttribute('aria-selected', 'false');

    await user.click(tokensTab);
    expect(tokensTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: /Add User/i })).not.toBeInTheDocument();

    // Submit OpenAI / ChatGPT token
    const openAiCard = screen.getByTestId('provider-token-card-openai');
    const openAiInput = within(openAiCard).getByLabelText('OpenAI / ChatGPT API Token');
    await user.type(openAiInput, 'sk-proj-test1234567890');
    await user.click(within(openAiCard).getByRole('button', { name: 'Save ChatGPT Token' }));

    expect(within(openAiCard).getByText(/Configured \(sk-pr••••••7890\)/)).toBeInTheDocument();

    // Submit Anthropic / Claude token
    const claudeCard = screen.getByTestId('provider-token-card-anthropic');
    const claudeInput = within(claudeCard).getByLabelText('Anthropic / Claude API Token');
    await user.type(claudeInput, 'sk-ant-api03-abcdef9999');
    await user.click(within(claudeCard).getByRole('button', { name: 'Save Claude Token' }));

    expect(within(claudeCard).getByText(/Configured \(sk-an••••••9999\)/)).toBeInTheDocument();

    // Remove ChatGPT token
    await user.click(within(openAiCard).getByRole('button', { name: /Remove ChatGPT \(OpenAI\) token/i }));
    expect(within(openAiCard).getByText('Not configured')).toBeInTheDocument();

    // Switch back to User Statistics tab
    await user.click(usersTab);
    expect(screen.getByRole('button', { name: /Add User/i })).toBeInTheDocument();
  });

  it('submits provider token to backend endpoint in api mode for PostgreSQL storage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitProviderToken(
      {
        provider: 'anthropic',
        apiKey: 'sk-ant-api03-live-secret',
        baseUrl: 'https://api.anthropic.com/v1',
      },
      'api'
    );

    expect(result.syncedToBackend).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/provider-tokens',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          provider: 'anthropic',
          apiKey: 'sk-ant-api03-live-secret',
          baseUrl: 'https://api.anthropic.com/v1',
        }),
      })
    );

    vi.unstubAllGlobals();
  });

  it('queries OpenAI Organization Costs endpoint in api mode and shows billed spend + balance note', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          available: true,
          periodDays: 30,
          totalSpendUsd: 12.345,
          remainingBalanceSupported: false,
          source: 'openai_organization_costs',
          message:
            'Retrieved billed organization spend for the last 30 days from OpenAI (/v1/organization/costs). Note: OpenAI does not expose remaining credit balance via API.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      render(
        <AdminPage
          users={INITIAL_MANAGED_USERS}
          providerTokens={DEFAULT_PROVIDER_TOKENS}
          botMode="api"
          authToken="jwt-admin-token"
          onBackToChat={() => {}}
          onAddUser={() => {}}
          onToggleSuspendUser={() => {}}
          onDeleteUser={() => {}}
          onDeleteUserChat={() => {}}
          onSaveProviderToken={async () => 'ok'}
          onDeleteProviderToken={async () => {}}
        />
      );

      await user.type(screen.getByLabelText('OpenAI Organization Admin Key'), 'sk-admin-org-secret');
      await user.click(screen.getByRole('button', { name: /Check OpenAI Org Spend \(30d\)/i }));

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/billing/openai-costs',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-admin-token',
          }),
          body: JSON.stringify({
            adminApiKey: 'sk-admin-org-secret',
            days: 30,
          }),
        })
      );

      const billingBanner = await screen.findByTestId('openai-org-costs-result');
      expect(within(billingBanner).getByText(/30-Day OpenAI Billed Spend: \$12\.35/i)).toBeInTheDocument();
      expect(within(billingBanner).getByText(/does not expose remaining credit balance/i)).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('hides user-deleted chat from user list, marks it with a deleted icon in Admin Console, and backs it up', async () => {
    const user = userEvent.setup();
    const createObjectUrlSpy = vi.fn(() => 'blob:mock-backup-url');
    const revokeObjectUrlSpy = vi.fn();
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlSpy,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlSpy,
    });

    try {
      render(<App botAdapters={{ simulated: new SimulatedBotAdapter(0) }} />);

      const chatNav = screen.getByRole('navigation', { name: 'Chat history' });
      expect(within(chatNav).getByText('Getting started with AI Bot UI')).toBeInTheDocument();

      // User deletes the chat from their sidebar
      await user.click(screen.getByRole('button', { name: 'Delete Getting started with AI Bot UI' }));
      expect(within(chatNav).queryByText('Getting started with AI Bot UI')).not.toBeInTheDocument();

      // Admin opens Console and sees deleted badge on user row
      await user.click(screen.getByRole('button', { name: 'Admin Console' }));
      const currentUserRow = screen.getByTestId('admin-user-row-user-current');
      expect(within(currentUserRow).getByTestId('user-deleted-chats-badge-user-current')).toHaveTextContent(
        '1 deleted'
      );

      // Admin inspects user's chats and sees the deleted icon + badge
      await user.click(screen.getByRole('button', { name: 'View chats for Alex Morgan' }));
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByTestId('admin-chat-deleted-icon-chat-welcome')).toHaveAttribute(
        'aria-label',
        'Deleted by user'
      );

      // Select the deleted chat and trigger JSON backup
      await user.click(within(dialog).getByRole('button', { name: /^Getting started with AI Bot UI/i }));
      expect(within(dialog).getByTestId('selected-chat-deleted-badge-chat-welcome')).toHaveTextContent(
        'Deleted by user'
      );

      await user.click(
        within(dialog).getByRole('button', { name: 'Backup selected chat Getting started with AI Bot UI' })
      );

      const modalStatus = await within(dialog).findByTestId('modal-backup-status');
      expect(modalStatus).toHaveTextContent(
        'Backed up "Getting started with AI Bot UI" (2 messages, deleted by user) to chat-backup-chat-welcome.json.'
      );
      expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    } finally {
      anchorClickSpy.mockRestore();
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      });
    }
  });

  it('calls backend workspace chat backup endpoint in api mode and shows backup summary', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          backupVersion: '1.0',
          exportedAt: 1700000000000,
          totalChats: 5,
          deletedChats: 2,
          chats: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:mock-workspace-backup'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    try {
      render(
        <AdminPage
          users={INITIAL_MANAGED_USERS}
          providerTokens={DEFAULT_PROVIDER_TOKENS}
          botMode="api"
          authToken="jwt-admin-token"
          onBackToChat={() => {}}
          onAddUser={() => {}}
          onToggleSuspendUser={() => {}}
          onDeleteUser={() => {}}
          onDeleteUserChat={() => {}}
          onSaveProviderToken={async () => 'ok'}
          onDeleteProviderToken={async () => {}}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Backup all chats' }));

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/chats/backup',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-admin-token',
          }),
        })
      );

      const status = await screen.findByTestId('admin-backup-status');
      expect(status).toHaveTextContent(
        'Backed up 5 chats (2 deleted by user) to workspace-chats-backup.json.'
      );
    } finally {
      anchorClickSpy.mockRestore();
      vi.unstubAllGlobals();
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      });
    }
  });
});
