import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SUSTech Timetable Viewer',
  description: 'A reusable, data-driven timetable viewer for course-plan comparison.',
  openGraph: {
    title: 'SUSTech Timetable Viewer',
    description: 'A reusable, data-driven timetable viewer for course-plan comparison.',
    images: [{
      url: 'https://raw.githubusercontent.com/Stevvven777/sustech-course-advisor/main/web/public/og.png',
      width: 1731,
      height: 909,
      alt: 'SUSTech Timetable Viewer abstract weekly schedule',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SUSTech Timetable Viewer',
    description: 'A reusable, data-driven timetable viewer for course-plan comparison.',
    images: ['https://raw.githubusercontent.com/Stevvven777/sustech-course-advisor/main/web/public/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
