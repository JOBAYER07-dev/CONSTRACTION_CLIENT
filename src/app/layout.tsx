import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/layout/Navbar';
import { ToastContainer } from 'react-toastify';
import Footer from '@/components/layout/Footer';
import Providers from '@/providers';
import ConstructiONChatbot from '@/components/layout/ConstrutiONChatbot';
import SmoothScroll from '@/components/layout/SmoothScroll';
import CustomCursor from '@/components/layout/CustomCursor';


export const metadata: Metadata = {
  title: 'ConstructiON AI - Next-Gen Cost Estimation',
  description:
    'AI-powered cost estimation and project intelligence for civil engineering.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning lang="en" className="h-full antialiased">
      <body className="font-sans bg-[#020617] text-[#F8FAFC] min-h-screen selection:bg-[#10B981]/30 selection:text-[#10B981] flex flex-col justify-between overflow-x-hidden">
        <Providers>
          <SmoothScroll />
          <CustomCursor />
          <Navbar />

          <main className="flex-grow w-full relative z-10">{children}</main>

          <ConstructiONChatbot />
          <Footer />
          <ToastContainer position="bottom-left" theme="dark" />
        </Providers>
      </body>
    </html>
  );
}
