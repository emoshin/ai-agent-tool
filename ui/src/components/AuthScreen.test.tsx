import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { SimulatedBotAdapter } from '../services/botClient';

describe('Authentication & Login Screen', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('opens login screen, fills admin credentials, authenticates, and unlocks admin console', async () => {
    const user = userEvent.setup();

    const adminUserProfile = {
      id: 'admin-uuid-1',
      name: 'System Administrator',
      subtitle: 'Administrator',
      email: 'admin@ai-agent-tool.dev',
      role: 'ADMIN',
      status: 'ACTIVE',
      avatarUrl: null,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        tokenLimit: 1000000,
      },
      modelBreakdown: [],
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/users/login') {
        return new Response(
          JSON.stringify({
            accessToken: 'jwt-admin-token',
            user: adminUserProfile,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url === '/api/users/me') {
        return new Response(JSON.stringify(adminUserProfile), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === '/api/chats') {
        return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url === '/api/admin/users') {
        return new Response(JSON.stringify([{ ...adminUserProfile, chatCount: 0 }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.startsWith('/api/admin/users/') && url.endsWith('/chats')) {
        return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url === '/api/admin/provider-tokens') {
        return new Response(
          JSON.stringify([
            {
              provider: 'openai',
              label: 'ChatGPT (OpenAI)',
              baseUrl: 'https://api.openai.com/v1',
              configured: false,
              maskedKey: '',
              updatedAt: null,
            },
            {
              provider: 'anthropic',
              label: 'Claude (Anthropic)',
              baseUrl: 'https://api.anthropic.com/v1',
              configured: false,
              maskedKey: '',
              updatedAt: null,
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App botAdapters={{ simulated: new SimulatedBotAdapter(0) }} />);

    await user.click(screen.getAllByRole('button', { name: /Sign In/i })[0]);

    expect(screen.getByText('Default Admin Credentials')).toBeInTheDocument();
    expect(screen.getByText('admin@ai-agent-tool.dev')).toBeInTheDocument();
    expect(screen.getByText('admin123')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fill Admin Login' }));
    expect(screen.getByLabelText('Email Address')).toHaveValue('admin@ai-agent-tool.dev');
    expect(screen.getByLabelText('Password')).toHaveValue('admin123');

    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('System Administrator')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Admin Console' })).toBeInTheDocument();
    expect(screen.getByText('REST / SSE API')).toBeInTheDocument();
  });

  it('registers a member account and hides Admin Console for non-admin users', async () => {
    const user = userEvent.setup();

    const memberProfile = {
      id: 'member-uuid-1',
      name: 'Regular Member',
      subtitle: 'Developer',
      email: 'member@example.com',
      role: 'MEMBER',
      status: 'ACTIVE',
      avatarUrl: null,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        tokenLimit: 250000,
      },
      modelBreakdown: [],
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/users/register') {
        return new Response(
          JSON.stringify({
            accessToken: 'jwt-member-token',
            user: memberProfile,
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url === '/api/users/me') {
        return new Response(JSON.stringify(memberProfile), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === '/api/chats') {
        return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('{}', { status: 403 });
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App botAdapters={{ simulated: new SimulatedBotAdapter(0) }} />);

    await user.click(screen.getAllByRole('button', { name: /Sign In/i })[0]);
    await user.click(screen.getByRole('tab', { name: 'Create Account' }));

    await user.type(screen.getByLabelText('Full Name'), 'Regular Member');
    await user.type(screen.getByLabelText('Email Address'), 'member@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    // Wait for authenticated workspace
    await waitFor(() => {
      expect(screen.getByText('Regular Member')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Admin Console' })).not.toBeInTheDocument();
  });
});
