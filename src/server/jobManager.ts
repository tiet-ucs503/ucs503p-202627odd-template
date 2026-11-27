import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';
import type { EngineResult } from '../lib/optimizationEngine';
import { AcademicYearConfig, CourseAllocation, Faculty, Room, StudentSection, Course, AcademicConstraint } from '../types';

export interface TimetableJobRequest {
  jobId: string;
  academicYear: AcademicYearConfig;
  allocations: CourseAllocation[];
  facultyMembers: Faculty[];
  rooms: Room[];
  sections: StudentSection[];
  courses: Course[];
  constraints: AcademicConstraint[];
  options: {
    budgetMode?: 'FAST' | 'BALANCED' | 'MAXIMUM_OPTIMIZATION';
    optimizationProfile?: 'STUDENT_FOCUSED' | 'FACULTY_FOCUSED' | 'BALANCED';
    timeBudgetMs?: number;
    seed?: number;
    maxCandidates?: number;
  };
}

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface TimetableJobState {
  jobId: string;
  status: JobStatus;
  progress: number; // 0 - 100%
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: EngineResult;
  error?: string;
  worker?: Worker;
}

const MAX_STORED_JOBS = 50;
const JOB_TTL_MS = 30 * 60 * 1000;

class TimetableJobManager {
  private jobs = new Map<string, TimetableJobState>();

  private pruneOldJobs(): void {
    const cutoff = Date.now() - JOB_TTL_MS;
    for (const [id, job] of this.jobs.entries()) {
      const isTerminal = job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED';
      if (isTerminal && job.completedAt && Date.parse(job.completedAt) < cutoff) {
        this.jobs.delete(id);
      }
    }
    while (this.jobs.size >= MAX_STORED_JOBS) {
      const oldestTerminal = [...this.jobs.entries()].find(
        ([, job]) => job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED'
      );
      if (!oldestTerminal) break;
      this.jobs.delete(oldestTerminal[0]);
    }
  }

  public createJob(
    academicYear: AcademicYearConfig,
    allocations: CourseAllocation[],
    facultyMembers: Faculty[],
    rooms: Room[],
    sections: StudentSection[],
    courses: Course[],
    constraints: AcademicConstraint[],
    options: any = {}
  ): string {
    this.pruneOldJobs();
    const jobId = `job_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const jobState: TimetableJobState = {
      jobId,
      status: 'PENDING',
      progress: 0,
      createdAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, jobState);

    setImmediate(() => {
      const job = this.jobs.get(jobId);
      if (!job || job.status === 'CANCELLED') return;
      job.status = 'RUNNING';
      job.startedAt = new Date().toISOString();
      job.progress = 10;
      const worker = new Worker(new URL('./solverWorker.ts', import.meta.url), {
        workerData: { jobId, academicYear, allocations, facultyMembers, rooms, sections, courses, constraints, options },
        execArgv: process.execArgv.filter((arg) => !arg.startsWith('--input-type')),
      });
      job.worker = worker;
      worker.on('message', (message: { result?: EngineResult; error?: string }) => {
        const active = this.jobs.get(jobId);
        if (!active || active.status === 'CANCELLED') return;
        if (message.error || !message.result) {
          active.status = 'FAILED';
          active.error = message.error || 'Solver worker returned no result.';
        } else {
          active.status = 'COMPLETED';
          active.progress = 100;
          active.result = message.result;
        }
        active.completedAt = new Date().toISOString();
        active.worker = undefined;
        void worker.terminate();
      });
      worker.on('error', (error) => {
        const active = this.jobs.get(jobId);
        if (!active || active.status === 'CANCELLED') return;
        active.status = 'FAILED';
        active.error = error.message;
        active.completedAt = new Date().toISOString();
        active.worker = undefined;
        void worker.terminate();
      });
      worker.on('exit', (code) => {
        const active = this.jobs.get(jobId);
        if (active && active.status === 'RUNNING' && code !== 0) {
          active.status = 'FAILED';
          active.error = `Solver worker exited unexpectedly (${code}).`;
          active.completedAt = new Date().toISOString();
          active.worker = undefined;
        }
      });
    });

    return jobId;
  }

  public getJob(jobId: string): TimetableJobState | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    const { worker, ...safeState } = job;
    return safeState as TimetableJobState;
  }

  public cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') return false;

    job.status = 'CANCELLED';
    job.completedAt = new Date().toISOString();
    if (job.worker) {
      const w = job.worker;
      job.worker = undefined;
      w.terminate().catch(() => {});
    }
    return true;
  }
}

export const timetableJobManager = new TimetableJobManager();
