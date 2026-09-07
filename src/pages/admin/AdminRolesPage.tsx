import React from 'react';
import { ShieldCheck, Lock, Building2, Check, X } from 'lucide-react';

export const AdminRolesPage: React.FC = () => {
  const platformRoles = [
    {
      role: 'SUPER_ADMIN',
      badge: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
      description: 'Supreme central authority. Governs platform settings, organizations, platform admins, and join approvals.',
      scope: 'Central System-Wide',
      canManageOrgs: true,
      canAssignAdmins: true,
      canReviewRequests: true,
      canAccessPersonalTasks: false, // STRICTLY FALSE
    },
    {
      role: 'PLATFORM_ADMIN',
      badge: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
      description: 'Central operations manager. Can approve join requests and manage organizations.',
      scope: 'Central Operations',
      canManageOrgs: true,
      canAssignAdmins: false,
      canReviewRequests: true,
      canAccessPersonalTasks: false, // STRICTLY FALSE
    },
  ];

  const orgRoles = [
    {
      role: 'org_owner',
      title: 'Organization Owner',
      description: 'Primary owner of the enterprise organization (e.g. Managing Director).',
    },
    {
      role: 'org_admin',
      title: 'Organization Admin',
      description: 'Administrative officer with authority to review requests and manage directory.',
    },
    {
      role: 'project_manager',
      title: 'Project Manager',
      description: 'Authorized to delegate workplace tasks, reassign staff, and monitor milestones.',
    },
    {
      role: 'team_member',
      title: 'Team Member',
      description: 'Assigned employee who works on delegated tasks and updates progress.',
    },
    {
      role: 'viewer',
      title: 'Viewer',
      description: 'Read-only observer for workplace tasks.',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Roles & Security Matrix</h1>
        <p className="text-xs text-slate-400 mt-1">
          Cryptographic and database-enforced permission model governing Personal Space, Workplace, and Platform Admin.
        </p>
      </div>

      {/* Critical Security Alert */}
      <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-900/60 text-xs space-y-1">
        <div className="flex items-center gap-2 font-bold text-indigo-300">
          <Lock className="w-4 h-4" />
          <span>Non-Negotiable Privacy Boundary</span>
        </div>
        <p className="text-slate-300 leading-relaxed">
          Personal tasks are strictly protected at the database RLS layer (`scope = 'personal' AND user_id = auth.uid()`).
          No administrative role — including Super Admin — can view another user's personal task content.
        </p>
      </div>

      {/* Platform Roles */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-purple-400 pb-2 border-b border-slate-800">
          <ShieldCheck className="w-5 h-5" />
          <h2 className="text-base font-bold text-white">Central Platform Roles</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {platformRoles.map((pr) => (
            <div
              key={pr.role}
              className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${pr.badge}`}>
                  {pr.role}
                </span>
                <span className="text-[11px] text-slate-400">{pr.scope}</span>
              </div>
              <p className="text-xs text-slate-300">{pr.description}</p>

              <div className="pt-2 border-t border-slate-700/60 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Manage Organizations:</span>
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Review Join Requests:</span>
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Assign Platform Admins:</span>
                  {pr.canAssignAdmins ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <X className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Read Users' Personal Tasks:</span>
                  <span className="flex items-center gap-1 text-rose-400 font-bold">
                    <X className="w-4 h-4" /> Blocked
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Organization Roles */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-indigo-400 pb-2 border-b border-slate-800">
          <Building2 className="w-5 h-5" />
          <h2 className="text-base font-bold text-white">Organization Workplace Roles</h2>
        </div>

        <div className="divide-y divide-slate-800/80">
          {orgRoles.map((role) => (
            <div key={role.role} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
              <div>
                <span className="font-bold text-xs text-white">{role.title}</span>
                <span className="font-mono text-[10px] text-slate-500 ml-2">({role.role})</span>
                <p className="text-xs text-slate-400 mt-0.5">{role.description}</p>
              </div>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300 uppercase">
                Workplace Scope
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
