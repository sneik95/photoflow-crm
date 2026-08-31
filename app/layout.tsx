import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://foto-crm.idyachkov12.chatgpt.site"),
  title: "PhotoFlow",
  description:
    "PhotoFlow — CRM для фотографов: съёмки, клиенты, дедлайны и финансы в одном приложении.",
  applicationName: "PhotoFlow",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PhotoFlow",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon-32.png",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "PhotoFlow",
    description: "CRM для фотографов: съёмки, клиенты, дедлайны и финансы.",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "PhotoFlow — CRM для фотографов" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PhotoFlow",
    description: "CRM для фотографов: съёмки, клиенты, дедлайны и финансы.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F7F5EF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
