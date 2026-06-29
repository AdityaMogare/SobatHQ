import {
  Bot,
  Calendar,
  FileText,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Settings,
  Sheet,
} from 'lucide-react';
import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  connected: boolean;
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: Mail, label: 'Email', active: false },
  { icon: Calendar, label: 'Calendar', active: false },
  { icon: FileText, label: 'Documents', active: false },
  { icon: Sheet, label: 'Reports', active: false },
  { icon: MessageSquare, label: 'Slack', active: false },
  { icon: Settings, label: 'Settings', active: false },
];

export function Layout({ children, connected }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sobat-600 flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-lg">SobatHQ</h1>
              <p className="text-xs text-gray-500">AI Chief of Staff</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-sobat-50 text-sobat-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-400'}`} />
            {connected ? 'Live updates active' : 'Connecting...'}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
