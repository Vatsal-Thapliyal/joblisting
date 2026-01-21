export interface FailedJob {
  externalJobId: string;
  reason: string;
}

export interface ImportLog {
  _id: string;
  sourceUrl: string;
  startedAt?: string;
  totalFetched?: number;
  newJobs?: number;
  updatedJobs?: number;
  failedJobs?: FailedJob[];
}
