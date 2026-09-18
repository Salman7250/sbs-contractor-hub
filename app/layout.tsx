import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PageTitle from "@/app/components/page-title";
import { WorkspaceAccessProvider } from "@/app/components/workspace-access-provider";
import { getWorkspaceNavigationAccess } from "@/lib/auth/workspace-navigation-access";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SBS",
  description: "Sharif Business Solutions",
};
export default async function RootLayout({
  children,
}: LayoutProps<"/">) {
  const { allowedModuleSlugs, permissionKeys } =
    await getWorkspaceNavigationAccess();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>
        <WorkspaceAccessProvider
          allowedModuleSlugs={allowedModuleSlugs}
          permissionKeys={permissionKeys}
        >
          <PageTitle />
          {children}
        </WorkspaceAccessProvider>
      </body>
    </html>
  );
}
