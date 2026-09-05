import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { useTask } from '../../context/TaskContext';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { UniversalSearchModal } from '../search/UniversalSearchModal';
import { AIAssistantDrawer } from '../ai/AIAssistantDrawer';
import { ReminderBanner } from '../reminders/ReminderBanner';
import { AlertTriangle, Database, Sparkles } from 'lucide-react';
import { useAndroidBackHandler } from '../../hooks/useAndroidBackHandler';
import { useBackButton } from '../../hooks/useBackButton';
import { AppUpdateCard } from '../AppUpdateCard';

export const AppLayout: React.FC = () => {
  // Initialize native Android hardware back button handler
  useAndroidBackHandler();

  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Register with Android hardware back button handler (Priority 30: Menus & Popups)
  useBackButton(mobileMenuOpen, () => setMobileMenuOpen(false), 30);

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
    <div className="flex h-screen min-h-[100dvh] bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 overflow-hidden relative transition-colors">
      {/* Desktop & Mobile Drawer Sidebar */}
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-y-auto min-w-0">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        {/* Due Reminders Alert Banner */}
        <ReminderBanner />

        {/* Supabase Configuration Alert (if placeholder in .env) */}
        {!isConfigured && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between flex-wrap gap-2 max-w-7xl mx-auto">
              <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-200 text-xs sm:text-sm font-medium">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  Supabase is not configured yet. Run the SQL migration and add credentials to <code className="bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded text-xs">.env</code>.
                </span>
              </div>
              <Link
                to="/settings"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-300 underline"
              >
                <Database className="w-3.5 h-3.5" />
                Setup Guide
              </Link>
            </div>
          </div>
        )}

        {/* Main View Router Outlet */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-12">
          {/* App Update Banner */}
          <AppUpdateCard />
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />

      {/* Floating AI Assistant Action Button */}
      {/* Positioned safely above MobileNav on small screens (bottom-20), bottom-right on desktop */}
      <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-30 pointer-events-none">
        <button
          onClick={openAIDrawer}
          className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 sm:px-4.5 sm:py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 text-white font-bold text-xs sm:text-sm shadow-xl hover:shadow-2xl border border-white/25 dark:border-indigo-400/30 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-400/40 dark:focus:ring-indigo-500/40 transform hover:-translate-y-0.5 active:scale-95 group"
          title="Open Task-Aware AI Assistant (Esc to close)"
          aria-label="Open Task-Aware AI Assistant"
        >
          <Sparkles className="w-4 h-4 text-amber-200 group-hover:rotate-12 transition-transform duration-200" />
          <span className="tracking-wide">Ask AI</span>
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