import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Task, TaskShareLink } from '../../types/task';
import {
  createTaskShareLink,
  getTaskShareLinks,
  revokeShareLink,
} from '../../services/shareLinkService';
import { useToast } from '../../context/ToastContext';
import { Copy, Check, ShieldAlert, Link as LinkIcon, Trash2 } from 'lucide-react';

interface TaskShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
}

export const TaskShareModal: React.FC<TaskShareModalProps> = ({
  isOpen,
  onClose,
  task,
}) => {
  const { showToast } = useToast();
  const [links, setLinks] = useState<TaskShareLink[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [allowAttachments, setAllowAttachments] = useState<boolean>(false);
  const [newlyCreatedUrl, setNewlyCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const loadLinks = async () => {
    setIsLoading(true);
    try {
      const data = await getTaskShareLinks(task.id);
      setLinks(data);
    } catch (err: any) {
      console.error('Failed to load share links:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLinks();
      setNewlyCreatedUrl(null);
      setCopied(false);
    }
  }, [isOpen, task.id]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const result = await createTaskShareLink({
        taskId: task.id,
        expiresInDays: expiresInDays > 0 ? expiresInDays : null,
        allowAttachments,
      });
      setNewlyCreatedUrl(result.shareUrl);
      showToast('Secure share link generated!', 'success');
      await loadLinks();
    } catch (err: any) {
      showToast(err.message || 'Failed to generate link', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    showToast('Link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRevoke = async (linkId: string) => {
    try {
      await revokeShareLink(linkId);
      showToast('Share link revoked successfully.', 'info');
      await loadLinks();
      if (newlyCreatedUrl) {
        setNewlyCreatedUrl(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Could not revoke link', 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Task (Read-Only)"
      subtitle={`Generate a secure external link for "${task.title}"`}
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Security Notice */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Secure SHA-256 Hashed Link</p>
            <p className="text-amber-700 dark:text-amber-300 leading-relaxed">
              Anyone with this link can view task details without logging in. The raw token is never stored in the database.
            </p>
          </div>
        </div>

        {/* Create Form */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-3.5">
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Generate New Share Link
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                Link Expiration
              </label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-800 dark:text-slate-200"
              >
                <option value={1}>Expires in 24 Hours</option>
                <option value={7}>Expires in 7 Days</option>
                <option value={30}>Expires in 30 Days</option>
                <option value={0}>No Expiration</option>
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={allowAttachments}
                  onChange={(e) => setAllowAttachments(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Allow Viewing Attachments</span>
              </label>
            </div>
          </div>

          <Button
            size="sm"
            onClick={handleCreate}
            isLoading={isCreating}
            className="w-full mt-2"
          >
            <LinkIcon className="w-3.5 h-3.5 mr-1.5" />
            Generate Secure Link
          </Button>
        </div>

        {/* Newly Created Link Box */}
        {newlyCreatedUrl && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 space-y-2">
            <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
              <span>Link Ready to Share:</span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Read-Only</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={newlyCreatedUrl}
                className="w-full text-xs font-mono bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2 text-slate-800 dark:text-slate-200"
              />
              <Button
                size="sm"
                onClick={() => handleCopy(newlyCreatedUrl)}
                className="shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        )}

        {/* Existing Links List */}
        <div>
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Active Links ({links.filter((l) => l.is_active).length})
          </div>

          {isLoading ? (
            <div className="text-xs text-slate-400 py-3 text-center">Loading links...</div>
          ) : links.length === 0 ? (
            <div className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No share links generated yet for this task.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {links.map((link) => (
                <div
                  key={link.id}
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                    link.is_active
                      ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                      : 'border-slate-200/50 dark:border-slate-800/50 bg-slate-100/50 dark:bg-slate-800/30 opacity-60'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          link.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                      <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px] truncate">
                        Hash: {link.token_hash.slice(0, 16)}...
                      </span>
                      {link.allow_attachments && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                          + Files
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-3">
                      <span>Views: {link.view_count}</span>
                      {link.expires_at ? (
                        <span>Expires: {new Date(link.expires_at).toLocaleDateString()}</span>
                      ) : (
                        <span>No expiration</span>
                      )}
                    </div>
                  </div>

                  {link.is_active && (
                    <button
                      onClick={() => handleRevoke(link.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Revoke link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
