import Sidebar from "@/components/Sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex p-6 h-screen w-full">
      <Sidebar />
      <main className="flex-1 h-full overflow-y-auto rounded-3xl">
        {children}
      </main>
    </div>
  );
}
