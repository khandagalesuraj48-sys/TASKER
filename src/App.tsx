import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { TaskProvider } from './context/TaskContext';
import { LocalizationProvider } from './context/LocalizationContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { EnterpriseProvider } from './context/EnterpriseContext';
import { AdminProvider } from './context/AdminContext';

import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AdminRoute } from './components/auth/AdminRoute';
import { AppLayout } from './components/layout/AppLayout';
import { AdminLayout } from './components/admin/AdminLayout';

// Personal Space Pages
import { DashboardPage } from './pages/DashboardPage';
import { PendingTasksPage } from './pages/PendingTasksPage';
import { AllTasksPage } from './pages/AllTasksPage';
import { CompletedTasksPage } from './pages/CompletedTasksPage';
import { BinPage } from './pages/BinPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { SettingsPage } from './pages/SettingsPage';

// Organization Workplace Pages
import { OrgTasksPage } from './pages/OrgTasksPage';
import { OrgAssignedTasksPage } from './pages/OrgAssignedTasksPage';
import { OrgCreatedTasksPage } from './pages/OrgCreatedTasksPage';
import { EmployeeDirectoryPage } from './pages/EmployeeDirectoryPage';
import { AssignmentHistoryPage } from './pages/AssignmentHistoryPage';
import { OrgManagementPage } from './pages/OrgManagementPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PublicSharedTaskPage } from './pages/PublicSharedTaskPage';

// Central Platform Admin Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminOrganizationsPage } from './pages/admin/AdminOrganizationsPage';
import { AdminMembersPage } from './pages/admin/AdminMembersPage';
import { AdminRequestsPage } from './pages/admin/AdminRequestsPage';
import { AdminDirectoryPage } from './pages/admin/AdminDirectoryPage';
import { AdminRolesPage } from './pages/admin/AdminRolesPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <LocalizationProvider>
          <AuthProvider>
            <AdminProvider>
              <EnterpriseProvider>
                <WorkspaceProvider>
                  <BrowserRouter>
                    <Routes>
                      {/* Public Read-Only Share Link Route (Unauthenticated) */}
                      <Route path="/shared/task/:token" element={<PublicSharedTaskPage />} />

                      {/* Central Platform Admin Area (Protected by database is_platform_admin check) */}
                      <Route
                        path="/admin"
                        element={
                          <AdminRoute>
                            <AdminLayout />
                          </AdminRoute>
                        }
                      >
                        <Route index element={<AdminDashboardPage />} />
                        <Route path="users" element={<AdminUsersPage />} />
                        <Route path="organizations" element={<AdminOrganizationsPage />} />
                        <Route path="members" element={<AdminMembersPage />} />
                        <Route path="requests" element={<AdminRequestsPage />} />
                        <Route path="directory" element={<AdminDirectoryPage />} />
                        <Route path="roles" element={<AdminRolesPage />} />
                        <Route path="audit" element={<AdminAuditPage />} />
                        <Route path="settings" element={<AdminSettingsPage />} />
                      </Route>

                      {/* Standard Application Area (Personal Space + Workplace Collaboration) */}
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
            </AdminProvider>
          </AuthProvider>
        </LocalizationProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
