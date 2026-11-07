const nodemailer = require("nodemailer");

const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";
const EMAIL_FROM = process.env.EMAIL_FROM || GMAIL_USER;
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || "http://localhost:3000").split(",")[0].trim();

const isConfigured = Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);

let transporter = null;

if (isConfigured) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });
} else {
  console.warn(
    "[mailer] GMAIL_USER / GMAIL_APP_PASSWORD are not set in Backend/.env — " +
      "verification emails will be skipped (logged to console instead)."
  );
}

// Sends an email, or logs a warning and resolves quietly if mail isn't configured yet.
// Callers should not let a mail failure block the surrounding request.
async function sendMail({ to, subject, html }) {
  if (!isConfigured) {
    console.warn(`[mailer] Skipped sending "${subject}" to ${to} (mailer not configured).`);
    return { skipped: true };
  }

  // return transporter.sendMail({
  //   from: `"ESG Digital Signage" <${EMAIL_FROM}>`,
  //   to,
  //   subject,
  //   html,
  // });
  const info = await transporter.sendMail({
    from: `"ESG Digital Signage" <${EMAIL_FROM}>`,
    to,
    subject,
    html,
  });

}

function buildVerificationEmailHtml({ heading, intro, verifyUrl }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1c3026;">
      <h2 style="color: #1c3026;">${heading}</h2>
      <p>${intro}</p>
      <p style="margin: 28px 0;">
        <a href="${verifyUrl}"
           style="background:#58a785; color:#ffffff; padding:12px 22px; border-radius:8px; text-decoration:none; font-weight:700; display:inline-block;">
          Verify Email
        </a>
      </p>
      <p style="color:#7b8982; font-size:13px;">
        Or copy and paste this link into your browser:<br />
        <a href="${verifyUrl}" style="color:#58a785;">${verifyUrl}</a>
      </p>
      <p style="color:#7b8982; font-size:12px;">This link expires in 24 hours.</p>
    </div>
  `;
}

async function sendSignupVerificationEmail(toEmail, token) {
  const verifyUrl = `${CLIENT_ORIGIN}/verify-email?token=${encodeURIComponent(token)}`;
  return sendMail({
    to: toEmail,
    subject: "Verify your email address",
    html: buildVerificationEmailHtml({
      heading: "Welcome! Please verify your email",
      intro: "Thanks for creating an account. Please confirm this is your email address to finish setting up your account.",
      verifyUrl,
    }),
  });
}

async function sendEmailChangeVerificationEmail(toEmail, token) {
  const verifyUrl = `${CLIENT_ORIGIN}/verify-email?token=${encodeURIComponent(token)}`;
  return sendMail({
    to: toEmail,
    subject: "Confirm your new email address",
    html: buildVerificationEmailHtml({
      heading: "Confirm your new email address",
      intro: "We received a request to change the email address on your account. Confirm this address to complete the change.",
      verifyUrl,
    }),
  });
}

async function sendPasswordResetEmail(toEmail, token) {

  const resetUrl =
    `${CLIENT_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`;


  return sendMail({
    to: toEmail,

    subject: "Reset your password",

    html: `
      <div style="font-family: Arial, sans-serif; max-width:480px; margin:auto; color:#1c3026;">

        <h2 style="color:#1c3026;">
          Password Reset Request
        </h2>

        <p>
          We received a request to reset your password.
        </p>

        <p style="margin:28px 0;">
          <a href="${resetUrl}"
             style="
             background:#58a785;
             color:white;
             padding:12px 22px;
             border-radius:8px;
             text-decoration:none;
             font-weight:bold;">
             Reset Password
          </a>
        </p>

        <p style="font-size:13px;color:#7b8982;">
          Or copy this link:
          <br/>
          ${resetUrl}
        </p>

        <p style="font-size:12px;color:#7b8982;">
          This link expires soon.
        </p>

      </div>
    `
  });

}

module.exports = {
  isConfigured,
  sendMail,
  sendSignupVerificationEmail,
  sendEmailChangeVerificationEmail,
  sendPasswordResetEmail,
};
