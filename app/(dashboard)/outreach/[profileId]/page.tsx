import { redirect } from "next/navigation";

export default async function ProfileIndexPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  redirect(`/outreach/${profileId}/channels/email`);
}
