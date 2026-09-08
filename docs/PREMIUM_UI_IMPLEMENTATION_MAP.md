# TASKER — PREMIUM UI/UX IMPLEMENTATION MAP
**Document Version:** 1.0.0  
**Phase:** Phase 1 — Code Audit & Implementation Specification  
**Status:** Audit Approved — **Zero Production Code or Backend Changes Made**  
**Source of Truth:** TASKER Live Production System (`v1.0.22`, Build 25)

---

## 1. Absolute Production Safety & Protected Architecture

The following core systems, database schemas, tables, state models, and services are **STRICTLY PROTECTED** and will **NEVER** be modified, dropped, renamed, or migrated during this UI/UX transformation:

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                        PROTECTED ARCHITECTURAL ASSETS                         │
├───────────────────────────────────────────────────────────────────────────────┤
│ • Supabase Database & Migrations (001 through 017)                            │
│ • Existing production rows & foreign keys in all tables                       │
│ • auth.users, public.platform_admins, public.organizations, public.org_sites │
│ • public.tasks, task_notes, task_attachments, task_reminders, notifications   │
│ • public.app_releases & public.user_release_channels                          │
│ • Release Channel System: Beta / Stable resolver, staged rollouts, kill switch│
│ • Monotonic version_code trigger: check_app_release_monotonicity()            │
│ • Native Update Resolvers: get_eligible_app_release()                         │
│ • Capacitor Native Bridge: NotificationHelperPlugin, LocalNotifications       │
│ • Electron IPC Bridge: preload.cjs, main.cjs                                  │
│ • Core React Contexts: TaskContext, EnterpriseContext, AdminContext,          │
│   AuthContext, WorkspaceContext, LocalizationContext, ThemeContext            │
│ • Service Contracts: taskService, enterpriseService, releaseChannelService,  │
│   appUpdateService, reminderService, notificationService, whatsappService     │
└───────────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Strict Separation of Concerns:**
> All UI/UX enhancements will strictly consume the existing Context APIs and service contracts. Not a single database column will be renamed for UI convenience. Where business logic exists inside components (e.g., in `TaskDetailPage.tsx` or `TaskCard.tsx`), the operational logic is preserved 100% while presentation is modernized.

---

## 2. Full Code Audit & Existing Component Ecosystem

### 2.1 Directory Breakdown & Existing Asset Inventory
- **`src/pages/` (31 files):**
  - Personal Space: `DashboardPage`, `PendingTasksPage`, `AllTasksPage`, `CompletedTasksPage`, `BinPage`, `TaskDetailPage`, `SettingsPage`.
  - Workplace Space: `OrgTasksPage`, `OrgPendingTasksPage`, `OrgAssignedTasksPage`, `OrgCreatedTasksPage`, `EmployeeDirectoryPage`, `AssignmentHistoryPage`, `OrgManagementPage`, `NotificationsPage`, `PublicSharedTaskPage`.
  - ERP Suites (Integrated): `ErpDashboardPage`, `ErpAccountingPage`, `ErpCrmPage`, `ErpHrPage`, `ErpInventoryPage`, `ErpDocumentsPage`, `ErpReportsPage`, `ErpApprovalsPage`, `FinancePage`, `BusinessPage`, `DocumentsPage`, `VehiclesPage`, `FamilyPage`, `ReportsPage`, `TemplatesPage`.
- **`src/pages/admin/` (10 files):**
  - `AdminDashboardPage`, `AdminReleasesPage`, `AdminUsersPage`, `AdminOrganizationsPage`, `AdminMembersPage`, `AdminRequestsPage`, `AdminDirectoryPage`, `AdminRolesPage`, `AdminAuditPage`, `AdminSettingsPage`.
- **`src/components/layout/` (4 files):**
  - `AppLayout.tsx` (Global Shell, Notifications, Update Card, AI Drawer), `Header.tsx` (Top App Bar & Org switcher), `Sidebar.tsx` (Desktop Navigation Rail), `MobileNav.tsx` (Mobile Bottom Bar & More Drawer).
