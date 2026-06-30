import "./globals.css";

export const metadata = {
  title: "News Pulse — Topic-Clustered News Timeline",
  description: "Live news clustered by topic, plotted on a timeline.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
