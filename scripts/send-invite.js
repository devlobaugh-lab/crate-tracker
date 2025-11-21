#!/usr/bin/env node

/**
 * Simple script to send invitation emails using Gmail SMTP
 * Usage: node scripts/send-invite.js <to-email> <admin-email> <role>
 *
 * Prerequisites:
 * 1. Enable 2FA on your Gmail account
 * 2. Generate an App Password: https://support.google.com/accounts/answer/185833
 * 3. Set environment variables:
 *    export SMTP_EMAIL="your-gmail@gmail.com"
 *    export SMTP_PASSWORD="your-app-password"
 */

const nodemailer = require('nodemailer');

// Check arguments
const [,, toEmail, adminEmail, role] = process.argv;

if (!toEmail || !adminEmail || !role) {
  console.error('Usage: node scripts/send-invite.js <to-email> <admin-email> <role>');
  console.error('Example: node scripts/send-invite.js user@gmail.com admin@gmail.com normal');
  console.error('');
  console.error('Required environment variables:');
  console.error('  SMTP_EMAIL=your-gmail@gmail.com');
  console.error('  SMTP_PASSWORD=your-gmail-app-password');
  process.exit(1);
}

// Validate inputs
if (!toEmail.toLowerCase().endsWith('@gmail.com')) {
  console.error('Error: Only Gmail addresses are allowed');
  process.exit(1);
}

if (!['admin', 'normal'].includes(role.toLowerCase())) {
  console.error('Error: Role must be "admin" or "normal"');
  process.exit(1);
}

const smtpEmail = process.env.SMTP_EMAIL;
const smtpPassword = process.env.SMTP_PASSWORD;

if (!smtpEmail || !smtpPassword) {
  console.error('Error: SMTP_EMAIL and SMTP_PASSWORD environment variables are required');
  console.error('');
  console.error('Setup instructions:');
  console.error('1. Enable 2FA on your Gmail account');
  console.error('2. Generate an App Password: https://support.google.com/accounts/answer/185833');
  console.error('3. Set environment variables:');
  console.error('   export SMTP_EMAIL="your-gmail@gmail.com"');
  console.error('   export SMTP_PASSWORD="your-app-password"');
  process.exit(1);
}

// Create transporter
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: smtpEmail,
    pass: smtpPassword,
  },
});

// Generate email content
const roleText = role.toLowerCase() === 'admin' ? 'Administrator' : 'Regular User';
const subject = 'You\'re invited to join Crate Tracker!';
const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Welcome to Crate Tracker!</h2>
  <p>You've been invited to join Crate Tracker.</p>
  <p>Crate Tracker is a tool for tracking your game progress and patterns.</p>
  <p>To get started:</p>
  <ol>
    <li>Visit <a href="https://crate-tracker-38b6e.web.app/">https://crate-tracker-38b6e.web.app/</a></li>
    <li>Sign in with your Gmail account</li>
    <li>Start tracking your crates!</li>
  </ol>
  <hr>
  <p style="font-size: 12px; color: #666;">
    This invitation was sent automatically. Please do not reply to this message.
  </p>
</div>`;

const text = `Welcome to Crate Tracker!

Visit: https://crate-tracker-38b6e.web.app/
Sign in with your Gmail account

---
This invitation was sent automatically.`;

// Send email
async function sendEmail() {
  try {
    console.log(`Sending invitation to ${toEmail}...`);

    const result = await transporter.sendMail({
      from: `"Crate Tracker" <${smtpEmail}>`,
      to: toEmail,
      subject: subject,
      html: html,
      text: text,
    });

    console.log('✅ Email sent successfully!');
    console.log(`Message ID: ${result.messageId}`);
    console.log(`To: ${toEmail}`);
    console.log(`From: ${adminEmail} (as admin)`);

  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    process.exit(1);
  }
}

sendEmail();
