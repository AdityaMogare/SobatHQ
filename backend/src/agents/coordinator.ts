import { BaseAgent } from './base-agent.js';
import { createChildLogger } from '../utils/logger.js';
import { toolRegistry } from '../tools/registry.js';
import type {
  AgentRole,
  BriefingItem,
  DailyBriefing,
  OrchestratorRequest,
  OrchestratorResponse,
  SuggestedAction,
  ToolContext,
  ToolName,
} from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

const log = createChildLogger('agents:coordinator');

interface SpecialistResult {
  agent: AgentRole;
  data: Record<string, unknown>;
}

export class CoordinatorAgent extends BaseAgent {
  readonly role: AgentRole = 'coordinator';
  readonly name = 'Sobat Coordinator';

  private specialists = new Map<AgentRole, BaseAgent>();

  registerSpecialist(agent: BaseAgent): void {
    this.specialists.set(agent.role, agent);
  }

  async process(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const request = input as unknown as OrchestratorRequest;
    const response = await this.orchestrate(request);
    return response as unknown as Record<string, unknown>;
  }

  async orchestrate(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const requestId = uuidv4();
    this.setStatus('thinking', 'Analyzing request');

    log.info({ requestId, userId: request.userId, message: request.message }, 'Orchestration started');

    const context: ToolContext = {
      userId: request.userId,
      accessToken: 'stub-token',
    };

    const isDailyBriefing =
      request.message.toLowerCase().includes('important') ||
      request.message.toLowerCase().includes('today') ||
      request.message.toLowerCase().includes('briefing');

    let briefing: DailyBriefing | undefined;
    const suggestedActions: SuggestedAction[] = [];
    const tasksCreated: string[] = [];
    const approvalsRequired: string[] = [];

    if (isDailyBriefing) {
      this.setStatus('working', 'Gathering daily briefing');
      briefing = await this.buildDailyBriefing(context);
      suggestedActions.push(
        ...this.generateSuggestedActions(briefing),
      );
    } else {
      this.setStatus('working', 'Processing request');
      const intent = this.classifyIntent(request.message);
      const results = await this.delegateToSpecialists(intent, context, request.message);
      for (const result of results) {
        if (result.data.taskId) tasksCreated.push(result.data.taskId as string);
        if (result.data.approvalId) approvalsRequired.push(result.data.approvalId as string);
      }
    }

    this.setStatus('idle');

    const summary = briefing
      ? this.formatBriefingSummary(briefing)
      : `Processed your request: "${request.message.slice(0, 80)}"`;

    return {
      requestId,
      summary,
      briefing,
      suggestedActions,
      tasksCreated,
      approvalsRequired,
    };
  }

  private classifyIntent(message: string): AgentRole[] {
    const lower = message.toLowerCase();
    const agents: AgentRole[] = [];

    if (lower.includes('email') || lower.includes('inbox') || lower.includes('reply')) {
      agents.push('email');
    }
    if (lower.includes('calendar') || lower.includes('meeting') || lower.includes('schedule')) {
      agents.push('calendar');
    }
    if (lower.includes('document') || lower.includes('drive') || lower.includes('file')) {
      agents.push('documents');
    }
    if (lower.includes('report') || lower.includes('sheet')) {
      agents.push('reporting');
    }
    if (lower.includes('slack') || lower.includes('message')) {
      agents.push('slack');
    }

    return agents.length > 0 ? agents : ['email', 'calendar', 'documents'];
  }

  private async delegateToSpecialists(
    roles: AgentRole[],
    context: ToolContext,
    message: string,
  ): Promise<SpecialistResult[]> {
    const results: SpecialistResult[] = [];

    for (const role of roles) {
      const specialist = this.specialists.get(role);
      if (specialist) {
        const data = await specialist.process({ context, message });
        results.push({ agent: role, data });
      } else {
        const toolNames = toolRegistry.getToolsForAgent(role);
        for (const toolName of toolNames) {
          const result = await toolRegistry.execute(toolName, 'list_unread', {}, context);
          results.push({ agent: role, data: { tool: toolName, result } });
        }
      }
    }

    return results;
  }

