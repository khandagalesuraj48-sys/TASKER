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
import { FinancePage } from './pages/FinancePage';
import { VehiclesPage } from './pages/VehiclesPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { FamilyPage } from './pages/FamilyPage';
import { BusinessPage } from './pages/BusinessPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { ReportsPage } from './pages/ReportsPage';
import { ErpDashboardPage } from './pages/ErpDashboardPage';
import { ErpInventoryPage } from './pages/ErpInventoryPage';
import { ErpAccountingPage } from './pages/ErpAccountingPage';
import { ErpApprovalsPage } from './pages/ErpApprovalsPage';
import { ErpCrmPage } from './pages/ErpCrmPage';
import { ErpHrPage } from './pages/ErpHrPage';
import { ErpDocumentsPage } from './pages/ErpDocumentsPage';
import { ErpReportsPage } from './pages/ErpReportsPage';
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
                      <Route index element={<DashboardPage />} />
                      <Route path="pending" element={<PendingTasksPage />} />
                      <Route path="tasks" element={<AllTasksPage />} />
                      <Route path="completed" element={<CompletedTasksPage />} />
                      <Route path="reminders" element={<AllTasksPage />} />
                      <Route path="finance" element={<FinancePage />} />
                      <Route path="vehicles" element={<VehiclesPage />} />
                      <Route path="documents" element={<DocumentsPage />} />
                      <Route path="family" element={<FamilyPage />} />
                      <Route path="business" element={<BusinessPage />} />
                      <Route path="templates" element={<TemplatesPage />} />
                      <Route path="reports" element={<ReportsPage />} />
                      <Route path="erp" element={<ErpDashboardPage />} />
                      <Route path="erp/inventory" element={<ErpInventoryPage />} />
                      <Route path="erp/accounting" element={<ErpAccountingPage />} />
                      <Route path="erp/crm" element={<ErpCrmPage />} />
                      <Route path="erp/hr" element={<ErpHrPage />} />
                      <Route path="erp/approvals" element={<ErpApprovalsPage />} />
                      <Route path="erp/documents" element={<ErpDocumentsPage />} />
                      <Route path="erp/reports" element={<ErpReportsPage />} />
                      <Route path="bin" element={<BinPage />} />
                      <Route path="tasks/:id" element={<TaskDetailPage />} />
                      <Route path="settings" element={<SettingsPage />} />
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
