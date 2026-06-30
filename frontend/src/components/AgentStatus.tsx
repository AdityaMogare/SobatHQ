import { Bot, Brain, Loader2, Pause, AlertTriangle } from 'lucide-react';
import type { AgentState, AgentStatus } from '../types/index.js';

interface AgentStatusPanelProps {
  agents: AgentState[];
}

const statusConfig: Record<AgentStatus, { icon: typeof Bot; color: string; label: string }> = {
  idle: { icon: Pause, color: 'text-gray-400 bg-gray-100', label: 'Idle' },
  thinking: { icon: Brain, color: 'text-purple-600 bg-purple-100', label: 'Thinking' },
  working: { icon: Loader2, color: 'text-sobat-600 bg-sobat-100', label: 'Working' },
  waiting_approval: { icon: AlertTriangle, color: 'text-amber-600 bg-amber-100', label: 'Awaiting Approval' },
  error: { icon: AlertTriangle, color: 'text-red-600 bg-red-100', label: 'Error' },
};

const roleEmojis: Record<string, string> = {
  coordinator: '🎯',
  email: '📧',
  calendar: '📅',
  documents: '📄',
  reporting: '📊',
  slack: '💬',
};

export function AgentStatusPanel({ agents }: AgentStatusPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Agent Status</h2>
        <p className="text-sm text-gray-500">{agents.length} agents online</p>
      </div>

      <div className="p-4 grid grid-cols-2 gap-3">
        {agents.map((agent) => {
          const config = statusConfig[agent.status];
          const StatusIcon = config.icon;
          const isSpinning = agent.status === 'working';

          return (
            <div
              key={agent.id}
              className="p-4 rounded-lg border border-gray-100 hover:border-sobat-200 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{roleEmojis[agent.role] ?? '🤖'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{agent.name}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${config.color}`}>
                      <StatusIcon className={`w-3 h-3 ${isSpinning ? 'animate-spin' : ''}`} />
                      {config.label}
                    </span>
                  </div>
                  {agent.currentTask && (
                    <p className="text-xs text-gray-400 mt-1 truncate">{agent.currentTask}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
