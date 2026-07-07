import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../utils/logger.js';
import type { QwenClient } from '../integrations/qwen/client.js';
import { QWEN_ORCHESTRATOR_TOOLS, QWEN_SYSTEM_PROMPT } from '../integrations/qwen/tools.js';
import type { QwenMessage } from '../integrations/qwen/types.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { ToolContext } from '../types/index.js';

const log = createChildLogger('agents:qwen-loop');

const MAX_TOOL_ITERATIONS = 5;

export interface QwenOrchestrationResult {
  summary: string;
  reasoning?: string;
  toolResults: Array<{ tool: string; data: unknown }>;
}

export async function runQwenOrchestrationLoop(
  qwen: QwenClient,
  toolRegistry: ToolRegistry,
  userId: string,
  userMessage: string,
): Promise<QwenOrchestrationResult> {
  const context: ToolContext = { userId };
  const messages: QwenMessage[] = [
    { role: 'system', content: QWEN_SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  const toolResults: Array<{ tool: string; data: unknown }> = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    let response;
    try {
      response = await qwen.chatWithTools(messages, QWEN_ORCHESTRATOR_TOOLS, {
        enable_thinking: true,
        temperature: 0.3,
      });
    } catch (err) {
      log.error({ err, userId, iteration: i }, 'Qwen request failed');
      throw err;
    }

    if (!response.toolCalls?.length) {
      return {
        summary: response.content || 'No briefing generated.',
        reasoning: response.reasoning,
        toolResults,
      };
    }

    messages.push({
      role: 'assistant',
      content: response.content ?? '',
      tool_calls: response.toolCalls,
    });

    for (const toolCall of response.toolCalls) {
      const toolName = toolCall.function.name;
      log.info({ userId, tool: toolName }, 'Executing Qwen tool call');

      let result;
      try {
        result = await toolRegistry.executeQwenTool(toolName, context);
      } catch (err) {
        log.error({ err, tool: toolName }, 'Tool execution failed');
        result = { success: false, error: err instanceof Error ? err.message : 'Tool failed' };
      }

      const payload = result.success ? result.data : { error: result.error };
      toolResults.push({ tool: toolName, data: payload });

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(payload),
      });
    }
  }

  log.warn({ userId }, 'Qwen tool loop hit max iterations');
  const final = await qwen.chat(messages, { enable_thinking: true, temperature: 0.3 });
  return {
    summary: final.content || 'Briefing compiled with partial data.',
    reasoning: final.reasoning,
    toolResults,
  };
}

export function buildBriefingFromToolResults(
  toolResults: Array<{ tool: string; data: unknown }>,
): { emailCount: number; emails: unknown[]; events: unknown[] } {
  const emails =
    (toolResults.find((t) => t.tool === 'get_unread_emails')?.data as unknown[]) ?? [];
  const events =
    (toolResults.find((t) => t.tool === 'get_calendar_events')?.data as unknown[]) ?? [];

  return {
    emailCount: Array.isArray(emails) ? emails.length : 0,
    emails,
    events,
  };
}

export function generateRequestId(): string {
  return uuidv4();
}
