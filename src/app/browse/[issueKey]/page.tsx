"use client";

import { use } from "react";
import Link from "next/link";
import { useIssueByKey } from "@/hooks/useData";
import { IssueView } from "@/components/issues/IssueView";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";

export default function BrowsePage({ params }: PageProps<"/browse/[issueKey]">) {
  const { issueKey } = use(params);
  const issue = useIssueByKey(issueKey);
  if (!issue) {
    return (
      <EmptyState
        title="Work item not found"
        description={`There is no work item with key "${issueKey.toUpperCase()}". It may have been deleted.`}
        action={
          <Link href="/for-you">
            <Button>Back to For you</Button>
          </Link>
        }
      />
    );
  }
  return <IssueView issueId={issue.id} variant="page" />;
}
