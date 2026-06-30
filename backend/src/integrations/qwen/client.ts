import { env } from '../../config/env.js';
import { createChildLogger } from '../../utils/logger.js';
import type { QwenChatRequest, QwenChatResponse, QwenChatResult, QwenMessage } from './types.js';

const log = createChildLogger('integrations:qwen');

export class QwenClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private enableReasoning: boolean;

  constructor() {
    if (!env.QWEN_API_KEY) {
      log.warn('QWEN_API_KEY not set — Qwen client will throw on use');
    }
    this.apiKey = env.QWEN_API_KEY ?? '';
    this.baseUrl = env.QWEN_API_BASE.replace(/\/$/, '');
    this.model = env.QWEN_MODEL;
    this.enableReasoning = env.QWEN_ENABLE_REASONING;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async chat(
    messages: QwenMessage[],
    options?: Partial<Omit<QwenChatRequest, 'messages'>>,
  ): Promise<QwenChatResult> {
    if (!this.apiKey) {
      throw new Error('Qwen API key not configured. Set QWEN_API_KEY in environment.');
    }

    const body: QwenChatRequest = {
      model: options?.model ?? this.model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 4096,
      enable_thinking: options?.enable_thinking ?? this.enableReasoning,
      stream: false,
    };

    log.info({ model: body.model, enableThinking: body.enable_thinking }, 'Qwen chat request');

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error({ status: response.status, error: errorText }, 'Qwen API error');
      throw new Error(`Qwen API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as QwenChatResponse;
    const choice = data.choices[0];
    if (!choice) {
      throw new Error('Qwen API returned no choices');
    }

    const result: QwenChatResult = {
      content: choice.message.content,
      reasoning: choice.message.reasoning_content,
      model: data.model,
      usage: data.usage,
    };

    log.info(
      {
        model: data.model,
        hasReasoning: !!result.reasoning,
        tokens: data.usage?.total_tokens,
      },
      'Qwen chat completed',
    );

    return result;
  }

  async reason(prompt: string, systemPrompt?: string): Promise<QwenChatResult> {
    const messages: QwenMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    return this.chat(messages, { enable_thinking: true });
  }
}

export const qwenClient = new QwenClient();
