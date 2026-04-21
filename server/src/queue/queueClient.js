/**
 * queueClient.js — BullMQ producer/consumer with an in-process
 * fallback runner so every caller keeps working even when Redis
 * or the `bullmq` package isn't available yet.
 *
 * Three queues (spec §§1-2, 7):
 *   • QUEUES.RISK_SCORING       — per-farm risk model computation
 *   • QUEUES.AUTONOMOUS_ACTIONS — dispatch loop for decisions
 *   • QUEUES.NOTIFICATIONS      — batched SMS/email fanout
 *
 *   enqueue(queueName, payload, opts?)  → { queued: boolean, id }
 *   registerProcessor(queueName, fn)    — worker-side handler
 *   getQueueInfo()                      → diagnostic snapshot
 *
 * Fallback contract:
 *   • REDIS_URL unset OR bullmq import fails → jobs run inline
 *     via the registered processor (awaited). API callers still
 *     get { queued: true } with a local id so call-sites don't
 *     branch on infrastructure state.
 *   • No processor registered → job goes to the in-memory deferred
 *     list; the next registerProcessor(...) drains it.
 *   • Every dispatch path logs via opsEvent so operators can tell
 *     which mode was used.
 *
 * Never throws — callers just get { queued: false, error } on
 * hard failure.
 */

import { opsEvent } from '../utils/opsLogger.js';

export const QUEUES = Object.freeze({
  RISK_SCORING:       'risk_scoring',
  AUTONOMOUS_ACTIONS: 'autonomous_actions',
  NOTIFICATIONS:      'notifications',
});

const VALID_QUEUES = new Set(Object.values(QUEUES));

// ─── Dynamic bullmq loader ───────────────────────────────────────
let bullModule = null;
let bullLoadFailed = false;
let connectionHandle = null;
const queueHandles = new Map();
const workerHandles = new Map();

// Memory-mode registry + deferred queues for when no processor is
// registered yet.
const processors = new Map();
const deferredJobs = new Map();

