export interface QwenMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: QwenToolCall[];
}

export interface QwenToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface QwenToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface QwenChatRequest {
  model?: string;
  messages: QwenMessage[];
  temperature?: number;
  max_tokens?: number;
  enable_thinking?: boolean;
  stream?: boolean;
  tools?: QwenToolDefinition[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

export interface QwenChoice {
  index: number;
  message: {
    role: string;
    content: string | null;
    reasoning_content?: string;
    tool_calls?: QwenToolCall[];
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
  toolCalls?: QwenToolCall[];
  finishReason?: string;
}
