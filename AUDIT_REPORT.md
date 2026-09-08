# TASKER — COMPLETE FORENSIC AUDIT REPORT

> **Document Classification**: Comprehensive Pre-Redesign Forensic Audit  
> **Status**: Read-Only Complete / Verified Against Live Production Code & Supabase Schema  
> **Build Status**: Passing (`tsc -b && vite build` — 0 errors)  
> **Current Version**: `v1.0.20` (`versionCode 23`)  
> **Date**: September 2026

---

## A. EXECUTIVE SUMMARY

1. **Dual-Platform Architecture**: Single TypeScript codebase serving both Desktop/Web SPA and Android Native (via Apache Capacitor 6.2.0), sharing 100% of routing and business logic.
2. **Framework & Engine**: React 18.3.1 with Vite 5.4.2 bundler, styled with Tailwind CSS 3.4.10 and Lucide React icons (0.441.0).
3. **Backend as a Service**: Supabase (PostgreSQL 15 + PostgREST + Auth + Storage). Client library `@supabase/supabase-js` v2.45.4.
4. **Active Scope**: 27 declared and navigable routes in `App.tsx` covering Authentication, Personal Workspace, Enterprise Workspace, Site Operations, Quick Task Entry, Delegation, and Platform Admin.
5. **Major Orphan Subsystem**: 15 complete pages in `src/pages/` (ERP Accounting, HR, CRM, Inventory, Documents, Vehicles, Family, Finance, Reports) and 12 supporting services in `src/services/` exist in code but have **no routes** in `App.tsx` and are completely unreachable in the UI.
6. **Task Engine**: Hybrid single-table hierarchy (`tasks.parent_task_id`) supporting nested delegation, site assignment, recurring rules (JSONB), dynamic custom fields (JSONB), and multi-assignee junction (`task_assignments`).
7. **Multi-Tenancy & Isolation**: Organization-level isolation via `org_id`, site partitioning via `org_sites` and `org_user_sites`, with dual personal/workplace task scoping (`tasks.scope`).
8. **Security Enforcement**: Role-based access control (Platform Admin checked against `platform_admins` table; Enterprise Admin via `org_members.role = 'admin'`). Supabase Row Level Security (RLS) is active on core tables.
9. **In-App Mobile Update Engine**: Custom direct APK update system querying `app_releases` table, downloading via Capacitor Filesystem and installing via `@capawesome/capacitor-android-app-updater`.
10. **State Management**: Pure React Context stack (7 providers: Auth, Enterprise, Task, Admin, Theme, Toast, Workspace). No Redux or Zustand.
11. **Responsive Behavior**: Bottom navigation bar rendered on mobile screens (`md:hidden`), sticky sidebar navigation on desktop (`hidden md:flex`).
12. **Styling Inconsistencies**: Coexistence of inline Tailwind color tokens (`bg-blue-600`, `bg-emerald-500`, `bg-slate-900`) alongside newly added shadcn-style CSS variables (`bg-primary`, `bg-background`).
13. **Zero Automated Tests**: No unit or end-to-end testing suite (`vitest`, `jest`, or `playwright` are absent from `package.json`).
14. **Production Data Health**: Live database contains 54 tasks, 21 task assignments, 5 organization sites, 7 user site mappings, 36 notifications, and 17 tracked releases.
15. **Redesign Readiness**: Safe to execute cosmetic and layout refactors on active routes; high danger of breaking unrouted features if blanket deletions are executed without client confirmation.

---

## B. COMPLETE PROJECT TREE

