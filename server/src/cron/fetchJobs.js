const axios = require("axios");
const parseXML = require("../utils/xmlParser");
const ImportLog = require("../models/importLog");
const jobQueue = require("../queue/job.queue");

// feed URLs
const FEEDS = [
  "https://jobicy.com/?feed=job_feed",
  "https://jobicy.com/?feed=job_feed&job_categories=smm&job_types=full-time",
  "https://jobicy.com/?feed=job_feed&job_categories=seller&job_types=full-time&search_region=france",
  "https://jobicy.com/?feed=job_feed&job_categories=design-multimedia",
  "https://jobicy.com/?feed=job_feed&job_categories=data-science",
  "https://jobicy.com/?feed=job_feed&job_categories=copywriting",
  "https://jobicy.com/?feed=job_feed&job_categories=business",
  "https://jobicy.com/?feed=job_feed&job_categories=management",
  "https://www.higheredjobs.com/rss/articleFeed.cfm"
];

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;

module.exports = async () => {
  console.log("Starting job import at:", new Date().toISOString());

  for (const url of FEEDS) {
    let importLog;

    try {
      importLog = await ImportLog.create({
        sourceUrl: url,
        startedAt: new Date(),
        totalFetched: 0,
        totalImported: 0,
        newJobs: 0,
        updatedJobs: 0,
        failedJobs: [],
        failedJobsCount: 0
      });

      console.log(`Fetching jobs from: ${url}`);
      
      const response = await axios.get(url, { 
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; JobImporter/1.0)'
        }
      });

      const json = await parseXML(response.data);

      let items = [];
      if (json?.rss?.channel?.item) {
        items = json.rss.channel.item;
      } else if (json?.feed?.entry) {
        items = json.feed.entry;
      }

      const jobsArray = Array.isArray(items) ? items : [items];

      importLog.totalFetched = jobsArray.length;
      await importLog.save();

      console.log(`Found ${jobsArray.length} jobs from ${url}`);

      for (let i = 0; i < jobsArray.length; i += BATCH_SIZE) {
        const batch = jobsArray.slice(i, i + BATCH_SIZE);
        
        const queueJobs = batch.map(job => ({
          name: "import-job",
          data: {
            sourceUrl: url,
            importLogId: importLog._id.toString(),
            job
          },
          opts: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000
            },
            removeOnComplete: 100,
            removeOnFail: 1000
          }
        }));

        await jobQueue.addBulk(queueJobs);
        
        console.log(`Queued batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} jobs) from ${url}`);
      }

      importLog.finishedAt = new Date();
      await importLog.save();

      console.log(`Successfully queued all jobs from ${url}`);

    } catch (error) {
      console.error(`Error fetching jobs from ${url}:`, error.message);

      if (importLog) {
        importLog.finishedAt = new Date();
        importLog.error = error.message;
        await importLog.save();
      }
    }
  }

  console.log("Job import completed at:", new Date().toISOString());
};