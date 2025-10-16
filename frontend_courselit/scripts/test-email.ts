import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import pug from "pug";

dotenv.config();

const queueServer = process.env.QUEUE_SERVER;
const jwtSecret = process.env.TRANSPORT_JWT_SECRET;

if (!jwtSecret) {
  console.error("TRANSPORT_JWT_SECRET is required");
  process.exit(1);
}

// Email configuration
const testEmail =
  process.env.TEST_EMAIL || process.env.SUPER_ADMIN_EMAIL || "test@example.com";
const fromEmail =
  process.env.MAIL_FROM ||
  `${process.env.SUPER_ADMIN_NAME || "CourseKit"} <noreply@coursekit.com>`;

console.log("Queue Server:", queueServer);
console.log("Test Email To:", testEmail);
console.log("From Email:", fromEmail);
console.log("JWT Secret:", jwtSecret ? "✓ Set" : "✗ Missing");

if (!queueServer) {
  console.error("QUEUE_SERVER environment variable is required");
  process.exit(1);
}

const emailTemplate = `
doctype html
html
  head
    title Test Email
    style.
      body { font-family: Arial, sans-serif; margin: 40px; }
      .header { color: #333; border-bottom: 2px solid #007cba; padding-bottom: 10px; }
      .content { margin: 20px 0; line-height: 1.6; }
      .footer { margin-top: 30px; font-size: 12px; color: #666; }
  body
    .header
      h1 #{title}
    .content
      p Hello #{name},
      p This is a test email sent through the queue service using a Pug template.
      p Current time: #{timestamp}
      if features
        p Features tested:
        ul
          each feature in features
            li #{feature}
    .footer
      p Sent via CourseKit Queue Service
`;

async function sendTestEmail() {
  try {
    const token = jwt.sign(
      {
        user: {
          userId: "test-user-id",
          email: "test@example.com",
          domain: "test-domain-id",
        },
      },
      jwtSecret!,
      { expiresIn: "1h" },
    );

    const templateData = {
      title: "Queue Service Test",
      name: "Developer",
      timestamp: new Date().toISOString(),
      features: [
        "Pug Templates",
        "Zod Validation",
        "Queue Processing",
        "Nodemailer",
      ],
    };

    const htmlContent = pug.compile(emailTemplate)(templateData);

    const response = await fetch(`${queueServer}/api/job/mail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: [testEmail],
        from: fromEmail,
        subject: "Test Email from Queue Service",
        body: htmlContent,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log("✅ Email queued successfully:", result);
    console.log(`📧 Email sent from: ${fromEmail}`);
    console.log(`📧 Email sent to: ${testEmail}`);

    // Check status
    const statusResponse = await fetch(`${queueServer}/api/mail/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log("📊 Queue status:", status);
    }
  } catch (error) {
    console.error("❌ Failed to send test email:", error);
    process.exit(1);
  }
}

sendTestEmail();