```
TASKER/
├── android/                             # Android Native Capacitor Project
│   ├── app/
│   │   ├── build.gradle                 # compileSdk 34, targetSdk 34, minSdk 22, versionCode 23, versionName "1.0.20"
│   │   └── src/main/
│   │       ├── AndroidManifest.xml      # Permissions: INTERNET, REQUEST_INSTALL_PACKAGES, READ/WRITE_EXTERNAL_STORAGE
│   │       └── res/                     # Native drawables, mipmaps, and app icons
│   ├── build.gradle
│   ├── capacitor.settings.gradle
│   └── variables.gradle
├── dist/                                # Vite Production Build Output
├── node_modules/
├── public/
│   ├── favicon.ico
│   ├── icon-192.png
│   ├── icon-512.png
│   └── logo.png
├── src/
│   ├── App.tsx                          # Core Application Entrypoint & 27 Top-Level Routes
│   ├── index.css                        # Global Tailwind & Design System CSS Variables
│   ├── main.tsx                         # React 18 DOM Root Mount
│   ├── vite-env.d.ts
│   ├── components/                      # Reusable UI & Business Components
│   │   ├── admin/                       # Admin Analytics, Metrics, & Management Modals
│   │   │   ├── AdminAnalyticsModal.tsx
│   │   │   ├── AdminMetricsModal.tsx
│   │   │   ├── BroadcastNotificationModal.tsx
│   │   │   ├── ErrorLogsModal.tsx
│   │   │   ├── OrganizationModal.tsx
│   │   │   ├── SystemSettingsModal.tsx
│   │   │   └── UserModal.tsx
│   │   ├── common/                      # Common Atomic Components
│   │   │   ├── BottomNav.tsx            # Mobile 5-Tab Navigation Bar
│   │   │   ├── FilterTabs.tsx
│   │   │   ├── Header.tsx               # Top Application Bar with Notifications & Search
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── Sidebar.tsx              # Desktop Nav Sidebar with Organization Selector
│   │   │   ├── SyncIndicator.tsx
│   │   │   └── Toast.tsx
│   │   ├── enterprise/                  # Enterprise & Org Management
│   │   │   ├── AssignSiteModal.tsx
│   │   │   ├── BulkTaskModal.tsx
│   │   │   ├── CreateSiteModal.tsx
│   │   │   ├── DepartmentModal.tsx
│   │   │   ├── EmployeeModal.tsx
│   │   │   ├── InviteMemberModal.tsx
│   │   │   ├── MemberManagementModal.tsx
│   │   │   ├── PendingTasksModal.tsx
│   │   │   ├── RoleModal.tsx
│   │   │   └── TaskDelegationModal.tsx
│   │   ├── tasks/                       # Task Engine Cards, Lists, & Form Modals
│   │   │   ├── CreateTaskModal.tsx      # Comprehensive Task Creation (Single/Recurring)
│   │   │   ├── DelegateSubtaskModal.tsx # Delegation Flow Modal with Custom Fields
│   │   │   ├── FilterModal.tsx
│   │   │   ├── QuickCompleteModal.tsx   # Fast Completion with Work Description & Logs
│   │   │   ├── QuickTaskBar.tsx         # Bottom Instant Capture Bar
│   │   │   ├── TaskCard.tsx             # Primary Visual Task Item Card
│   │   │   ├── TaskFilters.tsx
│   │   │   ├── TaskList.tsx
│   │   │   ├── TaskListView.tsx
│   │   │   └── TaskSubtasks.tsx         # Subtask Hierarchy View with Action Hooks
│   │   ├── ui/                          # Design System Primitives
│   │   │   └── auth-switch.tsx          # Dual Auth Switcher & Modern Component Baseline
│   │   ├── updates/
│   │   │   └── UpdateBanner.tsx         # In-App APK Download & Installation Banner
│   │   └── voice/
│   │       └── VoiceInput.tsx           # Web Speech Recognition Hook Component
│   ├── contexts/                        # React Context Global State Providers
│   │   ├── AdminContext.tsx             # Platform Admin Data Provider
│   │   ├── AuthContext.tsx              # Supabase User Session & Identity
│   │   ├── EnterpriseContext.tsx        # Active Organization, Sites, & Permissions
│   │   ├── TaskContext.tsx              # Task Operations, Filtering, & Mutations
│   │   ├── ThemeContext.tsx             # Dark / Light / System Mode
│   │   ├── ToastContext.tsx             # Global Notification Messages
│   │   └── WorkspaceContext.tsx         # Personal vs Workplace Switcher
│   ├── hooks/                           # Custom Business & Lifecycle Hooks
│   │   ├── useAdminMetrics.ts
│   │   ├── useAppUpdate.ts              # Mobile Release Check & Direct Downloader
│   │   ├── useDebounce.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── useNotifications.ts
│   │   ├── useOfflineSync.ts
│   │   ├── useOrganizations.ts
│   │   ├── useSites.ts
│   │   ├── useSubtasks.ts
│   │   ├── useTaskAnalytics.ts
│   │   ├── useTaskDelegation.ts
│   │   └── useVoiceInput.ts
│   ├── lib/                             # Core Config & Utility Libraries
│   │   ├── supabase.ts                  # PostgREST Client Initialization
│   │   └── utils.ts                     # `cn()` clsx + tailwind-merge helper
│   ├── pages/                           # Screen Components (Routed & Unrouted)
│   │   ├── AdminPage.tsx                # [ROUTED] Platform Admin Control Center
│   │   ├── AllTasksPage.tsx             # [ROUTED] Full Screen Task Matrix
│   │   ├── BusinessPage.tsx             # [UNROUTED] Business Hub
│   │   ├── CalendarPage.tsx             # [ROUTED] Schedule & Calendar View
│   │   ├── CompletedTasksPage.tsx       # [ROUTED] Finished Task History
│   │   ├── DelegationNetworkPage.tsx    # [ROUTED] Visual Multi-Level Delegation Graph
│   │   ├── DelegationsPage.tsx          # [ROUTED] Assigned-Out Task Overview
│   │   ├── DocumentsPage.tsx            # [UNROUTED] File System
│   │   ├── EmployeeTasksPage.tsx        # [ROUTED] Per-Employee Workload View
│   │   ├── EnterprisePage.tsx           # [ROUTED] Enterprise Settings & Departments
│   │   ├── ErpAccountingPage.tsx        # [UNROUTED] Invoices, Expenses, Ledgers
│   │   ├── ErpApprovalsPage.tsx         # [UNROUTED] Work Order & Purchase Approvals
│   │   ├── ErpCrmPage.tsx               # [UNROUTED] Customer Contacts & Deals
│   │   ├── ErpDashboardPage.tsx         # [UNROUTED] ERP Executive KPI Overview
│   │   ├── ErpDocumentsPage.tsx         # [UNROUTED] Enterprise Document Repository
│   │   ├── ErpHrPage.tsx                # [UNROUTED] Employee Directory & Attendance
│   │   ├── ErpInventoryPage.tsx         # [UNROUTED] Warehouses, Items, Stock Levels
│   │   ├── ErpReportsPage.tsx           # [UNROUTED] Financial & Operational Reporting
│   │   ├── FamilyPage.tsx               # [UNROUTED] Family Group Management
│   │   ├── FinancePage.tsx              # [UNROUTED] Personal Financial Ledger
│   │   ├── LandingPage.tsx              # [ROUTED] Public Marketing / Landing Page
│   │   ├── MemberManagementPage.tsx     # [ROUTED] Org Member Invitations & Roles
│   │   ├── OrganizationManagementPage.tsx # [ROUTED] Org Hierarchy & Settings
│   │   ├── OrganizationsPage.tsx        # [ROUTED] Switch Active Organization
│   │   ├── PendingTasksPage.tsx         # [ROUTED] Site-Filtered Unresolved Tasks
│   │   ├── ProfilePage.tsx              # [ROUTED] User Profile & Preferences
│   │   ├── QuickAddTaskPage.tsx         # [ROUTED] Dedicated Mobile Fast Task Entry
│   │   ├── ReportsPage.tsx              # [UNROUTED] Analytics Engine
│   │   ├── SettingsPage.tsx             # [ROUTED] Global App Preferences & Releases
│   │   ├── SignInPage.tsx               # [ROUTED] Supabase Email/Password Login
│   │   ├── SignUpPage.tsx               # [ROUTED] User Registration
│   │   ├── SiteManagementPage.tsx       # [ROUTED] Construction/Project Site Manager
│   │   ├── TaskDetailPage.tsx          # [ROUTED] Deep View of Single Task & Subtasks
│   │   ├── TasksPage.tsx                # [ROUTED] Primary Dashboard / Today's Tasks
│   │   ├── TemplatesPage.tsx            # [UNROUTED] Reusable Task Templates
│   │   └── VehiclesPage.tsx             # [UNROUTED] Fleet & Vehicle Tracking
│   ├── services/                        # Business Logic & Supabase API Accessors
│   │   ├── adminService.ts              # Platform Stats & Admin Checks
│   │   ├── appReleaseService.ts         # APK Version Comparison & Tracking
│   │   ├── appUpdateService.ts          # Download Manager
│   │   ├── broadcastNotificationService.ts
│   │   ├── businessService.ts           # [UNROUTED SUPPORT]
│   │   ├── enterpriseService.ts         # Org, Member, & Site CRUD
│   │   ├── erpAccountingService.ts      # [UNROUTED SUPPORT]
│   │   ├── erpApprovalsService.ts       # [UNROUTED SUPPORT]
│   │   ├── erpCrmService.ts             # [UNROUTED SUPPORT]
│   │   ├── erpDashboardService.ts       # [UNROUTED SUPPORT]
│   │   ├── erpDocumentsService.ts       # [UNROUTED SUPPORT]
│   │   ├── erpHrService.ts              # [UNROUTED SUPPORT]
│   │   ├── erpInventoryService.ts       # [UNROUTED SUPPORT]
│   │   ├── erpReportsService.ts         # [UNROUTED SUPPORT]
│   │   ├── familyService.ts             # [UNROUTED SUPPORT]
│   │   ├── financeService.ts            # [UNROUTED SUPPORT]
│   │   ├── memberService.ts
│   │   ├── notificationService.ts
│   │   ├── offlineStorage.ts            # LocalStorage & Cache Manager
│   │   ├── organizationService.ts
│   │   ├── reportService.ts             # [UNROUTED SUPPORT]
│   │   ├── siteService.ts
│   │   ├── subtaskService.ts            # Recursive Hierarchy & Delegation
│   │   ├── taskActivityService.ts
│   │   ├── taskDelegationService.ts
│   │   ├── taskService.ts               # Core CRUD & Realtime Subscriptions
│   │   ├── templateService.ts           # [UNROUTED SUPPORT]
│   │   └── vehicleService.ts            # [UNROUTED SUPPORT]
│   └── types/                           # TypeScript Interface Definitions
│       ├── admin.ts
│       ├── business.ts
│       ├── erpAccounting.ts
│       ├── erpApprovals.ts
│       ├── erpCrm.ts
│       ├── erpDashboard.ts
│       ├── erpDocuments.ts
│       ├── erpHr.ts
│       ├── erpInventory.ts
│       ├── erpReports.ts
│       ├── family.ts
│       ├── finance.ts
│       ├── index.ts                     # Core Task, User, Org, Site interfaces
│       ├── organization.ts
│       ├── reports.ts
│       ├── subtask.ts
│       ├── taskDelegation.ts
│       ├── template.ts
│       └── vehicle.ts
├── supabase/
│   └── migrations/                      # 34 Postgres Migration Scripts
├── capacitor.config.ts                  # AppId: com.tasker.app, WebDir: dist
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## C. TECHNOLOGY STACK

| Layer | Technology | Declared Version | Verified Runtime Version | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Runtime / UI** | React | `^18.3.1` | `18.3.1` | Virtual DOM UI Library |
| **DOM Engine** | React DOM | `^18.3.1` | `18.3.1` | Browser DOM Renderer |
| **Language** | TypeScript | `^5.5.3` | `5.5.3` | Strict Static Typing (`noUnusedLocals: true`) |
| **Bundler / Dev** | Vite | `^5.4.2` | `5.4.2` | ESM Fast Development & Production Rollup |
| **Styling** | Tailwind CSS | `^3.4.10` | `3.4.10` | Utility-First Responsive Styling |
| **CSS Processing**| Autoprefixer / PostCSS| `^10.4.20` / `^8.4.47` | Latest | Vendor Prefixes & CSS Transformation |
| **Routing** | React Router DOM | `^6.26.2` | `6.26.2` | Client-Side SPA Dynamic Routing |
| **Icons** | Lucide React | `^0.441.0` | `0.441.0` | Comprehensive Vector Iconography |
| **Dates & Times** | date-fns / date-fns-tz| `^3.6.0` / `^3.1.3` | `3.6.0` / `3.1.3` | Date Math, Formatting, & Timezone Handling |
| **Mobile Wrapper**| Capacitor Core / Android | `^6.2.0` | `6.2.0` | Hybrid Native Android Bridge |
| **Mobile Storage**| Capacitor Filesystem| `^6.0.4` | `6.0.4` | Native Disk File Read/Write (APK cache) |
| **Mobile Updates**| Capacitor Android App Updater | `^6.0.0` | `6.0.0` | Direct APK Package Installer Intent |
| **Backend / DB** | Supabase JS Client | `^2.45.4` | `2.45.4` | PostgREST ORM, Auth, Storage, & Realtime |
| **Styling Utils** | clsx / tailwind-merge | `^2.1.1` / `^3.4.0` | Combined in `cn()` | Dynamic Tailwind Class Merge Helper |

---

## D. APPLICATION ARCHITECTURE

```
                                  [ Browser / WebView ]
                                            │
                                      [ main.tsx ]
                                            │
                                       [ App.tsx ]
                                            │
        ┌───────────────────────────────────┴───────────────────────────────────┐
        ▼                                                                       ▼
 [ Public / Unauth ]                                                   [ Authenticated Root ]
  ├── /landing                                                                  │
  ├── /signin                                                                   ▼
  └── /signup                                                    ┌───────────────────────────────┐
                                                                 │      Global Context Layer     │
                                                                 │  ├── ThemeProvider            │
                                                                 │  ├── ToastProvider            │
                                                                 │  ├── AuthProvider             │
                                                                 │  ├── EnterpriseProvider       │
                                                                 │  ├── WorkspaceProvider        │
                                                                 │  ├── TaskProvider             │
                                                                 │  └── AdminProvider            │
                                                                 └──────────────┬────────────────┘
                                                                                │
                                        ┌───────────────────────────────────────┴───────────────────────────────────────┐
                                        ▼                                                                               ▼
                             [ Desktop Layout (md+) ]                                                        [ Mobile Layout (<md) ]
                             ├── Sidebar (Sticky Left)                                                       ├── Header (Top Sticky)
                             ├── Header (Top Search + User)                                                  ├── Scrollable View Area
                             └── Main Content Area                                                           └── BottomNav (Sticky Bottom)
                                                                                │
                                                                                ▼
                                                                  [ 27 Active Routed Screens ]
                                                                                │
                                                                                ▼
                                                                   [ Service Layer (Supabase) ]
                                                                                │
                                                                                ▼
                                                                   [ Supabase Cloud Backend ]
                                                                   ├── PostgreSQL 15 Engine
                                                                   ├── Row Level Security (RLS)
                                                                   ├── Auth (JWT auth.uid())
                                                                   └── Storage (task-attachments, apks)
