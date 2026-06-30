import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { AgentState, ApprovalRequest, DailyBriefing, Task } from '../types/index.js';
import { DEMO_USER_ID } from '../lib/api.js';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3001';

interface RealtimeState {
  connected: boolean;
  agents: AgentState[];
  tasks: Task[];
  approvals: ApprovalRequest[];
  briefing: DailyBriefing | null;
  lastEvent: string | null;
}

export function useRealtime(initial?: Partial<RealtimeState>) {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<RealtimeState>({
    connected: false,
    agents: initial?.agents ?? [],
    tasks: initial?.tasks ?? [],
    approvals: initial?.approvals ?? [],
    briefing: initial?.briefing ?? null,
    lastEvent: null,
  });

  useEffect(() => {
    const socket = io(WS_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setState((s) => ({ ...s, connected: true }));
      socket.emit('subscribe', DEMO_USER_ID);
    });

    socket.on('disconnect', () => {
      setState((s) => ({ ...s, connected: false }));
    });

    socket.on('agent:status', (agent: AgentState) => {
      setState((s) => ({
        ...s,
        agents: s.agents.map((a) => (a.id === agent.id ? agent : a)),
        lastEvent: `Agent ${agent.name} is ${agent.status}`,
      }));
    });

    socket.on('task:updated', (task: Task) => {
      setState((s) => ({
        ...s,
        tasks: s.tasks.some((t) => t.id === task.id)
          ? s.tasks.map((t) => (t.id === task.id ? task : t))
          : [task, ...s.tasks],
        lastEvent: `Task updated: ${task.title}`,
      }));
    });

    socket.on('approval:new', (approval: ApprovalRequest) => {
      setState((s) => ({
        ...s,
        approvals: [approval, ...s.approvals],
        lastEvent: `New approval: ${approval.title}`,
      }));
    });

    socket.on('approval:resolved', (approval: ApprovalRequest) => {
      setState((s) => ({
        ...s,
        approvals: s.approvals.map((a) => (a.id === approval.id ? approval : a)),
        lastEvent: `Approval ${approval.status}: ${approval.title}`,
      }));
    });

    socket.on('briefing:ready', (briefing: DailyBriefing) => {
      setState((s) => ({ ...s, briefing, lastEvent: 'Daily briefing ready' }));
    });

    socket.on('orchestrator:progress', (data: { step: string; agent: string }) => {
      setState((s) => ({ ...s, lastEvent: `Orchestrator: ${data.step} (${data.agent})` }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const setInitialData = useCallback((data: Partial<RealtimeState>) => {
    setState((s) => ({ ...s, ...data }));
  }, []);

  return { ...state, setInitialData };
}
