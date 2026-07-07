import { BaseAgent } from './base-agent.js';
import { createChildLogger } from '../utils/logger.js';
import type { QwenClient } from '../integrations/qwen/client.js';
import {
  runQwenOrchestrationLoop,
  buildBriefingFromToolResults,
  generateRequestId,
} from './qwen-loop.js';
import type { ToolRegistry } from '../tools/registry.js';
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

export interface OrchestratorDeps {
  qwen: QwenClient;
  toolRegistry: ToolRegistry;
}

export class CoordinatorAgent extends BaseAgent {
  readonly role: AgentRole = 'coordinator';
  readonly name = 'Sobat Coordinator';

  private specialists = new Map<AgentRole, BaseAgent>();

  constructor(private deps: OrchestratorDeps) {
    super();
  }

  registerSpecialist(agent: BaseAgent): void {
    this.specialists.set(agent.role, agent);
  }

  async process(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const request = input as unknown as OrchestratorRequest;
    const response = await this.orchestrate(request);
    return response as unknown as Record<string, unknown>;
  }

  async orchestrate(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const requestId = generateRequestId();
    this.setStatus('thinking', 'Analyzing request');

    log.info({ requestId, userId: request.userId, message: request.message }, 'Orchestration started');

    const context: ToolContext = { userId: request.userId };

    const isDailyBriefing =
      request.message.toLowerCase().includes('important') ||
      request.message.toLowerCase().includes('today') ||
      request.message.toLowerCase().includes('briefing') ||
      request.message.toLowerCase().includes('sync');

    let briefing: DailyBriefing | undefined;
    let suggestedActions: SuggestedAction[] = [];
    const tasksCreated: string[] = [];
    const approvalsRequired: string[] = [];
    let summary: string;

    if (this.deps.qwen.isConfigured()) {
      this.setStatus('working', 'Running Qwen orchestration');
      try {
        const qwenResult = await runQwenOrchestrationLoop(
          this.deps.qwen,
          this.deps.toolRegistry,
          request.userId,
          request.message,
        );

        summary = qwenResult.summary;
        const parsed = buildBriefingFromToolResults(qwenResult.toolResults);
        briefing = this.buildBriefingFromLiveData(parsed.emails, parsed.events, parsed.emailCount);
        suggestedActions = this.generateSuggestedActionsFromLiveData(briefing);
      } catch (err) {
        log.error({ err, userId: request.userId }, 'Qwen orchestration failed, falling back to live tools');
        const fallback = await this.buildDailyBriefingLive(context);
        briefing = fallback.briefing;
        summary = fallback.summary;
        suggestedActions = this.generateSuggestedActionsFromLiveData(briefing);
      }
    } else if (isDailyBriefing) {
      this.setStatus('working', 'Gathering live briefing data');
      const fallback = await this.buildDailyBriefingLive(context);
      briefing = fallback.briefing;
      summary = fallback.summary;
      suggestedActions = this.generateSuggestedActionsFromLiveData(briefing);
    } else {
      this.setStatus('working', 'Processing request');
      summary = `Processed your request: "${request.message.slice(0, 80)}"`;
    }

    this.setStatus('idle');

    return {
      requestId,
      summary,
      briefing,
      suggestedActions,
      tasksCreated,
      approvalsRequired,
    };
  }

  private async buildDailyBriefingLive(
    context: ToolContext,
  ): Promise<{ briefing: DailyBriefing; summary: string }> {
    const [emailResult, calendarResult] = await Promise.all([
      this.deps.toolRegistry.execute('gmail', 'get_unread_emails', {}, context),
      this.deps.toolRegistry.execute('calendar', 'get_calendar_events', {}, context),
    ]);

    const emails = emailResult.success
      ? (emailResult.data as Array<{ id: string; sender: string; subject: string; snippet: string }>)
      : [];
    const events = calendarResult.success
      ? (calendarResult.data as Array<{ id: string; title: string; startTime: string; attendees: string[] }>)
      : [];

    const briefing = this.buildBriefingFromLiveData(emails, events, emails.length);
    const summary = this.formatBriefingSummary(briefing);
    return { briefing, summary };
  }

