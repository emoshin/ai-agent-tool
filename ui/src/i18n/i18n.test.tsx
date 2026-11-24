import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { SimulatedBotAdapter } from '../services/botClient';
import { en } from './en';
import { translate } from './I18nContext';
import { ru } from './ru';

describe('Localization (English & Russian)', () => {
  it('provides full translation key parity between English and Russian dictionaries and interpolates parameters', () => {
    const enKeys = Object.keys(en).sort();
    const ruKeys = Object.keys(ru).sort();
    expect(ruKeys).toEqual(enKeys);

    for (const key of ruKeys) {
      expect(ru[key as keyof typeof en].trim().length).toBeGreaterThan(0);
    }

    expect(translate('ru', 'admin.passwordUpdated', { target: 'Alice' })).toBe(
      'Пароль обновлён для Alice.'
    );
    expect(translate('en', 'admin.passwordUpdated', { target: 'Alice' })).toBe(
      'Password updated for Alice.'
    );
  });

  it('switches UI between English and Russian across Chat, Settings, Admin Console, and AuthScreen and persists locale', async () => {
    const user = userEvent.setup();
    render(<App botAdapters={{ simulated: new SimulatedBotAdapter(0) }} />);

    // Default English
    expect(screen.getByPlaceholderText('Message AI Bot...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New chat' })).toBeInTheDocument();

    // Switch to Russian via header LanguageSwitcher dropdown
    const switcher = screen.getByTestId('language-switcher');
    const trigger = within(switcher).getByRole('button', { name: /Language: English/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const listbox = within(switcher).getByRole('listbox', { name: 'Language' });
    await user.click(within(listbox).getByRole('option', { name: /Русский/i }));

    expect(localStorage.getItem('ai_agent_ui_locale_v1')).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
    expect(screen.getByPlaceholderText('Напишите сообщение ИИ-боту...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Новый чат' })).toBeInTheDocument();
    expect(screen.getByText('Сегодня')).toBeInTheDocument();

    // Start new chat and verify empty-state Russian strings
    await user.click(screen.getByRole('button', { name: 'Новый чат' }));
    expect(screen.getByText('Чем я могу помочь?')).toBeInTheDocument();

    // Open Settings and verify Russian labels + dropdown in Settings
    await user.click(screen.getByRole('button', { name: 'Открыть настройки' }));
    const settingsDialog = screen.getByRole('dialog');
    expect(within(settingsDialog).getByText('Настройки бота и профиля')).toBeInTheDocument();
    expect(within(settingsDialog).getByText('Язык интерфейса')).toBeInTheDocument();
    const settingsSwitcher = within(settingsDialog).getByTestId('language-switcher');
    expect(within(settingsSwitcher).getByRole('button', { name: /Язык: Русский/i })).toBeInTheDocument();
    await user.click(within(settingsDialog).getByRole('button', { name: 'Закрыть настройки' }));

    // Open Admin Console and verify Russian tabs, KPIs, and modals
    await user.click(screen.getByRole('button', { name: 'Открыть панель администратора' }));
    expect(screen.getByText('Панель администратора')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Статистика пользователей' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'API-токены' })).toBeInTheDocument();

    // Switch to API Tokens tab in Russian
    await user.click(screen.getByRole('tab', { name: 'API-токены' }));
    expect(screen.getByText('Ключи провайдеров ИИ (PostgreSQL)')).toBeInTheDocument();

    // Switch back to User Statistics and open Add User modal in Russian
    await user.click(screen.getByRole('tab', { name: 'Статистика пользователей' }));
    await user.click(screen.getByRole('button', { name: 'Добавить пользователя' }));
    expect(screen.getByRole('heading', { name: 'Новый пользователь' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Отмена' }));

    // Switch back to English from Admin header dropdown
    const adminSwitcher = screen.getByTestId('language-switcher');
    await user.click(within(adminSwitcher).getByRole('button', { name: /Язык: Русский/i }));
    await user.click(within(adminSwitcher).getByRole('option', { name: /English/i }));
    expect(localStorage.getItem('ai_agent_ui_locale_v1')).toBe('en');
    expect(screen.getByText('Admin Console')).toBeInTheDocument();

    // Return to Chat and open AuthScreen, switch to Russian via AuthScreen dropdown
    await user.click(screen.getByRole('button', { name: 'Back to Chat' }));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const authSwitcher = screen.getByTestId('language-switcher');
    await user.click(within(authSwitcher).getByRole('button', { name: /Language: English/i }));
    await user.click(within(authSwitcher).getByRole('option', { name: /Русский/i }));
    expect(screen.getByRole('tab', { name: 'Регистрация' })).toBeInTheDocument();
    expect(screen.getByText('Учётные данные администратора по умолчанию')).toBeInTheDocument();
  });
});
