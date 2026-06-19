import Sidebar from "@/components/Sidebar";
import RouteGuard from "@/components/RouteGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex p-6 h-screen w-full print:block print:h-auto print:overflow-visible print:p-8">
      <Sidebar />
      <main className="flex-1 h-full overflow-y-auto rounded-3xl print:h-auto print:overflow-visible print:rounded-none">
        <RouteGuard>
          {children}
        </RouteGuard>
      </main>
    </div>
  );
}
