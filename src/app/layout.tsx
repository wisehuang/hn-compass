import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "HN Compass",
  description: "Daily Hacker News, with the signal distilled.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        <Script
          id="jelly-ui-package"
          src="https://jelly-ui.com/package.js"
          strategy="afterInteractive"
          type="module"
        />
        <jelly-theme mode="auto" accent="amber"><div className="app-shell">{children}</div></jelly-theme>
      </body>
    </html>
  );
}