- **`src/components/tasks/` (20 files):**
  - `TaskCard`, `TaskTable`, `TaskFormModal`, `ChangeStatusModal`, `QuickCompleteModal`, `DelegateSubtaskModal`, `TaskSubtasks`, `TaskAttachments`, `TaskNotes`, `TaskDiscussion`, `TaskTimeTracker`, `TaskGanttView`, `TaskShareModal`, `TaskAssignmentModal`, `StatusTimeline`, `VoiceTaskModal`, `FilePreviewModal`, `FileUploadZone`, `FilterPanel`, `SearchBar`.
- **`src/components/ui/` (9 files) & `src/components/common/` (8 files):**
  - Shadcn UI Primitives: `button`, `badge`, `card`, `input`, `table`, `auth-switch`.
  - Common Components: `Button`, `Modal`, `ConfirmDialog`, `EmptyState`, `LoadingSkeleton`, `StatusBadge`, `PriorityBadge`, `Logo`.

### 2.2 Duplicated Styling & Architectural Anti-Patterns Identified
1. **Button Inconsistency:** Both `src/components/common/Button.tsx` and `src/components/ui/button.tsx` exist concurrently with conflicting variant definitions (`variant="primary"` vs `variant="default"`).
2. **Arbitrary Border Radii:** Random mix of `rounded-md` (6px), `rounded-lg` (8px), `rounded-xl` (12px), and `rounded-2xl` (16px) across cards, inputs, and modal dialogs.
3. **Color Fragmentation:** Uncoordinated accent colors (emerald, amber, indigo, sky, violet, workplace purple, brand blue) appearing on the same surface without strict semantic purpose.
4. **Mobile Squeezing:** Desktop modals and wide tables rendered inside mobile viewports without progressive conversion into native bottom sheets and gesture-friendly lists.
5. **Excessive Desktop Whitespace:** Large desktop monitors (1920x1080) displaying stretched card grids with empty negative space, forcing users to click back-and-forth instead of utilizing master-detail split views.

### 2.3 Platform Detection Standard
Platform detection is centralized across three authoritative targets:
```typescript
// Android Native APK:
const isAndroid = Capacitor.getPlatform() === 'android' || Capacitor.isNativePlatform();

// Windows Desktop Workstation:
const isWindows = typeof window !== 'undefined' && Boolean(
  (window as any).electron?.isDesktop || 
  (window as any).electron?.platform === 'windows' || 
  navigator.userAgent.includes('Electron')
);

// Responsive Enterprise Web:
const isWeb = !isAndroid && !isWindows;
```

---

## 3. Screen-by-Screen Implementation Map