  private buildBriefingFromLiveData(
    emails: unknown[],
    events: unknown[],
    emailCount: number,
  ): DailyBriefing {
    const emailList = emails as Array<{ id: string; sender: string; subject: string; snippet: string }>;
    const eventList = events as Array<{ id: string; title: string; startTime: string; attendees: string[] }>;

    const highlights: BriefingItem[] = emailList.map((msg, i) => ({
      id: msg.id ?? `highlight_${i}`,
      icon: '📬',
      title: msg.subject,
      description: `From: ${msg.sender}`,
      priority: i === 0 ? 'high' : 'medium',
      source: 'gmail' as ToolName,
    }));

    const meetings: BriefingItem[] = eventList.map((evt, i) => ({
      id: evt.id ?? `meeting_${i}`,
      icon: '📅',
      title: evt.title,
      description: evt.startTime
        ? new Date(evt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : undefined,
      priority: 'medium',
      source: 'calendar' as ToolName,
    }));

    return {
      date: new Date().toISOString().split('T')[0],
      emailCount,
      highlights,
      meetings,
      followUps: [],
      reports: [],
    };
  }

  private generateSuggestedActionsFromLiveData(briefing: DailyBriefing): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    if (briefing.highlights.length > 0) {
      const top = briefing.highlights[0];
      actions.push({
        id: uuidv4(),
        label: `Reply to: ${top.title.slice(0, 40)}`,
        description: top.description ?? 'Draft a response',
        action: 'send_email',
        priority: 'high',
        tool: 'gmail',
      });
    }

    if (briefing.meetings.length > 0) {
      actions.push({
        id: uuidv4(),
        label: `Prepare for: ${briefing.meetings[0].title}`,
        description: 'Review meeting details and attendees',
        action: 'create_event',
        priority: 'medium',
        tool: 'calendar',
      });
    }

    return actions;
  }

  private formatBriefingSummary(briefing: DailyBriefing): string {
    const lines = [
      `📬 ${briefing.emailCount} unread email${briefing.emailCount !== 1 ? 's' : ''}`,
      ...briefing.highlights.slice(0, 3).map((h) => `${h.icon} ${h.title}`),
      ...briefing.meetings.slice(0, 3).map((m) => `${m.icon} ${m.title}${m.description ? ` (${m.description})` : ''}`),
    ];
    return lines.join('\n');
  }
}

// ─── Specialist Agents ─────────────────────────────────────────────────────

export class EmailAgent extends BaseAgent {
  readonly role: AgentRole = 'email';
  readonly name = 'Email Agent';

  constructor(private toolRegistry: ToolRegistry) {
    super();
  }

  async process(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const context = input.context as ToolContext;
    this.setStatus('working', 'Processing emails');
    const result = await this.toolRegistry.execute('gmail', 'get_unread_emails', {}, context);
    this.setStatus('idle');
    return { agent: this.role, result };
  }
}

export class CalendarAgent extends BaseAgent {
  readonly role: AgentRole = 'calendar';
  readonly name = 'Calendar Agent';

  constructor(private toolRegistry: ToolRegistry) {
    super();
  }

  async process(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const context = input.context as ToolContext;
    this.setStatus('working', 'Checking calendar');
    const result = await this.toolRegistry.execute('calendar', 'get_calendar_events', {}, context);
    this.setStatus('idle');
    return { agent: this.role, result };
  }
}

export class DocumentsAgent extends BaseAgent {
  readonly role: AgentRole = 'documents';
  readonly name = 'Documents Agent';

  constructor(private toolRegistry: ToolRegistry) {
    super();
  }

  async process(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const context = input.context as ToolContext;
    this.setStatus('working', 'Scanning documents');
    const result = await this.toolRegistry.execute('drive', 'list_recent', {}, context);
    this.setStatus('idle');
    return { agent: this.role, result };
  }
}

export class ReportingAgent extends BaseAgent {
  readonly role: AgentRole = 'reporting';
  readonly name = 'Reporting Agent';

  constructor(private toolRegistry: ToolRegistry) {
    super();
  }

  async process(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const context = input.context as ToolContext;
    this.setStatus('working', 'Preparing reports');
    const result = await this.toolRegistry.execute('sheets', 'get_report', {}, context);
    this.setStatus('idle');
    return { agent: this.role, result };
  }
}

export class SlackAgent extends BaseAgent {
  readonly role: AgentRole = 'slack';
  readonly name = 'Slack Agent';

  constructor(private toolRegistry: ToolRegistry) {
    super();
  }

  async process(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const context = input.context as ToolContext;
    this.setStatus('working', 'Checking Slack');
    const result = await this.toolRegistry.execute('slack', 'list_unread', {}, context);
    this.setStatus('idle');
    return { agent: this.role, result };
  }
}

export function createOrchestrator(deps: OrchestratorDeps): CoordinatorAgent {
  const coordinator = new CoordinatorAgent(deps);
  coordinator.registerSpecialist(new EmailAgent(deps.toolRegistry));
  coordinator.registerSpecialist(new CalendarAgent(deps.toolRegistry));
  coordinator.registerSpecialist(new DocumentsAgent(deps.toolRegistry));
  coordinator.registerSpecialist(new ReportingAgent(deps.toolRegistry));
  coordinator.registerSpecialist(new SlackAgent(deps.toolRegistry));
  return coordinator;
}
