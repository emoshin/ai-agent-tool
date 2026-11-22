import { Bot } from 'lucide-react';
import type { ModelProvider } from '../types/chat';
import { getModelProvider } from '../utils/defaults';

interface ModelIconProps {
  modelId?: string;
  provider?: ModelProvider;
  className?: string;
}

export function ChatGptIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      data-testid="chatgpt-icon"
    >
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

export function ClaudeIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      data-testid="claude-icon"
    >
      <path d="M12 2.25c.52 0 .95.39 1.02.9l.77 5.34 4.02-3.6c.39-.35.98-.32 1.33.07.34.39.31.98-.08 1.33l-4.01 3.59 5.31.78c.51.08.88.53.83 1.05-.05.51-.49.9-1.01.88l-5.36-.18 3.12 4.39c.3.42.21 1-.21 1.31-.42.31-1.01.22-1.32-.2L13.3 13.5l-.27 5.35c-.03.52-.46.93-.98.93s-.95-.41-.98-.93l-.27-5.35-3.11 4.41c-.31.42-.9.51-1.32.2-.42-.31-.51-.89-.21-1.31l3.12-4.39-5.36.18c-.52.02-.96-.37-1.01-.88-.05-.52.32-.97.83-1.05l5.31-.78-4.01-3.59c-.39-.35-.42-.94-.08-1.33.35-.39.94-.42 1.33-.07l4.02 3.6.77-5.34c.07-.51.5-.9 1.02-.9Z" />
    </svg>
  );
}

export function ModelIcon({ modelId, provider, className = 'h-4 w-4' }: ModelIconProps) {
  const resolvedProvider = provider ?? getModelProvider(modelId ?? '');

  if (resolvedProvider === 'anthropic') {
    return <ClaudeIcon className={`${className} text-[#d97757]`} />;
  }

  if (resolvedProvider === 'openai') {
    return <ChatGptIcon className={`${className} text-[#10a37f]`} />;
  }

  return <Bot className={`${className} text-[#b4b4b4]`} aria-hidden="true" data-testid="custom-bot-icon" />;
}