| Component | Route | Primary Purpose | Current UI Problem | Target UI Direction | Mobile Behavior | Web Behavior | Windows Behavior | Reusable Primitive | Risk Level | Wave |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`AppLayout`** | Shell (`/`) | Root multi-platform application shell | Mixed mobile/desktop layout; AI button floating over mobile nav | Clean native frame with sticky bottom nav on mobile, persistent collapsible rail on web/desktop | Bottom nav bar (56px) + safe-area insets; docked AI entry | 240px collapsible sidebar + compact header | Frameless window integration + 3-pane support | `AppShell`, `TopBar` | Medium | Wave 1 |
| **`Header`** | Shell (`/`) | Global breadcrumbs, search trigger, org selector | Crowded with icons; search bar squeezed; profile menu overflow | Compact 48px command header with monospaced breadcrumb & quick search trigger | 44px top app bar with hamburger, search icon, bell, avatar | 48px header with `Ctrl+K` bar, org switcher pill, theme toggle | Native window header with title, org switcher, minimize/maximize controls | `HeaderBar`, `OrgPill` | Medium | Wave 1 |
| **`Sidebar`** | Shell (`/`) | Desktop navigation rail | Inconsistent badge colors; cluttered icon list; weak collapsed state | Linear-style 240px/64px collapsible rail with grouped sections & clear active pills | Hidden (replaced by bottom navigation) | 240px wide sidebar; collapsible to 64px icon rail | Persistent left tree navigation for workplaces & sites | `NavRail`, `NavItem` | Low | Wave 1 |
| **`MobileNav`** | Shell (`/`) | Mobile navigation | "More" drawer takes full screen; actions are cluttered | Native 5-item bottom bar: `[Home] [Tasks] [＋] [Notifs] [More]` | Always pinned to bottom; safe-area padded; active indicator dot | Hidden on `>= 1024px` | Hidden | `BottomNavBar` | Low | Wave 1 |
| **`DashboardPage`** | `/` | Operational personal overview | Metric cards occupy excessive vertical space; card grid has awkward gaps | Dense KPI ticker + "Today's Priorities" queue with quick-action triggers | Compact horizontal KPI strip + urgency list | 4-card KPI row + split master-detail task list | 3-pane layout: site list ➔ task queue ➔ task inspector | `KpiTicker`, `MasterDetail`| Low | Wave 2 |
| **`PendingTasksPage`** | `/pending` | Daily backlog execution | No batch selection; overdue tasks visually blend with standard tasks | High-urgency execution backlog with visual deadline tags and batch actions | Single-column cards with swipe actions & bottom batch sheet | Dense table with multi-select checkboxes & floating batch bar | Keyboard-first queue (`J`/`K` navigate, `E` complete) | `BatchActionBar`, `UrgencyTag`| Low | Wave 2 |
| **`AllTasksPage`** | `/tasks` | Complete task catalog & search | Dropdown filters stack vertically; no faceted count indicators | Filter pill strip with popover dropdowns + instant faceted count chips | Collapsible filter bottom sheet; swipe cards | Dense sortable table with sticky headers | Dense sortable table with persistent filter sidebar | `FilterBar`, `FacetChip` | Low | Wave 2 |
| **`CompletedTasksPage`**| `/completed`| Historical proof-of-work archive | Unstructured chronological list without grouping | Date-grouped archive ("Completed Today", "Yesterday", "Last Week") | Compact list with green verified check badges | Table with completion notes & sign-off preview | Table with inspector pane showing full audit log | `TimelineGroup` | Low | Wave 2 |
| **`BinPage`** | `/bin` | Soft-deleted task recovery | Generic browser alerts for permanent purge; weak retention notice | Dedicated safety center with 30-day retention indicator & two-step empty bin | Stacked recovery cards with clear "Restore" buttons | Table with single-click restore and purge warning | Table with keyboard shortcut (`Delete` to purge) | `SafetyBanner` | Low | Wave 2 |
| **`TaskDetailPage`** | `/tasks/:id` | Core execution workspace | Vertical scroll fatigue (10 stacked cards); stopwatch placed mid-page | 2-column desktop workspace; tabbed mobile execution workspace | 4 tabs: `[Overview] [Subtasks] [Chat] [Files]` + sticky actions | Left 65% (content) + Right 35% (status, assignee, stopwatch, actions) | Left 65% + Right 35% with persistent docked stopwatch | `StopwatchWidget`, `SubtaskMatrix`| High | Wave 3 |
| **`TaskFormModal`** | Modal | Task creation & modification | 39KB multi-field form; keyboard obscures pickers on mobile | Progressive disclosure: Core inputs first (Title, Date, Priority), then expandable options | Full-screen slide-up sheet with bottom-pinned submit | Compact 540px modal with auto-focus & `Ctrl+Enter` submit | Compact modal with complete tab-accessible keyboard flow | `ProgressiveForm` | High | Wave 3 |
| **`QuickCompleteModal`**| Modal | Fast sign-off & duration log | Standard desktop dialog on mobile | Fast 1-tap preset notes ("Completed as spec", "Inspected") + duration picker | Native bottom sheet with quick-select tag pills | Focused centered modal | Focused modal | `PresetTagPicker` | Medium | Wave 3 |
| **`AIAssistantDrawer`** | Drawer | Voice/text AI assistant | Floating trigger button overlaps mobile navigation bar | Sleek integrated assistant docked into header on mobile, expandable panel on web | Full-height bottom sheet with speech wave visualizer | 420px slide-over panel on the right side | 420px dockable side-panel | `SpeechWave`, `AIDrawer` | Medium | Wave 3 |
| **`OrgTasksPage`** | `/org/tasks` | Workplace operations board | Gantt view overflows mobile screens; site creation buried in selector | Unified operations hub with Site pill switcher and Agenda/Gantt toggle | Replaces Gantt with touch-friendly Agenda Timeline | Full-bleed interactive Gantt canvas with zoom controls | Full-bleed interactive Gantt canvas | `AgendaTimeline`, `GanttCanvas`| High | Wave 4 |
| **`OrgPendingTasksPage`**|`/org/pending`| Enterprise backlog queue | Lacks distinction between viewer's tasks vs colleagues' tasks | Segmented queue: "My Direct Tasks" vs "Team Bottlenecks" with workload pills | Segmented card list | Dense table with bottleneck warnings | Dense table with employee filter sidebar | `SegmentedQueue` | Medium | Wave 4 |
| **`OrgAssignedTasksPage`**|`/org/assigned-to-me`| Personal workplace duties | No indicator whether task was acknowledged/seen | Dedicated inbox with "Acknowledge & Start" 1-click status trigger | Card list with clear assignor chip & 1-tap start | Table with assignor chip & instant start action | Table with instant start action | `AssignmentInbox` | Low | Wave 4 |
| **`OrgCreatedTasksPage`** |`/org/created-by-me` | Delegation & supervision hub | Missing quick-nudge WhatsApp shortcuts for overdue assignees | Delegation tracking matrix with Subtasks Done ratio & 1-Click WhatsApp Nudge | Cards with progress bars & WhatsApp nudge button | High-density supervision table | High-density supervision table | `DelegationRow` | Low | Wave 4 |
| **`EmployeeDirectoryPage`**|`/org/employees`| Team directory & workload | Workload is static text; does not show if employee is overloaded | Staff catalog with capacity indicators (🟢 Available / 🟡 Normal / 🔴 Overloaded) | Staff cards with direct Call / WhatsApp buttons | High-density directory table with site assignments | Directory table with quick assign popover | `CapacityPill`, `StaffCard` | Low | Wave 4 |
| **`AssignmentHistoryPage`**|`/org/history` | Legal & dispatch audit trail | Basic timeline with awkward text wrapping; no date range filter | Enterprise audit log table with user avatar chips & reassignment transitions | Vertical audit card timeline | Audit table with transition arrows (`Suraj ➔ Pawan`) | Audit table with transition arrows & CSV export | `AuditTransitionRow`| Low | Wave 4 |
| **`OrgManagementPage`** | `/org/manage` | Org settings & site governance | Dense and cluttered; member table and site table stacked together | Grouped settings tabs: `[General] [Sites] [Members & Roles] [Join Requests]` | Tabbed mobile view with expandable action cards | Multi-tab enterprise administration hub | Multi-tab enterprise administration hub | `AdminTabContainer`| High | Wave 4 |
| **`NotificationsPage`** | `/org/notifications`| Realtime operational notifications| No date grouping; cannot dismiss individual notifications | Categorized notification feed with tabs (`All`, `Unread`, `Assignments`, `Mentions`) | Swipe-to-dismiss notification list | Notification center with bulk mark-as-read | Notification center with native toast integration | `NotificationFeed` | Low | Wave 4 |
| **`SettingsPage`** | `/settings` | System settings & Release Channel| Platform info rendered as giant cluttered card; release channel buried | Structured System Control Center with clear Release Channel & DPDP sections | Grouped cards with channel badge & 1-tap update check | Refined 4xl centered control center | Refined control center with desktop installer info | `ChannelCard`, `SettingSection`| High | Wave 5 |
| **`AdminDashboardPage`**| `/admin` | Executive platform telemetry | Metric cards lack trend indicators; basic dark layout | Elevated telemetry command center with platform health & tenant metrics | Responsive stacked dark cards | High-density dark command center with quick links | High-density dark command center | `TelemetryStatCard` | Medium | Wave 6 |
| **`AdminReleasesPage`** | `/admin/releases` | Release Center (Beta/Stable) | Needs tighter monospaced version badges & refined rollout slider | Professional release control hub preserving all 19 production releases & RPCs | Horizontal scroll catalog with status badges | High-density release matrix with live rollout sliders & kill switch | High-density release matrix | `RolloutSlider`, `ReleaseTable`| High | Wave 6 |
| **`AdminUsersPage`** | `/admin/users` | User & Super Admin governance| Client-side only search; action buttons rely on browser prompts | Secure user governance table with role badges & modal confirmations | User cards with role badges | Full-width table with search filter & admin toggle | Full-width table with admin toggle | `UserGovernanceTable`| Medium | Wave 6 |

