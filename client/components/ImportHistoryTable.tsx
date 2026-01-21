'use client';

import { Fragment, useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ImportLog } from '@/types/import-log';

interface Props {
  logs: ImportLog[];
}

const PAGE_SIZE = 10;

export default function ImportHistoryTable({ logs }: Props) {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(logs.length / PAGE_SIZE);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return logs.slice(start, start + PAGE_SIZE);
  }, [logs, currentPage]);

  const formatDate = (date?: string | Date) =>
    date ? format(new Date(date), 'dd MMM yyyy HH:mm:ss') : 'N/A';

  const toggleExpand = (id: string) => {
    setExpandedLogId(prev => (prev === id ? null : id));
  };

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <TableHeader>File</TableHeader>
              <TableHeader>Imported At</TableHeader>
              <TableHeader align="center">Total</TableHeader>
              <TableHeader align="center">New</TableHeader>
              <TableHeader align="center">Updated</TableHeader>
              <TableHeader align="center">Failed</TableHeader>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {paginatedLogs.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-10 text-center text-sm text-gray-500"
                >
                  No import history found
                </td>
              </tr>
            )}

            {paginatedLogs.map(log => (
              <Fragment key={log._id}>
                <tr
                  onClick={() => toggleExpand(log._id)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-6 py-4 text-sm text-blue-600 hover:underline whitespace-normal break-all">
                    <a
                      href={log.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {log.sourceUrl}
                    </a>
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-700">
                    {formatDate(log.startedAt)}
                  </td>

                  <TableCell align="center">
                    {log.totalFetched ?? 0}
                  </TableCell>

                  <TableCell align="center">
                    {log.newJobs ?? 0}
                  </TableCell>

                  <TableCell align="center">
                    {log.updatedJobs ?? 0}
                  </TableCell>

                  <TableCell align="center">
                    {log.failedJobs?.length ?? 0}
                  </TableCell>
                </tr>

                {expandedLogId === log._id &&
                  (log.failedJobs?.length ?? 0) > 0 && (
                    <tr>
                      <td colSpan={6} className="bg-red-50 px-6 py-4">
                        <h4 className="mb-3 font-semibold text-red-800">
                          Failed Jobs
                        </h4>

                        <div className="space-y-2">
                          {log.failedJobs!.slice(0, 5).map((job, index) => (
                            <div
                              key={index}
                              className="rounded bg-white p-3 text-xs shadow-sm"
                            >
                              <div>
                                <strong>ID:</strong> {job.externalJobId}
                              </div>
                              <div>
                                <strong>Reason:</strong> {job.reason}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-3">
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>

          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded border text-gray-800 px-3 py-1 text-sm disabled:opacity-50 "
            >
              Previous
            </button>

            <button
              onClick={() =>
                setCurrentPage(p => Math.min(totalPages, p + 1))
              }
              disabled={currentPage === totalPages}
              className="rounded border text-gray-800 px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TableHeader({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <th
      className={`px-6 py-3 text-${align} text-xs font-medium uppercase text-gray-500`}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <td className={`px-6 py-4 text-${align} text-sm text-gray-700`}>
      {children}
    </td>
  );
}
