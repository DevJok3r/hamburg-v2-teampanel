import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hamburg V2 – Staff Portal',
  description: 'Internes Teamverwaltungssystem',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className={`${inter.className} bg-[#0f1117] antialiased`}>
        {children}
      </body>
    </html>
  );
}