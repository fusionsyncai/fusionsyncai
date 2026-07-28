"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { ProfileChannelNav } from "@/components/outreach/profile-channel-nav";

export default function ProfileOutreachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ profileId: string }>();
  const profileId = params.profileId;
  const [profileName, setProfileName] = useState("Profile");

  useEffect(() => {
    void fetch(`/api/outreach/profiles/${profileId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.profile?.name) setProfileName(data.profile.name);
      })
      .catch(() => {});
  }, [profileId]);

  return (
    <div>
      <ProfileChannelNav profileId={profileId} profileName={profileName} />
      {children}
    </div>
  );
}
