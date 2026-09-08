// src/services/releaseChannelService.ts

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type ReleaseChannel = 'stable' | 'beta';
export type ReleaseStatus = 'draft' | 'published' | 'disabled';

export interface UserReleaseChannelInfo {
  userId: string;
  channel: ReleaseChannel;
  joinedAt?: string;
  updatedAt?: string;
}

export interface AdminReleaseRecord {
  id: string;
  version_name: string;
  version_code: number;
  release_channel: ReleaseChannel;
  status: ReleaseStatus;
  rollout_percentage: number;
  apk_url: string;
  release_url?: string;
  release_notes: string | null;
  is_mandatory: boolean;
  published_at?: string;
  created_at: string;
  created_by?: string;
  disabled_at?: string;
  disabled_by?: string;
}

export interface AdminUserChannelView {
  userId: string;
  email: string;
  displayName: string;
  channel: ReleaseChannel;
  joinedAt: string;
  updatedAt: string;
}

export interface CreateReleasePayload {
  versionName: string;
  versionCode: number;
  channel: ReleaseChannel;
  apkUrl: string;
  releaseUrl?: string;
  releaseNotes: string;
  isMandatory: boolean;
  rolloutPercentage: number;
  status: ReleaseStatus;
}

export const releaseChannelService = {
  /**
   * Fetch current authenticated user's release channel.
   * Server-authoritative query against public.user_release_channels.
   * Defaults safely to 'stable' for any user without an explicit record.
   */
  async getMyReleaseChannel(): Promise<ReleaseChannel> {
    if (!isSupabaseConfigured()) return 'stable';

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return 'stable';

      // 1. Try dedicated table
      const { data, error } = await supabase
        .from('user_release_channels')
        .select('release_channel')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('user_release_channels query notice:', error.message);
        return 'stable';
      }

      if (data && (data.release_channel === 'beta' || data.release_channel === 'stable')) {
        return data.release_channel as ReleaseChannel;
      }

      return 'stable';
    } catch {
      return 'stable';
    }
  },

  /**
   * Enroll current authenticated user into Beta channel.
   * Server-authoritative via join_beta_channel RPC or direct upsert.
   */
  async joinBeta(): Promise<{ success: boolean; channel: ReleaseChannel; message: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        throw new Error('Authentication required to join Beta channel.');
      }

      // 1. Attempt server RPC
      const { data: rpcData, error: rpcErr } = await supabase.rpc('join_beta_channel');
      if (!rpcErr && rpcData?.success) {
        return {
          success: true,
          channel: 'beta',
          message: rpcData.message || 'Successfully joined TASKER Beta channel.',
        };
      }

      // 2. Resilient fallback to direct table upsert
      const { error: upsertErr } = await supabase
        .from('user_release_channels')
        .upsert(
          {
            user_id: user.id,
            release_channel: 'beta',
            joined_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          },
          { onConflict: 'user_id' }
        );

      if (upsertErr) throw upsertErr;

      // Log audit
      try {
        await supabase.from('admin_audit_logs').insert({
          admin_id: user.id,
          admin_email: user.email || 'user',
          action: 'user_joined_beta',
          target_type: 'channel',
          target_id: user.id,
          details: { channel: 'beta', timestamp: new Date().toISOString() },
        });
      } catch {}

      return {
        success: true,
        channel: 'beta',
        message: 'Successfully enrolled in TASKER Beta channel.',
      };
    } catch (err: any) {
      console.error('Failed to join Beta:', err);
      throw new Error(err?.message || 'Failed to join Beta channel.');
    }
  },

  /**
   * Switch current authenticated user back to Stable channel.
   */
  async leaveBeta(): Promise<{ success: boolean; channel: ReleaseChannel; message: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        throw new Error('Authentication required.');
      }

      // 1. Attempt server RPC
      const { data: rpcData, error: rpcErr } = await supabase.rpc('leave_beta_channel');
      if (!rpcErr && rpcData?.success) {
        return {
          success: true,
          channel: 'stable',
          message: rpcData.message || 'Switched to Stable channel.',
        };
      }

      // 2. Resilient fallback to direct table upsert
      const { error: upsertErr } = await supabase
        .from('user_release_channels')
        .upsert(
          {
            user_id: user.id,
            release_channel: 'stable',
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          },
          { onConflict: 'user_id' }
        );

      if (upsertErr) throw upsertErr;

      // Log audit
      try {
        await supabase.from('admin_audit_logs').insert({
          admin_id: user.id,
          admin_email: user.email || 'user',
          action: 'user_left_beta',
          target_type: 'channel',
          target_id: user.id,
          details: { channel: 'stable', timestamp: new Date().toISOString() },
        });
      } catch {}

      return {
        success: true,
        channel: 'stable',
        message: 'Successfully switched to TASKER Stable channel.',
      };
    } catch (err: any) {
      console.error('Failed to leave Beta:', err);
      throw new Error(err?.message || 'Failed to switch to Stable channel.');
    }
  },

  /**
   * Platform Admin: Fetch all app releases (Draft, Published, Disabled).
   */
  async adminGetAllReleases(): Promise<AdminReleaseRecord[]> {
    try {
      const { data, error } = await supabase
        .from('app_releases')
        .select('*')
        .order('version_code', { ascending: false });

      if (error) {
        console.error('Error fetching admin releases:', error);
        return [];
      }

      return (data || []).map((r: any) => ({
        id: r.id,
        version_name: r.version_name,
        version_code: Number(r.version_code),
        release_channel: (r.release_channel as ReleaseChannel) || 'stable',
        status: (r.status as ReleaseStatus) || 'published',
        rollout_percentage: typeof r.rollout_percentage === 'number' ? r.rollout_percentage : 100,
        apk_url: r.apk_url,
        release_url: r.release_url || r.apk_url,
        release_notes: r.release_notes || '',
        is_mandatory: Boolean(r.is_mandatory),
        published_at: r.published_at || r.created_at,
        created_at: r.created_at,
        created_by: r.created_by,
        disabled_at: r.disabled_at,
        disabled_by: r.disabled_by,
      }));
    } catch (err) {
      console.error('adminGetAllReleases exception:', err);
      return [];
    }
  },

  /**
   * Platform Admin: Publish or Save Draft Release.
   * Enforces atomic monotonicity check: versionCode must be greater than current maximum.
   */
  async adminPublishRelease(payload: CreateReleasePayload): Promise<void> {
    // 1. Client-side monotonic pre-validation
    const existing = await this.adminGetAllReleases();
    const maxPublishedCode = existing
      .filter((r) => r.status === 'published')
      .reduce((max, r) => Math.max(max, r.version_code), 0);

    if (payload.status === 'published' && payload.versionCode <= maxPublishedCode) {
      throw new Error(
        `Version code ${payload.versionCode} cannot be published because build ${maxPublishedCode} already exists. Version codes must be strictly monotonic.`
      );
    }

    // 2. Call server-side RPC for atomic lock & monotonicity
    const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_publish_release', {
      p_version_name: payload.versionName.trim(),
      p_version_code: payload.versionCode,
      p_release_channel: payload.channel,
      p_apk_url: payload.apkUrl.trim(),
      p_release_url: payload.releaseUrl ? payload.releaseUrl.trim() : null,
      p_release_notes: payload.releaseNotes.trim(),
      p_is_mandatory: payload.isMandatory,
      p_rollout_percentage: payload.rolloutPercentage,
      p_status: payload.status,
    });

    if (!rpcErr && rpcData?.success) {
      return;
    }

    if (rpcErr) {
      // If RPC rejected for monotonicity or admin rights, bubble error directly
      if (rpcErr.message?.includes('Version code') || rpcErr.message?.includes('Access denied')) {
        throw new Error(rpcErr.message);
      }
    }

    // Fallback: Direct insert if RPC not yet migrated
    const { data: { user } } = await supabase.auth.getUser();
    const { error: insertErr } = await supabase.from('app_releases').insert({
      version_name: payload.versionName.trim(),
      version_code: payload.versionCode,
      release_channel: payload.channel,
      status: payload.status,
      rollout_percentage: payload.rolloutPercentage,
      apk_url: payload.apkUrl.trim(),
      release_url: payload.releaseUrl ? payload.releaseUrl.trim() : payload.apkUrl.trim(),
      release_notes: payload.releaseNotes.trim(),
      is_mandatory: payload.isMandatory,
      created_by: user?.id || null,
      published_at: payload.status === 'published' ? new Date().toISOString() : null,
    });

    if (insertErr) throw insertErr;

    // Log to admin audit logs
    try {
      await supabase.from('admin_audit_logs').insert({
        admin_id: user?.id,
        admin_email: user?.email,
        action: 'admin_published_release',
        target_type: 'release',
        details: {
          version_name: payload.versionName,
          version_code: payload.versionCode,
          channel: payload.channel,
          status: payload.status,
        },
      });
    } catch {}
  },

  /**
   * Platform Admin: Kill Switch — Immediately disable a published release.
   */
  async adminDisableRelease(releaseId: string): Promise<void> {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_disable_release', {
      p_release_id: releaseId,
    });

    if (!rpcErr && rpcData?.success) return;

    // Fallback direct update
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('app_releases')
      .update({
        status: 'disabled',
        disabled_at: new Date().toISOString(),
        disabled_by: user?.id || null,
      })
      .eq('id', releaseId);

    if (error) throw error;

    try {
      await supabase.from('admin_audit_logs').insert({
        admin_id: user?.id,
        admin_email: user?.email,
        action: 'admin_disabled_release',
        target_type: 'release',
        target_id: releaseId,
        details: { release_id: releaseId, disabled_at: new Date().toISOString() },
      });
    } catch {}
  },

  /**
   * Platform Admin: Update Staged Rollout percentage (e.g. 10% -> 25% -> 50% -> 100%).
   */
  async adminSetRollout(releaseId: string, percentage: number): Promise<void> {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100.');
    }

    const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_set_release_rollout', {
      p_release_id: releaseId,
      p_percentage: percentage,
    });

    if (!rpcErr && rpcData?.success) return;

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('app_releases')
      .update({ rollout_percentage: percentage })
      .eq('id', releaseId);

    if (error) throw error;

    try {
      await supabase.from('admin_audit_logs').insert({
        admin_id: user?.id,
        admin_email: user?.email,
        action: 'admin_set_release_rollout',
        target_type: 'release',
        target_id: releaseId,
        details: { release_id: releaseId, new_rollout: percentage },
      });
    } catch {}
  },

  /**
   * Platform Admin: Get all users with their current release channel.
   */
  async adminGetUsersWithChannels(): Promise<AdminUserChannelView[]> {
    try {
      // 1. Fetch all user release channel memberships
      const { data: channelRows, error: chErr } = await supabase
        .from('user_release_channels')
        .select('*');

      if (chErr) {
        console.warn('user_release_channels query warning:', chErr.message);
      }

      const channelMap = new Map<string, any>((channelRows || []).map((r: any) => [r.user_id, r]));

      // 2. Fetch users from org memberships and platform admins
      const [membersRes, adminsRes] = await Promise.all([
        supabase.from('org_memberships').select('user_id'),
        supabase.from('platform_admins').select('user_id, email'),
      ]);

      const userIds = new Set<string>();
      const emailMap = new Map<string, string>();

      (adminsRes.data || []).forEach((a: any) => {
        userIds.add(a.user_id);
        if (a.email) emailMap.set(a.user_id, a.email);
      });

      (membersRes.data || []).forEach((m: any) => {
        userIds.add(m.user_id);
      });

      (channelRows || []).forEach((c: any) => {
        userIds.add(c.user_id);
      });

      const result: AdminUserChannelView[] = [];

      userIds.forEach((uid) => {
        const ch = channelMap.get(uid);
        const email = emailMap.get(uid) || `user_${uid.substring(0, 8)}@tasker.local`;
        const displayName = email.split('@')[0];

        result.push({
          userId: uid,
          email,
          displayName,
          channel: ch?.release_channel === 'beta' ? 'beta' : 'stable',
          joinedAt: ch?.joined_at || ch?.created_at || new Date().toISOString(),
          updatedAt: ch?.updated_at || new Date().toISOString(),
        });
      });

      return result.sort((a, b) => {
        if (a.channel === 'beta' && b.channel !== 'beta') return -1;
        if (a.channel !== 'beta' && b.channel === 'beta') return 1;
        return a.displayName.localeCompare(b.displayName);
      });
    } catch (err) {
      console.error('adminGetUsersWithChannels exception:', err);
      return [];
    }
  },

  /**
   * Platform Admin: Change a user's release channel.
   */
  async adminSetUserChannel(targetUserId: string, channel: ReleaseChannel): Promise<void> {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_set_user_channel', {
      p_target_user_id: targetUserId,
      p_channel: channel,
    });

    if (!rpcErr && rpcData?.success) return;

    // Direct fallback
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('user_release_channels')
      .upsert(
        {
          user_id: targetUserId,
          release_channel: channel,
          updated_at: new Date().toISOString(),
          updated_by: user?.id || null,
        },
        { onConflict: 'user_id' }
      );

    if (error) throw error;

    try {
      await supabase.from('admin_audit_logs').insert({
        admin_id: user?.id,
        admin_email: user?.email,
        action: 'admin_changed_user_channel',
        target_type: 'channel',
        target_id: targetUserId,
        details: { target_user_id: targetUserId, new_channel: channel },
      });
    } catch {}
  },
};

