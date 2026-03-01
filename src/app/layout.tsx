import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DrawTform",
  description: "Upload Terraform projects and visualize dependency graphs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