---

## 4. Reusable Component Blueprint

The following unified component primitives will be established in **Wave 1** to replace duplicated styling across the application:

```
src/components/primitives/
├── Button.tsx             # Unified button with primary, secondary, outline, destructive, ghost variants
├── Input.tsx              # Clean 1px border input with focus ring and clear button
├── Select.tsx             # Accessible select popover with search filter
├── Badge.tsx              # Semantic status, priority, channel, and count badges
├── Card.tsx               # Standard surface container with 1px border and subtle hover elevation
├── Modal.tsx              # Desktop/Web modal dialog with auto-focus and keyboard handling
├── BottomSheet.tsx        # Mobile-native slide-up drawer with touch gesture dismiss
├── CommandPalette.tsx     # Ctrl+K universal quick command modal
├── KpiStat.tsx            # Standardized metric card with trend indicator and icon
├── StatusDot.tsx          # 6px/8px pulse dot for realtime states (Active, Overdue, Published)
└── EmptyState.tsx         # Unified zero-data illustration and call-to-action block
```

---

## 5. Unified Design Tokens & Visual Standard

### 5.1 Color Tokens (Neutral-First 85%)
- **Canvas Background:**
  - Light: `#f8fafc` (`slate-50`)
  - Dark: `#090d16` (Deep Slate / Pitch Black hybrid)
