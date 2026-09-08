// src/components/tasks/TaskDiscussion.tsx
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, AtSign, User } from 'lucide-react';
import { fetchTaskComments, addCommentToTask, TaskComment } from '../../services/taskCommentService';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';

export interface DiscussionMember {
  id?: string | null;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
}

interface TaskDiscussionProps {
  taskId: string;
  teamMembers?: DiscussionMember[];
}

export const TaskDiscussion: React.FC<TaskDiscussionProps> = ({ taskId, teamMembers = [] }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [showMentionMenu, setShowMentionMenu] = useState<boolean>(false);
  const [mentionFilter, setMentionFilter] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadComments = async () => {
    const list = await fetchTaskComments(taskId);
    setComments(list);
  };

  useEffect(() => {
    loadComments();

    const handleCommentAdded = (e: any) => {
      if (e.detail && e.detail.task_id === taskId) {
        setComments((prev) => {
          if (prev.some((c) => c.id === e.detail.id)) return prev;
          return [...prev, e.detail];
        });
      }
    };

    window.addEventListener('tasker_comment_added', handleCommentAdded);
    return () => window.removeEventListener('tasker_comment_added', handleCommentAdded);
  }, [taskId]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    // Check for @mention trigger
    const lastWord = val.split(' ').pop() || '';
    if (lastWord.startsWith('@')) {
      setShowMentionMenu(true);
      setMentionFilter(lastWord.slice(1).toLowerCase());
    } else {
      setShowMentionMenu(false);
    }
  };

  const insertMention = (memberName: string) => {
    const words = inputText.split(' ');
    words.pop(); // Remove partial @mention
    words.push(`@${memberName} `);
    setInputText(words.join(' '));
    setShowMentionMenu(false);
    inputRef.current?.focus();
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSubmitting) return;

    // Extract @mentions
    const mentionsFound = (inputText.match(/@(\w+)/g) || []).map((m) => m.replace('@', ''));

    setIsSubmitting(true);
    try {
      await addCommentToTask({
        taskId,
        userId: user?.id || 'guest',
        userName: user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Operative',
        userEmail: user?.email || '',
        content: inputText.trim(),
        mentions: mentionsFound,
      });

      setInputText('');
      setShowMentionMenu(false);
      loadComments();
    } catch (err) {
      console.error('Error sending comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMembers = teamMembers.filter((m) => {
    const label = m.name || m.full_name || m.email || '';
    return label.toLowerCase().includes(mentionFilter);
  });

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Task Discussion & Activity ({comments.length})
          </h4>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">Realtime Feed</span>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
        {comments.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
            <MessageSquare className="w-8 h-8 stroke-[1.2] mb-1 opacity-40" />
            <p className="text-xs font-medium">No discussion messages yet.</p>
            <p className="text-[11px] text-muted-foreground/80">
              Type <strong className="text-foreground">@name</strong> to mention a teammate.
            </p>
          </div>
        ) : (
          comments.map((c) => {
            const isMe = c.user_id === user?.id;
            return (
              <div
                key={c.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1`}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                  <User className="w-2.5 h-2.5" />
                  <span className="font-semibold text-foreground">{c.user_name}</span>
                  <span>•</span>
                  <span>{format(new Date(c.created_at), 'h:mm a')}</span>
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm ${
                    isMe
                      ? 'bg-primary text-primary-foreground rounded-br-xs'
                      : 'bg-muted/70 text-foreground border border-border/40 rounded-bl-xs'
                  }`}
                >
                  {/* Render with highlighted @mentions */}
                  {c.content.split(' ').map((word, i) => {
                    if (word.startsWith('@')) {
                      return (
                        <span
                          key={i}
                          className={`font-semibold underline decoration-2 mr-1 ${
                            isMe ? 'text-amber-200' : 'text-primary'
                          }`}
                        >
                          {word}
                        </span>
                      );
                    }
                    return word + ' ';
                  })}
                </div>
              </div>
            );
          })
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Mentions Dropdown Menu */}
      {showMentionMenu && filteredMembers.length > 0 && (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-1 max-h-32 overflow-y-auto mb-2 animate-fadeIn">
          <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
            Mention Teammate:
          </div>
          {filteredMembers.map((m, idx) => {
            const label = m.name || m.full_name || (m.email ? m.email.split('@')[0] : `user_${idx}`);
            return (
              <button
                key={m.id || idx}
                type="button"
                onClick={() => insertMention(label)}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted text-foreground transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                  {(label[0] || 'U').toUpperCase()}
                </div>
                <span className="font-medium truncate">{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSend} className="relative flex items-center gap-2 pt-2 border-t border-border/50">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder="Type a message or @mention..."
            className="w-full pl-3 pr-8 py-2 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={() => {
              setInputText((prev) => prev + '@');
              setShowMentionMenu(true);
              setMentionFilter('');
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary p-0.5 rounded transition-colors"
            title="Mention teammate"
          >
            <AtSign className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="submit"
          disabled={!inputText.trim() || isSubmitting}
          className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all"
          title="Send comment"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
