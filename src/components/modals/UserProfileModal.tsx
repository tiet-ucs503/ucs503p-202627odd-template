import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTimetable } from '../../context/TimetableContext';
import { evaluatePasswordPolicy } from '../../lib/passwordPolicy';
import { Building, X, Edit3, CheckCircle2, Lock, AlertCircle } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSwitchAccount?: () => void;
}

const fieldInput = 'w-full px-3 py-1.5 rounded-lg border border-[#E5E2D9] dark:border-zinc-800 bg-white dark:bg-zinc-950 text-stone-900 dark:text-zinc-100 text-xs';

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { currentUser, currentInstitution, currentRole, roster, updateUserProfile, changePassword } = useAuth();
  const { sections, departments } = useTimetable();

  const [isEditing, setIsEditing] = useState(false);
  const [phoneInput, setPhoneInput] = useState(currentUser?.phone ?? '');
  const [officeLocationInput, setOfficeLocationInput] = useState(currentUser?.officeLocation ?? '');
  const [officeHoursInput, setOfficeHoursInput] = useState(currentUser?.officeHours ?? '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  if (!isOpen || !currentUser) return null;

  const section = sections.find((s) => s.id === roster?.sectionId);
  const subSection = section?.subSections?.find((s) => s.id === roster?.subSectionId);
  const isStudent = currentUser.roleCode === 'STUDENT' || currentUser.roleCode === 'CLASS_REPRESENTATIVE';
  const department = currentUser.department || departments.find((d) => d.id === section?.departmentId)?.name || '—';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await updateUserProfile({ phone: phoneInput.trim(), officeLocation: officeLocationInput.trim(), officeHours: officeHoursInput.trim() });
    setBusy(false);
    setMessage({ ok: r.success, text: r.success ? 'Contact details saved.' : r.message ?? 'Could not save.' });
    if (r.success) setIsEditing(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const policy = evaluatePasswordPolicy(newPassword);
    if (!policy.isValid) return setMessage({ ok: false, text: `New password needs: ${policy.errors.join(', ')}.` });
    if (newPassword !== confirmPassword) return setMessage({ ok: false, text: 'New passwords do not match.' });
    setBusy(true);
    const r = await changePassword(oldPassword, newPassword);
    setBusy(false);
    setMessage({ ok: r.success, text: r.message ?? (r.success ? 'Password changed.' : 'Could not change password.') });
    if (r.success) {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto font-sans" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl max-w-xl w-full shadow-lg relative overflow-hidden my-auto max-h-[92vh] flex flex-col text-stone-900 dark:text-zinc-100"
      >
        <div className="p-6 border-b border-[#E5E2D9] dark:border-zinc-800 bg-[#F4F2EC] dark:bg-zinc-950/70 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#8C1B2E]/10 text-[#8C1B2E] flex items-center justify-center font-bold text-xl border border-[#8C1B2E]/30 shrink-0" aria-hidden="true">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <h2 id="profile-title" className="text-xl font-bold tracking-tight font-serif">{currentUser.name}</h2>
              <p className="text-xs text-stone-600 dark:text-zinc-400 mt-0.5">
                {currentRole?.name ?? currentUser.roleName} · {department}
              </p>
              {isStudent ? (
                <div className="text-[11px] text-stone-500 dark:text-zinc-400 mt-1">
                  {section ? `Semester ${section.semester} · ${section.name}${subSection ? ` / ${subSection.name}` : ''}` : 'Not linked to a section yet'}
                  {roster?.rollNumber && <span className="font-mono"> · Roll No. {roster.rollNumber}</span>}
                </div>
              ) : (
                <div className="text-[11px] text-stone-500 dark:text-zinc-400 mt-1 flex items-center gap-2">
                  <Building className="h-3.5 w-3.5 text-[#8C1B2E]" aria-hidden="true" />
                  <span>{currentInstitution.name} ({currentInstitution.code})</span>
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200" aria-label="Close profile">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {message && (
            <div role={message.ok ? 'status' : 'alert'} className={`p-3 rounded-xl border flex items-center gap-2 ${message.ok ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'}`}>
              {message.ok ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <AlertCircle className="h-4 w-4" aria-hidden="true" />}
              <span>{message.text}</span>
            </div>
          )}

          {isStudent && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Info label="Program" value={section?.program || '—'} />
              <Info label="Batch" value={section ? String(section.batchYear) : '—'} />
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E2D9] dark:border-zinc-800 pb-2">
              <h3 className="font-bold uppercase tracking-wider text-stone-500 text-[11px]">Contact information</h3>
              <button onClick={() => setIsEditing(!isEditing)} className="flex items-center gap-1.5 text-xs text-[#8C1B2E] dark:text-red-400 font-semibold hover:underline">
                {!isEditing && <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />}
                <span>{isEditing ? 'Cancel' : 'Edit contact'}</span>
              </button>
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="space-y-3">
                <Labeled id="profile-phone" label="Phone number">
                  <input id="profile-phone" type="tel" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} className={fieldInput} />
                </Labeled>
                {!isStudent && (
                  <>
                    <Labeled id="profile-office" label="Office location">
                      <input id="profile-office" value={officeLocationInput} onChange={(e) => setOfficeLocationInput(e.target.value)} className={fieldInput} />
                    </Labeled>
                    <Labeled id="profile-hours" label="Office hours">
                      <input id="profile-hours" value={officeHoursInput} onChange={(e) => setOfficeHoursInput(e.target.value)} className={fieldInput} />
                    </Labeled>
                  </>
                )}
                <button type="submit" disabled={busy} className="px-4 py-2 bg-[#8C1B2E] text-white font-semibold text-xs rounded-lg hover:bg-[#721525] disabled:opacity-60">
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <Info label="Institutional email" value={currentUser.email} mono />
                <Info label="Phone number" value={currentUser.phone || '—'} mono />
                {!isStudent && <Info label="Office location" value={currentUser.officeLocation || '—'} />}
                {!isStudent && <Info label="Office hours" value={currentUser.officeHours || '—'} />}
                <Info label="Sign-in method" value={currentUser.ssoProvider ?? '—'} />
              </div>
            )}
          </div>

          {currentUser.hasPassword && (
            <div className="space-y-3 pt-2 border-t border-[#E5E2D9] dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-[#8C1B2E]" aria-hidden="true" />
                  <span>Account password</span>
                </span>
                <button type="button" onClick={() => setShowPasswordForm(!showPasswordForm)} className="text-xs text-[#8C1B2E] dark:text-red-400 font-semibold hover:underline">
                  {showPasswordForm ? 'Cancel' : 'Change password'}
                </button>
              </div>
              {showPasswordForm && (
                <form onSubmit={handleChangePassword} className="p-3.5 bg-white dark:bg-zinc-950 rounded-xl border border-[#E5E2D9] dark:border-zinc-800 space-y-3">
                  <Labeled id="pw-current" label="Current password">
                    <input id="pw-current" type="password" autoComplete="current-password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className={fieldInput} required />
                  </Labeled>
                  <Labeled id="pw-new" label="New password (12+ characters, upper, lower, number, symbol)">
                    <input id="pw-new" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={fieldInput} required />
                  </Labeled>
                  <Labeled id="pw-confirm" label="Confirm new password">
                    <input id="pw-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={fieldInput} required />
                  </Labeled>
                  <button type="submit" disabled={busy} className="px-4 py-2 bg-[#8C1B2E] text-white font-semibold text-xs rounded-lg disabled:opacity-60">
                    {busy ? 'Updating…' : 'Update password'}
                  </button>
                  <p className="text-[11px] text-stone-500">Changing your password signs you out on other devices.</p>
                </form>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#E5E2D9] dark:border-zinc-800 bg-[#F4F2EC] dark:bg-zinc-950/70 flex items-center justify-between text-xs">
          <span className="text-stone-500">Thapar Institute of Engineering & Technology</span>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg border border-[#E5E2D9] dark:border-zinc-700 bg-white dark:bg-zinc-800 font-semibold hover:bg-stone-100">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-stone-500 block mb-0.5">{label}</span>
      <span className={`${mono ? 'font-mono' : 'font-medium'} text-stone-900 dark:text-zinc-100 break-all`}>{value}</span>
    </div>
  );
}

function Labeled({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-stone-600 dark:text-zinc-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
