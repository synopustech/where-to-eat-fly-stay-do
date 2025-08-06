import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import Script from 'next/script';
import GoogleMapsScript from './components/GoogleMapsScript';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Where to Eat - AI-Powered Restaurant Finder",
  description: "Find the best restaurants near you with AI-powered recommendations using Claude and Google Places API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet" />
      </head>
      <body className={inter.className}>
        {children}
        <Script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" />
        <GoogleMapsScript />
      </body>
    </html>
  );
}
