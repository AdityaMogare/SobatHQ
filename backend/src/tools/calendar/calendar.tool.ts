import { BaseTool } from '../base-tool.js';
import type { ToolContext, ToolDefinition, ToolResult } from '../../types/index.js';

export class CalendarTool extends BaseTool {
  readonly definition: ToolDefinition = {
    name: 'calendar',
    displayName: 'Google Calendar',
    description: 'View and manage calendar events and meetings',
    requiredScopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    actions: ['list_today', 'get_event', 'create_event', 'find_conflicts', 'reschedule'],
  };

  async execute(
    action: string,
    params: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    if (!context.accessToken) return this.notConfigured();

    switch (action) {
      case 'list_today':
        return this.listToday(context);
      case 'create_event':
        return this.createEvent(context, params);
      case 'find_conflicts':
        return this.findConflicts(context, params);
      default:
        return { success: false, error: `Unknown Calendar action: ${action}` };
    }
  }

  private async listToday(_context: ToolContext): Promise<ToolResult> {
    return {
      success: true,
      data: {
        events: [
          {
            id: 'evt_1',
            title: 'Team Standup',
            start: new Date().setHours(10, 0, 0, 0),
            end: new Date().setHours(10, 30, 0, 0),
          },
          {
            id: 'evt_2',
            title: 'Interview (moved to 3 PM)',
            start: new Date().setHours(15, 0, 0, 0),
            end: new Date().setHours(16, 0, 0, 0),
            updated: true,
          },
        ],
      },
      metadata: { stub: true },
    };
  }

  private async createEvent(
    _context: ToolContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    return {
      success: true,
      data: {
        title: params.title,
        start: params.start,
        end: params.end,
        requiresApproval: true,
      },
      metadata: { stub: true },
    };
  }

  private async findConflicts(
    _context: ToolContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    return {
      success: true,
      data: { conflicts: [], requestedSlot: params },
      metadata: { stub: true },
    };
  }
}
