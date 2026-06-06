import DashboardShell from "@/components/DashboardShell";
import { FinanceVisibilityProvider } from "@/lib/finance-visibility";
import "@livekit/components-styles";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <FinanceVisibilityProvider>
      <DashboardShell>{children}</DashboardShell>
    </FinanceVisibilityProvider>
  );
}