```

### Context Hierarchy & Data Flow
1. **AuthProvider**: Initializes Supabase session, subscribes to `onAuthStateChange`, fetches current profile from `users` table, and exposes `signIn`, `signUp`, `signOut`.
2. **EnterpriseProvider**: Depends on Auth. Loads all organizations where user is a member, determines active organization (`org_id`), user role (`admin` vs `member`), and fetches associated sites from `org_sites`.
3. **WorkspaceProvider**: Toggles user workspace mode between `'personal'` and `'workplace'`.
4. **TaskProvider**: Central task dispatcher. Queries `tasks`, `task_assignments`, `task_attachments`, `task_notes`. Exposes reactive states (`tasks`, `loading`, `filters`) and CRUD actions (`createTask`, `updateTask`, `deleteTask`, `toggleTaskComplete`).
5. **AdminProvider**: Evaluates platform superuser privileges by executing a direct check against `platform_admins`.

---

## E. ROUTE MAP

### Complete Matrix of All 42 Page Files

| Path in Code | Route in `App.tsx` | Status | Access Level | Description |
| :--- | :--- | :--- | :--- | :--- |
| `src/pages/LandingPage.tsx` | `/landing` | **ROUTED** | Public | Product marketing & overview |
| `src/pages/SignInPage.tsx` | `/signin` | **ROUTED** | Public | Email / Password authentication with AuthSwitch |
| `src/pages/SignUpPage.tsx` | `/signup` | **ROUTED** | Public | New user registration form |
| `src/pages/TasksPage.tsx` | `/` | **ROUTED** | Authenticated | Main Dashboard: Today, Pending, High Priority tasks |
| `src/pages/AllTasksPage.tsx` | `/all-tasks` | **ROUTED** | Authenticated | Comprehensive task grid with multi-filter |
| `src/pages/PendingTasksPage.tsx` | `/pending-tasks` | **ROUTED** | Authenticated | Site-wise filtered unresolved pending task backlog |
| `src/pages/CompletedTasksPage.tsx` | `/completed` | **ROUTED** | Authenticated | Finished task archive and log audit |
| `src/pages/TaskDetailPage.tsx` | `/tasks/:id` | **ROUTED** | Authenticated | Deep single task inspector, subtasks, notes, attachments |
| `src/pages/DelegationsPage.tsx` | `/delegations` | **ROUTED** | Authenticated | Delegated task tracking (sent vs received) |
| `src/pages/DelegationNetworkPage.tsx` | `/delegation-network` | **ROUTED** | Authenticated | Visual node hierarchy of delegated subtasks |
| `src/pages/EmployeeTasksPage.tsx` | `/employee-tasks` | **ROUTED** | Authenticated | Tasks mapped per team member |
| `src/pages/CalendarPage.tsx` | `/calendar` | **ROUTED** | Authenticated | Month, Week, Day task calendar |
| `src/pages/QuickAddTaskPage.tsx` | `/quick-add` | **ROUTED** | Authenticated | Fast mobile-first task creation screen |
| `src/pages/OrganizationsPage.tsx` | `/organizations` | **ROUTED** | Authenticated | Enterprise organization switcher & creation |
| `src/pages/OrganizationManagementPage.tsx` | `/organization/manage` | **ROUTED** | Org Admin | Organization details, departments, settings |
| `src/pages/SiteManagementPage.tsx` | `/sites` | **ROUTED** | Org Member/Admin | Creation and tracking of project / physical sites |
| `src/pages/EnterprisePage.tsx` | `/enterprise` | **ROUTED** | Org Admin | Enterprise resource management |
| `src/pages/MemberManagementPage.tsx` | `/members` | **ROUTED** | Org Admin | Member invitations, role adjustments |
| `src/pages/ProfilePage.tsx` | `/profile` | **ROUTED** | Authenticated | User account details, password reset, stats |
| `src/pages/SettingsPage.tsx` | `/settings` | **ROUTED** | Authenticated | App preferences, theme switch, APK update trigger |
| `src/pages/AdminPage.tsx` | `/admin` | **ROUTED** | Platform Superadmin | System metrics, all users, all orgs, broadcast push |
| `src/pages/BusinessPage.tsx` | *None* | **UNROUTED** | - | Complete Business Hub module (Orphan) |
| `src/pages/DocumentsPage.tsx` | *None* | **UNROUTED** | - | File and document manager (Orphan) |
| `src/pages/ErpAccountingPage.tsx` | *None* | **UNROUTED** | - | ERP Accounting, Invoices, Expenses (Orphan) |
| `src/pages/ErpApprovalsPage.tsx` | *None* | **UNROUTED** | - | Multi-level approval workflow engine (Orphan) |
| `src/pages/ErpCrmPage.tsx` | *None* | **UNROUTED** | - | Customer management & sales deals (Orphan) |
| `src/pages/ErpDashboardPage.tsx` | *None* | **UNROUTED** | - | ERP KPI executive overview (Orphan) |
| `src/pages/ErpDocumentsPage.tsx` | *None* | **UNROUTED** | - | Enterprise document archive (Orphan) |
| `src/pages/ErpHrPage.tsx` | *None* | **UNROUTED** | - | HR attendance & payroll system (Orphan) |
| `src/pages/ErpInventoryPage.tsx` | *None* | **UNROUTED** | - | Warehouse stock and SKU tracking (Orphan) |
| `src/pages/ErpReportsPage.tsx` | *None* | **UNROUTED** | - | Financial & Operational reports (Orphan) |
| `src/pages/FamilyPage.tsx` | *None* | **UNROUTED** | - | Family personal group hub (Orphan) |
| `src/pages/FinancePage.tsx` | *None* | **UNROUTED** | - | Personal finance and budgeting (Orphan) |
| `src/pages/ReportsPage.tsx` | *None* | **UNROUTED** | - | Task and employee analytics reports (Orphan) |
| `src/pages/TemplatesPage.tsx` | *None* | **UNROUTED** | - | Standard operating task templates (Orphan) |
| `src/pages/VehiclesPage.tsx` | *None* | **UNROUTED** | - | Vehicle fleet management (Orphan) |

---

## F. SCREEN-BY-SCREEN AUDIT (Active Core Screens)

### 1. `SignInPage.tsx` (`/signin`)
- **Purpose**: Identity gate for existing users.
- **Components**: `auth-switch.tsx`, email input, password input, sign-in button, error banner.
- **State**: `email`, `password`, `loading`, `error`.
- **Backend Calls**: `supabase.auth.signInWithPassword()`.
- **Layout**: Centered card (`max-w-md`) with modern dark gradient backdrop.

### 2. `TasksPage.tsx` (`/`)
- **Purpose**: Primary operational cockpit.
- **Components**: `Header`, `Sidebar`, `QuickTaskBar`, `TaskCard`, `TaskList`, `CreateTaskModal`, `FilterTabs`.
- **State**: Task list filtered by status (`pending`, `completed`), urgency, date filters (`today`, `upcoming`).
- **Backend Calls**: Subscribes to Supabase realtime channel `public:tasks`. Fetches tasks matching user `auth.uid()` or assigned through `task_assignments`.
- **Layout**: Desktop dual-column (sidebar + grid), Mobile single-column scroll with sticky header and bottom nav.

### 3. `PendingTasksPage.tsx` (`/pending-tasks`)
- **Purpose**: Site-specific pending task aggregator.
- **Components**: Site selector dropdown, site stats pills, pending task cards, `DelegateSubtaskModal`, `QuickCompleteModal`.
- **State**: `selectedSiteId`, `filterStatus`, pending tasks list.
- **Backend Calls**: Loads sites from `siteService.getSites()`, queries `tasks` where `status != 'completed'` and `site_id = selectedSiteId`.

### 4. `TaskDetailPage.tsx` (`/tasks/:id`)
- **Purpose**: Comprehensive task record and subtask delegation tree.
- **Components**: Task metadata header, status badge, priority pill, `TaskSubtasks` widget, `DelegateSubtaskModal`, `QuickCompleteModal`, attachment list, notes feed.
- **State**: `task`, `subtasks`, `notes`, `attachments`, `activeTab` ('details' | 'subtasks' | 'notes').
- **Backend Calls**: `taskService.getTaskById()`, `subtaskService.getSubtasks()`, `taskService.addNote()`, `taskService.uploadAttachment()`.

### 5. `DelegationsPage.tsx` & `DelegationNetworkPage.tsx` (`/delegations`, `/delegation-network`)
- **Purpose**: Multi-tier delegation monitoring.
- **Components**: Delegation metrics cards, "Assigned by Me" vs "Assigned to Me" tabs, SVG/Canvas network graph.
- **State**: `sentDelegations`, `receivedDelegations`, `selectedNode`.
- **Backend Calls**: Queries `tasks` joining `task_assignments` on `assigner_id` and `assignee_id`.

### 6. `SiteManagementPage.tsx` (`/sites`)
- **Purpose**: Geographical/Project site administration.
- **Components**: `CreateSiteModal`, site cards, member assignment drawer.
- **State**: `sites`, `loading`, `selectedSite`.
- **Backend Calls**: `org_sites` table operations (Insert, Update, Delete) scoped to `currentOrg.id`.

### 7. `SettingsPage.tsx` (`/settings`)
- **Purpose**: App preferences, local storage purge, native update downloader.
- **Components**: Theme toggle, version info card, "Check for Updates" button, `UpdateBanner`.
- **State**: `isCheckingUpdate`, `downloadProgress`, `updateInfo`.
- **Backend Calls**: `appReleaseService.getLatestRelease()` targeting `app_releases` table.

### 8. `AdminPage.tsx` (`/admin`)
- **Purpose**: Multi-tenant platform superuser dashboard.
- **Components**: `AdminMetricsModal`, `BroadcastNotificationModal`, `OrganizationModal`, `UserModal`, `SystemSettingsModal`.
- **State**: Global user count, total tasks count, total organizations, error logs.
- **Backend Calls**: `platform_admins` verification, queries cross-tenant tables via PostgREST RPC and admin services.

---

## G. TASK ENGINE

### Data Model & Recursive Hierarchy
Tasks are stored in the PostgreSQL `tasks` table with a nullable self-referential foreign key:
```sql
parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE
```
- **Single-Tier & Multi-Tier Delegation**: A task can spawn unlimited children (`subtasks`).
- **Custom Metadata**: Handled via `tasks.custom_fields` (`JSONB`). This enables dynamic attributes (e.g., Log Book attachments, meter readings, checklist items) without modifying the relational schema.
- **Recurrence Engine**: `recurrence_pattern` (`JSONB`) storing frequency (`daily`, `weekly`, `monthly`), interval, and days of week.
- **Multi-Assignee Junction**: `task_assignments` links `task_id` to multiple `assignee_id` values, supporting team assignments alongside single primary assignees.
- **Status Lifecycle**:
  ```
  [ pending ] ───► [ in_progress ] ───► [ completed ]
       │                                     │
       └───────────► [ cancelled ] ◄─────────┘
  ```

---

## H. DATABASE / SUPABASE DEPENDENCY MAP

### Direct Verified Table Inventory
| Table Name | Row Count | Primary Key | Critical Foreign Keys | Primary Access Pattern |
| :--- | :--- | :--- | :--- | :--- |
| `tasks` | 54 | `id` (UUID) | `org_id`, `site_id`, `parent_task_id`, `user_id` | Core work items, subtasks, recurrence |
| `task_assignments` | 21 | `id` (UUID) | `task_id`, `assignee_id`, `assigned_by` | Multi-user task distribution |
| `org_sites` | 5 | `id` (UUID) | `org_id` | Project / physical job sites |
| `org_user_sites` | 7 | `id` (UUID) | `org_id`, `user_id`, `site_id` | User site assignment whitelist |
| `notifications` | 36 | `id` (UUID) | `user_id` | System, task, and broadcast alerts |
| `app_releases` | 17 | `id` (UUID) | None | Mobile APK versions and changelogs |
| `platform_admins` | 1 | `id` (UUID) | `user_id` | Superadmin authorization check |
| `organizations` | Multi | `id` (UUID) | `created_by` | Multi-tenant company entities |
| `org_members` | Multi | `id` (UUID) | `org_id`, `user_id` | Role matrix (`admin`, `member`, `manager`)|
| `users` (profiles) | Multi | `id` (UUID) | `auth.users.id` | Profile names, avatars, department |
| `task_attachments`| Multi | `id` (UUID) | `task_id`, `uploaded_by` | File metadata linked to Supabase storage |
| `task_notes` | Multi | `id` (UUID) | `task_id`, `user_id` | Activity logs and comments |

### Supabase Storage Buckets
- `task-attachments`: File uploads, logbook images, task completion proofs.
- `app-releases` / `apks`: Direct binary storage for compiled Android APK releases.

---

## I. SECURITY MAP

1. **Authentication**: Supabase Auth issues JWT containing `auth.uid()`. Session persisted in browser `localStorage`.
2. **Row Level Security (RLS)**:
   - `tasks`: Policies restrict `SELECT/UPDATE/DELETE` to rows where `user_id = auth.uid()` OR `id IN (SELECT task_id FROM task_assignments WHERE assignee_id = auth.uid())` OR user is an admin of `org_id`.
   - `organizations`: Restricted to members enrolled in `org_members`.
3. **Platform Admin Check**:
   - Implemented via `adminService.isPlatformAdmin()`.
   - Directly checks if `auth.uid()` exists in `platform_admins`. If false, access to `/admin` redirects to `/`.
4. **Environment Variables**:
   - `VITE_SUPABASE_URL`: Public endpoint.
   - `VITE_SUPABASE_ANON_KEY`: Safe public anon key (protected by RLS).
   - `VITE_APP_ACCESS_KEY`: Client access validation token.
   - `VITE_GEMINI_API_KEY`: Client-side Gemini API key for AI assistant features.

---

## J. ORGANIZATION / MULTI-TENANT SYSTEM

- **Tenant Boundary**: Every business record links to `org_id`.
- **Role Hierarchy**:
  - `admin`: Full administrative control over members, billing, departments, sites, and tasks.
  - `manager`: Site supervisor capabilities; task creation, assignment, and status approvals.
  - `member`: Operational execution; views only assigned tasks and assigned sites.
- **Site-Level Isolation**:
  - `org_sites` divides an organization into distinct projects (e.g., "Site 18 B", "Site VTR").
  - `org_user_sites` restricts an employee's view to their authorized sites only.
  - In `PendingTasksPage`, task listings filter dynamically based on the user's active site selection.

---

## K. ADMIN SYSTEM

- **Access Guard**: Protected route guarding `/admin`.
- **Capabilities**:
  - **Cross-Organization Inspection**: View aggregated operational metrics across all registered tenants.
  - **User Directory**: View all user accounts, active sessions, and force privilege changes.
  - **Broadcast Push System**: Publish global notifications dispatched to the `notifications` table for all users.
  - **Release Management**: Upload new APK builds to `app_releases`, specify minimum required versions, and trigger forced update prompts across all mobile devices.

---

## L. MOBILE / CAPACITOR SYSTEM

1. **Native Wrapper**: Apache Capacitor 6.2.0 targeting Android SDK 34 (Android 14) with backward compatibility to SDK 22 (Android 5.1).
2. **Package Name**: `com.tasker.app`
3. **Current Build Metrics**:
   - `versionCode`: `23`
   - `versionName`: `1.0.20`
4. **In-App Direct Update Pipeline**:
   - Mobile app checks `app_releases` table on boot or via `/settings`.
   - If `latest.version_code > current.versionCode`, triggers `UpdateBanner`.
   - Uses `@capacitor/filesystem` to stream the remote `.apk` to the device's temporary cache.
   - Dispatches `@capawesome/capacitor-android-app-updater` to trigger the native Android package installer intent (`ACTION_INSTALL_PACKAGE`).

---

## M. RESPONSIVE DESIGN AUDIT

- **Breakpoints**: Tailwind standard (`sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`).
- **Mobile (< 768px)**:
  - Sidebar is completely hidden (`hidden md:flex`).
  - Navigation handled exclusively by `BottomNav.tsx` (Home, Pending Tasks, Quick Add, Delegations, Profile).
  - Header displays compact logo, notification bell, and user avatar.
  - Modals render full-screen or as bottom sheets (`rounded-t-2xl`).
- **Desktop (>= 768px)**:
  - Bottom navigation bar is hidden (`md:hidden`).
  - Persistent left sidebar with organization switcher, site shortcuts, and full route menu.
  - Modals render centered with backdrop blur (`sm:max-w-lg md:max-w-2xl`).

---

## N. CURRENT DESIGN SYSTEM

- **Color Palette**:
  - Core Brand: Indigo / Blue (`#3b82f6`, `#4f46e5`, `#1d4ed8`)
  - Status Success: Emerald / Green (`#10b981`, `#059669`)
  - Status Warning: Amber / Yellow (`#f59e0b`, `#d97706`)
  - Status Danger: Rose / Red (`#ef4444`, `#dc2626`)
  - Neutral Dark: Slate / Zinc (`#0f172a`, `#1e293b`, `#334155`)
  - Neutral Light: White / Slate 50 (`#ffffff`, `#f8fafc`, `#f1f5f9`)
