import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Meme Ad Agent",
  description: "Chat-based UGC meme video generator for startup products."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
