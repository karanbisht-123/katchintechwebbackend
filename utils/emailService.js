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
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT) || 465,
            secure: parseInt(process.env.EMAIL_PORT) === 465,
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

        if (!fullName || !email || !phoneNo || !country || !requirements || !createdAt) {
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
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New Contact Form Submission</title>
<style>
    body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 0;
        background-color: #f7f7f7;
        color: #333;
    }
    .container {
        max-width: 600px;
        margin: 40px auto;
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.05);
        overflow: hidden;
    }
    .header {
        background-color: #007bff; /* A standard blue for professionalism */
        color: #ffffff;
        padding: 24px;
        text-align: center;
    }
    .header h1 {
        margin: 0;
        font-size: 24px;
    }
    .content {
        padding: 30px;
    }
    .details p {
        margin: 0 0 10px 0;
    }
    .details strong {
        display: block;
        color: #555;
        font-size: 14px;
        margin-bottom: 4px;
    }
    .details .value {
        font-size: 16px;
        color: #333;
    }
    .requirements-box {
        margin-top: 20px;
        padding: 15px;
        background-color: #f9f9f9;
        border-left: 4px solid #007bff; /* Consistent blue border */
        border-radius: 4px; /* Slight rounding for the box */
    }
    .footer {
        text-align: center;
        padding: 20px;
        font-size: 12px;
        color: #999;
        border-top: 1px solid #eeeeee;
        background-color: #f7f7f7; /* Match body background for clean separation */
    }
    a {
        color: #007bff;
        text-decoration: none;
    }
    a:hover {
        text-decoration: underline;
    }
</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>New Contact Form Submission</h1>
        </div>
        <div class="content">
            <p>A new inquiry has been submitted through your website contact form. Below are the details:</p>
            <div class="details">
                <p><strong>Full Name:</strong> <span class="value">${fullName}</span></p>
                <p><strong>Email Address:</strong> <span class="value"><a href="mailto:${email}">${email}</a></span></p>
                <p><strong>Phone Number:</strong> <span class="value"><a href="tel:${phoneNo}">${phoneNo}</a></span></p>
                <p><strong>Country:</strong> <span class="value">${country}</span></p>
                <div class="requirements-box">
                    <strong>Requirements:</strong>
                    <p>${requirements}</p>
                </div>
                <p style="margin-top:20px;"><strong>Submitted:</strong> <span class="value">${new Date(createdAt).toLocaleString()}</span></p>
            </div>
        </div>
        <div class="footer">
            <p>This email was automatically generated.</p>
            <p>&copy; KatchinTech - All rights reserved.</p>
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
            subject: `New Contact Form Submission from ${fullName}`,
            text: textContent,
            html: htmlContent,
            replyTo: email,
        };

        try {
            await this.transporter.verify();
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
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Thank You for Contacting Us</title>
<style>
    body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 0;
        background-color: #f7f7f7;
        color: #333;
    }
    .container {
        max-width: 600px;
        margin: 40px auto;
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.05);
        overflow: hidden;
    }
    .header {
        background-color: #28a745; /* A success green */
        color: #ffffff;
        padding: 24px;
        text-align: center;
    }
    .header h1 {
        margin: 0;
        font-size: 24px;
    }
    .content {
        padding: 30px;
    }
    .content p {
        margin: 0 0 15px 0;
        font-size: 16px;
    }
    .footer {
        text-align: center;
        padding: 20px;
        font-size: 12px;
        color: #999;
        border-top: 1px solid #eeeeee;
        background-color: #f7f7f7; /* Match body background */
    }
</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Thank You for Contacting Us!</h1>
        </div>
        <div class="content">
            <p>Dear ${fullName},</p>
            <p>Thank you for reaching out to **KatchinTech**. We've received your inquiry and our team will get back to you shortly.</p>
            <p>We usually respond within **24–48 business hours**. We appreciate your interest and look forward to connecting with you.</p>
            <p>Best regards,<br>The KatchinTech Team</p>
        </div>
        <div class="footer">
            <p>This is an automated confirmation email.</p>
            <p>&copy; KatchinTech - All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;

        const mailOptions = {
            from: `"KatchinTech" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Thank you for contacting KatchinTech",
            html: htmlContent,
        };

        try {
            await this.transporter.verify();
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