- **Typography**: Inter / System Sans-Serif font stack.
- **Component Primitives**:
  - Cards: `bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 backdrop-blur-sm`
  - Inputs: `bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500`
  - Buttons: `px-4 py-2 rounded-lg font-medium transition-colors shadow-sm`

---

## O. DESIGN INCONSISTENCIES

1. **Dual Styling Dialects**:
   - Legacy components use direct utility tokens: `bg-slate-800 text-white border-slate-700`.
   - Newer components (such as `auth-switch.tsx`) use modern shadcn semantic tokens: `bg-background text-foreground border-border bg-primary text-primary-foreground`.
2. **Modal Backdrop Discrepancy**: Some modals use `bg-black/50 backdrop-blur-sm` while older modals use solid `bg-black/75`.
3. **Card Border Radii**: Inconsistent mixture of `rounded-lg`, `rounded-xl`, and `rounded-2xl` across adjacent cards on `/pending-tasks` and `/` dashboard.
4. **Elevation & Shadows**: Uneven use of `shadow-sm`, `shadow-md`, `shadow-lg`, and flat non-shadowed borders.

---

## P. BLUEPRINT VS ACTUAL IMPLEMENTATION

| Architectural Blueprint Item | Actual Implementation Status | Variance Notes |
| :--- | :--- | :--- |
| **Enterprise ERP Suite** | **Code Present, Unrouted** | 10 complete ERP modules exist in `src/pages/` and `src/services/` but have zero routes in `App.tsx`. |
| **Multi-Tier Task Delegation**| **Fully Implemented** | `parent_task_id`, `task_assignments`, and `DelegateSubtaskModal` are live and operational. |
| **Site Operations Hub** | **Fully Implemented** | Sites can be created, assigned, and filtered cleanly in `/pending-tasks` and `/sites`. |
| **Automated Testing Suite** | **Missing** | Zero test files exist in the repository (`0.0% coverage`). |
| **Single Design System** | **Partially Unified** | Tailwind works across all screens, but CSS variable token standardization is incomplete. |

