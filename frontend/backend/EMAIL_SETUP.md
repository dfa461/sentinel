# Email Configuration Guide

This guide explains how to set up email functionality in Sentinel to send assessment invitations to candidates.

## Overview

Sentinel uses SMTP (Simple Mail Transfer Protocol) to send professional, HTML-formatted emails to candidates with their unique assessment links.

## Quick Setup

### 1. Choose Your Email Provider

The system supports any SMTP-compatible email provider. Common options:

- **Gmail** (Recommended for testing)
- **Outlook/Office 365**
- **SendGrid**
- **Mailgun**
- **Amazon SES**
- **Custom SMTP server**

### 2. Configure Environment Variables

Add these variables to your `.env` file:

```bash
# Email Configuration
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password_here
FROM_EMAIL=your_email@gmail.com
FROM_NAME=Sentinel Assessment
```

## Provider-Specific Setup

### Gmail Setup (Recommended for Testing)

1. **Enable 2-Factor Authentication** on your Google account
   - Go to: https://myaccount.google.com/security
   - Enable "2-Step Verification"

2. **Generate an App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Name it "Sentinel Assessment"
   - Copy the 16-character password

3. **Update .env file**
   ```bash
   SMTP_SERVER=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your.email@gmail.com
   SMTP_PASSWORD=abcd efgh ijkl mnop  # The 16-character app password
   FROM_EMAIL=your.email@gmail.com
   FROM_NAME=Sentinel Assessment
   ```

### Outlook/Office 365 Setup

```bash
SMTP_SERVER=smtp.office365.com
SMTP_PORT=587
SMTP_USERNAME=your.email@outlook.com
SMTP_PASSWORD=your_password
FROM_EMAIL=your.email@outlook.com
FROM_NAME=Sentinel Assessment
```

### SendGrid Setup

```bash
SMTP_SERVER=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your_sendgrid_api_key
FROM_EMAIL=verified_sender@yourdomain.com
FROM_NAME=Sentinel Assessment
```

### Amazon SES Setup

```bash
SMTP_SERVER=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USERNAME=your_smtp_username
SMTP_PASSWORD=your_smtp_password
FROM_EMAIL=verified_sender@yourdomain.com
FROM_NAME=Sentinel Assessment
```

## Testing Email Configuration

### 1. Check Health Endpoint

```bash
curl http://localhost:8000/health
```

Should return:
```json
{
  "status": "healthy",
  "grok_api_configured": true,
  "x_api_configured": true,
  "email_configured": true,
  "smtp_server": "smtp.gmail.com"
}
```

### 2. Send a Test Email

Use the `/send-assessment` endpoint:

```bash
curl -X POST http://localhost:8000/send-assessment \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "your.test@email.com"
  }'
```

### 3. Check Logs

Watch the backend logs for:
```
[Email] Sending assessment for @testuser
[Email] Recipient: your.test@email.com
[Email] Successfully sent email to your.test@email.com
```

## Email Template

The system sends a beautifully formatted HTML email with:

- **Professional header** with gradient styling
- **Personalized greeting** with the candidate's username
- **Clear CTA button** to start the assessment
- **Assessment details** (duration, features, tips)
- **Plain text fallback** for email clients that don't support HTML
- **Unique assessment link** that's specific to each candidate

### Preview

```
Subject: Complete Your Sentinel Technical Assessment

Hi @username,

Thank you for your interest! We're excited to invite you to complete your technical assessment on the Sentinel platform.

What to expect:
📝 Interactive coding challenges
🤖 AI-powered assistance and hints
💡 Adaptive follow-up questions
⏱️ Approximately 45-60 minutes

[Start Assessment Button]

Tips for success:
- Use a desktop or laptop for the best experience
- Ensure stable internet connection
- Find a quiet environment to focus
- Don't hesitate to ask for hints if you're stuck
```

## Troubleshooting

### Email Not Sending

1. **Check credentials**
   ```bash
   # Verify environment variables are loaded
   python3 -c "import os; from dotenv import load_dotenv; load_dotenv(); print(f'User: {os.getenv(\"SMTP_USERNAME\")}, Pass: {\"*\" * len(os.getenv(\"SMTP_PASSWORD\", \"\"))}');"
   ```

2. **Test SMTP connection**
   ```python
   import smtplib
   from dotenv import load_dotenv
   import os

   load_dotenv()
   server = smtplib.SMTP(os.getenv("SMTP_SERVER"), int(os.getenv("SMTP_PORT")))
   server.starttls()
   server.login(os.getenv("SMTP_USERNAME"), os.getenv("SMTP_PASSWORD"))
   print("✓ SMTP connection successful!")
   server.quit()
   ```

3. **Common Issues**:
   - **Gmail "Less secure app access"**: Use App Password instead of regular password
   - **Port blocked**: Try port 465 (SSL) instead of 587 (TLS)
   - **Authentication failed**: Double-check username and password
   - **Sender not verified**: Some providers require sender email verification

### Gmail Specific Issues

- **"Username and Password not accepted"**: You must use an App Password, not your regular Gmail password
- **"SMTP authentication failed"**: Enable 2FA first, then generate App Password
- **Email in spam**: Add SPF/DKIM records if using custom domain

### Development Mode

If you don't want to configure email during development, the system will:
- Still generate assessment links
- Print them to the console
- Return them in the API response
- Mark `email_configured: false` in the response

## Security Best Practices

1. **Never commit .env file** to git
2. **Use App Passwords** instead of real passwords
3. **Rotate credentials** regularly
4. **Use environment-specific configs** (dev, staging, prod)
5. **Monitor email sending** for abuse
6. **Rate limit** email sending to prevent spam

## Production Considerations

For production deployments:

1. **Use a dedicated email service** (SendGrid, Mailgun, AWS SES)
2. **Verify your domain** to improve deliverability
3. **Set up SPF, DKIM, and DMARC** records
4. **Monitor bounce rates** and handle failures
5. **Add rate limiting** to prevent abuse
6. **Log all email sends** for auditing
7. **Use templates** for different email types
8. **Handle unsubscribes** properly

## Custom Email Templates

To customize the email template, edit the HTML in `main.py:680-770`:

```python
html_body = f"""
<!DOCTYPE html>
<html>
<!-- Your custom template here -->
</html>
"""
```

## Support

If you encounter issues:
1. Check the backend logs for detailed error messages
2. Verify your SMTP credentials with your provider
3. Test with a simple Python script first
4. Check provider-specific documentation for SMTP settings
