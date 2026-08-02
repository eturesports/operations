import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ETURE Sports · Operations Database",
  description: "Eture Sports unified operations & data intelligence platform",
};

// `viewport-fit=cover` is what makes env(safe-area-inset-*) report real
// numbers on an iPhone. Without it every inset reads zero, which is why the
// floating navigation sat under the home indicator instead of above it.
// The insets are honoured explicitly wherever the layout reaches an edge.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Sets the theme before paint to avoid a flash of the wrong theme.
const themeInit = `(function(){try{var t=localStorage.getItem('eture-theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-[100dvh] antialiased">{children}</body>
    </html>
  );
}
