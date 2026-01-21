const { Worker } = require("bullmq");
const Job = require("../models/jobs");
const ImportLog = require("../models/importLog");
const connection = require("../config/redis");

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY) || 10;

//Normalize different value types from XML parsing
function normalizeValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value._) return String(value._).trim();
  if (typeof value === "object" && value.$t) return String(value.$t).trim();
  return String(value).trim();
}

//Extract external job ID from various possible fields
function getExternalJobId(rawJob) {
  const possibleIds = [
    normalizeValue(rawJob.guid),
    normalizeValue(rawJob.id),
    normalizeValue(rawJob.link),
    normalizeValue(rawJob.url)
  ];

  return possibleIds.find(id => id && id.length > 0) || null;
}

//Extract and normalize job data from raw XML object
function extractJobData(rawJob, sourceUrl) {
  return {
    source: sourceUrl,
    externalJobId: getExternalJobId(rawJob),
    title: normalizeValue(rawJob.title),
    company: 
      normalizeValue(rawJob["job:company"]) ||
      normalizeValue(rawJob.company) ||
      normalizeValue(rawJob["dc:creator"]) ||
      "",
    location:
      normalizeValue(rawJob["job:location"]) ||
      normalizeValue(rawJob.location) ||
      normalizeValue(rawJob["geo:location"]) ||
      "",
    description: 
      normalizeValue(rawJob.description) ||
      normalizeValue(rawJob.summary) ||
      normalizeValue(rawJob.content) ||
      "",
    url: 
      normalizeValue(rawJob.link) ||
      normalizeValue(rawJob.url) ||
      "",
    category:
      normalizeValue(rawJob.category) ||
      normalizeValue(rawJob["job:category"]) ||
      "",
    jobType:
      normalizeValue(rawJob["job:type"]) ||
      normalizeValue(rawJob.type) ||
      "",
    region:
      normalizeValue(rawJob["job:region"]) ||
      normalizeValue(rawJob.region) ||
      "",
    postedDate: rawJob.pubDate ? new Date(rawJob.pubDate) : null,
    rawPayload: rawJob
  };
}

//Worker to process job import queue
const worker = new Worker(
  "job-import-queue",
  async (queueJob) => {
    const { job: rawJob, importLogId, sourceUrl } = queueJob.data;

    const jobData = extractJobData(rawJob, sourceUrl);

    if (!jobData.externalJobId) {
      throw new Error("Missing externalJobId - cannot identify job uniquely");
    }

    if (!jobData.title) {
      throw new Error("Missing job title - invalid job data");
    }

    try {
      const existingJob = await Job.findOne({
        source: sourceUrl,
        externalJobId: jobData.externalJobId
      }).lean();

      await Job.findOneAndUpdate(
        { 
          source: sourceUrl, 
          externalJobId: jobData.externalJobId 
        },
        {
          $set: jobData,
          $setOnInsert: { importedAt: new Date() }
        },
        { 
          upsert: true, 
          new: true,
          runValidators: true
        }
      );

      const updateFields = {
        $inc: {
          totalImported: 1
        }
      };

      if (existingJob) {
        updateFields.$inc.updatedJobs = 1;
      } else {
        updateFields.$inc.newJobs = 1;
      }

      await ImportLog.findByIdAndUpdate(importLogId, updateFields);

      return { 
        success: true, 
        externalJobId: jobData.externalJobId,
        isNew: !existingJob 
      };

    } catch (err) {
      console.error(`Failed to import job ${jobData.externalJobId}:`, err.message);

      await ImportLog.findByIdAndUpdate(importLogId, {
        $inc: {
          failedJobsCount: 1
        },
        $push: {
          failedJobs: {
            externalJobId: String(jobData.externalJobId),
            reason: err.message,
            timestamp: new Date()
          }
        }
      });

      throw err;
    }
  },
  {
    connection,
    concurrency: CONCURRENCY,
    limiter: {
      max: 100,
      duration: 1000
    }
  }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed: ${err.message}`);
});

worker.on("error", (err) => {
  console.error("Worker error:", err);
});

// shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing worker...");
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing worker...");
  await worker.close();
  process.exit(0);
});

module.exports = worker;