function nextLocalId() {
  return `job_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

async function getBullmq() {
  if (bullLoadFailed) return null;
  if (bullModule) return bullModule;
  try {
    bullModule = await import('bullmq');
    return bullModule;
  } catch {
    bullLoadFailed = true;
    return null;
  }
}

async function getConnection() {
  if (!process.env.REDIS_URL) return null;
  if (connectionHandle) return connectionHandle;
  const bull = await getBullmq();
  if (!bull) return null;
  try {
    // BullMQ accepts either an ioredis instance or an options object.
    // Passing the URL as `url` is simplest and avoids a direct
    // ioredis dependency here.
    connectionHandle = { url: process.env.REDIS_URL, maxRetriesPerRequest: null };
    return connectionHandle;
  } catch {
    return null;
  }
}

async function getQueueHandle(name) {
  if (!VALID_QUEUES.has(name)) return null;
  if (queueHandles.has(name)) return queueHandles.get(name);
  const bull = await getBullmq();
  const conn = await getConnection();
  if (!bull || !conn) return null;
  try {
    const Q = bull.Queue;
    const queue = new Q(name, { connection: conn });
    queueHandles.set(name, queue);
    return queue;
  } catch (err) {
    opsEvent('queue', 'queue_init_failed', 'error', {
      queue: name, error: err && err.message,
    });
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * enqueue — put a job on the named queue. Falls back to inline
 * execution when Redis/BullMQ are unavailable.
 */
export async function enqueue(queueName, payload, {
  jobId = null,
  attempts = 3,
  backoffMs = 5_000,
  delayMs = 0,
  priority = 0,
} = {}) {
  if (!VALID_QUEUES.has(queueName)) {
    return { queued: false, error: 'unknown_queue', id: null };
  }
  if (!payload || typeof payload !== 'object') {
    return { queued: false, error: 'invalid_payload', id: null };
  }

  const queue = await getQueueHandle(queueName);
  if (queue) {
    try {
      const job = await queue.add(queueName, payload, {
        jobId: jobId || undefined,
        attempts,
        backoff: { type: 'exponential', delay: backoffMs },
        delay: delayMs,
        priority,
        removeOnComplete: 1000,
        removeOnFail: 500,
      });
      return { queued: true, mode: 'redis', id: String(job.id) };
    } catch (err) {
      opsEvent('queue', 'enqueue_failed_downgrade', 'warn', {
        queue: queueName, error: err && err.message,
      });
      // fall through to memory mode
    }
  }

  const id = jobId || nextLocalId();
  const processor = processors.get(queueName);
  if (processor) {
    // Run inline — same await contract as BullMQ Worker.process.
    try {
      await processor({ id, name: queueName, data: payload });
      opsEvent('queue', 'processed_inline', 'info', { queue: queueName, id });
      return { queued: true, mode: 'inline', id };
    } catch (err) {
      opsEvent('queue', 'inline_processor_failed', 'error', {
        queue: queueName, id, error: err && err.message,
      });
      return { queued: false, error: 'processor_threw', id };
    }
  }

  // No processor yet — defer so the next `registerProcessor` drains.
  const list = deferredJobs.get(queueName) || [];
  list.push({ id, data: payload });
  deferredJobs.set(queueName, list);
  opsEvent('queue', 'deferred_no_processor', 'info', {
    queue: queueName, id, backlog: list.length,
  });
  return { queued: true, mode: 'deferred', id };
}

/**
 * registerProcessor — worker-side entry point. When BullMQ is
 * available, spins up a real Worker; otherwise stashes the handler
 * for inline + deferred runs.
 */
export async function registerProcessor(queueName, handler) {
  if (!VALID_QUEUES.has(queueName) || typeof handler !== 'function') {
    return { registered: false, mode: null };
  }
  processors.set(queueName, handler);

  const bull = await getBullmq();
  const conn = await getConnection();
  if (bull && conn) {
    try {
      if (workerHandles.has(queueName)) {
        try { await workerHandles.get(queueName).close(); } catch {}
      }
      const Worker = bull.Worker;
      const worker = new Worker(queueName, async (job) => handler({
        id:   String(job.id),
        name: job.name,
        data: job.data,
      }), { connection: conn });
      workerHandles.set(queueName, worker);
      opsEvent('queue', 'worker_ready', 'info', { queue: queueName, mode: 'redis' });
    } catch (err) {
      opsEvent('queue', 'worker_init_failed_inline', 'warn', {
        queue: queueName, error: err && err.message,
      });
    }
  } else {
    opsEvent('queue', 'worker_ready', 'info', { queue: queueName, mode: 'inline' });
  }

  // Drain any deferred jobs that landed before the processor was
  // registered. Intentionally sequential so a slow handler can't
  // flood the event loop.
  const pending = deferredJobs.get(queueName) || [];
  if (pending.length > 0) {
    deferredJobs.set(queueName, []);
    for (const job of pending) {
      try {
        await handler({ id: job.id, name: queueName, data: job.data });
      } catch (err) {
        opsEvent('queue', 'deferred_drain_failed', 'error', {
          queue: queueName, id: job.id, error: err && err.message,
        });
      }
    }
  }
  return { registered: true, mode: workerHandles.has(queueName) ? 'redis' : 'inline' };
}

export async function getQueueInfo() {
  const redisAvailable = !!process.env.REDIS_URL;
  const info = {
    redisConfigured: redisAvailable,
    bullmqLoaded:    !!bullModule,
    queues: {},
  };
  for (const name of VALID_QUEUES) {
    const queue = queueHandles.get(name);
    let counts = null;
    if (queue && typeof queue.getJobCounts === 'function') {
      try { counts = await queue.getJobCounts(); } catch { counts = null; }
    }
    info.queues[name] = {
      processorRegistered: processors.has(name),
      workerMode: workerHandles.has(name) ? 'redis' : 'inline',
      deferredBacklog: (deferredJobs.get(name) || []).length,
      counts,
    };
  }
  return info;
}

/**
 * closeAll — graceful shutdown helper for tests + the server
 * process's SIGTERM path.
 */
export async function closeAll() {
  for (const worker of workerHandles.values()) {
    try { await worker.close(); } catch {}
  }
  workerHandles.clear();
  for (const queue of queueHandles.values()) {
    try { await queue.close(); } catch {}
  }
  queueHandles.clear();
  processors.clear();
  deferredJobs.clear();
}

export const _internal = Object.freeze({
  VALID_QUEUES, processors, deferredJobs, queueHandles, workerHandles,
  resetAll: () => {
    processors.clear();
    deferredJobs.clear();
    queueHandles.clear();
    workerHandles.clear();
    connectionHandle = null;
    bullModule = null;
    bullLoadFailed = false;
  },
});
