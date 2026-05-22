import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Beyblade Bot Web',
  description: 'Manage your Beyblade battles and check the leaderboard.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-900 text-slate-50 flex flex-col">
        <header className="glass-panel mx-4 mt-4 p-4 flex justify-between items-center sticky top-4 z-50">
          <h1 className="text-xl font-bold text-gradient">Beyblade Bot</h1>
          <nav className="flex gap-4 text-sm font-medium">
            <a href="/" className="hover:text-blue-400 transition-colors">Home</a>
            <a href="#arena" className="hover:text-blue-400 transition-colors">Arena</a>
            <a href="#leaderboard" className="hover:text-blue-400 transition-colors">Leaderboard</a>
          </nav>
        </header>
        <main className="flex-1 p-4 flex flex-col items-center">
          {children}
        </main>
        <footer className="p-6 text-center text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} Beyblade Bot Project
        </footer>
      </body>
    </html>
  );
}
