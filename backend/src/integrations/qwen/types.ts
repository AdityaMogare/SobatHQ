export interface QwenMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface QwenChatRequest {
  model?: string;
  messages: QwenMessage[];
  temperature?: number;
  max_tokens?: number;
  enable_thinking?: boolean;
  stream?: boolean;
}

export interface QwenThinkingBlock {
  type: 'thinking';
  thinking: string;
}

export interface QwenTextBlock {
  type: 'text';
  text: string;
}

export interface QwenChoice {
  index: number;
  message: {
    role: string;
    content: string;
    reasoning_content?: string;
  };
  finish_reason: string;
}

export interface QwenChatResponse {
  id: string;
  model: string;
  choices: QwenChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface QwenChatResult {
  content: string;
  reasoning?: string;
  model: string;
  usage?: QwenChatResponse['usage'];
}
