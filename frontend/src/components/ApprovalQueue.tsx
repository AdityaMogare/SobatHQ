import { Check, X, Mail, MessageSquare, Calendar, FileText } from 'lucide-react';
import type { ApprovalRequest } from '../types/index.js';

interface ApprovalQueueProps {
  approvals: ApprovalRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  loading?: boolean;
}

const actionIcons: Record<string, typeof Mail> = {
  send_email: Mail,
  reply_slack: MessageSquare,
  create_event: Calendar,
  update_sheet: FileText,
  share_document: FileText,
  custom: FileText,
};

export function ApprovalQueue({ approvals, onApprove, onReject, loading }: ApprovalQueueProps) {
  const pending = approvals.filter((a) => a.status === 'pending');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Approval Queue</h2>
        <p className="text-sm text-gray-500">
          {pending.length} action{pending.length !== 1 ? 's' : ''} awaiting your approval
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {loading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading approvals...</div>
        ) : pending.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No pending approvals</div>
        ) : (
          pending.map((approval) => {
            const ActionIcon = actionIcons[approval.action] ?? FileText;
            return (
              <div key={approval.id} className="px-6 py-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-sobat-50 flex items-center justify-center shrink-0">
                    <ActionIcon className="w-5 h-5 text-sobat-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900">{approval.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{approval.description}</p>

                    {approval.preview && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                    {approval.preview.to != null && (
                      <p className="text-gray-600"><span className="font-medium">To:</span> {String(approval.preview.to)}</p>
                    )}
                    {approval.preview.subject != null && (
                      <p className="text-gray-600 mt-1"><span className="font-medium">Subject:</span> {String(approval.preview.subject)}</p>
                    )}
                    {approval.preview.body != null && (
                      <p className="text-gray-700 mt-2 whitespace-pre-wrap">{String(approval.preview.body)}</p>
                    )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-4">
                      <button
                        onClick={() => onApprove(approval.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-sobat-600 text-white text-sm font-medium rounded-lg hover:bg-sobat-700 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => onReject(approval.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
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
