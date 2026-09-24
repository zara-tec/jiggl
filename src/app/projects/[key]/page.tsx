import { redirect } from "next/navigation";

export default async function ProjectIndex({ params }: PageProps<"/projects/[key]">) {
  const { key } = await params;
  redirect(`/projects/${key}/board`);
}
