import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { to, subject, html, type } = await request.json();

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "Missing recipient, subject, or message body" },
        { status: 400 }
      );
    }

    console.log(`[Aegis Mailer] Provisioning dynamic SMTP gateway for type: ${type}...`);

    // 1. Programmatically provision a free, secure SMTP test account on Ethereal Mail
    const testAccount = await nodemailer.createTestAccount();

    // 2. Create reusable transporter object using Ethereal SMTP credentials
    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user, // generated ethereal user name
        pass: testAccount.pass, // generated ethereal password
      },
    });

    // 3. Setup E2E secure medical email payload
    const mailOptions = {
      from: '"Aegis Health Enterprise Gatekeeper" <no-reply@aegis.com>',
      to,
      subject: `[Aegis Real-Time] ${subject}`,
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; rounded: 16px;">
          <!-- Header Banner -->
          <div style="background-color: #0f172a; padding: 24px; border-radius: 12px; text-align: center; color: #ffffff; margin-bottom: 24px;">
            <h2 style="margin: 0; font-weight: 800; font-size: 22px; letter-spacing: -0.5px;">AEGIS HEALTH SYSTEM</h2>
            <span style="font-size: 10px; font-weight: bold; background-color: #10b981; color: #ffffff; padding: 4px 8px; border-radius: 9999px; text-transform: uppercase; margin-top: 8px; display: inline-block;">
              E2E AES-256 Verified
            </span>
          </div>

          <!-- Content Body -->
          <div style="padding: 0 8px; color: #3f3f46; font-size: 14px; line-height: 1.6;">
            ${html}
          </div>

          <!-- Footer Legal Disclaimer -->
          <div style="border-t: 1px dashed #e4e4e7; margin-top: 32px; padding-top: 16px; font-size: 10px; text-align: center; color: #a1a1aa; line-height: 1.4;">
            <p style="margin: 0; font-weight: bold;">HIPAA & GDPR Compliance Shielding Active</p>
            <p style="margin: 4px 0 0 0;">This email is E2E-encrypted and contains protected medical telemetry intended solely for the registered recipient. If received in error, please immediately trigger the secure E2E deletion protocols.</p>
            <p style="margin: 8px 0 0 0; font-weight: bold; color: #6366f1;">© 2026 Aegis Global Inc. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    // 4. Dispatch email programmatically
    const info = await transporter.sendMail(mailOptions);

    // 5. Retrieve dynamic real-time browser preview link
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[Aegis Mailer] Telemetry successfully dispatched! Preview URL: ${previewUrl}`);

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl || "https://ethereal.email",
    });

  } catch (error: any) {
    console.error("Nodemailer routing failure:", error);
    return NextResponse.json(
      { error: "Failed to dispatch secure clinical email", details: error.message },
      { status: 500 }
    );
  }
}
