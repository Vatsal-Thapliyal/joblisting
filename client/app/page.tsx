import type { Metadata } from 'next';
import { jobsAPI } from '@/lib/api';
import ImportHistoryTable from '@/components/ImportHistoryTable';
import { ImportLog } from '@/types/import-log';

export const metadata: Metadata = {
  title: 'Import History - JobBoard',
  description: 'View job import history and statistics',
};

export default async function ImportHistoryPage() {
  const logs: ImportLog[] = await jobsAPI.getImportLogs();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <ImportHistoryTable logs={logs} />
    </div>
  );
}
