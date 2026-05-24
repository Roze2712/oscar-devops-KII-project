import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { CartProvider } from "@/context/CartContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { WishlistProvider } from "@/lib/context/WishlistContext";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Oscar",
  description: "Oscar",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            <CartProvider>
              <WishlistProvider>
              <div className="min-h-screen bg-background text-foreground">
                <Suspense
                  fallback={
                    <div className="fixed left-0 top-0 z-50 h-14 w-full border-b border-border bg-background/90 backdrop-blur" />
                  }
                >
                  <Navbar />
                </Suspense>
                <div className="flex min-h-[calc(100vh-3.5rem)] flex-col pt-14">
                  <div className="flex-1">{children}</div>
                  <Footer />
                </div>
              </div>
              </WishlistProvider>
            </CartProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
