import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SOSButton from "@/components/SOSButton";
import AuthGate from "@/components/AuthGate";
import AppBackground from "@/components/AppBackground";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/lib/toast";
import { LocationProvider } from "@/lib/location";
import { BeaconProvider } from "@/lib/beacon";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const DESCRIPTION =
  "Connecting people, knowledge, and care when it matters most. Emergency response, blood donation, family health, and traditional herbal knowledge in one community-driven platform.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "HealthOS — The Community Health & Emergency Network",
    template: "%s · HealthOS",
  },
  description: DESCRIPTION,
  applicationName: "HealthOS",
  keywords: [
    "emergency SOS",
    "blood donation",
    "community health",
    "health card",
    "herbal knowledge",
    "first aid",
  ],
  authors: [{ name: "HealthOS" }],
  openGraph: {
    type: "website",
    siteName: "HealthOS",
    title: "HealthOS — The Community Health & Emergency Network",
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "HealthOS — The Community Health & Emergency Network",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} h-full`}
    >
      <body className="min-h-full flex flex-col text-text antialiased">
        <AppBackground />
        <AuthProvider>
          <ToastProvider>
            <LocationProvider>
              <BeaconProvider>
                <Navbar />
                <main className="flex-1">
                  <AuthGate>{children}</AuthGate>
                </main>
                <Footer />
                <SOSButton />
              </BeaconProvider>
            </LocationProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
