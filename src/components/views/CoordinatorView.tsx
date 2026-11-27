import React, { useState, useEffect } from 'react';
import { useTimetable } from '../../context/TimetableContext';
import { useAuth } from '../../context/AuthContext';
import { PollComposer } from './PollComposer';
import { formatLocalizedTimestamp } from '../../lib/userUtils';
import { supabaseClient, getSupabaseAccessToken } from '../../lib/supabaseClient';
import { getResolvedApiBaseUrl, apiUrl } from '../../lib/apiConfig';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Clock,
  Sparkles,
  Calendar,
  AlertTriangle,
  Lock,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

export function CoordinatorView() {
  const {
    courses,
    facultyMembers,
    rooms,
    sections,
    sessions,
    notifications,
    academicYear,
    versions,
    activeVersionNumber,
    allocations,
    publishStatus,
    validationReport,
    setActiveView,
    generateDualRoutinesAPI,
  } = useTimetable();

  const { currentUser, authStatus, isAuthLoading, isAuthenticated, currentRole, logout } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Environment and Preview Determination
  const isDevOrPreview =
    typeof window !== 'undefined' &&
    (import.meta.env.DEV ||
      window.location.hostname.includes('run.app') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  const environmentLabel =
    typeof window !== 'undefined' && (window.location.hostname.includes('run.app') || window.location.hostname === 'localhost')
      ? 'PREVIEW'
      : 'PRODUCTION';

  // Live Auth Diagnostics State (Dev / Preview Only)
  const [authDiagnostics, setAuthDiagnostics] = useState<{
    sessionFound: boolean;
    userFound: boolean;
    tokenPresent: boolean;
    profileFound: boolean;
    role: string;
    apiBase: string;
    backendStatus: 'AUTHENTICATED' | '401' | '403' | 'UNREACHABLE' | 'CHECKING';
  }>({
    sessionFound: false,
    userFound: false,
    tokenPresent: false,
    profileFound: false,
    role: 'UNKNOWN',
    apiBase: getResolvedApiBaseUrl(),
    backendStatus: 'CHECKING',
  });

  useEffect(() => {
    let isMounted = true;
    const runDiagnostics = async () => {
      const apiBase = getResolvedApiBaseUrl();
      let sessionFound = false;
      let userFound = false;
      let tokenPresent = false;
      let profileFound = false;
      let role = 'UNKNOWN';
      let backendStatus: 'AUTHENTICATED' | '401' | '403' | 'UNREACHABLE' = '401';

      if (supabaseClient) {
        try {
          const { data: { session } } = await supabaseClient.auth.getSession();
          if (session) {
            sessionFound = true;
            tokenPresent = Boolean(session.access_token);
            if (session.user) {
              userFound = true;
              const { data: prof } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();
              if (prof) {
                profileFound = true;
                role = prof.role_code || 'OTHER';
              }
            }
          }
        } catch {}
      }

      try {
        const token = await getSupabaseAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const meRes = await fetch(apiUrl('/api/auth/me'), { headers });
        if (meRes.status === 200) {
          const meData = await meRes.json();
          if (meData.authenticated) {
            backendStatus = 'AUTHENTICATED';
            if (meData.roleCode) role = meData.roleCode;
            profileFound = true;
          } else {
            backendStatus = '401';
          }
        } else if (meRes.status === 403) {
          backendStatus = '403';
        } else if (meRes.status === 401) {
          backendStatus = '401';
        } else {
          backendStatus = 'UNREACHABLE';
        }
      } catch {
        backendStatus = 'UNREACHABLE';
      }

      if (isMounted) {
        setAuthDiagnostics({
          sessionFound,
          userFound,
          tokenPresent,
          profileFound,
          role: role === 'COORDINATOR' ? 'COORDINATOR' : role !== 'UNKNOWN' ? 'OTHER' : 'UNKNOWN',
          apiBase,
          backendStatus,
        });
      }
    };

    runDiagnostics();
    return () => {
      isMounted = false;
    };
  }, [authStatus]);

  const isCoordinatorAuthorized =
    authStatus === 'AUTHENTICATED' &&
    (currentUser?.authorizedWorkspaces?.includes('Coordinator') ||
      currentRole?.code === 'COORDINATOR' ||
      currentRole?.code === 'COLLEGE_ADMIN' ||
      currentRole?.code === 'SUPER_ADMIN' ||
      currentUser?.department?.includes('CSED'));

  // Real Database Counts
  const activeFacultyCount = facultyMembers.filter(f => f.status !== 'Inactive').length;
  const activeRoomsCount = rooms.filter(r => r.isAvailable).length;
  const activeSectionsCount = sections.filter(s => s.status !== 'Inactive').length;

  // Real Timetable State Determination
  const hardViolationsCount = validationReport.hardViolationsCount ?? validationReport.errorCount ?? 0;
  const hasDraft = sessions.length > 0;
  const isPublished = publishStatus === 'Published';

  // 4 Core Backend Readiness Checks
  const isDataComplete = allocations.length > 0 && activeSectionsCount > 0 && activeFacultyCount > 0 && activeRoomsCount > 0 && (validationReport.errorCount ?? 0) === 0;
  const noHardConflicts = hardViolationsCount === 0;
  const facultyConfigured = activeFacultyCount > 0;
  const roomsConfigured = activeRoomsCount > 0;

  const generationAllowed = isDataComplete && noHardConflicts && facultyConfigured && roomsConfigured && validationReport.isReadyForGeneration;
  const allChecksPassed = generationAllowed;
  const isValidated = hasDraft && noHardConflicts;

  // Real Timestamps
  const activeVersion = versions.find((version) => version.versionNumber === activeVersionNumber);
  const timestampStr = formatLocalizedTimestamp(isPublished
    ? academicYear.publishedAt || activeVersion?.createdAt
    : activeVersion?.createdAt);

  // Generation Handler
  const handleGenerate = async () => {
    if (isGenerating || (!generationAllowed && !isPublished)) return;
    setIsGenerating(true);
    setGenError(null);
    try {
      const res = await generateDualRoutinesAPI();
      if (res.success) {
        setActiveView('generation_validator');
      } else {
        setGenError(res.error || res.message || 'Failed to generate timetable.');
      }
    } catch (err: any) {
      setGenError(err.message || 'Generation request failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const recentRequests = notifications
    .filter((item) => ['cancellation', 'approval_needed', 'makeup_request'].includes(item.type))
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      type: item.title,
      section: sections.find((section) => section.id === item.actionPayload?.sectionId)?.name || 'Academic timetable',
      requestedBy: item.message,
      status: item.read ? 'Seen' : 'New',
      time: item.timestamp,
    }));

  // Workflow Stage Calculation
  let currentStage: 'DATA' | 'GENERATE' | 'REVIEW' | 'PUBLISH' = 'DATA';
  let stateLabel: 'DATA_INCOMPLETE' | 'READY_TO_GENERATE' | 'DRAFT_GENERATED' | 'VALIDATED' | 'PUBLISHED' = 'DATA_INCOMPLETE';

  if (isPublished) {
    currentStage = 'PUBLISH';
    stateLabel = 'PUBLISHED';
  } else if (hasDraft && isValidated) {
    currentStage = 'REVIEW';
    stateLabel = 'VALIDATED';
  } else if (hasDraft) {
    currentStage = 'REVIEW';
    stateLabel = 'DRAFT_GENERATED';
  } else if (generationAllowed) {
    currentStage = 'GENERATE';
    stateLabel = 'READY_TO_GENERATE';
  } else {
    currentStage = 'DATA';
    stateLabel = 'DATA_INCOMPLETE';
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 font-sans pb-12 text-stone-900 dark:text-zinc-100">
      {/* 1. Slim Workflow Indicator */}
      <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-3 flex flex-wrap items-center justify-between text-xs font-medium">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase text-stone-400 dark:text-zinc-500 font-semibold tracking-wider">Workflow:</span>
          <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-[#8C1B2E]/10 text-[#8C1B2E] dark:bg-red-950/40 dark:text-red-300 border border-[#8C1B2E]/20">
            {stateLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 font-mono text-[11px]">
          <span className={currentStage === 'DATA' ? 'text-[#8C1B2E] dark:text-red-400 font-bold' : isDataComplete ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-stone-400'}>
            DATA {isDataComplete ? '✓' : '●'}
          </span>
          <span className="text-stone-300 dark:text-zinc-700">→</span>
          <span className={currentStage === 'GENERATE' ? 'text-[#8C1B2E] dark:text-red-400 font-bold' : hasDraft ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-stone-400'}>
            GENERATE {hasDraft ? '✓' : currentStage === 'GENERATE' ? '●' : '○'}
          </span>
          <span className="text-stone-300 dark:text-zinc-700">→</span>
          <span className={currentStage === 'REVIEW' ? 'text-[#8C1B2E] dark:text-red-400 font-bold' : isPublished ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-stone-400'}>
            REVIEW {isPublished ? '✓' : currentStage === 'REVIEW' ? '●' : '○'}
          </span>
          <span className="text-stone-300 dark:text-zinc-700">→</span>
          <span className={currentStage === 'PUBLISH' ? 'text-[#8C1B2E] dark:text-red-400 font-bold' : 'text-stone-400'}>
            PUBLISH {isPublished ? '✓' : '○'}
          </span>
        </div>
      </div>

      {/* 2. Header */}
      <div className="border-b border-[#E5E2D9] dark:border-zinc-800 pb-2.5">
        <h1 className="text-2xl font-bold font-serif text-stone-900 dark:text-zinc-100 tracking-tight">
          Coordinator Portal
        </h1>
        <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
          Thapar Institute of Engineering & Technology — Academic Operations
        </p>
      </div>

      {/* 3. Compact Status Dashboard */}
      <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-4 space-y-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 block font-semibold">
              Current Status
            </span>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                isPublished
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
              }`}>
                {publishStatus.toUpperCase()}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                authStatus === 'AUTHENTICATED'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : authStatus === 'AUTH_LOADING'
                  ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
              }`}>
                {authStatus === 'AUTHENTICATED' ? 'AUTHENTICATED' : authStatus === 'AUTH_LOADING' ? 'AUTHENTICATING…' : 'UNAUTHENTICATED'}
              </span>
              <span className="text-xs font-semibold text-stone-700 dark:text-zinc-300 font-serif">
                {hasDraft ? (isValidated ? 'Draft Validated' : 'Draft Generated') : 'No Active Draft'}
              </span>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs text-stone-500">
            <div>{isPublished ? 'Last published:' : 'Last generated:'}</div>
            <div className="font-mono text-stone-800 dark:text-zinc-300 font-semibold">{timestampStr}</div>
          </div>
        </div>

        {/* Compact Summary Line */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
          <div>
            <span className="text-[10px] text-stone-400 block font-medium">Scheduled Sessions</span>
            <span className="font-mono font-bold text-stone-900 dark:text-zinc-100">{sessions.length} / 736</span>
          </div>

          <div>
            <span className="text-[10px] text-stone-400 block font-medium">Hard Conflicts</span>
            <span className={`font-mono font-bold ${hardViolationsCount === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700'}`}>
              {hardViolationsCount}
            </span>
          </div>

          <div className="col-span-2">
            <span className="text-[10px] text-stone-400 block font-medium">Academic Dataset</span>
            <span className="font-sans text-stone-800 dark:text-zinc-200 font-semibold">
              {sections.reduce((sum, s) => sum + (s.studentCount || 0), 0).toLocaleString()} students · {activeFacultyCount} faculty · {activeSectionsCount} sections · {allocations.length} allocations
            </span>
          </div>
        </div>
      </div>

      {/* 4. State-Driven Action & Readiness Section (Zero UI Contradictions) */}
      <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-4 space-y-3.5 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[#E5E2D9] dark:border-zinc-800 pb-2.5">
          <span className="font-bold font-serif text-stone-900 dark:text-zinc-100 uppercase tracking-wider text-[11px]">
            {isPublished
              ? 'PUBLISHED TIMETABLE ACTIVE'
              : hasDraft
              ? 'TIMETABLE DRAFT AVAILABLE'
              : generationAllowed
              ? 'READY TO GENERATE'
              : 'DATA INCOMPLETE'}
          </span>

          {allChecksPassed ? (
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> All Checks Passed
            </span>
          ) : (
            <span className="text-rose-700 dark:text-rose-400 font-semibold text-[11px] flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Action Required
            </span>
          )}
        </div>

        {/* 4 Backend Readiness Checklist Items */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs py-1">
          <div className="flex items-center gap-2">
            {isDataComplete ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className={isDataComplete ? 'text-stone-800 dark:text-zinc-200' : 'text-rose-700 dark:text-rose-400 font-medium'}>
              {isDataComplete ? `Data complete (${allocations.length} allocations, ${activeSectionsCount} sections)` : 'Data incomplete: missing allocations or active cohorts'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {noHardConflicts ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className={noHardConflicts ? 'text-stone-800 dark:text-zinc-200' : 'text-rose-700 dark:text-rose-400 font-medium'}>
              {noHardConflicts ? 'No hard conflicts' : `${hardViolationsCount} hard conflict(s) detected`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {facultyConfigured ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className={facultyConfigured ? 'text-stone-800 dark:text-zinc-200' : 'text-rose-700 dark:text-rose-400 font-medium'}>
              {facultyConfigured ? `Faculty availability configured (${activeFacultyCount} active faculty)` : 'Faculty availability unconfigured'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {roomsConfigured ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className={roomsConfigured ? 'text-stone-800 dark:text-zinc-200' : 'text-rose-700 dark:text-rose-400 font-medium'}>
              {roomsConfigured ? `Rooms & labs configured (${activeRoomsCount} spaces)` : 'Rooms & labs unconfigured'}
            </span>
          </div>
        </div>

        {/* Descriptive Text & Status Notice */}
        <div className="space-y-3 pt-2 border-t border-[#E5E2D9] dark:border-zinc-800 text-xs">
          {hasDraft ? (
            <p className="text-stone-600 dark:text-zinc-300">
              <strong className="text-stone-900 dark:text-zinc-100 font-semibold">{sessions.length} / 736</strong> sessions scheduled with <strong className="text-emerald-700 dark:text-emerald-400">{hardViolationsCount} hard conflicts</strong>. Ready for review or regeneration.
            </p>
          ) : generationAllowed ? (
            <p className="text-stone-600 dark:text-zinc-300">
              Academic data complete ({allocations.length} course allocations across {activeSectionsCount} sections). Ready to run the automated constraint solver.
            </p>
          ) : (
            <p className="text-rose-700 dark:text-rose-400">
              Academic dataset is missing required allocations or faculty setup before timetable generation can run.
            </p>
          )}

          {genError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{genError}</span>
            </div>
          )}

          {/* Action Buttons: Responsive full-width stacked on mobile, row on tablet/desktop */}
          <div className="flex flex-col gap-2.5 pt-1">
            {/* 1. AUTH_LOADING: Skeleton / Resolving state */}
            {authStatus === 'AUTH_LOADING' || isAuthLoading ? (
              <button
                disabled
                className="w-full sm:w-auto flex-1 py-3 px-5 bg-stone-200 dark:bg-zinc-800 text-stone-500 dark:text-zinc-400 font-bold text-xs rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
              >
                <div className="w-4 h-4 border-2 border-[#8C1B2E] border-t-transparent rounded-full animate-spin" />
                <span>Verifying authenticated HOD session with Supabase…</span>
              </button>
            ) : authStatus === 'UNAUTHENTICATED' ? (
              /* 2. UNAUTHENTICATED: Mutation actions disabled, sign-in prompt */
              <div className="w-full space-y-2">
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0" />
                    <span>HOD timetable actions unavailable. Sign in with HOD credentials to generate or edit timetables.</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    disabled
                    className="w-full sm:w-auto flex-1 py-3 px-5 bg-stone-200 dark:bg-zinc-800 text-stone-400 dark:text-zinc-500 font-bold text-xs rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    <span>Generate Timetable (Sign In Required)</span>
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      window.history.replaceState(null, '', '/');
                      window.location.reload();
                    }}
                    className="w-full sm:w-auto px-5 py-3 bg-[#8C1B2E] hover:bg-[#721525] text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <span>Sign In as HOD</span>
                  </button>
                </div>
              </div>
            ) : !isCoordinatorAuthorized ? (
              /* 3. AUTHENTICATED but NOT authorized as Coordinator: Access Denied */
              <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2.5">
                <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
                <div>
                  <div className="font-bold text-rose-900 dark:text-rose-100">Access Denied (403 Forbidden)</div>
                  <div className="mt-0.5 text-stone-600 dark:text-zinc-300">
                    Your authenticated account ({currentUser?.email || 'authenticated user'}) does not have HOD Timetable Management privileges.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2.5">
                {/* Primary Action: Generate / Regenerate Timetable */}
                {isPublished ? (
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !isCoordinatorAuthorized}
                    className="w-full sm:w-auto flex-1 py-3 px-5 bg-[#8C1B2E] hover:bg-[#721525] active:bg-[#5a111e] disabled:bg-stone-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Generating timetable…</span>
                      </>
                    ) : (
                      <>
                        <span>Generate New Draft</span>
                      </>
                    )}
                  </button>
                ) : generationAllowed ? (
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !isCoordinatorAuthorized}
                    className="w-full sm:w-auto flex-1 py-3 px-5 bg-[#8C1B2E] hover:bg-[#721525] active:bg-[#5a111e] disabled:bg-stone-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Generating timetable…</span>
                      </>
                    ) : (
                      <>
                        <span>Generate Timetable</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full sm:w-auto flex-1 py-3 px-5 bg-stone-200 dark:bg-zinc-800 text-stone-400 dark:text-zinc-500 font-bold text-xs rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Sparkles className="h-4 w-4 text-stone-400" />
                    <span>Generate Timetable (Data Incomplete)</span>
                  </button>
                )}

                {/* Secondary Action: Review timetable (shown whenever draft exists or published) */}
                {(hasDraft || isPublished) && (
                  <button
                    onClick={() => setActiveView('grid')}
                    className="w-full sm:w-auto flex-1 py-3 px-5 bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 hover:border-stone-400 active:bg-stone-50 dark:active:bg-zinc-900 text-stone-800 dark:text-zinc-200 font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Review timetable →</span>
                  </button>
                )}

                {/* If data incomplete and no draft exists, direct to setup */}
                {!generationAllowed && !hasDraft && (
                  <button
                    onClick={() => setActiveView('academic_setup')}
                    className="w-full sm:w-auto flex-1 py-3 px-5 bg-[#8C1B2E] hover:bg-[#721525] text-white font-bold text-xs rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Complete data setup →</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Recent Requests (3 items max) */}
      <PollComposer />
      <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-4 space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[#E5E2D9] dark:border-zinc-800 pb-2">
          <span className="font-serif font-bold text-xs text-stone-900 dark:text-zinc-100 uppercase tracking-wider">
            Recent requests
          </span>
          <button
            onClick={() => setActiveView('recovery')}
            className="text-xs text-[#8C1B2E] dark:text-red-400 font-semibold hover:underline"
          >
            View all requests
          </button>
        </div>

        <div className="divide-y divide-[#E5E2D9] dark:divide-zinc-800 text-xs">
          {recentRequests.length === 0 && <div className="py-3 text-stone-500">No recent requests or disruptions.</div>}
          {recentRequests.map(req => (
            <div key={req.id} className="py-2 first:pt-0 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-stone-900 dark:text-zinc-100">
                  {req.type} — {req.section}
                </div>
                <div className="text-[11px] text-stone-500">
                  Requested by: {req.requestedBy}
                </div>
              </div>

              <div className="text-right">
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  req.status === 'Approved'
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                }`}>
                  {req.status}
                </span>
                <time className="text-[10px] text-stone-500 dark:text-zinc-400 mt-0.5 block">{formatLocalizedTimestamp(req.time)}</time>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Temporary Auth Diagnostics Panel (Development & Preview Only - Section 12) */}
      {isDevOrPreview && (
        <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-lg p-3 space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between border-b border-[#E5E2D9] dark:border-zinc-800 pb-1.5">
            <span className="font-bold text-[11px] text-stone-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#8C1B2E] dark:text-red-400" />
              AUTH DIAGNOSTICS
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 font-semibold">
              Environment: {environmentLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
            <div>
              <span className="text-stone-400 block text-[10px]">Session:</span>
              <span className={authDiagnostics.sessionFound ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-rose-700 dark:text-rose-400 font-bold'}>
                {authDiagnostics.sessionFound ? 'FOUND' : 'NOT FOUND'}
              </span>
            </div>

            <div>
              <span className="text-stone-400 block text-[10px]">Supabase User:</span>
              <span className={authDiagnostics.userFound ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-rose-700 dark:text-rose-400 font-bold'}>
                {authDiagnostics.userFound ? 'FOUND' : 'NOT FOUND'}
              </span>
            </div>

            <div>
              <span className="text-stone-400 block text-[10px]">Access Token:</span>
              <span className={authDiagnostics.tokenPresent ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-rose-700 dark:text-rose-400 font-bold'}>
                {authDiagnostics.tokenPresent ? 'PRESENT' : 'MISSING'}
              </span>
            </div>

            <div>
              <span className="text-stone-400 block text-[10px]">Profile:</span>
              <span className={authDiagnostics.profileFound ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-rose-700 dark:text-rose-400 font-bold'}>
                {authDiagnostics.profileFound ? 'FOUND' : 'NOT FOUND'}
              </span>
            </div>

            <div>
              <span className="text-stone-400 block text-[10px]">Role:</span>
              <span className="font-bold text-stone-800 dark:text-zinc-200">
                {authDiagnostics.role}
              </span>
            </div>

            <div className="col-span-2">
              <span className="text-stone-400 block text-[10px]">API:</span>
              <span className="text-stone-700 dark:text-zinc-300 truncate block text-[10px]" title={authDiagnostics.apiBase}>
                {authDiagnostics.apiBase || '(relative / same origin)'}
              </span>
            </div>

            <div>
              <span className="text-stone-400 block text-[10px]">Backend:</span>
              <span className={`font-bold ${
                authDiagnostics.backendStatus === 'AUTHENTICATED'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : authDiagnostics.backendStatus === '403'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}>
                {authDiagnostics.backendStatus}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
