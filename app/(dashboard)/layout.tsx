import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="flex h-full">
        <Sidebar />
        <main className="flex h-full min-w-0 flex-1 flex-col">
          <div className="shrink-0 border-b bg-background/80 px-6 py-4 backdrop-blur">
            <p className="text-sm font-medium text-muted-foreground">
              FusionSync AIOS
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
