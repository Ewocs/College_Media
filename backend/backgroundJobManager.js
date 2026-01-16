/**
 * backgroundJobManager.js
 * -----------------------
 * Protects system from runaway background jobs by enforcing
 * timeouts, retry limits, backoff, monitoring, and dead-letter queues.
 *
 * Tech: Node.js
 */

const { EventEmitter } = require("events");

/* -----------------------------
   CONFIGURATION
--------------------------------*/

const JOB_TIMEOUT_MS = 5000; // max execution time
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;
const MONITOR_INTERVAL_MS = 2000;

/* -----------------------------
   JOB STATES
--------------------------------*/

const JobState = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  DEAD: "DEAD"
};

/* -----------------------------
   JOB CLASS
--------------------------------*/

class Job {
  constructor(id, handler) {
    this.id = id;
    this.handler = handler;
    this.state = JobState.PENDING;
    this.retries = 0;
    this.startTime = null;
    this.timeoutRef = null;
  }
}

/* -----------------------------
   DEAD LETTER QUEUE
--------------------------------*/

const deadLetterQueue = [];

/* -----------------------------
   JOB MANAGER
--------------------------------*/

class JobManager extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map();
  }

  addJob(id, handler) {
    const job = new Job(id, handler);
    this.jobs.set(id, job);
    this.runJob(job);
  }

  async runJob(job) {
    job.state = JobState.RUNNING;
    job.startTime = Date.now();

    console.log(`▶️ Job started: ${job.id}`);

    job.timeoutRef = setTimeout(() => {
      this.failJob(job, "Execution timeout");
    }, JOB_TIMEOUT_MS);

    try {
      await job.handler();
      this.completeJob(job);
    } catch (err) {
      this.failJob(job, err.message);
    }
  }

  completeJob(job) {
    clearTimeout(job.timeoutRef);
    job.state = JobState.SUCCESS;

    console.log(`✅ Job completed: ${job.id}`);
    this.jobs.delete(job.id);
  }

  failJob(job, reason) {
    clearTimeout(job.timeoutRef);
    job.retries += 1;

    console.error(`❌ Job failed: ${job.id} | Reason: ${reason}`);

    if (job.retries > MAX_RETRIES) {
      this.killJob(job);
    } else {
      const backoff =
        BASE_BACKOFF_MS * Math.pow(2, job.retries - 1);

      console.log(
        `🔁 Retrying job ${job.id} in ${backoff}ms`
      );

      setTimeout(() => this.runJob(job), backoff);
    }
  }

  killJob(job) {
    job.state = JobState.DEAD;

    console.error(`☠️ Job moved to Dead Letter Queue: ${job.id}`);

    deadLetterQueue.push({
      id: job.id,
      retries: job.retries,
      failedAt: new Date().toISOString()
    });

    this.jobs.delete(job.id);
  }

  monitorJobs() {
    for (const job of this.jobs.values()) {
      if (job.state === JobState.RUNNING) {
        const runtime = Date.now() - job.startTime;

        if (runtime > JOB_TIMEOUT_MS) {
          this.failJob(job, "Detected runaway job");
        }
      }
    }
  }
}

/* -----------------------------
   INSTANCE
--------------------------------*/

const jobManager = new JobManager();

/* -----------------------------
   MONITORING LOOP
--------------------------------*/

setInterval(() => {
  jobManager.monitorJobs();
}, MONITOR_INTERVAL_MS);

/* -----------------------------
   SAMPLE JOBS
--------------------------------*/

// Normal job
jobManager.addJob("job-fast", async () => {
  await new Promise((r) => setTimeout(r, 1000));
});

// Runaway job (never resolves)
jobManager.addJob("job-runaway", async () => {
  while (true) {}
});

// Failing job
jobManager.addJob("job-failing", async () => {
  throw new Error("Simulated failure");
});

/* -----------------------------
   EXPORTS
--------------------------------*/

module.exports = {
  jobManager,
  deadLetterQueue,
  JobState
};

/* -----------------------------
   END OF FILE
--------------------------------*/
