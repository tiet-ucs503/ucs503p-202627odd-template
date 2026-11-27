import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  Settings,
  User,
  Bell,
  Sun,
  Moon,
  Save,
  CheckCircle2,
  Building,
  Mail,
  Lock,
  Edit3
} from 'lucide-react';

export function SettingsView() {
  const { currentUser, currentInstitution, currentRole, updateUserProfile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'appearance'>('profile');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Profile Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [officeLocation, setOfficeLocation] = useState(currentUser?.officeLocation ?? '');

  // Notification preferences are stored on the user profile.
  const prefs = currentUser?.notificationPreferences ?? {};
  const [notifyTimetable, setNotifyTimetable] = useState(prefs.timetable ?? true);
  const [notifyRequests, setNotifyRequests] = useState(prefs.requests ?? true);
  const [notifyConflicts, setNotifyConflicts] = useState(prefs.conflicts ?? true);

  const save = async (updates: Parameters<typeof updateUserProfile>[0], okText: string) => {
    setSaving(true);
    const r = await updateUserProfile(updates);
    setSaving(false);
    setFeedback({ ok: r.success, text: r.success ? okText : r.message ?? 'Could not save.' });
    setTimeout(() => setFeedback(null), 3000);
    return r.success;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await save({ phone: phone.trim(), officeLocation: officeLocation.trim() }, 'Profile updated.')) setIsEditing(false);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    save({ notificationPreferences: { timetable: notifyTimetable, requests: notifyRequests, conflicts: notifyConflicts } }, 'Notification preferences saved.');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 font-sans pb-12 text-stone-900 dark:text-zinc-100">
      {/* Header */}
      <div className="border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400 mt-0.5">
          Manage your profile, notifications, and application appearance.
        </p>
      </div>

      {/* Tabs: Profile | Notifications | Appearance */}
      <div className="flex border-b border-[#E5E2D9] dark:border-zinc-800 text-xs font-semibold bg-[#FAF9F5] dark:bg-zinc-900 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('profile')}
          className={`py-2 px-4 rounded-lg transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'profile'
              ? 'bg-[#8C1B2E] text-white shadow-xs'
              : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100'
          }`}
        >
          <User className="h-3.5 w-3.5" />
          <span>Profile</span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`py-2 px-4 rounded-lg transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'notifications'
              ? 'bg-[#8C1B2E] text-white shadow-xs'
              : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100'
          }`}
        >
          <Bell className="h-3.5 w-3.5" />
          <span>Notifications</span>
        </button>

        <button
          onClick={() => setActiveTab('appearance')}
          className={`py-2 px-4 rounded-lg transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'appearance'
              ? 'bg-[#8C1B2E] text-white shadow-xs'
              : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100'
          }`}
        >
          {theme === 'dark' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          <span>Appearance</span>
        </button>
      </div>

      {feedback && (
        <div
          role={feedback.ok ? 'status' : 'alert'}
          className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${feedback.ok ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'}`}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 1. PROFILE TAB */}
      {activeTab === 'profile' && (
        <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-6 space-y-5 text-xs shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-[11px]">
            <div>
              <span className="text-stone-500 dark:text-zinc-400">Assigned Role & Account Status: </span>
              <strong className="text-stone-900 dark:text-zinc-100">{currentRole?.name || currentUser?.roleCode}</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 font-semibold text-emerald-800 dark:text-emerald-300">ACTIVE</span>
              <span className="font-mono text-stone-500 dark:text-zinc-400">ID: {currentUser?.id || '—'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#8C1B2E]/10 text-[#8C1B2E] font-bold text-lg flex items-center justify-center border border-[#8C1B2E]/30 shrink-0">
                {currentUser?.name?.charAt(0) || '?'}
              </div>
              <div>
                <h3 className="text-base font-bold font-serif text-stone-900 dark:text-zinc-100">
                  {currentUser?.name}
                </h3>
                <p className="text-stone-500 text-[11px]">
                  {currentRole?.name ?? currentUser?.roleName}{currentUser?.department ? ` · ${currentUser.department}` : ''}
                </p>
              </div>
            </div>

            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 text-xs text-[#8C1B2E] dark:text-red-400 font-semibold hover:underline"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs text-stone-500 hover:underline"
              >
                Cancel
              </button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label htmlFor="settings-phone" className="block text-stone-600 dark:text-zinc-400 mb-1">Phone Number</label>
                <input
                  id="settings-phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs"
                />
              </div>

              <div>
                <label htmlFor="settings-office" className="block text-stone-600 dark:text-zinc-400 mb-1">Office Location</label>
                <input
                  id="settings-office"
                  type="text"
                  value={officeLocation}
                  onChange={e => setOfficeLocation(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-[#8C1B2E] text-white font-semibold text-xs rounded-lg shadow-xs hover:bg-[#721525] disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <span className="text-stone-500 block mb-0.5">Institution</span>
                <span className="font-semibold text-stone-900 dark:text-zinc-100">{currentInstitution?.name || 'Thapar Institute of Engineering & Technology'}</span>
              </div>

              <div>
                <span className="text-stone-500 block mb-0.5">Department</span>
                <span className="font-semibold text-stone-900 dark:text-zinc-100">{currentUser?.department || '—'}</span>
              </div>

              <div>
                <span className="text-stone-500 block mb-0.5">Institutional Email</span>
                <span className="font-mono text-stone-900 dark:text-zinc-100">{currentUser?.email}</span>
              </div>

              <div>
                <span className="text-stone-500 block mb-0.5">Phone Number</span>
                <span className="font-mono text-stone-900 dark:text-zinc-100">{currentUser?.phone || '—'}</span>
              </div>

              {(currentUser?.roleCode === 'STUDENT' || currentUser?.roleCode === 'CLASS_REPRESENTATIVE') ? (
                <>
                  <div>
                    <span className="text-stone-500 block mb-0.5">Enrollment / Roll Number</span>
                    <span className="font-mono font-semibold text-stone-900 dark:text-zinc-100">{currentUser?.rollNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block mb-0.5">Assigned Section / Group</span>
                    <span className="font-semibold text-stone-900 dark:text-zinc-100">{currentUser?.sectionId || '—'}{currentUser?.batch ? ` · ${currentUser.batch}` : ''}</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-stone-500 block mb-0.5">Office Location</span>
                    <span className="font-semibold text-stone-900 dark:text-zinc-100">{currentUser?.officeLocation || '—'}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block mb-0.5">Authorized Workspaces</span>
                    <span className="font-semibold text-stone-900 dark:text-zinc-100">{(currentUser?.authorizedWorkspaces || []).join(', ') || currentRole?.name || '—'}</span>
                  </div>
                </>
              )}
              <div className="sm:col-span-2 pt-2 border-t border-[#E5E2D9] dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500 dark:text-zinc-400">
                <span>Session Security: HttpOnly Same-Origin Cookie Active</span>
                <span>Account Created: {currentUser?.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'Institutional Record'}</span>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-[#E5E2D9] dark:border-zinc-800 flex justify-end">
            <button
              onClick={logout}
              className="px-4 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/20 font-semibold"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* 2. NOTIFICATIONS TAB */}
      {activeTab === 'notifications' && (
        <form onSubmit={handleSaveSettings} className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-6 space-y-4 text-xs shadow-2xs">
          <h3 className="text-sm font-bold font-serif border-b border-[#E5E2D9] dark:border-zinc-800 pb-2">
            Notification Preferences
          </h3>

          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="pref-notifyTimetable" className="font-semibold block text-stone-900 dark:text-zinc-100">Timetable Updates</label>
                <span className="text-stone-500 text-[11px]">Receive notifications when class schedules change</span>
              </div>
              <input
                type="checkbox"
                id="pref-notifyTimetable"
                checked={notifyTimetable}
                onChange={e => setNotifyTimetable(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-[#8C1B2E] focus:ring-[#8C1B2E]"
              />
            </div>

            <div className="flex items-center justify-between border-t border-[#E5E2D9] dark:border-zinc-800/60 pt-3">
              <div>
                <label htmlFor="pref-notifyRequests" className="font-semibold block text-stone-900 dark:text-zinc-100">Request Updates</label>
                <span className="text-stone-500 text-[11px]">Receive notifications when new cancellation/swap requests arrive</span>
              </div>
              <input
                type="checkbox"
                id="pref-notifyRequests"
                checked={notifyRequests}
                onChange={e => setNotifyRequests(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-[#8C1B2E] focus:ring-[#8C1B2E]"
              />
            </div>

            <div className="flex items-center justify-between border-t border-[#E5E2D9] dark:border-zinc-800/60 pt-3">
              <div>
                <label htmlFor="pref-notifyConflicts" className="font-semibold block text-stone-900 dark:text-zinc-100">Conflict Notifications</label>
                <span className="text-stone-500 text-[11px]">Immediate alert if scheduling conflicts occur</span>
              </div>
              <input
                type="checkbox"
                id="pref-notifyConflicts"
                checked={notifyConflicts}
                onChange={e => setNotifyConflicts(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-[#8C1B2E] focus:ring-[#8C1B2E]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#E5E2D9] dark:border-zinc-800 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#8C1B2E] text-white font-semibold rounded-lg hover:bg-[#721525] disabled:opacity-60"
            >
              Save Preferences
            </button>
          </div>
        </form>
      )}

      {/* 3. APPEARANCE TAB */}
      {activeTab === 'appearance' && (
        <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-6 space-y-4 text-xs shadow-2xs">
          <h3 className="text-sm font-bold font-serif border-b border-[#E5E2D9] dark:border-zinc-800 pb-2">
            Appearance & Theme
          </h3>

          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="font-semibold block text-stone-900 dark:text-zinc-100">Color Theme</span>
              <span className="text-stone-500 text-[11px]">Switch between Thapar Warm Paper mode and Dark Slate mode</span>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="px-4 py-2 rounded-lg border border-[#E5E2D9] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-800 dark:text-zinc-200 font-semibold flex items-center gap-2 hover:bg-stone-100 dark:hover:bg-zinc-700"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-stone-600" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
