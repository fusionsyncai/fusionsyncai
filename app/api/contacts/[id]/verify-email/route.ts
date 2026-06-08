import { EmailStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VERIFIER_URL = process.env.EMAIL_VERIFIER_URL ?? "http://localhost:5050";

type VerifierResponse = {
  email?: string;
  status?: string;
  reason?: string;
  message?: string;
};

function toEmailStatus(status: string | undefined): EmailStatus {
  switch (status?.toLowerCase()) {
    case "valid":
      return EmailStatus.VALID;
    case "invalid":
      return EmailStatus.INVALID;
    case "risky":
      return EmailStatus.RISKY;
    case "catch_all":
    case "catch-all":
      return EmailStatus.CATCH_ALL;
    default:
      return EmailStatus.UNKNOWN;
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const contact = await prisma.contact.findUnique({
    where: { id },
    select: { id: true, email: true },
  });

  if (!contact) {
    return Response.json({ error: "Contact not found" }, { status: 404 });
  }

  if (!contact.email) {
    return Response.json(
      { error: "Contact has no email to verify" },
      { status: 400 },
    );
  }

  let result: VerifierResponse;

  try {
    const response = await fetch(`${VERIFIER_URL}/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: contact.email }),
    });

    if (!response.ok) {
      return Response.json(
        { error: "Email verifier returned an error", status: response.status },
        { status: 502 },
      );
    }

    result = (await response.json()) as VerifierResponse;
  } catch {
    return Response.json(
      { error: "Email verifier unreachable", verifierUrl: VERIFIER_URL },
      { status: 503 },
    );
  }

  const emailStatus = toEmailStatus(result.status);

  const updated = await prisma.contact.update({
    where: { id: contact.id },
    data: { emailStatus },
    select: {
      id: true,
      name: true,
      email: true,
      emailStatus: true,
    },
  });

  return Response.json({
    contact: updated,
    verification: {
      status: result.status ?? null,
      reason: result.reason ?? null,
      message: result.message ?? null,
    },
  });
}
