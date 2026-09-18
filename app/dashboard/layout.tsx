import { DashboardHeader } from "@/app/dashboard/_components/dashboard-header";
import { requireTeacher } from "@/lib/auth/dal";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const teacher = await requireTeacher();

  return (
    <div className="flex flex-col">
      <DashboardHeader name={teacher.name} email={teacher.email} creditsBalance={teacher.creditsBalance} />
      <div className="flex flex-col gap-6 p-6">{children}</div>
    </div>
  );
}
