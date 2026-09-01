import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SUSTech Timetable Viewer',
  description: 'A reusable, data-driven timetable viewer for course-plan comparison.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
