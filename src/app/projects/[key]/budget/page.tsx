"use client";

import { use } from "react";
import { useProjectByKey } from "@/hooks/useData";
import { Page } from "@/components/layout/AppShell";
import { BudgetView } from "@/components/offers/BudgetView";

export default function BudgetPage({ params }: PageProps<"/projects/[key]/budget">) {
  const { key } = use(params);
  const project = useProjectByKey(key);
  if (!project) return null;
  return (
    <Page>
      <BudgetView project={project} />
    </Page>
  );
}
