const { Queue } = require("bullmq");
const connection = require("../config/redis");

const jobQueue = new Queue("job-import-queue", { connection });

module.exports = jobQueue;