- **Surface & Cards:**
  - Light: `#ffffff` with border `#e2e8f0` (`slate-200`)
  - Dark: `#0f172a` (`slate-900`) with border `#1e293b` (`slate-800`)
- **Semantic Colors:**
  - **Success / Completed / Stable:** `emerald-600` (`#059669`) / Dark: `emerald-400` (`#34d399`)
  - **Warning / Pending / Beta:** `amber-600` (`#d97706`) / Dark: `amber-400` (`#fbbf24`)
  - **Danger / Overdue / Kill-Switch:** `rose-600` (`#e11d48`) / Dark: `rose-400` (`#fb7185`)
  - **Workplace / Enterprise:** `indigo-600` (`#4f46e5`) / Dark: `indigo-400` (`#818cf8`)
  - **Personal Focus:** `blue-600` (`#2563eb`) / Dark: `blue-400` (`#60a5fa`)

### 5.2 Typography Tokens
- **Font Families:**
  - Sans: `Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif`
  - Mono: `JetBrains Mono, ui-monospace, monospace` (Strictly for Build codes, IDs, timers, phone numbers)
- **Scale:**
  - `text-xs`: 12px / 16px (Timestamps, secondary metadata)
  - `text-sm`: 14px / 20px (Body, form inputs, table data)
  - `text-base`: 16px / 24px (Card headers, sub-headings)
  - `text-lg`: 18px / 28px (Page titles)
  - `text-xl`: 20px / 28px (Master view titles)
  - `text-2xl`: 24px / 32px (Admin KPI metrics)

