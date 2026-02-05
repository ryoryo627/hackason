import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeCare AI - 在宅医療支援システム",
  description: "在宅医療支援AIエージェントシステム - Admin UI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
