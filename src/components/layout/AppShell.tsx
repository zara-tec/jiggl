"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { startSync } from "@/lib/sync";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { CreateIssueModal } from "@/components/issues/CreateIssueModal";
import { Button } from "@/components/ui/Button";

const AUTH_PAGES = ["/login", "/register"];
const DENIED = "Your access to this workspace has been removed or deactivated. Ask a workspace admin, or sign in with another account.";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const bootstrapped = useStore((s) => s.bootstrapped);
  const loadWorkspace = useStore((s) => s.loadWorkspace);
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (isAuthPage || bootstrapped) return;
    let cancelled = false;
    setError(null);
    loadWorkspace()
      .then((status) => {
        if (cancelled) return;
        if (status === 401) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        else if (status === 403) setError(DENIED);
        else if (status !== 200) setError(`The server answered ${status}.`);
      })
      .catch(() => !cancelled && setError("Cannot reach the server."));
    return () => {
      cancelled = true;
    };
  }, [isAuthPage, bootstrapped, loadWorkspace, router, pathname, attempt]);

  React.useEffect(() => {
    if (bootstrapped) startSync();
  }, [bootstrapped]);

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="flex h-dvh flex-col bg-ds-surface">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-ds-surface">
          {bootstrapped ? (
            children
          ) : error ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="ds-heading-md">Could not load your workspace</div>
              <p className="text-sm text-ds-text-subtle">{error}</p>
              {error === DENIED ? (
                <Button appearance="primary" onClick={() => void fetch("/api/auth/logout", { method: "POST" }).then(() => router.replace("/login"))}>
                  Sign out
                </Button>
              ) : (
                <Button appearance="primary" onClick={() => setAttempt((a) => a + 1)}>
                  Try again
                </Button>
              )}
            </div>
          ) : (
            <ShellSkeleton />
          )}
        </main>
      </div>
      {bootstrapped && <CreateIssueModal />}
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="animate-pulse px-page pt-6">
      <div className="mb-3 h-3 w-40 rounded bg-ds-neutral" />
      <div className="mb-8 h-7 w-72 rounded bg-ds-neutral" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-ds-lg bg-ds-neutral" />
        ))}
      </div>
      <div className="mt-6 h-64 rounded-ds-lg bg-ds-neutral" />
    </div>
  );
}

/** Scrollable page body with the standard page paddings */
export function Page({ children, className, noPadding }: { children: React.ReactNode; className?: string; noPadding?: boolean }) {
  return <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${noPadding ? "" : "px-page pb-10"} ${className ?? ""}`}>{children}</div>;
}
