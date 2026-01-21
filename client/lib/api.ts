import axios from 'axios';
import { ImportLog } from '@/types/import-log';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://joblisting-backend-6t7j.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
});

interface ImportLogsResponse {
  data: ImportLog[];
}

export const jobsAPI = {
  getImportLogs: async (): Promise<ImportLog[]> => {
    const response = await api.get<ImportLogsResponse>('/import-logs', {
      params: {
        _t: Date.now(), // Cache-busting timestamp
      },
    });

    return Array.isArray(response.data)
      ? response.data
      : response.data.data ?? [];
  },
};