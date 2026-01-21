# System Architecture Documentation

## Overview

This document explains the architectural decisions, system design, and data flow of the Job Importer System.

## System Architecture Diagram

```
┌───────────────────────┐
│   Cron Scheduler      │
│  (At 2 AM everyday)   │
└────────┬──────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│              Fetch Jobs Service                 │
│  - Fetches from 9 RSS/XML feeds                 │
│  - Parses XML to JSON                           │
│  - Creates Import Log entries                   │
└────────┬────────────────────────────────────────┘
         │
         │ Batch jobs (100 per batch)
         │
         ▼
┌─────────────────────────────────────────────────┐
│              Redis Queue (BullMQ)               │
│  - job-import-queue                             │
│  - Retry logic with exponential backoff         │
│  - Rate limiting (100 jobs/sec)                 │
└────────┬────────────────────────────────────────┘
         │
         │ Concurrent processing (10 workers)
         │
         ▼
┌─────────────────────────────────────────────────┐
│           Background Worker Process             │
│  - Validates job data                           │
│  - Normalizes fields                            │
│  - Upsert to MongoDB                            │
│  - Updates import logs                          │
└────────┬────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│              MongoDB Collections                │
│  - jobs (with compound unique index)            │
│  - import_logs (with time-series indexes)       │
└─────────────────────────────────────────────────┘
         │
         │
         ▼
┌─────────────────────────────────────────────────┐
│              REST API Layer                     │
│  - Import logs endpoint                         │
│  - Statistics endpoint                          │
│  - Queue status endpoint                        │
│  - Jobs listing endpoint                        │
└─────────────────────────────────────────────────┘
         │
         │
         ▼
┌─────────────────────────────────────────────────┐
│           Next.js Frontend (Admin UI)           │
│  - Import history view                          |
└─────────────────────────────────────────────────┘
```

## Core Components

### 1. Job Fetcher Service (cron/fetchJobs.js)

**Purpose**: Orchestrates the import process from multiple external feeds

**Key Responsibilities**:
- Fetch XML data from 9 different RSS feeds
- Convert XML to JSON using xml2js
- Create import log entries before processing
- Batch jobs into groups of 100 for efficient queueing
- Handle feed-level errors gracefully

**Design Decisions**:
- **Batch Processing**: Groups jobs into batches of 100 to prevent memory overflow and optimize queue operations
- **Individual Feed Isolation**: Each feed is processed independently; failure in one doesn't affect others
- **Early Logging**: Creates import log before queueing to track total fetched count

**Code Flow**:
```
For each feed URL:
  1. Create import log entry
  2. Fetch XML data (30s timeout)
  3. Parse XML to JSON
  4. Extract job items
  5. Update total fetched count
  6. Batch jobs into groups of 100
  7. Queue all batches to Redis
  8. Mark import log as finished
```

### 2. Queue System (queue/job.queue.js)

**Purpose**: Manage background job processing with reliability

**Technology**: BullMQ (chosen over Bull for better performance)

**Configuration**:
- Queue name: `job-import-queue`
- Connected to Redis
- Supports bulk operations
- Job options include retry and cleanup policies

**Design Decisions**:
- **BullMQ over Bull**: Better TypeScript support, improved performance, active maintenance
- **Bulk Operations**: Uses `addBulk()` for efficient batch queueing
- **Job Options**: Each job configured with 3 retry attempts and exponential backoff

### 3. Background Worker (workers/jobImport.worker.js)

**Purpose**: Process queued jobs and import into MongoDB

**Key Responsibilities**:
- Normalize data from various XML structures
- Extract external job IDs reliably
- Perform upsert operations to prevent duplicates
- Update import logs with success/failure counts
- Handle errors and track failures

**Design Decisions**:

#### Data Normalization
Handles multiple XML parsing formats:
```javascript
// Handles these formats:
value = "string"
value = { _: "string" }
value = { $t: "string" }
```

#### External ID Extraction
Priority-based fallback system:
```javascript
1. Try guid field
2. Try id field  
3. Try link field
4. Try url field
5. Error if none found
```

#### Upsert Strategy
```javascript
findOneAndUpdate(
  { source, externalJobId },  // Find by compound key
  { $set: jobData },           // Update all fields
  { upsert: true }             // Create if not exists
)
```

**Performance Optimizations**:
- Configurable concurrency (default: 10)
- Rate limiting: 100 jobs per second
- Lean queries for checking existence
- Atomic operations for counters

**Error Handling**:
- Three retry attempts with exponential backoff
- Failed jobs logged with reason and timestamp
- Worker continues on individual job failures
- Graceful shutdown on SIGTERM/SIGINT

### 4. Database Layer (MongoDB)

#### Jobs Collection Schema

**Compound Unique Index**: `{ source: 1, externalJobId: 1 }`

**Rationale**: 
- Prevents duplicate jobs from same source
- Efficient upsert operations
- Allows same externalJobId from different sources

#### Import Logs Collection Schema

**Design Decisions**:
- Separate collection for logs (not embedded) for better queryability
- Failed jobs stored as array for detailed tracking
- Virtual field `total` calculated from imported + failed

### 5. REST API Layer (Routes/importRoutes.js)

**Endpoints Design**:

| Endpoint | Method | Purpose | Pagination |
|----------|--------|---------|------------|
| `/api/import-logs` | GET | List import history | Yes (50/page) |
| `/api/import-logs/:id` | GET | Single import details | No |
| `/api/trigger-import` | POST | Manual import trigger | No |
| `/api/stats` | GET | System statistics | No |
| `/api/queue-status` | GET | Current queue status | No |
| `/api/jobs` | GET | List jobs | Yes (20/page) |

**Query Optimizations**:
- Uses `.lean()` for read-only operations (10-20% faster)
- Excludes large fields (rawPayload) in list views
- Supports filtering to reduce result sets
- Implements proper pagination with totals

## Data Flow

### Import Workflow

```
1. Cron Trigger (Every Hour)
   ↓
2. Fetch Jobs Service
   - Creates Import Log (status: pending)
   - Fetches XML from 9 feeds
   - Parses to JSON
   - Updates totalFetched count
   ↓
3. Queue Jobs in Batches
   - Groups into batches of 100
   - Adds to Redis queue with retry config
   - Import Log (status: processing)
   ↓
4. Worker Processing (10 concurrent)
   - Validates required fields
   - Normalizes data
   - Checks for existing job
   - Upserts to MongoDB
   - Updates Import Log counters
   ↓
5. Completion
   - Import Log (status: completed)
   - All counters finalized
   - Failed jobs documented
```

### Error Handling Flow

```
Job Processing Error
   ↓
Is Retry #1 or #2?
   Yes → Exponential backoff → Retry
   No → 
      ↓
   Log to Import Log
      - Increment failedJobsCount
      - Add to failedJobs array
      - Record reason and timestamp
   ↓
   Continue with next job
```
