import { Sparkles, RefreshCw } from 'lucide-react';
import type { DailyBriefing } from '../types/index.js';

interface BriefingCardProps {
  briefing: DailyBriefing | null;
  summary: string | null;
  onRefresh: () => void;
  loading?: boolean;
}

export function BriefingCard({ briefing, summary, onRefresh, loading }: BriefingCardProps) {
  const items = briefing
    ? [
        { icon: '📬', text: `${briefing.emailCount} new emails` },
        ...briefing.highlights.map((h) => ({ icon: h.icon, text: h.title })),
        ...briefing.meetings.filter((m) => m.title.includes('moved')).map((m) => ({ icon: m.icon, text: m.title })),
        ...briefing.reports.map((r) => ({ icon: r.icon, text: r.title })),
        ...briefing.followUps.map((f) => ({ icon: f.icon, text: f.title })),
      ]
    : [];

  return (
    <div className="bg-gradient-to-br from-sobat-600 to-sobat-800 rounded-xl text-white shadow-lg">
      <div className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6" />
          <div>
            <h2 className="text-lg font-semibold">Today's Briefing</h2>
            <p className="text-sobat-200 text-sm">What's important today</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="px-6 pb-6">
        {loading ? (
          <p className="text-sobat-200 text-sm">Gathering your briefing...</p>
        ) : items.length > 0 ? (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        ) : summary ? (
          <pre className="text-sm whitespace-pre-wrap font-sans text-sobat-100">{summary}</pre>
        ) : (
          <p className="text-sobat-200 text-sm">Click refresh to get your daily briefing</p>
        )}
      </div>
    </div>
  );
}
