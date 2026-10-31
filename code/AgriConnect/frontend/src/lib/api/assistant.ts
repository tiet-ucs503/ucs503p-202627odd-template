import { apiRequest, apiRequestBlob } from './client';
import type { Locale } from '@/lib/i18n/locales';

export type AssistantChatRole = 'user' | 'assistant';

export interface AssistantTurn {
  role: AssistantChatRole;
  content: string;
}

export interface AssistantCitation {
  id: string;
  title: string;
  source: string;
}

export interface AssistantReply {
  reply: string;
  source: 'gemini' | 'local' | 'grounded' | 'escalated' | 'refused';
  mode?: 'chat' | 'grounded' | 'escalated' | 'refused';
  citations?: AssistantCitation[];
  escalated?: boolean;
  escalationId?: string;
  escalationReason?: string;
}

export interface AssistantStatus {
  configured: boolean;
  connected: boolean;
  model: string;
  source: 'gemini' | 'local';
}

export function getAssistantStatus() {
  return apiRequest<AssistantStatus>('/api/v1/assistant/status');
}

export function queryAssistant(input: {
  message: string;
  history?: AssistantTurn[];
  language?: Locale;
}) {
  return apiRequest<AssistantReply>('/api/v1/assistant/query', {
    method: 'POST',
    body: {
      message: input.message,
      history: input.history ?? [],
      language: input.language,
    },
  });
}

export function speakAssistant(input: { text: string; language?: Locale }) {
  return apiRequestBlob('/api/v1/assistant/speak', {
    method: 'POST',
    body: {
      text: input.text,
      language: input.language,
    },
  });
}
