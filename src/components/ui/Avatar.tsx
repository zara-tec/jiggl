"use client";

import { UserRound } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import type { User } from "@/lib/types";

const SIZES = {
  xs: { box: 16, text: 8 },
  sm: { box: 24, text: 10 },
  md: { box: 32, text: 12 },
  lg: { box: 40, text: 14 },
  xl: { box: 64, text: 22 },
} as const;

export function Avatar({
  user,
  size = "sm",
  className,
  title,
}: {
  user?: User | null;
  size?: keyof typeof SIZES;
  className?: string;
  title?: string;
}) {
  const s = SIZES[size];
  if (!user) {
    return (
      <span
        title={title ?? "Unassigned"}
        className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-ds-track", className)}
        style={{ width: s.box, height: s.box }}
      >
        <UserRound size={Math.round(s.box * 0.62)} strokeWidth={2.2} className="text-ds-text-subtlest" />
      </span>
    );
  }
  return (
    <span
      title={title ?? user.name}
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white", className)}
      style={{ width: s.box, height: s.box, background: user.color, fontSize: s.text, lineHeight: 1 }}
    >
      {initials(user.name)}
    </span>
  );
}

export function AvatarGroup({ users, max = 4, size = "sm" }: { users: User[]; max?: number; size?: keyof typeof SIZES }) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  const box = SIZES[size].box;
  return (
    <div className="flex items-center">
      {shown.map((u, i) => (
        <span key={u.id} className="rounded-full ring-2 ring-ds-surface" style={{ marginLeft: i === 0 ? 0 : -Math.round(box * 0.25) }}>
          <Avatar user={u} size={size} />
        </span>
      ))}
      {rest > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-ds-track text-[11px] font-semibold text-ds-text-subtle ring-2 ring-ds-surface"
          style={{ width: box, height: box, marginLeft: -Math.round(box * 0.25) }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

export function ProjectAvatar({
  name,
  color,
  size = 24,
  className,
}: {
  name: string;
  color: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-[3px] font-bold text-white", className)}
      style={{ width: size, height: size, background: color, fontSize: Math.max(9, Math.round(size * 0.42)) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
