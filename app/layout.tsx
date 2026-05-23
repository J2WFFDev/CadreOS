import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "CadreOS",
  description: "CadreOS App Foundation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <ClerkProvider>
        <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
      </ClerkProvider>
    </html>
  );
}
