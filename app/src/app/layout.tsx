import type { Metadata } from 'next';
import './globals.css';
import { WorkspaceProvider } from '../components/providers/workspace-provider';
export const metadata: Metadata = {
  title: 'BoatCore · Fishing operations, connected',
  description: 'Trip operations, sales and crew settlement in one connected workspace.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </body>
    </html>
  );
}
