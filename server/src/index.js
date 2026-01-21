require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const cron = require("node-cron");
const fetchJobs = require("./cron/fetchJobs");

const PORT = process.env.PORT || 8080;

// Connect to MongoDB
connectDB();

// Initialize worker
require("./workers/jobImport.worker");
console.log("Worker initialized");

cron.schedule("* * * * *", () => {
  console.log("Running scheduled job import at:", new Date().toISOString());
  fetchJobs().catch(err => {
    console.error("Cron job error:", err);
  });
});

console.log("Cron job scheduled (runs every hour)");

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down...");
  process.exit(0);
});