  private async buildDailyBriefing(context: ToolContext): Promise<DailyBriefing> {
    const [emailResult, calendarResult, sheetsResult] = await Promise.all([
      toolRegistry.execute('gmail', 'list_unread', {}, context),
      toolRegistry.execute('calendar', 'list_today', {}, context),
      toolRegistry.execute('sheets', 'get_report', {}, context),
    ]);

    const emailData = emailResult.data as { count?: number; messages?: Array<{ subject: string; from: string }> } | undefined;
    const calendarData = calendarResult.data as { events?: Array<{ title: string; updated?: boolean }> } | undefined;
    const reportData = sheetsResult.data as { title?: string; status?: string } | undefined;

    const highlights: BriefingItem[] = (emailData?.messages ?? []).map((msg, i) => ({
      id: `highlight_${i}`,
      icon: i === 0 ? '✅' : '📬',
      title: msg.subject,
      description: `From: ${msg.from}`,
      priority: i === 0 ? 'urgent' : 'medium',
      source: 'gmail' as ToolName,
    }));

    const meetings: BriefingItem[] = (calendarData?.events ?? []).map((evt, i) => ({
      id: `meeting_${i}`,
      icon: evt.updated ? '📅' : '🗓️',
      title: evt.title,
      priority: evt.updated ? 'high' : 'medium',
      source: 'calendar' as ToolName,
    }));

    const followUps: BriefingItem[] = [
      {
        id: 'followup_1',
        icon: '⚠️',
        title: 'Recruiter follow-up due today',
        priority: 'urgent',
        source: 'gmail',
      },
    ];

    const reports: BriefingItem[] = reportData
      ? [{
          id: 'report_1',
          icon: '📄',
          title: `${reportData.title} is ${reportData.status}`,
          priority: 'medium',
          source: 'sheets',
        }]
      : [];

    return {
      date: new Date().toISOString().split('T')[0],
      emailCount: emailData?.count ?? 0,
      highlights,
      meetings,
      followUps,
      reports,
    };
  }

  private generateSuggestedActions(briefing: DailyBriefing): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    if (briefing.highlights.some((h) => h.title.toLowerCase().includes('recruiter'))) {
      actions.push({
        id: uuidv4(),
        label: 'Reply to Amazon recruiter',
        description: 'Draft a response confirming availability',
        action: 'send_email',
        priority: 'urgent',
        tool: 'gmail',
      });
    }

    if (briefing.meetings.some((m) => m.title.toLowerCase().includes('interview'))) {
      actions.push({
        id: uuidv4(),
        label: 'Confirm Thursday interview',
        description: 'Send confirmation for the rescheduled interview',
        action: 'create_event',
        priority: 'high',
        tool: 'calendar',
      });
    }

    if (briefing.reports.length > 0) {
      actions.push({
        id: uuidv4(),
        label: 'Review and approve weekly report',
        description: 'Weekly report is compiled and ready for your review',
        action: 'update_sheet',
        priority: 'medium',
        tool: 'sheets',
      });
    }

    return actions;
  }

  private formatBriefingSummary(briefing: DailyBriefing): string {
    const lines = [
      `📬 ${briefing.emailCount} new emails`,
      ...briefing.highlights.slice(0, 2).map((h) => `${h.icon} ${h.title}`),
      ...briefing.meetings.filter((m) => m.title.includes('moved')).map((m) => `${m.icon} ${m.title}`),
      ...briefing.reports.map((r) => `${r.icon} ${r.title}`),
      ...briefing.followUps.map((f) => `${f.icon} ${f.title}`),
    ];
    return lines.join('\n');
  }
}

// ─── Specialist Agents ─────────────────────────────────────────────────────

export class EmailAgent extends BaseAgent {
  readonly role: AgentRole = 'email';
  readonly name = 'Email Agent';

  async process(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const context = input.context as ToolContext;
    this.setStatus('working', 'Processing emails');
    const result = await toolRegistry.execute('gmail', 'prioritize_inbox', {}, context);
    this.setStatus('idle');
    return { agent: this.role, result };
  }
}

export class CalendarAgent extends BaseAgent {
  readonly role: AgentRole = 'calendar';
  readonly name = 'Calendar Agent';

  async process(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const context = input.context as ToolContext;
    this.setStatus('working', 'Checking calendar');
    const result = await toolRegistry.execute('calendar', 'list_today', {}, context);
    this.setStatus('idle');
    return { agent: this.role, result };
  }
}

export class DocumentsAgent extends BaseAgent {
  readonly role: AgentRole = 'documents';
  readonly name = 'Documents Agent';

  async process(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const context = input.context as ToolContext;
    this.setStatus('working', 'Scanning documents');
    const result = await toolRegistry.execute('drive', 'list_recent', {}, context);
    this.setStatus('idle');
    return { agent: this.role, result };
  }
}

export class ReportingAgent extends BaseAgent {
  readonly role: AgentRole = 'reporting';
  readonly name = 'Reporting Agent';

  async process(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const context = input.context as ToolContext;
    this.setStatus('working', 'Preparing reports');
    const result = await toolRegistry.execute('sheets', 'get_report', {}, context);
    this.setStatus('idle');
    return { agent: this.role, result };
  }
}

export class SlackAgent extends BaseAgent {
  readonly role: AgentRole = 'slack';
  readonly name = 'Slack Agent';

  async process(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const context = input.context as ToolContext;
    this.setStatus('working', 'Checking Slack');
    const result = await toolRegistry.execute('slack', 'list_unread', {}, context);
    this.setStatus('idle');
    return { agent: this.role, result };
  }
}

export function createOrchestrator(): CoordinatorAgent {
  const coordinator = new CoordinatorAgent();
  coordinator.registerSpecialist(new EmailAgent());
  coordinator.registerSpecialist(new CalendarAgent());
  coordinator.registerSpecialist(new DocumentsAgent());
  coordinator.registerSpecialist(new ReportingAgent());
  coordinator.registerSpecialist(new SlackAgent());
  return coordinator;
}