---

## Q. REDESIGN SAFETY MAP

### 🟢 Safe to Modify (Cosmetic / Layout Only)
- Visual styling of `Header.tsx`, `Sidebar.tsx`, and `BottomNav.tsx`.
- Color schemes, typography, spacing, and border radius tokens in `tailwind.config.js` and `index.css`.
- Card layouts in `TaskCard.tsx`, `TaskList.tsx`, and `TaskListView.tsx`.
- Metric pill styles and visual iconography.

### 🟡 Modify with Caution (State & Schema Dependencies)
- `CreateTaskModal.tsx`, `DelegateSubtaskModal.tsx`, `QuickCompleteModal.tsx` (tightly bound to `tasks`, `task_assignments`, and custom fields JSONB schema).
- `PendingTasksPage.tsx` (filtering logic bound to `org_sites` and `org_user_sites`).
- `TaskDetailPage.tsx` (recursive subtask hierarchy mutations).

### 🔴 High-Risk Zone (Do NOT Touch Without Explicit Approval)
- `lib/supabase.ts` and `contexts/AuthContext.tsx` (critical authentication session loop).
- `appReleaseService.ts`, `appUpdateService.ts`, and `android/` native manifest (breaks live APK auto-update on Android devices).
- Supabase SQL schema migrations and table foreign keys.
- Deletion of the 15 unrouted pages without client sign-off on feature roadmaps.

