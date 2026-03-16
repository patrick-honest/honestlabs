import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/providers";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Honest Business Review",
  description: "Business review dashboard for Honest Bank Indonesia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline script prevents theme flash on page load by applying stored theme before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('honest-theme');document.documentElement.className=t==='dark'?'dark':'light'}catch(e){document.documentElement.className='light'}})()`,
          }}
        />
      </head>
      <body
        className={`${manrope.variable} ${geistMono.variable} font-sans antialiased bg-[var(--background)] text-[var(--foreground)] transition-colors`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
