/**
 * Lightweight PostgreSQL-backed background job queue.
 *
 * Uses the v2_jobs table (created by 001_add_postgis.sql).
 * No external broker dependency — just Prisma raw queries.
 *
 * Usage:
 *   enqueue('satellite_ingest', { profileId, scanId });
 *   startWorker('satellite_ingest', async (payload) => { ... });
 */

// @ts-ignore — JS module
import prisma from '../lib/prisma.js';

export interface JobRecord {
  id: string;
  queue: string;
  payload: any;
  status: string;
  attempts: number;
  max_attempts: number;
}

// ── Enqueue ──

/**
 * Add a job to the queue for background processing.
 *
 * @param queue - Queue name (e.g. 'satellite_ingest', 'score_farm', 'send_alert')
 * @param payload - Arbitrary JSON payload
 * @param options - Optional delay and retry config
 */
export async function enqueue(
  queue: string,
  payload: Record<string, any>,
  options?: { delaySeconds?: number; maxAttempts?: number },
): Promise<string | null> {
  const delay = options?.delaySeconds ?? 0;
  const maxAttempts = options?.maxAttempts ?? 3;
  const runAfter = new Date(Date.now() + delay * 1000);

  try {
    const rows: any[] = await (prisma as any).$queryRaw`
      INSERT INTO v2_jobs (queue, payload, max_attempts, run_after)
      VALUES (${queue}, ${JSON.stringify(payload)}::jsonb, ${maxAttempts}, ${runAfter})
      RETURNING id
    `;
    return rows[0].id;
  } catch (err: any) {
    // v2_jobs table may not exist if PostGIS migration hasn't run
    console.warn(`[jobs] enqueue failed (table may not exist): ${err.message}`);
    return null;
  }
}

// ── Dequeue (atomic claim) ──

/**
 * Atomically claim the next available job from a queue.
 * Uses SELECT ... FOR UPDATE SKIP LOCKED to prevent double-processing.
 */
async function dequeue(queue: string): Promise<JobRecord | null> {
  try {
    const rows: any[] = await (prisma as any).$queryRaw`
      UPDATE v2_jobs
      SET status = 'running', started_at = now(), attempts = attempts + 1
      WHERE id = (
        SELECT id FROM v2_jobs
        WHERE queue = ${queue}
          AND status = 'pending'
          AND run_after <= now()
          AND attempts < max_attempts
        ORDER BY run_after ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, queue, payload, status, attempts, max_attempts
    `;
    return rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}

/**
 * Mark a job as completed.
 */
async function complete(jobId: string): Promise<void> {
  await (prisma as any).$queryRaw`
    UPDATE v2_jobs SET status = 'completed', completed_at = now()
    WHERE id = ${jobId}::uuid
  `;
}

/**
 * Mark a job as failed. If attempts < max_attempts, reset to pending for retry.
 */
async function fail(jobId: string, error: string, attempts: number, maxAttempts: number): Promise<void> {
  if (attempts < maxAttempts) {
    // Exponential backoff: 30s, 90s, 270s...
    const backoffSeconds = 30 * Math.pow(3, attempts - 1);
    const runAfter = new Date(Date.now() + backoffSeconds * 1000);
    await (prisma as any).$queryRaw`
      UPDATE v2_jobs SET status = 'pending', error = ${error}, run_after = ${runAfter}
      WHERE id = ${jobId}::uuid
    `;
  } else {
    await (prisma as any).$queryRaw`
      UPDATE v2_jobs SET status = 'failed', error = ${error}, completed_at = now()
      WHERE id = ${jobId}::uuid
    `;
  }
}

// ── Worker loop ──

type JobHandler = (payload: any) => Promise<void>;

const _workers: Map<string, NodeJS.Timeout> = new Map();

/**
 * Start a polling worker for a queue.
 * Polls every `intervalMs` (default 5s). Only one worker per queue.
 */
export function startWorker(
  queue: string,
  handler: JobHandler,
  intervalMs: number = 5000,
): void {
  if (_workers.has(queue)) {
    console.warn(`[jobs] Worker for '${queue}' already running`);
    return;
  }

  console.log(`[jobs] Starting worker for '${queue}' (poll: ${intervalMs}ms)`);

  const poll = async () => {
    try {
      const job = await dequeue(queue);
      if (!job) return;

      try {
        await handler(job.payload);
        await complete(job.id);
      } catch (err: any) {
        console.error(`[jobs] Job ${job.id} failed:`, err.message);
        await fail(job.id, err.message, job.attempts, job.max_attempts);
      }
    } catch (err: any) {
      console.error(`[jobs] Worker poll error on '${queue}':`, err.message);
    }
  };

  const timer = setInterval(poll, intervalMs);
  _workers.set(queue, timer);
}

/**
 * Stop a worker for a queue.
 */
export function stopWorker(queue: string): void {
  const timer = _workers.get(queue);
  if (timer) {
    clearInterval(timer);
    _workers.delete(queue);
    console.log(`[jobs] Stopped worker for '${queue}'`);
  }
}

/**
 * Stop all workers. Call during graceful shutdown.
 */
export function stopAllWorkers(): void {
  for (const [queue, timer] of _workers) {
    clearInterval(timer);
    console.log(`[jobs] Stopped worker for '${queue}'`);
  }
  _workers.clear();
}

/**
 * Clean up completed/failed jobs older than `days`.
 */
export async function pruneJobs(days: number = 7): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  try {
    const result: any[] = await (prisma as any).$queryRaw`
      DELETE FROM v2_jobs
      WHERE status IN ('completed', 'failed') AND created_at < ${cutoff}
      RETURNING id
    `;
    return result.length;
  } catch {
    console.warn('[jobs] pruneJobs failed (table may not exist)');
    return 0;
  }
}
