import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  releaseChannelService,
  AdminReleaseRecord,
  AdminUserChannelView,
  ReleaseChannel,
  ReleaseStatus,
  CreateReleasePayload,
} from '../../services/releaseChannelService';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import {
  Radio,
  Sparkles,
  ShieldCheck,
  FlaskConical,
  AlertTriangle,
  RefreshCw,
  Plus,
  Search,
  Download,
  PowerOff,
  Sliders,
  CheckCircle2,
  Calendar,
  X,
} from 'lucide-react';

export const AdminReleasesPage: React.FC = () => {
  const { showToast } = useToast();

  const [releases, setReleases] = useState<AdminReleaseRecord[]>([]);
  const [users, setUsers] = useState<AdminUserChannelView[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'releases' | 'users'>('releases');

  // Filters
  const [channelFilter, setChannelFilter] = useState<'all' | ReleaseChannel>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ReleaseStatus>('all');
  const [userSearch, setUserSearch] = useState<string>('');
  const [userChannelFilter, setUserChannelFilter] = useState<'all' | ReleaseChannel>('all');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [killSwitchModal, setKillSwitchModal] = useState<{ open: boolean; release: AdminReleaseRecord | null }>({
    open: false,
    release: null,
  });
  const [channelEditModal, setChannelEditModal] = useState<{ open: boolean; user: AdminUserChannelView | null }>({
    open: false,
    user: null,
  });

  // Create Release Form State
  const [formVersionName, setFormVersionName] = useState<string>('');
  const [formVersionCode, setFormVersionCode] = useState<string>('');
  const [formChannel, setFormChannel] = useState<ReleaseChannel>('stable');
  const [formStatus, setFormStatus] = useState<ReleaseStatus>('published');
  const [formRollout, setFormRollout] = useState<number>(100);
  const [formApkUrl, setFormApkUrl] = useState<string>('');
  const [formReleaseUrl, setFormReleaseUrl] = useState<string>('');
  const [formReleaseNotes, setFormReleaseNotes] = useState<string>('');
  const [formIsMandatory, setFormIsMandatory] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allReleases, allUsers] = await Promise.all([
        releaseChannelService.adminGetAllReleases(),
        releaseChannelService.adminGetUsersWithChannels(),
      ]);
      setReleases(allReleases);
      setUsers(allUsers);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load release data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived metrics
  const maxPublishedCode = useMemo(() => {
    return releases
      .filter((r) => r.status === 'published')
      .reduce((max, r) => Math.max(max, r.version_code), 0);
  }, [releases]);

  const liveStable = useMemo(() => {
    return releases.find((r) => r.release_channel === 'stable' && r.status === 'published');
  }, [releases]);

  const liveBeta = useMemo(() => {
    return releases.find((r) => r.release_channel === 'beta' && r.status === 'published');
  }, [releases]);

  const betaUserCount = useMemo(() => {
    return users.filter((u) => u.channel === 'beta').length;
  }, [users]);

  // Filtered releases
  const filteredReleases = useMemo(() => {
    return releases.filter((r) => {
      if (channelFilter !== 'all' && r.release_channel !== channelFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [releases, channelFilter, statusFilter]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (userChannelFilter !== 'all' && u.channel !== userChannelFilter) return false;
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase();
        return u.email.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [users, userChannelFilter, userSearch]);

  const handleOpenCreateModal = () => {
    const nextCode = maxPublishedCode > 0 ? maxPublishedCode + 1 : 26;
    setFormVersionCode(String(nextCode));
    setFormVersionName(`1.0.${nextCode}`);
    setFormChannel('stable');
    setFormStatus('published');
    setFormRollout(100);
    setFormApkUrl(`https://xargfforwknnicudigxs.supabase.co/storage/v1/object/public/app-releases/app-release-v1.0.${nextCode}.apk`);
    setFormReleaseUrl(`https://xargfforwknnicudigxs.supabase.co/storage/v1/object/public/app-releases/TASKER-Setup-1.0.${nextCode}.exe`);
    setFormReleaseNotes('');
    setFormIsMandatory(false);
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = parseInt(formVersionCode, 10);
    if (isNaN(code) || code <= 0) {
      showToast('Version code must be a positive integer', 'error');
      return;
    }

    if (formStatus === 'published' && code <= maxPublishedCode) {
      showToast(`Version code must be strictly greater than current maximum build (${maxPublishedCode})`, 'error');
      return;
    }

    if (!formVersionName.trim()) {
      showToast('Version name is required (e.g. 1.0.23)', 'error');
      return;
    }

    if (!formApkUrl.trim()) {
      showToast('APK Download URL is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateReleasePayload = {
        versionName: formVersionName.trim(),
        versionCode: code,
        channel: formChannel,
        status: formStatus,
        rolloutPercentage: formRollout,
        apkUrl: formApkUrl.trim(),
        releaseUrl: formReleaseUrl.trim() || undefined,
        releaseNotes: formReleaseNotes.trim(),
        isMandatory: formIsMandatory,
      };

      await releaseChannelService.adminPublishRelease(payload);
      showToast(`Release v${formVersionName} ${formStatus === 'published' ? 'published' : 'saved as draft'} successfully!`, 'success');
      setCreateModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to create release', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisableRelease = async () => {
    if (!killSwitchModal.release) return;
    setSubmitting(true);
    try {
      await releaseChannelService.adminDisableRelease(killSwitchModal.release.id);
      showToast(`Release v${killSwitchModal.release.version_name} has been disabled immediately.`, 'info');
      setKillSwitchModal({ open: false, release: null });
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to disable release', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRollout = async (releaseId: string, pct: number) => {
    try {
      await releaseChannelService.adminSetRollout(releaseId, pct);
      showToast(`Rollout updated to ${pct}%`, 'success');
      setReleases((prev) =>
        prev.map((r) => (r.id === releaseId ? { ...r, rollout_percentage: pct } : r))
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to update rollout', 'error');
    }
  };

  const handleUserChannelChange = async (targetChannel: ReleaseChannel) => {
    if (!channelEditModal.user) return;
    setSubmitting(true);
    try {
      await releaseChannelService.adminSetUserChannel(channelEditModal.user.userId, targetChannel);
      showToast(`User ${channelEditModal.user.email} switched to ${targetChannel.toUpperCase()}`, 'success');
      setChannelEditModal({ open: false, user: null });
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update user channel', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-6 h-6 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Release Center</h1>
            <Badge variant="outline" className="text-[10px] uppercase border-indigo-500/50 text-indigo-300">
              Multi-Channel
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative channel management for Android APK & Windows Desktop releases with staged rollouts & kill switches.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="h-8 text-xs bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Publish New Release
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Live Stable Card */}
        <Card className="bg-slate-900 border-slate-800 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Live Stable Channel
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            {liveStable ? (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-black text-white font-mono">
                    v{liveStable.version_name}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    (Build {liveStable.version_code})
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant="success" className="text-[10px] px-1.5 py-0">
                    Rollout: {liveStable.rollout_percentage}%
                  </Badge>
                  {liveStable.is_mandatory && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      Mandatory
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No published stable release</p>
            )}
          </CardContent>
        </Card>

        {/* Live Beta Card */}
        <Card className="bg-slate-900 border-slate-800 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Live Beta Channel
              </span>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            </div>
            {liveBeta ? (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-black text-amber-300 font-mono">
                    v{liveBeta.version_name}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    (Build {liveBeta.version_code})
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                    Rollout: {liveBeta.rollout_percentage}%
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No active beta release</p>
            )}
          </CardContent>
        </Card>

        {/* Total Releases Count */}
        <Card className="bg-slate-900 border-slate-800 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Release Records
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{releases.length}</span>
              <span className="text-xs text-slate-400">historical builds</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Highest build: <span className="font-mono text-slate-300">{maxPublishedCode}</span>
            </p>
          </CardContent>
        </Card>

        {/* Beta Testers Enrolled */}
        <Card className="bg-slate-900 border-slate-800 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Enrolled Beta Users
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-400">{betaUserCount}</span>
              <span className="text-xs text-slate-400">of {users.length} users</span>
            </div>
            <p className="text-[11px] text-slate-500">
              {users.length - betaUserCount} on Stable channel
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('releases')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'releases'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Releases Catalog ({filteredReleases.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>Beta Testers & Channels ({filteredUsers.length})</span>
        </button>
      </div>

      {/* TAB 1: RELEASES CATALOG */}
      {activeTab === 'releases' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">Channel:</span>
              {(['all', 'stable', 'beta'] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannelFilter(ch)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition-colors ${
                    channelFilter === ch
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">Status:</span>
              {(['all', 'published', 'draft', 'disabled'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition-colors ${
                    statusFilter === st
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Releases Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/60 border-b border-slate-800 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Version & Build</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Staged Rollout</th>
                    <th className="py-3 px-4">Published Date</th>
                    <th className="py-3 px-4 text-right">Actions & Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredReleases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                        No releases found matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredReleases.map((release) => {
                      const isKillSwitched = release.status === 'disabled';
                      const isDraft = release.status === 'draft';
                      const isLive = release.status === 'published';

                      return (
                        <tr key={release.id} className="hover:bg-slate-800/30 transition-colors">
                          {/* Version & Build */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white font-mono text-sm">
                                v{release.version_name}
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                (Build {release.version_code})
                              </span>
                              {release.is_mandatory && (
                                <Badge variant="destructive" className="text-[9px] px-1 py-0 uppercase">
                                  Mandatory
                                </Badge>
                              )}
                            </div>
                            {release.release_notes && (
                              <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 max-w-sm">
                                {release.release_notes.split('\n')[0]}
                              </p>
                            )}
                          </td>

                          {/* Channel */}
                          <td className="py-3.5 px-4">
                            <Badge
                              variant={release.release_channel === 'beta' ? 'warning' : 'success'}
                              className="text-[10px] uppercase font-bold"
                            >
                              {release.release_channel === 'beta' ? '🧪 Beta' : '🟢 Stable'}
                            </Badge>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {isLive && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Published
                              </span>
                            )}
                            {isDraft && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                                <Sliders className="w-3.5 h-3.5" /> Draft
                              </span>
                            )}
                            {isKillSwitched && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400">
                                <PowerOff className="w-3.5 h-3.5" /> Disabled
                              </span>
                            )}
                          </td>

                          {/* Staged Rollout */}
                          <td className="py-3.5 px-4 min-w-[170px]">
                            {isLive ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                  <span>Rollout</span>
                                  <span className="font-bold text-white">{release.rollout_percentage}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-500 rounded-full"
                                    style={{ width: `${release.rollout_percentage}%` }}
                                  />
                                </div>
                                {/* Quick rollout buttons */}
                                <div className="flex items-center gap-1 pt-0.5">
                                  {[10, 25, 50, 100].map((pct) => (
                                    <button
                                      key={pct}
                                      onClick={() => handleUpdateRollout(release.id, pct)}
                                      disabled={release.rollout_percentage === pct}
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
                                        release.rollout_percentage === pct
                                          ? 'bg-indigo-600 text-white font-bold'
                                          : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                                      }`}
                                    >
                                      {pct}%
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px] italic">Not rolling out</span>
                            )}
                          </td>

                          {/* Published Date */}
                          <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" />
                              <span>{new Date(release.created_at).toLocaleDateString()}</span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {release.apk_url && (
                                <a
                                  href={release.apk_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                  title="Download APK"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              )}

                              {isLive && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setKillSwitchModal({ open: true, release })}
                                  className="h-7 text-[11px] px-2 font-bold bg-rose-600 hover:bg-rose-700"
                                >
                                  <PowerOff className="w-3 h-3 mr-1" />
                                  Disable
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BETA TESTERS & USER CHANNELS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search user email or name..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">Channel:</span>
              {(['all', 'beta', 'stable'] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setUserChannelFilter(ch)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition-colors ${
                    userChannelFilter === ch
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/60 border-b border-slate-800 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Assigned Channel</th>
                    <th className="py-3 px-4">Last Updated</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500 italic">
                        No users found matching query.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isBeta = user.channel === 'beta';

                      return (
                        <tr key={user.userId} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-bold text-white">{user.email}</p>
                            <p className="text-[11px] text-slate-500 font-mono">{user.userId}</p>
                          </td>

                          <td className="py-3 px-4">
                            <Badge
                              variant={isBeta ? 'warning' : 'success'}
                              className="text-[10px] uppercase font-bold"
                            >
                              {isBeta ? '🧪 Beta Channel' : '🟢 Stable Channel'}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {new Date(user.updatedAt || user.joinedAt).toLocaleDateString()}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setChannelEditModal({ open: true, user })}
                              className="h-7 text-xs bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                            >
                              Change Channel
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE RELEASE MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Publish New App Release</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Version Name */}
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Version Name (e.g. 1.0.23)
                  </label>
                  <input
                    type="text"
                    required
                    value={formVersionName}
                    onChange={(e) => setFormVersionName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    placeholder="1.0.23"
                  />
                </div>

                {/* Version Code */}
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Version Code (Build #)
                  </label>
                  <input
                    type="number"
                    required
                    value={formVersionCode}
                    onChange={(e) => setFormVersionCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    placeholder="26"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Must be greater than current highest ({maxPublishedCode}).
                  </p>
                </div>
              </div>

              {/* Channel & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Target Release Channel
                  </label>
                  <select
                    value={formChannel}
                    onChange={(e) => setFormChannel(e.target.value as ReleaseChannel)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                  >
                    <option value="stable">🟢 Stable (General Availability)</option>
                    <option value="beta">🧪 Beta (Pre-Release Preview)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Publishing Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ReleaseStatus)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                  >
                    <option value="published">🚀 Published (Active)</option>
                    <option value="draft">📝 Draft (Do not distribute)</option>
                  </select>
                </div>
              </div>

              {/* Initial Staged Rollout */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Initial Staged Rollout
                  </label>
                  <span className="text-xs font-mono font-bold text-indigo-400">{formRollout}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={formRollout}
                  onChange={(e) => setFormRollout(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                  <span>10% (Canary)</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>100% (Full GA)</span>
                </div>
              </div>

              {/* APK URL */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Android APK Direct Download URL
                </label>
                <input
                  type="url"
                  required
                  value={formApkUrl}
                  onChange={(e) => setFormApkUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="https://.../app-release-v1.0.23.apk"
                />
              </div>

              {/* Windows EXE / Release URL */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Windows Desktop Setup URL (.exe / GitHub Release)
                </label>
                <input
                  type="url"
                  value={formReleaseUrl}
                  onChange={(e) => setFormReleaseUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="https://.../TASKER-Setup-1.0.23.exe"
                />
              </div>

              {/* Release Notes */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Release Notes / What's New
                </label>
                <textarea
                  rows={3}
                  value={formReleaseNotes}
                  onChange={(e) => setFormReleaseNotes(e.target.value)}
                  placeholder="Describe bug fixes, features, and performance enhancements..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              {/* Mandatory Checkbox */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/60 border border-slate-700">
                <input
                  type="checkbox"
                  id="mandatoryCheck"
                  checked={formIsMandatory}
                  onChange={(e) => setFormIsMandatory(e.target.checked)}
                  className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="mandatoryCheck" className="text-xs text-slate-200 select-none">
                  <strong>Mandatory Release:</strong> Users on older versions must update before continuing
                </label>
              </div>

              {/* Monotonic validation banner */}
              {parseInt(formVersionCode, 10) <= maxPublishedCode && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    Build code must be greater than <strong>{maxPublishedCode}</strong>.
                  </span>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateModalOpen(false)}
                  className="bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || (formStatus === 'published' && parseInt(formVersionCode, 10) <= maxPublishedCode)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  {submitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {formStatus === 'published' ? 'Publish Release Now' : 'Save Draft'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KILL SWITCH CONFIRMATION MODAL */}
      {killSwitchModal.open && killSwitchModal.release && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-slate-900 border border-rose-800/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <PowerOff className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Emergency Kill Switch</h3>
                <p className="text-xs text-rose-300">Disable Published Release</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-200 space-y-1.5">
              <p>
                You are about to immediately disable <strong>v{killSwitchModal.release.version_name} (Build {killSwitchModal.release.version_code})</strong>.
              </p>
              <p className="text-[11px] text-rose-300">
                Once disabled, no users will receive update notifications or be able to download this build.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setKillSwitchModal({ open: false, release: null })}
                disabled={submitting}
                className="bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDisableRelease}
                disabled={submitting}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {submitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <PowerOff className="w-3.5 h-3.5 mr-1.5" />
                )}
                Confirm Kill Switch
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE USER CHANNEL MODAL */}
      {channelEditModal.open && channelEditModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Change User Release Channel</h3>
                <p className="text-xs text-slate-400">{channelEditModal.user.email}</p>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-2 p-3 bg-slate-800/60 rounded-lg border border-slate-700">
              <p>
                Current Channel:{' '}
                <strong className={channelEditModal.user.channel === 'beta' ? 'text-amber-400' : 'text-emerald-400'}>
                  {channelEditModal.user.channel.toUpperCase()}
                </strong>
              </p>
              <p className="text-[11px] text-slate-400">
                Switching channel takes effect on their next update check. Downgrades on Android require a newer version to be published on Stable.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setChannelEditModal({ open: false, user: null })}
                disabled={submitting}
                className="bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  handleUserChannelChange(
                    channelEditModal.user?.channel === 'beta' ? 'stable' : 'beta'
                  )
                }
                disabled={submitting}
                className={
                  channelEditModal.user.channel === 'beta'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }
              >
                {submitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : channelEditModal.user.channel === 'beta' ? (
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                ) : (
                  <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
                )}
                Switch to {channelEditModal.user.channel === 'beta' ? 'Stable Channel' : 'Beta Channel'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