### 5.3 Elevation & Borders
- **Border Standard:** Single 1px solid border (`border border-border`). Heavy multi-pixel borders are prohibited.
- **Shadows:** Micro-elevation only (`shadow-2xs: 0 1px 2px 0 rgba(0,0,0,0.03)`, `shadow-xs: 0 1px 2px 0 rgba(0,0,0,0.05)`). Exaggerated diffuse drop shadows are prohibited.

---

## 6. Implementation Wave Plan & Execution Schedule

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                     7-WAVE PRODUCTION IMPLEMENTATION ROADMAP                  │
├───────────────────────────────────────────────────────────────────────────────┤
│ WAVE 1: Design Tokens & Global Application Shell                              │
│ • Establish primitive components (Button, Input, Badge, Card, BottomSheet)    │
│ • Refactor AppLayout, Header, Sidebar, and MobileNav                          │
│ • Verification: npm run build & responsive viewport test                     │
│                                                                               │
│ WAVE 2: Personal Task Surfaces                                                │
│ • Redesign DashboardPage (compact KPI strip, urgent backlog)                  │
│ • Redesign PendingTasksPage, AllTasksPage, CompletedTasksPage, BinPage        │
│ • Standardize TaskCard and TaskTable with unified actions                     │
│ • Verification: npm run build & task CRUD verification                       │
│                                                                               │
│ WAVE 3: Core Task Execution Workspace & Modals                                │
│ • Redesign TaskDetailPage (2-column desktop, tabbed mobile)                   │
│ • Modernize TaskFormModal (progressive disclosure form)                       │
│ • Modernize QuickCompleteModal, DelegateSubtaskModal, AIAssistantDrawer       │
│ • Verification: Stopwatch timer, WhatsApp dispatch, PDF export verified       │
│                                                                               │
│ WAVE 4: Enterprise Workplace Suite                                            │
│ • Redesign OrgTasksPage (Agenda timeline on mobile, Gantt on desktop)         │
│ • Redesign OrgPendingTasksPage, OrgAssignedTasksPage, OrgCreatedTasksPage     │
│ • Redesign EmployeeDirectoryPage, AssignmentHistoryPage, OrgManagementPage    │
│ • Modernize NotificationsPage feed                                            │
│ • Verification: Org switching, site filtering, member roles verified          │
│                                                                               │
│ WAVE 5: System Settings & Release Channel Hub                                 │
│ • Redesign SettingsPage into unified System Control Center                    │
│ • Retain 100% of Release Channel (Beta/Stable) backend integration            │
│ • Verification: In-app update check, channel switch, data export verified     │
│                                                                               │
│ WAVE 6: Platform Admin Command Center                                         │
│ • Redesign AdminDashboardPage, AdminUsersPage, AdminOrganizationsPage         │
│ • Elevate AdminReleasesPage (Release Center, staged rollouts, kill switch)    │
│ • Redesign AdminMembersPage, AdminRequestsPage, AdminAuditPage                │
│ • Verification: Super admin authorization & release publishing verified       │
│                                                                               │
│ WAVE 7: Cross-Platform Hardening & Final Polish                               │
│ • Android hardware back button & safe-area audit                              │
│ • Windows Electron desktop shortcuts & window controls audit                  │
│ • Full WCAG 2.1 AA accessibility & reduced motion audit                       │
│ • Final production build verification (npm run build)                         │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Verification & Non-Regression Protocol

Every wave must satisfy the following zero-regression criteria before proceeding:
1. `cmd.exe /c npm run build` must complete with **0 errors**.
2. **Data Integrity:** Real task records, assignments, notes, attachments, and user sessions must render identically. Zero mock data.
3. **Release Infrastructure:** The Release Channel system (`stable` vs `beta`, staged rollout percentage, monotonicity checks, download URLs) must remain fully operational.
4. **Hardware Integrations:** Android back button handler, Capacitor local notifications, and Electron desktop update events must function without regression.
