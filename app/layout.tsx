import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TReactions – Telegram Bot Reactions',
  description: 'Painel para gerenciar múltiplos bots de reação no Telegram',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#0f1117] text-white antialiased">{children}</body>
    </html>
  );
}
