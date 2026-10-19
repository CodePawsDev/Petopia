import type { Metadata } from 'next';
import { Geist_Mono, Noto_Sans_Thai } from 'next/font/google';
import './globals.css';

const notoSansThai = Noto_Sans_Thai({
  variable: '--font-noto-sans-thai',
  subsets: ['thai', 'latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Petopia',
    template: '%s | Petopia',
  },
  description: 'Petopia — พื้นที่สำหรับคุณและสัตว์เลี้ยงที่คุณรัก',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="th"
      className={`${notoSansThai.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
