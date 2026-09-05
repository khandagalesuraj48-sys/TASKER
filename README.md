# My Work Tracker

**My Work Tracker** is a production-oriented, single-user web application designed for one person to record, organize, track, and manage all work and tasks from daily personal life and office work.

It is not a simple to-do list. It is a full-featured **Personal Work Tracking + Pending Management + Status History Timeline + Accountability + Document Attachment + Bin/Archive + Manual Backup & Restore System**.

---

## 1. Key Features

- **Pending Work Prioritization**: The dashboard immediately surfaces all work requiring attention, prioritizing Overdue, Pending, Partial, and In-Progress work.
- **Derived Overdue Status**: Tasks past their due date are clearly flagged with red OVERDUE indicators without corrupting the underlying lifecycle status.
- **Immutable Status History**: Every status transition records exact timestamps (formatted in `Asia/Kolkata`), the previous and new status, the actor (`Pawan`), and optional user remarks.
- **Pending Duration Tracking**: Real-time duration metrics (e.g. `Pending since: 3 days ago` / `05 Sep 2026`).
- **Completion Audit Records**: When tasks reach `Completed`, `completed_at` and `completed_by` are automatically captured and displayed.
- **Document Attachments via Supabase Storage**: Upload and manage PDFs, images (JPG, PNG), spreadsheets (XLS, XLSX, CSV), Word docs (DOC, DOCX), archives (ZIP), and text files up to 25MB.
- **Interactive File Previews**: Built-in modal viewer for PDFs and images, with direct download and new-tab access for all document formats.
- **Bin / Soft-Deletion & Recovery**:
  - Delete moves tasks to the Bin without losing status history, notes, or attachments.
  - One-click **Restore** brings tasks back into active views.
  - **Permanent Delete** removes database records and purges associated files from Supabase Storage with strong confirmation dialogs.
- **Portable Offline Backup & Restore**:
  - **Backup Now**: Exports all tasks, status histories, notes, and metadata into `data.json` and downloads binary attachments from Supabase Storage into a single timestamped `.zip` archive.
  - **Restore Backup**: Accepts the `.zip` archive, validates data, presents a pre-restore summary, idempotently upserts records, and uploads missing files to Supabase Storage.
- **Global Search & Multi-Criteria Filtering**: Search across title, description, and assigned person. Filter by Status, Priority (Low, Medium, High, Urgent), Due Date, Person, and Attachment presence. Sort by newest, oldest, due date, priority, recently updated, or longest pending.
- **Responsive Layout**: Desktop sidebar and responsive mobile drawer navigation designed for laptops, tablets, and mobile browsers.

---

## 2. Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling & UI**: Tailwind CSS, Lucide React Icons
- **Backend & Database**: Supabase PostgreSQL (hosted or local)
- **Object Storage**: Supabase Storage (`task-attachments` bucket)
- **Date & Timezone**: `date-fns`, `date-fns-tz` (Asia/Kolkata timezone support)
- **Archiving & Backup**: `jszip`, `file-saver`
- **Deployment**: Vercel-ready with single-page application rewrites (`vercel.json`)

---

## 3. Directory Structure

```text
TASKER/
├── public/
│   ├── favicon.svg
│   └── robots.txt
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── PriorityBadge.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── LoadingSkeleton.tsx
│   │   │   └── Toast.tsx
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── tasks/
│   │   │   ├── TaskCard.tsx
│   │   │   ├── TaskTable.tsx
│   │   │   ├── TaskFormModal.tsx
│   │   │   ├── ChangeStatusModal.tsx
│   │   │   ├── StatusTimeline.tsx
│   │   │   ├── TaskNotes.tsx
│   │   │   ├── TaskAttachments.tsx
│   │   │   ├── FileUploadZone.tsx
│   │   │   ├── FilePreviewModal.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   └── FilterPanel.tsx
│   │   └── dashboard/
│   │       ├── StatCard.tsx
│   │       └── PendingTodaySection.tsx
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── AllTasksPage.tsx
│   │   ├── PendingTasksPage.tsx
│   │   ├── CompletedTasksPage.tsx
│   │   ├── BinPage.tsx
│   │   ├── TaskDetailPage.tsx
│   │   └── SettingsPage.tsx
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── dateUtils.ts
│   │   └── fileUtils.ts
│   ├── services/
│   │   ├── taskService.ts
│   │   ├── statusHistoryService.ts
│   │   ├── notesService.ts
│   │   ├── attachmentService.ts
│   │   └── backupService.ts
│   ├── context/
│   │   ├── ToastContext.tsx
│   │   └── TaskContext.tsx
│   ├── types/
│   │   ├── task.ts
│   │   └── database.ts
│   ├── constants/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   └── vite-env.d.ts
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── .env.example
├── .env
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── vercel.json
└── README.md
```

