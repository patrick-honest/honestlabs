import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { APP_OWNER } from "@/lib/access-control";

/**
 * Only the app owner can manage users.
 */
function isAdmin(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === APP_OWNER.toLowerCase();
}

/**
 * GET /api/users — List all users
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.appUser.findMany({
    orderBy: { invitedAt: "desc" },
  });

  return NextResponse.json({ users });
}

/**
 * POST /api/users — Invite a new user
 * Body: { email: string, name?: string, pages?: string[], sendEmail?: boolean }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { email, name, pages, sendEmail } = body as {
    email: string;
    name?: string;
    pages?: string[];
    sendEmail?: boolean;
  };

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  // Check domain restriction
  const domain = email.split("@")[1];
  const allowedDomains = ["honest.co.id", "honestbank.com"];
  if (!allowedDomains.includes(domain)) {
    return NextResponse.json(
      { error: `Only ${allowedDomains.join(" and ")} emails allowed` },
      { status: 400 }
    );
  }

  // Upsert user
  const user = await prisma.appUser.upsert({
    where: { email: email.toLowerCase() },
    update: {
      name: name || "",
      pages: JSON.stringify(pages || []),
      status: "pending",
    },
    create: {
      email: email.toLowerCase(),
      name: name || "",
      pages: JSON.stringify(pages || []),
      invitedBy: session?.user?.email || APP_OWNER,
      status: "pending",
    },
  });

  // Send invite email if requested
  let emailSent = false;
  if (sendEmail !== false) {
    try {
      // Use a simple email sending approach
      const appUrl = process.env.NEXTAUTH_URL || "https://review.honest.co.id";
      const inviteUrl = `${appUrl}/login?invited=true`;

      // For now, we'll use a simple fetch to a transactional email service
      // In production, integrate with SendGrid, Resend, or AWS SES
      console.log(`[Invite] Sending invite email to ${email} — login at ${inviteUrl}`);

      // Attempt to send via Resend if API key is configured
      if (process.env.RESEND_API_KEY) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Honest Business Review <noreply@honest.co.id>",
            to: [email],
            subject: "You're invited to Honest Business Review",
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 16px;">
                  You've been invited
                </h1>
                <p style="color: #666; line-height: 1.6; margin-bottom: 24px;">
                  ${session?.user?.name || "An administrator"} has invited you to access the
                  <strong>Honest Business Review Dashboard</strong>.
                </p>
                ${pages && pages.length > 0 ? `
                  <p style="color: #666; line-height: 1.6; margin-bottom: 24px;">
                    You've been granted access to: <strong>${pages.join(", ")}</strong>
                  </p>
                ` : ""}
                <a href="${inviteUrl}" style="display: inline-block; background: #D00083; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                  Sign in with Google
                </a>
                <p style="color: #999; font-size: 12px; margin-top: 32px;">
                  Sign in using your @honestbank.com or @honest.co.id Google account.
                </p>
              </div>
            `,
          }),
        });

        emailSent = res.ok;
        if (!emailSent) {
          console.error(`[Invite] Email send failed:`, await res.text());
        }
      } else {
        console.log(`[Invite] RESEND_API_KEY not configured — email not sent. User can still log in manually.`);
      }
    } catch (err) {
      console.error("[Invite] Email error:", err);
    }
  }

  return NextResponse.json({ user, emailSent }, { status: 201 });
}

/**
 * DELETE /api/users — Revoke a user
 * Body: { email: string }
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { email } = body as { email: string };

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  // Don't allow revoking the app owner
  if (email.toLowerCase() === APP_OWNER.toLowerCase()) {
    return NextResponse.json({ error: "Cannot revoke app owner" }, { status: 400 });
  }

  const user = await prisma.appUser.update({
    where: { email: email.toLowerCase() },
    data: { status: "revoked" },
  });

  return NextResponse.json({ user });
}

/**
 * PATCH /api/users — Update a user's pages or status
 * Body: { email: string, pages?: string[], status?: string }
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { email, pages, status } = body as {
    email: string;
    pages?: string[];
    status?: string;
  };

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (pages !== undefined) updateData.pages = JSON.stringify(pages);
  if (status !== undefined) updateData.status = status;

  const user = await prisma.appUser.update({
    where: { email: email.toLowerCase() },
    data: updateData,
  });

  return NextResponse.json({ user });
}
