const express = require("express");
const router = express.Router();
const ImportLog = require("../models/importLog");
const Job = require("../models/jobs");
const fetchJobs = require("../cron/fetchJobs");
const jobQueue = require("../queue/job.queue");

/**
 * GET /api/import-logs
 * Fetch import history with pagination and filtering
 */
router.get("/import-logs", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.sourceUrl) {
      filter.sourceUrl = req.query.sourceUrl;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const total = await ImportLog.countDocuments(filter);

    const logs = await ImportLog.find(filter)
      .sort({ startedAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching import logs:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch import logs",
      error: error.message
    });
  }
});

/**
 * GET /api/import-logs/:id
 * Get details of a specific import log
 */
router.get("/import-logs/:id", async (req, res) => {
  try {
    const log = await ImportLog.findById(req.params.id).lean();

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Import log not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: log
    });
  } catch (error) {
    console.error("Error fetching import log:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch import log",
      error: error.message
    });
  }
});

/**
 * POST /api/trigger-import
 * Manually trigger a job import
 */
router.post("/trigger-import", async (req, res) => {
  try {
    // Run the import process
    fetchJobs().catch(err => {
      console.error("Manual import error:", err);
    });

    return res.status(200).json({
      success: true,
      message: "Import process triggered successfully"
    });
  } catch (error) {
    console.error("Error triggering import:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to trigger import",
      error: error.message
    });
  }
});

/**
 * GET /api/stats
 */
router.get("/stats", async (req, res) => {
  try {
    const totalJobs = await Job.countDocuments();
    const totalImports = await ImportLog.countDocuments();
    
    const recentImport = await ImportLog.findOne()
      .sort({ startedAt: -1 })
      .lean();

    const stats = await ImportLog.aggregate([
      {
        $group: {
          _id: null,
          totalFetched: { $sum: "$totalFetched" },
          totalImported: { $sum: "$totalImported" },
          totalNew: { $sum: "$newJobs" },
          totalUpdated: { $sum: "$updatedJobs" },
          totalFailed: { $sum: "$failedJobsCount" }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalJobs,
        totalImports,
        lastImportAt: recentImport?.startedAt || null,
        aggregates: stats[0] || {
          totalFetched: 0,
          totalImported: 0,
          totalNew: 0,
          totalUpdated: 0,
          totalFailed: 0
        }
      }
    });
  } catch (error) {
    console.error("Error fetching stats:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message
    });
  }
});

/**
 * GET /api/queue-status
 */
router.get("/queue-status", async (req, res) => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      jobQueue.getWaitingCount(),
      jobQueue.getActiveCount(),
      jobQueue.getCompletedCount(),
      jobQueue.getFailedCount()
    ]);

    return res.status(200).json({
      success: true,
      data: {
        waiting,
        active,
        completed,
        failed,
        total: waiting + active
      }
    });
  } catch (error) {
    console.error("Error fetching queue status:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch queue status",
      error: error.message
    });
  }
});

/**
 * GET /api/jobs
 */
router.get("/jobs", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.source) filter.source = req.query.source;
    if (req.query.company) filter.company = new RegExp(req.query.company, 'i');
    if (req.query.location) filter.location = new RegExp(req.query.location, 'i');
    if (req.query.category) filter.category = req.query.category;

    const total = await Job.countDocuments(filter);

    const jobs = await Job.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    return res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch jobs",
      error: error.message
    });
  }
});

module.exports = router;