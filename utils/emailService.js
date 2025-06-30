const nodemailer = require("nodemailer");
require("dotenv").config();
class EmailService {
    constructor() {
        console.log("Environment variables:", {
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            user: process.env.EMAIL_USER,
            from: process.env.EMAIL_FROM,
            notification: process.env.NOTIFICATION_EMAIL,
        });

        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || "smtp.gmail.com",
            port: parseInt(process.env.EMAIL_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        this.testConnection().catch((err) =>
            console.error("Initial connection test failed:", err)
        );
    }

    async testConnection() {
        try {
            await this.transporter.verify();
            console.log("Email service connected successfully");
        } catch (error) {
            console.error("Email service connection failed:", {
                message: error.message,
                code: error.code,
                response: error.response,
            });
            throw error;
        }
    }

    async sendNotificationEmail(contactData) {
        const { fullName, email, phoneNo, country, requirements, createdAt } =
            contactData;
        if (
            !fullName ||
            !email ||
            !phoneNo ||
            !country ||
            !requirements ||
            !createdAt
        ) {
            throw new Error("Missing required contact data fields");
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error("Invalid email address");
        }

        const htmlContent = `
        <!DOCTYPE html>
        <html>
<head>
<meta charset="utf-8">
<title>New Contact Form Submission</title>
<style>
    body { 
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
        line-height: 1.8; 
        color: #2c3e50; 
        margin: 0; 
        padding: 0; 
        background-color: #f8f9fa;
    }
    .container { 
        max-width: 650px; 
        margin: 30px auto; 
        background: white; 
        border-radius: 8px; 
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        overflow: hidden;
    }
    .header { 
        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); 
        color: white; 
        padding: 30px; 
        text-align: center; 
    }
    .header h2 { 
        margin: 0; 
        font-size: 24px; 
        font-weight: 300; 
        letter-spacing: 1px;
    }
    .content { 
        padding: 40px; 
    }
    .intro { 
        font-size: 16px; 
        margin-bottom: 30px; 
        color: #5a6c7d;
    }
    .details-section {
        background: #f8f9fa;
        border-radius: 6px;
        padding: 25px;
        border-left: 4px solid #3498db;
    }
    .field { 
        margin-bottom: 20px; 
        display: flex;
        align-items: flex-start;
    }
    .field:last-child {
        margin-bottom: 0;
    }
    .label { 
        font-weight: 600; 
        color: #34495e; 
        min-width: 140px;
        flex-shrink: 0;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .value { 
        color: #2c3e50;
        font-size: 15px;
        word-break: break-word;
    }
    .value a {
        color: #3498db;
        text-decoration: none;
    }
    .value a:hover {
        text-decoration: underline;
    }
    .requirements-text {
        background: white;
        padding: 15px;
        border-radius: 4px;
        border: 1px solid #e9ecef;
        margin-top: 5px;
        font-style: italic;
    }
    .footer { 
        text-align: center; 
        padding: 25px; 
        font-size: 13px; 
        color: #7f8c8d; 
        background: #ecf0f1;
        border-top: 1px solid #e9ecef;
    }
    .footer p {
        margin: 5px 0;
    }
    .company-name {
        font-weight: 600;
        color: #34495e;
    }
    .divider {
        height: 1px;
        background: #e9ecef;
        margin: 20px 0;
    }
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <h2>New Contact Form Submission</h2>
    </div>
    <div class="content">
        <p class="intro">You have received a new inquiry through your website contact form. Please find the submission details below:</p>
        
        <div class="details-section">
            <div class="field">
                <span class="label">Full Name:</span>
                <span class="value">${fullName}</span>
            </div>
            <div class="divider"></div>
            <div class="field">
                <span class="label">Email Address:</span>
                <span class="value"><a href="mailto:${email}">${email}</a></span>
            </div>
            <div class="divider"></div>
            <div class="field">
                <span class="label">Phone Number:</span>
                <span class="value"><a href="tel:${phoneNo}">${phoneNo}</a></span>
            </div>
            <div class="divider"></div>
            <div class="field">
                <span class="label">Country:</span>
                <span class="value">${country}</span>
            </div>
            <div class="divider"></div>
            <div class="field">
                <span class="label">Requirements:</span>
                <div class="value">
                    <div class="requirements-text">${requirements}</div>
                </div>
            </div>
            <div class="divider"></div>
            <div class="field">
                <span class="label">Submitted:</span>
                <span class="value">${new Date(
            createdAt
        ).toLocaleString()}</span>
            </div>
        </div>
    </div>
    <div class="footer">
        <p>This email was automatically generated from your website contact form.</p>
        <p class="company-name">KatchinTech Contact Management System</p>
    </div>
</div>
</body>
</html>
    `;

        const textContent = `
NEW CONTACT FORM SUBMISSION
============================

Full Name: ${fullName}
Email: ${email}
Phone: ${phoneNo}
Country: ${country}

Requirements:
${requirements}

Submitted: ${new Date(createdAt).toLocaleString()}

============================
This email was automatically generated from your website contact form.
KatchinTech Contact Management System
    `;

        const mailOptions = {
            from: `"KatchinTech Contact Form" <${process.env.EMAIL_USER}>`,
            to: process.env.NOTIFICATION_EMAIL,
            subject: `🆕 New Contact Form Submission from ${fullName}`,
            text: textContent,
            html: htmlContent,
            replyTo: email,
        };

        try {
            await this.transporter.verify(); // Verify before sending
            const result = await this.transporter.sendMail(mailOptions);
            console.log("Notification email sent successfully:", {
                messageId: result.messageId,
                response: result.response,
            });
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error("Failed to send notification email:", {
                message: error.message,
                code: error.code,
                response: error.response,
            });
            return { success: false, error: error.message };
        }
    }

    async sendConfirmationEmail(contactData) {
        const { fullName, email } = contactData;

        // Validate input
        if (!fullName || !email) {
            throw new Error("Missing required contact data fields");
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error("Invalid email address");
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Thank You for Contacting Us</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #28a745; color: white; padding: 20px; text-align: center; }
                    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>✅ Thank You for Contacting Us!</h2>
                    </div>
                    <div class="content">
                        <p>Dear ${fullName},</p>
                        <p>Thank you for reaching out to KatchinTech! We have received your inquiry and our team will review your requirements shortly.</p>
                        <p>We typically respond to all inquiries within 24-48 hours during business days. If your inquiry is urgent, please feel free to call us directly.</p>
                        <p>We appreciate your interest in our services and look forward to discussing your project with you.</p>
                        <p>Best regards,<br>The KatchinTech Team</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated confirmation email.</p>
                        <p>© KatchinTech - All rights reserved</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: `"KatchinTech" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "✅ Thank you for contacting KatchinTech",
            html: htmlContent,
        };

        try {
            await this.transporter.verify(); // Verify before sending
            const result = await this.transporter.sendMail(mailOptions);
            console.log("Confirmation email sent successfully:", {
                messageId: result.messageId,
                response: result.response,
            });
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error("Failed to send confirmation email:", {
                message: error.message,
                code: error.code,
                response: error.response,
            });
            return { success: false, error: error.message };
        }
    }
}

module.exports = EmailService;
