"use client";

import { ChevronDown } from "lucide-react";
import type { OfferStatus, ProjectStatus } from "@/lib/types";
import { OFFER_STATUS_META, OFFER_TRANSITIONS } from "@/lib/offers";
import { Lozenge, boldStatusClasses, type LozengeAppearance } from "@/components/ui/Lozenge";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";

export const PROJECT_STATUS_META: Record<ProjectStatus, { name: string; appearance: LozengeAppearance }> = {
  prospect: { name: "Prospect", appearance: "new" },
  active: { name: "Active", appearance: "success" },
  closed: { name: "Closed", appearance: "default" },
};

export function OfferStatusLozenge({ status, isBold }: { status: OfferStatus; isBold?: boolean }) {
  const m = OFFER_STATUS_META[status];
  return (
    <Lozenge appearance={m.appearance} isBold={isBold}>
      {m.name}
    </Lozenge>
  );
}

/** Status button for an offer, listing the allowed transitions. */
export function OfferStatusButton({ status, onChange }: { status: OfferStatus; onChange: (s: OfferStatus) => void }) {
  const m = OFFER_STATUS_META[status];
  const options = OFFER_TRANSITIONS[status].map((s) => ({ value: s, label: OFFER_STATUS_META[s].name, description: OFFER_STATUS_META[s].description }));
  const cls = boldStatusClasses(m.appearance);
  if (options.length === 0) {
    return <span className={cn("inline-flex h-8 items-center rounded-ds px-3 text-sm font-semibold", cls)}>{m.name}</span>;
  }
  return (
    <Select
      value={status}
      options={options}
      onChange={(v) => v && onChange(v)}
      searchable={false}
      appearance="inline"
      className={cn("h-8 rounded-ds px-3 font-semibold hover:bg-transparent", cls)}
      menuClassName="w-72"
      renderTrigger={({ open }) => (
        <span className="inline-flex items-center gap-1.5 text-sm">
          {m.name}
          <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} />
        </span>
      )}
    />
  );
}
