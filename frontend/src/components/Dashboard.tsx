import { useCallback, useEffect, useState } from 'react';
import { Layout } from './Layout.js';
import { PendingTasks } from './PendingTasks.js';
import { AgentStatusPanel } from './AgentStatus.js';
import { ApprovalQueue } from './ApprovalQueue.js';
import { BriefingCard } from './BriefingCard.js';
import { useRealtime } from '../hooks/useRealtime.js';
import { api } from '../lib/api.js';

export function Dashboard() {
  const realtime = useRealtime();
  const [loading, setLoading] = useState(true);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [tasks, approvals, agents] = await Promise.all([
        api.getTasks(),
        api.getApprovals(),
        api.getAgents(),
      ]);
      realtime.setInitialData({ tasks, approvals, agents });
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [realtime.setInitialData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshBriefing = async () => {
    setBriefingLoading(true);
    try {
      const result = await api.getBriefing();
      setSummary(result.summary);
      if (result.briefing) {
        realtime.setInitialData({ briefing: result.briefing });
      }
    } catch (err) {
      console.error('Failed to load briefing:', err);
    } finally {
      setBriefingLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.approve(id);
      await loadData();
    } catch (err) {
      console.error('Failed to approve:', err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.reject(id);
      await loadData();
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  };

  return (
    <Layout connected={realtime.connected}>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Good morning</h1>
          <p className="text-gray-500 mt-1">
            Your AI Chief of Staff is ready. Review pending items and approve actions below.
          </p>
          {realtime.lastEvent && (
            <p className="text-xs text-sobat-600 mt-2">{realtime.lastEvent}</p>
          )}
        </header>

        <BriefingCard
          briefing={realtime.briefing}
          summary={summary}
          onRefresh={refreshBriefing}
          loading={briefingLoading}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PendingTasks tasks={realtime.tasks} loading={loading} />
          <AgentStatusPanel agents={realtime.agents} />
        </div>

        <ApprovalQueue
          approvals={realtime.approvals}
          onApprove={handleApprove}
          onReject={handleReject}
          loading={loading}
        />
      </div>
    </Layout>
  );
}
