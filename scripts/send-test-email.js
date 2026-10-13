/**
 * Resend Email Quickstart Script
 * 
 * Note: Replace 're_xxxxxxxxx' with your real API key, or define RESEND_API_KEY in your .env file.
 */

import { Resend } from 'resend';
import { getResendApiKey } from '../api/env-helper.js';

// Replace 're_xxxxxxxxx' with your real API key
const apiKey = process.env.RESEND_API_KEY || getResendApiKey() || 're_xxxxxxxxx';

const resend = new Resend(apiKey);

async function main() {
  console.log('Sending test email via Resend...');
  const { data, error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: 'dp844771@gmail.com',
    subject: 'Hello World',
    html: '<p>Congrats on sending your <strong>first email</strong>!</p>'
  });

  if (error) {
    console.error('Email failed to send:', error);
    process.exit(1);
  }

  console.log('Email sent successfully! Message ID:', data.id);
}

main();