---

## R. FUTURE ENTERPRISE UI RECOMMENDATION

1. **Unify Design Tokens**: Normalize all components to use semantic shadcn CSS variables (`--primary`, `--background`, `--card`, `--muted`, `--border`).
2. **Elevate Desktop ERP Experience**: Re-route and integrate the high-value orphan ERP modules (Approvals, Invoices, HR) into the desktop sidebar navigation under an expandable "Enterprise Suite" accordion.
3. **Streamline Mobile Task Execution**: Convert the mobile task list into high-density swipeable cards with one-tap "Quick Complete" and "Delegate" actions.
4. **Refined Typography & Micro-Interactions**: Implement crisp typography hierarchy with subtle framer-motion or CSS transitions for task completion states.

---

## S. REDESIGN IMPACT MAP

```
[ Layout Refactor ]
  │
  ├──► Affects: Sidebar.tsx, BottomNav.tsx, Header.tsx
  │    └──► Impact: Global navigation across all 27 active routes.
  │
[ Design System Tokenization ]
  │
  ├──► Affects: index.css, tailwind.config.js
  │    └──► Impact: Theme switcher, contrast ratios, and dark/light mode parity.
  │
[ Task Component Polish ]
  │
  ├──► Affects: TaskCard.tsx, TaskList.tsx, TaskSubtasks.tsx
  │    └──► Impact: Core daily user workflow; high user touchpoint.
  │
[ Unrouted Code Decision ]
  │
  └──► Affects: 15 Page files & 12 Service files
       └──► Impact: Bundle size reduction (if purged) OR major product expansion (if routed).
```

