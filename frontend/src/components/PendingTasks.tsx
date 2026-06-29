import { Clock, AlertCircle, CheckCircle2, Circle } from 'lucide-react';
import type { Task, TaskPriority, TaskStatus } from '../types/index.js';

interface PendingTasksProps {
  tasks: Task[];
  loading?: boolean;
}

const priorityColors: Record<TaskPriority, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
};

const statusIcons: Record<TaskStatus, typeof Circle> = {
  pending: Circle,
  queued: Clock,
  in_progress: Clock,
  awaiting_approval: AlertCircle,
  completed: CheckCircle2,
  failed: AlertCircle,
  cancelled: Circle,
};

export function PendingTasks({ tasks, loading }: PendingTasksProps) {
  const pending = tasks.filter((t) => !['completed', 'cancelled'].includes(t.status));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Pending Tasks</h2>
        <p className="text-sm text-gray-500">{pending.length} items need attention</p>
      </div>

      <div className="divide-y divide-gray-100">
        {loading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading tasks...</div>
        ) : pending.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">All caught up!</div>
        ) : (
          pending.map((task) => {
            const StatusIcon = statusIcons[task.status];
            return (
              <div key={task.id} className="px-6 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                <StatusIcon className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColors[task.priority]}`}>
                      {task.priority}
                    </span>
                    {task.assignedAgent && (
                      <span className="text-xs text-gray-400 capitalize">{task.assignedAgent} agent</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
