import { WorkspaceShell } from '../components/layout/workspace-shell';
import { DashboardPage } from '../features/dashboard/dashboard-page';
export default function Page() {
  return (
    <WorkspaceShell>
      <DashboardPage />
    </WorkspaceShell>
  );
}
