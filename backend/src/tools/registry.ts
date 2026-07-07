import { createChildLogger } from '../utils/logger.js';
import type { ToolContext, ToolDefinition, ToolName, ToolResult } from '../types/index.js';
import type { GoogleOAuthService } from '../auth/google.oauth.js';
import type { TokenStore } from '../auth/token-store.js';
import { BaseTool } from './base-tool.js';
import { GmailTool } from './gmail/gmail.tool.js';
import { CalendarTool } from './calendar/calendar.tool.js';
import { DriveTool } from './drive/drive.tool.js';
import { SheetsTool } from './sheets/sheets.tool.js';
import { SlackTool } from './slack/slack.tool.js';

const log = createChildLogger('tools:registry');

const TOOL_TIMEOUT_MS = 15_000;

export class ToolRegistry {
  private tools = new Map<ToolName, BaseTool>();

  constructor(tokenStore?: TokenStore, googleOAuth?: GoogleOAuthService) {
    this.register(new GmailTool(tokenStore, googleOAuth));
    this.register(new CalendarTool(tokenStore, googleOAuth));
    this.register(new DriveTool());
    this.register(new SheetsTool());
    this.register(new SlackTool());
    log.info({ tools: this.listTools().map((t) => t.name) }, 'Tool registry initialized');
  }

  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: ToolName): BaseTool | undefined {
    return this.tools.get(name);
  }

  listTools(): ToolDefinition[] {
    return [...this.tools.values()].map((t) => t.definition);
  }

  async execute(
    toolName: ToolName,
    action: string,
    params: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { success: false, error: `Tool not found: ${toolName}` };
    }
    if (!tool.supportsAction(action)) {
      return { success: false, error: `Action "${action}" not supported by ${toolName}` };
    }

    log.info({ tool: toolName, action, userId: context.userId }, 'Executing tool action');
    const start = Date.now();

    try {
      const result = await Promise.race([
        tool.execute(action, params, context),
        new Promise<ToolResult>((_, reject) =>
          setTimeout(() => reject(new Error(`Tool ${toolName}.${action} timed out`)), TOOL_TIMEOUT_MS),
        ),
      ]);
      log.info(
        { tool: toolName, action, durationMs: Date.now() - start, success: result.success },
        'Tool action completed',
      );
      return result;
    } catch (err) {
      log.error({ err, tool: toolName, action }, 'Tool action failed');
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /** Execute Qwen-facing tool names */
  async executeQwenTool(
    toolName: string,
    context: ToolContext,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'get_unread_emails':
        return this.execute('gmail', 'get_unread_emails', {}, context);
      case 'get_calendar_events':
        return this.execute('calendar', 'get_calendar_events', {}, context);
      default:
        return { success: false, error: `Unknown Qwen tool: ${toolName}` };
    }
  }

  getToolsForAgent(agentRole: string): ToolName[] {
    const mapping: Record<string, ToolName[]> = {
      coordinator: ['gmail', 'calendar', 'drive', 'sheets', 'slack'],
      email: ['gmail'],
      calendar: ['calendar'],
      documents: ['drive', 'sheets'],
      slack: ['slack'],
      reporting: ['sheets', 'drive'],
    };
    return mapping[agentRole] ?? [];
  }
}

export function createToolRegistry(tokenStore: TokenStore, googleOAuth: GoogleOAuthService): ToolRegistry {
  return new ToolRegistry(tokenStore, googleOAuth);
}
