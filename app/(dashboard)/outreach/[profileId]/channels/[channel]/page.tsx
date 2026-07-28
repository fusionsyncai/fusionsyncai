import { ChannelWorkspace } from "@/components/outreach/channel-workspace";
import { OUTREACH_CHANNELS } from "@/lib/outreach/profiles";
import { notFound } from "next/navigation";

export default async function ProfileChannelPage({
  params,
}: {
  params: Promise<{ profileId: string; channel: string }>;
}) {
  const { profileId, channel } = await params;

  if (!OUTREACH_CHANNELS.includes(channel as (typeof OUTREACH_CHANNELS)[number])) {
    notFound();
  }

  return <ChannelWorkspace profileId={profileId} channel={channel} />;
}
