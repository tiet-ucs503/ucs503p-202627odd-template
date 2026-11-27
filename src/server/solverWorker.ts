import { parentPort, workerData } from 'node:worker_threads';
import { executeOptimizationEngine } from '../lib/optimizationEngine';
import type { TimetableJobRequest } from './jobManager';

const port = parentPort;
if (!port) throw new Error('Solver worker must run inside a worker thread.');

try {
  const request = workerData as TimetableJobRequest;
  const result = executeOptimizationEngine(
    request.academicYear,
    request.allocations,
    request.facultyMembers,
    request.rooms,
    request.sections,
    request.courses,
    request.constraints,
    request.options,
  );
  port.postMessage({ result });
} catch (error) {
  port.postMessage({ error: error instanceof Error ? error.message : 'Unknown error in timetable solver.' });
}
