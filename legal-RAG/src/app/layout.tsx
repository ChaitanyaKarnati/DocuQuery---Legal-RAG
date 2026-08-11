import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DocuQuery - AI-Powered Document Intelligence",
  description: "Upload, analyze, and query your documents with advanced AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-slate-950 text-slate-100 antialiased`}
      >
        {/* Ambient background gradient */}
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-1/2 left-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute -bottom-1/2 right-1/4 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
        </div>

        <div className="flex min-h-screen flex-col">
          {/* Enhanced Header */}
          <header className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-900/60 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 xl:px-8">
              {/* Logo with gradient */}
              <Link 
                href="/" 
                className="group flex items-center gap-2.5 text-lg font-semibold tracking-tight transition-transform hover:scale-105"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20 transition-shadow group-hover:shadow-emerald-500/40">
                  <svg className="h-5 w-5 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
                  DocuQuery
                </span>
              </Link>

              {/* Navigation with active states */}
              <nav className="flex items-center gap-2">
                <NavLink href="/upload" icon="upload">
                  Upload
                </NavLink>
                <NavLink href="/files" icon="folder">
                  Files
                </NavLink>
                <NavLink href="/ask" icon="sparkles">
                  Ask AI
                </NavLink>
              </nav>
            </div>
          </header>

          {/* Main Content with max width and padding */}
          <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-12 xl:px-8">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              {children}
            </div>
          </main>

          {/* Enhanced Footer */}
          <footer className="relative border-t border-slate-800/50 bg-slate-900/40 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between xl:px-8">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-400">
                  &copy; {new Date().getFullYear()} DocuQuery
                </span>
                <span className="text-xs text-slate-500">
                  Proof of Concept • Research Purposes Only
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  Made with Gemini ✨
                </span>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

// Navigation Link Component with icons and hover effects
function NavLink({ href, icon, children }: { href: string; icon: string; children: React.ReactNode }) {
  const icons = {
    upload: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    folder: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    sparkles: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  };

  return (
    <Link
      href={href}
      className="group relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800/50 hover:text-emerald-300"
    >
      <span className="transition-transform group-hover:scale-110">
        {icons[icon as keyof typeof icons]}
      </span>
      <span>{children}</span>
      <span className="absolute inset-x-0 -bottom-px h-px scale-x-0 bg-gradient-to-r from-emerald-400/0 via-emerald-400 to-emerald-400/0 transition-transform group-hover:scale-x-100" />
    </Link>
  );
}