---

## T. UNUSED / DUPLICATED CODE

### 15 Unrouted Pages
1. `src/pages/BusinessPage.tsx`
2. `src/pages/DocumentsPage.tsx`
3. `src/pages/ErpAccountingPage.tsx`
4. `src/pages/ErpApprovalsPage.tsx`
5. `src/pages/ErpCrmPage.tsx`
6. `src/pages/ErpDashboardPage.tsx`
7. `src/pages/ErpDocumentsPage.tsx`
8. `src/pages/ErpHrPage.tsx`
9. `src/pages/ErpInventoryPage.tsx`
10. `src/pages/ErpReportsPage.tsx`
11. `src/pages/FamilyPage.tsx`
12. `src/pages/FinancePage.tsx`
13. `src/pages/ReportsPage.tsx`
14. `src/pages/TemplatesPage.tsx`
15. `src/pages/VehiclesPage.tsx`

### Supporting Unrouted Services
- `businessService.ts`, `documentsService.ts`, `erpAccountingService.ts`, `erpApprovalsService.ts`, `erpCrmService.ts`, `erpDashboardService.ts`, `erpDocumentsService.ts`, `erpHrService.ts`, `erpInventoryService.ts`, `erpReportsService.ts`, `familyService.ts`, `financeService.ts`, `reportService.ts`, `templateService.ts`, `vehicleService.ts`.

