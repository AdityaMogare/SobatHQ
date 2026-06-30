import { createChildLogger } from '../utils/logger.js';
import type { ToolContext, ToolDefinition, ToolName, ToolResult } from '../types/index.js';
import { BaseTool } from './base-tool.js';
import { GmailTool } from './gmail/gmail.tool.js';
import { CalendarTool } from './calendar/calendar.tool.js';
import { DriveTool } from './drive/drive.tool.js';
import { SheetsTool } from './sheets/sheets.tool.js';
import { SlackTool } from './slack/slack.tool.js';

const log = createChildLogger('tools:registry');

export class ToolRegistry {
  private tools = new Map<ToolName, BaseTool>();

  constructor() {
    this.register(new GmailTool());
    this.register(new CalendarTool());
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
      const result = await tool.execute(action, params, context);
      log.info({ tool: toolName, action, durationMs: Date.now() - start, success: result.success }, 'Tool action completed');
      return result;
    } catch (err) {
      log.error({ err, tool: toolName, action }, 'Tool action failed');
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
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

export const toolRegistry = new ToolRegistry();