---

## 4. Setup & Installation

### Prerequisites

- Node.js (version 18+ or 20+ LTS recommended)
- npm or pnpm or yarn
- A Supabase account and project (free tier at [supabase.com](https://supabase.com))

### 1. Clone or Open the Workspace

Open a terminal in the project directory:

```bash
cd TASKER
```

### 2. Install Dependencies

```bash
npm install
```

---

## 5. Supabase Database & Storage Setup

You do **not** need to create tables one by one manually. A complete migration script is provided.

### Step 1: Run the SQL Migration

1. Log into your [Supabase Dashboard](https://app.supabase.com).
2. Open your project.
3. In the left navigation, click on **SQL Editor**.
4. Click **New Query**.
5. Copy the entire contents of `supabase/migrations/001_initial_schema.sql` from this repository and paste it into the query editor.
6. Click **Run** (or press Ctrl+Enter).

The script will automatically create:
- `tasks` table with all metadata, status lifecycle fields, and constraints.
- `task_status_history` table for immutable transition records.
- `task_notes` table for timestamped updates.
- `task_attachments` table for file references.
- High-performance database indexes.
- Database triggers for `updated_at`, status transitions (`started_at`, `completed_at`, `pending_since`), and deduplicated initial creation history.
- Transactional RPC function `update_task_status_with_history` ensuring atomic status changes and history logging in a single database transaction.
- Row Level Security (RLS) policies configured for single-user access with optional access key protection.
- The `task-attachments` bucket in Supabase Storage with private access and signed URLs.

### Step 2: Configure Storage Bucket (Verification)

The SQL migration automatically provisions the `task-attachments` bucket as a **private** bucket (`public = false`). Documents are securely accessed via temporary signed URLs generated on-demand by the application, preventing public exposure of your uploaded files.

---

## 6. Environment Variables

Create a file named `.env` in the root of the project (you can copy `.env.example`):

```env
# Supabase Configuration (From Supabase Dashboard -> Project Settings -> API)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key

# Single-User Identity Configuration
VITE_DEFAULT_USER_NAME=Pawan

# Optional Single-User Access Key (matches app.access_key in Supabase Vault/Settings if enabled)
VITE_APP_ACCESS_KEY=
```

> **Security Note:**
> - Never expose the Supabase `service_role` secret in client-side code or `.env`. Only the public `anon` key should be used in frontend applications.
> - As a single-user application without user authentication/login, anyone who has your deployed web application URL and Supabase credentials can read/write data unless access is restricted. If hosting publicly on Vercel, consider setting up Vercel Deployment Protection (password protection) or configuring `VITE_APP_ACCESS_KEY` alongside Supabase RLS.

---

## 7. Local Development & Production Build

### Start Local Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Compile for Production

```bash
npm run build
```

This verifies strict TypeScript types and compiles the production bundle into the `dist/` folder.

### Preview Production Build Locally

```bash
npm run preview
```

---

## 8. Vercel Deployment Guide

Deploying to Vercel takes less than two minutes:

1. Push your repository to GitHub, GitLab, or Bitbucket.
2. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New** -> **Project**.
3. Import your repository.
4. Set the Framework Preset to **Vite**.
5. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-anon-key`
   - `VITE_DEFAULT_USER_NAME` = `Pawan`
6. Click **Deploy**.

> Note: `vercel.json` is already included in the repository to route all paths to `index.html` for single-page routing.

---

## 9. Backup & Restoration Workflow

### Creating a Manual Backup
1. Go to **Settings** in the left sidebar.
2. Click **Backup Now**.
3. The system queries all tasks (active and in the Bin), status history, notes, and attachment records.
4. It downloads all attached documents from Supabase Storage and packages everything into an offline `.zip` file: `MyWorkTracker_Backup_DD_MMM_YYYY_HHmm.zip`.

### Restoring from a Backup
1. Go to **Settings**.
2. Click **Choose Backup File** and select your `.zip` (or legacy `.json`) backup file.
3. Review the preview card showing the count of tasks, history entries, notes, and attachments found.
4. Click **Restore From This Backup**.
5. Confirm the restore prompt. Existing records are safely updated using stable IDs, and missing files are uploaded back into Supabase Storage.

---

## 10. License

Private, personal single-user software.

