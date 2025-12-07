#!/usr/bin/env python3
"""
Test script for email configuration
Run this to verify your SMTP settings are correct
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_smtp_connection():
    """Test SMTP connection and authentication"""
    print("Testing SMTP configuration...\n")

    # Get config
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("FROM_EMAIL", smtp_username)
    from_name = os.getenv("FROM_NAME", "Sentinel Assessment")

    # Check if credentials are set
    if not smtp_username or not smtp_password:
        print("❌ SMTP credentials not configured!")
        print("\nPlease set the following environment variables in your .env file:")
        print("  - SMTP_USERNAME")
        print("  - SMTP_PASSWORD")
        print("\nSee EMAIL_SETUP.md for detailed instructions.")
        return False

    print(f"SMTP Server: {smtp_server}")
    print(f"SMTP Port: {smtp_port}")
    print(f"Username: {smtp_username}")
    print(f"Password: {'*' * len(smtp_password)}")
    print(f"From Email: {from_email}")
    print(f"From Name: {from_name}\n")

    try:
        # Connect and authenticate
        print("Connecting to SMTP server...")
        server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)

        print("Starting TLS encryption...")
        server.starttls()

        print("Authenticating...")
        server.login(smtp_username, smtp_password)

        print("✓ Successfully authenticated!\n")
        server.quit()
        return True

    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ Authentication failed: {e}")
        print("\nCommon fixes:")
        print("  - For Gmail: Use an App Password (not your regular password)")
        print("  - Enable 2-Factor Authentication first")
        print("  - Check that username and password are correct")
        return False

    except smtplib.SMTPConnectError as e:
        print(f"❌ Connection failed: {e}")
        print("\nCommon fixes:")
        print("  - Check SMTP_SERVER and SMTP_PORT are correct")
        print("  - Verify your internet connection")
        print("  - Check if port is blocked by firewall")
        return False

    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def send_test_email(recipient_email: str):
    """Send a test email"""
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("FROM_EMAIL", smtp_username)
    from_name = os.getenv("FROM_NAME", "Sentinel Assessment")

    print(f"Sending test email to {recipient_email}...\n")

    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = "Sentinel Email Configuration Test"
        msg['From'] = f"{from_name} <{from_email}>"
        msg['To'] = recipient_email

        # Email body
        text_body = """
        This is a test email from Sentinel Assessment.

        If you received this email, your SMTP configuration is working correctly!

        You can now send assessment invitations to candidates.
        """

        html_body = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; }
                .content { background: #f8f9fa; padding: 30px; border-radius: 10px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🛡️ Email Test Successful!</h1>
            </div>
            <div class="content">
                <p>This is a test email from <strong>Sentinel Assessment</strong>.</p>
                <p>If you received this email, your SMTP configuration is working correctly! ✓</p>
                <p>You can now send assessment invitations to candidates.</p>
                <hr>
                <p style="font-size: 12px; color: #6c757d;">
                    Powered by xAI Grok • Built for the future of technical hiring
                </p>
            </div>
        </body>
        </html>
        """

        # Attach parts
        part1 = MIMEText(text_body, 'plain')
        part2 = MIMEText(html_body, 'html')
        msg.attach(part1)
        msg.attach(part2)

        # Send email
        with smtplib.SMTP(smtp_server, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(msg)

        print("✓ Test email sent successfully!")
        print(f"\nCheck {recipient_email} for the test message.")
        return True

    except Exception as e:
        print(f"❌ Failed to send test email: {e}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("Sentinel Email Configuration Test")
    print("=" * 60)
    print()

    # Test connection
    if test_smtp_connection():
        print("-" * 60)

        # Offer to send test email
        send_test = input("\nSend a test email? (y/n): ").strip().lower()

        if send_test == 'y':
            recipient = input("Enter recipient email address: ").strip()

            if recipient:
                print()
                send_test_email(recipient)
            else:
                print("No recipient provided, skipping test email.")
        else:
            print("\nSkipping test email.")

    print("\n" + "=" * 60)
    print("Test complete!")
    print("=" * 60)
