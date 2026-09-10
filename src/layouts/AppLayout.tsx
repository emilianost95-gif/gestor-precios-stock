import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { DemoModeBar } from '@/components/DemoModeBar';
import { CopilotLauncher } from '@/components/copilot/CopilotLauncher';
import { CopilotPanel } from '@/components/copilot/CopilotPanel';
import { TourOverlay } from '@/components/tour/TourOverlay';

export function AppLayout() {
  return (
    <div className="flex min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Saltar al contenido
      </a>

      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main
          id="contenido"
          className="flex-1 px-4 pb-32 pt-4 sm:px-6 sm:pb-16 sm:pt-6 lg:pb-24"
          tabIndex={-1}
        >
          <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-5">
            <DemoModeBar />
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
      <CopilotLauncher />
      <CopilotPanel />
      <TourOverlay />
    </div>
  );
}
