
import nodemailer from "nodemailer";

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;

  if (!user || !appPassword) {
    throw new Error("Gmail SMTP credentials are not configured.");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass: appPassword,
    },
  });
}

interface ClientInvitationEmail {
  email: string;
  organizationName: string;
  invitationUrl: string;
  expiresAt: Date;
}

export async function sendClientInvitationEmail({
  email,
  organizationName,
  invitationUrl,
  expiresAt,
}: ClientInvitationEmail): Promise<void> {
  const transporter = getTransporter();
  const from = process.env.MAIL_FROM || process.env.GMAIL_USER;

  if (!from) {
    throw new Error("MAIL_FROM is not configured.");
  }

  await transporter.sendMail({
    from,
    to: email,
    subject: `You're invited to ${organizationName} on TalentLens`,
    text: `
Hello,

You've been invited to access ${organizationName}'s client workspace on TalentLens.

Accept your invitation and create your account using this link:

${invitationUrl}

This invitation expires on ${expiresAt.toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata",
})}.

If you weren't expecting this invitation, you can ignore this email.

Regards,
TalentLens Team
    `.trim(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; color: #202020; line-height: 1.6;">
        <h2>You're invited to TalentLens</h2>
        <p>You've been invited to access <strong>${organizationName.replace(/[&<>"']/g, (char) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char]!)}</strong>'s client workspace.</p>
        <p>Create your account to review candidate submissions and share feedback with your recruitment team.</p>
        <p style="margin: 28px 0;">
          <a href="${invitationUrl}"
             style="background: #263b25; color: white; padding: 13px 22px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Accept invitation
          </a>
        </p>
        <p>This invitation expires on ${expiresAt.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        })}.</p>
        <p style="color: #777; font-size: 13px;">If you weren't expecting this invitation, you can ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;" />
        <p style="color: #888; font-size: 12px;">TalentLens — AI-powered recruitment workspace</p>
      </div>
    `,
  });
}
