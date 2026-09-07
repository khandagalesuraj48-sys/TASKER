import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { TaskProvider } from './context/TaskContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { PendingTasksPage } from './pages/PendingTasksPage';
import { AllTasksPage } from './pages/AllTasksPage';
import { CompletedTasksPage } from './pages/CompletedTasksPage';
import { BinPage } from './pages/BinPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { SettingsPage } from './pages/SettingsPage';

import { LocalizationProvider } from './context/LocalizationContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { EnterpriseProvider } from './context/EnterpriseContext';

import { OrgTasksPage } from './pages/OrgTasksPage';
import { OrgAssignedTasksPage } from './pages/OrgAssignedTasksPage';
import { OrgCreatedTasksPage } from './pages/OrgCreatedTasksPage';
import { EmployeeDirectoryPage } from './pages/EmployeeDirectoryPage';
import { AssignmentHistoryPage } from './pages/AssignmentHistoryPage';
import { OrgManagementPage } from './pages/OrgManagementPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PublicSharedTaskPage } from './pages/PublicSharedTaskPage';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <LocalizationProvider>
          <AuthProvider>
            <EnterpriseProvider>
              <WorkspaceProvider>
                <BrowserRouter>
                  <Routes>
                    {/* Public Read-Only Share Link Route (Unauthenticated) */}
                    <Route path="/shared/task/:token" element={<PublicSharedTaskPage />} />

                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <TaskProvider>
                            <AppLayout />
                          </TaskProvider>
                        </ProtectedRoute>
                      }
                    >
                      {/* Personal Space Routes */}
                      <Route index element={<DashboardPage />} />
                      <Route path="pending" element={<PendingTasksPage />} />
                      <Route path="tasks" element={<AllTasksPage />} />
                      <Route path="completed" element={<CompletedTasksPage />} />
                      <Route path="reminders" element={<AllTasksPage />} />
                      <Route path="bin" element={<BinPage />} />
                      <Route path="tasks/:id" element={<TaskDetailPage />} />
                      <Route path="settings" element={<SettingsPage />} />

                      {/* Organization Workplace Routes */}
                      <Route path="org/tasks" element={<OrgTasksPage />} />
                      <Route path="org/assigned-to-me" element={<OrgAssignedTasksPage />} />
                      <Route path="org/created-by-me" element={<OrgCreatedTasksPage />} />
                      <Route path="org/employees" element={<EmployeeDirectoryPage />} />
                      <Route path="org/history" element={<AssignmentHistoryPage />} />
                      <Route path="org/manage" element={<OrgManagementPage />} />
                      <Route path="org/notifications" element={<NotificationsPage />} />

                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                  </Routes>
                </BrowserRouter>
              </WorkspaceProvider>
            </EnterpriseProvider>
          </AuthProvider>
        </LocalizationProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
