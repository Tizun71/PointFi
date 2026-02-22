import type {Metadata} from 'next';
import {Inter, JetBrains_Mono} from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Confidential Credit Oracle',
  description: 'Web3 Lending Dashboard',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-mono antialiased bg-[#050505] text-gray-300 selection:bg-[#00ff9d] selection:text-black" suppressHydrationWarning>
        <div className="scanline"></div>
        {children}
      </body>
    </html>
  );
}
