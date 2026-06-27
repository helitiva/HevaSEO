import { ManagerShell } from '@/components/manager/ManagerShell';

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return <ManagerShell>{children}</ManagerShell>;
}
