import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useTask } from '../../context/TaskContext';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { UniversalSearchModal } from '../search/UniversalSearchModal';
import { AIAssistantDrawer } from '../ai/AIAssistantDrawer';
import { ReminderBanner } from '../reminders/ReminderBanner';
import { AlertTriangle, Database, Sparkles } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const {
    isCreateModalOpen,
    closeCreateModal,
    createModalDefaults,
    isConfigured,
    isUniversalSearchOpen,
    universalSearchQuery,
    closeUniversalSearch,
    isAIDrawerOpen,
    openAIDrawer,
    closeAIDrawer,
  } = useTask();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Sidebar */}
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        {/* Due Reminders Alert Banner */}
        <ReminderBanner />

        {/* Supabase Configuration Alert (if placeholder in .env) */}
        {!isConfigured && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5 text-amber-800 text-sm font-medium">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  Supabase is not configured yet. Run the SQL migration from{' '}
                  <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">
                    supabase/migrations/001_initial_schema.sql
                  </code>{' '}
                  and add your credentials to <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">.env</code>.
                </span>
              </div>
              <Link
                to="/settings"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 underline hover:text-amber-950"
              >
                <Database className="w-3.5 h-3.5" />
                View Supabase Instructions
              </Link>
            </div>
          </div>
        )}

        {/* Main View Router Outlet */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-20">
          <Outlet />
        </main>
      </div>

      {/* Floating Bottom-Right AI Assistant Launcher Button */}
      <div className="fixed bottom-5 right-5 z-30">
        <button
          onClick={openAIDrawer}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-linear-to-r from-blue-600 to-indigo-600 text-white font-semibold text-xs shadow-xl hover:from-blue-700 hover:to-indigo-700 hover:shadow-2xl transition-all focus:outline-none focus:ring-4 focus:ring-blue-300 transform hover:-translate-y-0.5"
          title="Open Task-Aware AI Assistant"
        >
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span className="tracking-wide">Ask Tasker AI</span>
        </button>
      </div>

      {/* Global Quick Add Task Modal */}
      {isCreateModalOpen && (
        <TaskFormModal
          isOpen={isCreateModalOpen}
          onClose={closeCreateModal}
          initialValues={createModalDefaults}
        />
      )}

      {/* Global Universal Search Command Palette */}
      <UniversalSearchModal
        isOpen={isUniversalSearchOpen}
        onClose={closeUniversalSearch}
        initialQuery={universalSearchQuery}
      />

      {/* Global Task-Aware AI Assistant Drawer */}
      <AIAssistantDrawer
        isOpen={isAIDrawerOpen}
        onClose={closeAIDrawer}
      />
    </div>
  );
};