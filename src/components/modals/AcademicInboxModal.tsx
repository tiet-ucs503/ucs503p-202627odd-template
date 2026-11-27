import React, { useEffect, useState } from 'react';
import { useTimetable } from '../../context/TimetableContext';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  X,
  AlertTriangle,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  ChevronRight,
  Vote,
  Sparkles
} from 'lucide-react';

/** Server timestamps are ISO strings; older sample items may hold text like "Just now". */
function whenLabel(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function isToday(ts: string): boolean {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) || d.toDateString() === new Date().toDateString();
}

interface AcademicInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActionClick?: (actionType: string) => void;
}

export function AcademicInboxModal({ isOpen, onClose, onActionClick }: AcademicInboxModalProps) {
  const { notifications, markNotificationRead, setActiveView } = useTimetable();
  const { currentWorkspace } = useAuth();
  const [feedback, setFeedback] = useState('');

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isStudent = currentWorkspace === 'Student' || currentWorkspace === 'CR';

  // Group notifications into Today vs Earlier
  const todayNotifs = notifications.filter(n => isToday(n.timestamp));
  const earlierNotifs = notifications.filter(n => !isToday(n.timestamp));
  const markRead = (id: string) => {
    if (notifications.find(n => n.id === id && !n.read)) {
      void markNotificationRead(id).then(() => setFeedback('Notification marked as read.')).catch((error) => setFeedback(error instanceof Error ? error.message : 'Could not update notification.'));
    }
  };
  const markAllRead = async () => {
    const unread = notifications.filter(x => !x.read);
    if (!unread.length) return;
    setFeedback('');
    const results = await Promise.allSettled(unread.map((item) => markNotificationRead(item.id)));
    const failed = results.filter((result) => result.status === 'rejected').length;
    setFeedback(failed ? `Marked ${unread.length - failed} of ${unread.length} notifications as read. Please retry the rest.` : 'All notifications marked as read.');
  };

  const handleNotificationAction = (notifId: string, actionType?: string) => {
    markRead(notifId);
    onClose();
    if (isStudent) {
      const notification = notifications.find((item) => item.id === notifId);
      setActiveView(notification?.type === 'cancellation' ? 'grid' : 'overview');
      if (onActionClick) onActionClick(actionType || 'replacement_vote');
    } else {
      setActiveView('recovery');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div role="dialog" aria-modal="true" aria-label="Notifications" className="w-screen max-w-md bg-[#FAF9F5] dark:bg-zinc-900 border-l border-[#E5E2D9] dark:border-zinc-800 shadow-xl flex flex-col text-stone-900 dark:text-zinc-100 animate-in slide-in-from-right duration-150">
          
          {/* Header */}
          <div className="p-4 border-b border-[#E5E2D9] dark:border-zinc-800 flex items-center justify-between bg-[#F4F2EC] dark:bg-zinc-950/60">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#8C1B2E]/10 text-[#8C1B2E] dark:text-red-400 flex items-center justify-center font-bold">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-stone-900 dark:text-zinc-100 font-serif">
                  Notifications
                </h3>
                <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                  Academic schedule updates & alerts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={markAllRead}
                disabled={!notifications.some(n => !n.read)}
                className="text-xs text-[#8C1B2E] dark:text-red-400 hover:text-[#721525] dark:hover:text-red-300 font-medium transition-colors"
              >
                Mark all as read
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-stone-200/50 transition-colors"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {feedback && <p role="status" className="rounded-md border border-[#E5E2D9] bg-white p-2.5 text-xs text-stone-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">{feedback}</p>}
            {/* TODAY SECTION */}
            {todayNotifs.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold text-stone-500 dark:text-zinc-400 uppercase tracking-wider px-1">
                  Today
                </div>

                <div className="space-y-2">
                  {todayNotifs.map(notif => {
                    const isCancellation = notif.type === 'cancellation' || notif.category === 'Critical';
                    const isReplacement = notif.type === 'makeup_request' || notif.title.toLowerCase().includes('replacement');

                    return (
                      <div
                        key={notif.id}
                        onClick={() => markRead(notif.id)}
                        className={`p-3.5 rounded-xl border text-xs transition-all cursor-pointer ${
                          !notif.read
                            ? 'bg-white dark:bg-zinc-950 border-[#E5E2D9] dark:border-zinc-700/80 shadow-xs'
                            : 'bg-white/60 dark:bg-zinc-900 border-[#E5E2D9] dark:border-zinc-800/80 opacity-75'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 font-semibold">
                            {isCancellation ? (
                              <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                            ) : isReplacement ? (
                              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            )}
                            <span className="text-stone-900 dark:text-zinc-100 font-medium">
                              {notif.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-stone-400 dark:text-zinc-500 shrink-0 font-medium">
                            {whenLabel(notif.timestamp)}
                          </span>
                        </div>

                        <p className="text-stone-600 dark:text-zinc-300 leading-relaxed pl-3.5 mb-2">
                          {notif.message}
                        </p>

                        {/* Student Action Buttons */}
                        {notif.actionable && (
                          <div className="pl-3.5 pt-1">
                            {isReplacement ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNotificationAction(notif.id, 'vote');
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8C1B2E] hover:bg-[#721525] text-white font-medium text-xs shadow-xs transition-colors"
                              >
                                <Vote className="h-3.5 w-3.5" />
                                <span>Vote for time</span>
                              </button>
                            ) : isCancellation ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNotificationAction(notif.id, 'view_options');
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E2D9] dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-stone-100 dark:hover:bg-zinc-700 text-stone-800 dark:text-zinc-200 font-medium text-xs transition-colors"
                              >
                                <span>View options</span>
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNotificationAction(notif.id, 'view_timetable');
                                }}
                                className="inline-flex items-center gap-1 text-[#8C1B2E] dark:text-red-400 hover:underline font-medium text-xs"
                              >
                                <span>View schedule</span>
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* EARLIER SECTION */}
            {earlierNotifs.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold text-stone-500 dark:text-zinc-400 uppercase tracking-wider px-1">
                  Earlier
                </div>

                <div className="space-y-2">
                  {earlierNotifs.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => markRead(notif.id)}
                      className={`p-3.5 rounded-xl border text-xs transition-all cursor-pointer ${
                        !notif.read
                          ? 'bg-white dark:bg-zinc-950 border-[#E5E2D9] dark:border-zinc-700/80 shadow-xs'
                          : 'bg-white/60 dark:bg-zinc-900 border-[#E5E2D9] dark:border-zinc-800/80 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-medium text-stone-900 dark:text-zinc-100">
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-stone-400 dark:text-zinc-500 shrink-0 font-medium">
                          {whenLabel(notif.timestamp)}
                        </span>
                      </div>

                      <p className="text-stone-600 dark:text-zinc-300 leading-relaxed pl-1">
                        {notif.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {notifications.length === 0 && (
              <div className="py-16 text-center text-slate-400 dark:text-zinc-500 text-xs">
                No notifications right now.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
