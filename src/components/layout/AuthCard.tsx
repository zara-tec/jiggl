"use client";

import * as React from "react";
import { Logo } from "./TopBar";

/** Centered auth card used by the login and register pages. */
export function AuthCard({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex h-screen items-start justify-center overflow-y-auto bg-ds-surface-sunken px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Logo size={32} />
          <span className="text-2xl font-bold tracking-tight text-ds-text">Jiggl</span>
        </div>
        <div className="rounded-ds-lg bg-ds-surface p-8 shadow-[0_0_10px_rgba(9,30,66,0.13),0_0_1px_rgba(9,30,66,0.31)]">
          <h1 className="mb-6 text-center text-base font-semibold text-ds-text-subtle">{title}</h1>
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-sm text-ds-text-subtle">{footer}</div>}
      </div>
    </div>
  );
}

export function AuthField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">{label}</span>
      {children}
    </label>
  );
}