---

## U. BUILD / RUNTIME STATUS

- **TypeScript Compilation**: `tsc -b` passes with **0 errors**.
- **Vite Bundler**: Production Rollup build completes successfully in **~7.4 seconds**.
- **Bundle Output**:
  - `dist/index.html` (0.89 kB)
  - `dist/assets/index-[hash].css` (91.43 kB │ gzip: 14.86 kB)
  - `dist/assets/index-[hash].js` (1,154.21 kB │ gzip: 298.11 kB)
- **Automated Test Suite**: None configured in repository.

---

## V. CRITICAL RISKS

1. **Bundle Chunk Warning**: `dist/assets/index-[hash].js` is ~1.15 MB, exceeding Vite's 500 kB chunk warning threshold. This is directly caused by bundling all 15 unrouted pages without dynamic `React.lazy()` route code-splitting.
2. **Direct APK Installer Permissions**: Android 14 (SDK 34) enforces strict restrictions on `REQUEST_INSTALL_PACKAGES`. If target permissions or signing keys drift, in-app updates fail silently.
3. **Database Grants on Service Role**: Direct Postgres service-role queries to `organizations` and `task_notes` require authenticated context due to strict `authenticated`/`anon` grant configurations. Any admin tools calling Supabase with raw service-role keys must account for these grants.

---

## W. UNKNOWN / NEEDS VERIFICATION

1. **Unrouted ERP Strategy**: Does the stakeholder intend to launch the 15 ERP and Family modules in an upcoming release, or should they be safely archived into a feature branch to streamline the bundle?
2. **Target Device Primacy**: Is the primary usage scenario field workers on Android mobile devices (prioritizing high contrast, large touch targets, offline resilience) or back-office managers on desktop web (prioritizing high information density, tables, multi-pane views)?
3. **Gemini API Integration**: `VITE_GEMINI_API_KEY` is present in environment configs; should AI smart task breakdown and auto-categorization be formally surfaced in the redesigned Task creation workflow?

---

## WHAT YOU NEED FROM ME BEFORE REDESIGN

Before any visual or architectural redesign commences, please confirm:
1. **Scope of Redesign**: Should the redesign focus exclusively on the **active 27 task & site management routes**, or should it also integrate and route the **15 unrouted ERP modules**?
2. **Design Preference**: Do you prefer an **Enterprise Dashboard aesthetic** (compact, high-density data tables, neutral gray/slate tones) or a **Modern SaaS aesthetic** (card-centric, generous whitespace, vibrant indigo/emerald accents)?
3. **Mobile vs Desktop Priority**: Which platform experience should lead the design direction — **Mobile Android APK** or **Desktop Web**?
