import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { JSX } from 'react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Job Listings - Find Your Dream Job',
  description: 'Browse thousands of job opportunities from top companies',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html lang="en">
      <body className={inter.className}>
        <main className="min-h-screen bg-gray-50">{children}</main>
      </body>
    </html>
  );
}
