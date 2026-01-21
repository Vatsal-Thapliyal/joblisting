# Job Importer System - Backend

A scalable job import system that pulls data from external RSS/XML feeds, processes them using Redis queue (BullMQ), and stores them in MongoDB with comprehensive import history tracking.

## Features

- **Multi-source Job Fetching**: Fetches jobs from multiple RSS/XML feeds (Jobicy, HigherEdJobs)
- **Queue-based Processing**: Uses BullMQ with Redis for reliable background job processing
- **Duplicate Prevention**: Compound indexes ensure no duplicate jobs (by source + externalJobId)
- **Import History Tracking**: Detailed logs of each import run with success/failure tracking
- **Batch Processing**: Configurable batch sizes for optimal performance
- **Retry Logic**: Automatic retry with exponential backoff for failed jobs
- **Scheduled Imports**: Automated hourly imports using node-cron
- **RESTful API**: Comprehensive API endpoints for viewing logs, stats, and jobs
- **Scalable Design**: Built to handle millions of records efficiently

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (v5 or higher)
- Redis (v6 or higher)
- npm or yarn

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd server
```

2. **Install dependencies**

- use npm install inside both server and client file.
```bash
npm install
```

3. **Configure environment variables**
```bash
create .env
```

Edit `.env` file with your configurations:
```env
PORT=8080
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/job-importer
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:3000
WORKER_CONCURRENCY=10
BATCH_SIZE=100
IMPORT_ON_STARTUP=false
```

4. **Start MongoDB** (if running locally)
```bash
mongod
```

5. **Start Redis** (if running locally)
```bash
redis-server
```

6. **Start the application**
```bash
# start Frontend
npm run dev

# start backend
npm start
```

## API Endpoints

### Import Logs

**GET /api/import-logs**
- Fetch import history with pagination
- Query params: `page`, `limit`, `sourceUrl`, `status`
- Response includes pagination metadata

**GET /api/import-logs/:id**
- Get details of specific import log
- Returns complete import log with failed jobs details

### Statistics

**GET /api/stats**
- Overall system statistics
- Returns total jobs, imports, aggregates

**GET /api/queue-status**
- Current queue status
- Returns waiting, active, completed, failed counts

### Jobs

**GET /api/jobs**
- Fetch jobs with pagination and filtering
- Query params: `page`, `limit`, `source`, `company`, `location`, `category`


## 🛠️ Key Technical Decisions

### 1. Queue Processing Strategy
- **BullMQ** chosen over Bull for better performance and TypeScript support
- **Batch processing** (default 100 jobs per batch) for optimal memory usage
- **Configurable concurrency** (default 10 workers) to balance speed and resource usage

### 2. Database Design
- **Compound unique index** on `source + externalJobId` prevents duplicates
- **Upsert operations** for efficient insert/update logic
- **Separate collections** for jobs and import logs for better query performance

### 3. Error Handling
- **Three-tier retry** with exponential backoff (2s, 4s, 8s delays)
- **Detailed failure tracking** in import logs with reasons
- **Graceful degradation** - one feed failure doesn't stop others

### 5. Data Normalization
- Handles various XML structures (RSS, Atom feeds)
- Robust field extraction with fallbacks
- Preserves raw payload for future processing

## Data Models

### Job Schema
```javascript
{
  source: String,           // Feed URL
  externalJobId: String,    // Unique ID from source
  title: String,
  company: String,
  location: String,
  description: String,
  url: String,
  category: String,
  jobType: String,
  region: String,
  postedDate: Date,
  rawPayload: Object,       // Original XML data
  importedAt: Date,
  lastUpdatedAt: Date,
  timestamps: true
}
```

### Import Log Schema
```javascript
{
  sourceUrl: String,
  startedAt: Date,
  finishedAt: Date,
  totalFetched: Number,
  totalImported: Number,
  newJobs: Number,
  updatedJobs: Number,
  failedJobsCount: Number,
  failedJobs: [
    {
      externalJobId: String,
      reason: String,
      timestamp: Date
    }
  ],
  error: String,
  status: Enum,
  timestamps: true
}
```