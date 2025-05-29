const nodemailer = require('nodemailer');
const { AppError } = require('../middleware/errorHandler');

class EmailService {
    constructor() {
            this.transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: process.env.EMAIL_PORT,
                secure: process.env.EMAIL_SECURE === 'true',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASSWORD
                }
            });
        }

    async sendVerificationEmail(email, otp) {
        try {
            this.transporter.sendMail(
                {
                    from: process.env.EMAIL_FROM,
                    to: email,
                    subject: 'Verify Your Email Address',
                    html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
            <h2 style="color: #2c3e50; margin-bottom: 20px;">Email Verification</h2>
            <p style="font-size: 16px; line-height: 1.5;">Your verification code is:</p>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; text-align: center;">
              <span style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #2c3e50;">${otp}</span>
            </div>
            <p style="font-size: 14px; color: #666;">This code will expire in 15 minutes.</p>
            <p style="font-size: 14px; color: #666;">If you didn't request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="margin-bottom: 5px;">Thanks,</p>
            <p style="font-weight: bold; color: #2c3e50;">The Needles Team</p>
          </div>
        `
                },
                (error, info) => {
                    if (error) {
                        return console.log('Error sending email:', error);
                    }

                    console.log('Message sent: %s', info.messageId);
                }
            );
        } catch (error) {
            throw new AppError('Error sending verification email', 500);
        }
    }

    async sendPasswordResetEmail(email, otp) {
        try {
            this.transporter.sendMail(
                {
                    from: process.env.EMAIL_FROM,
                    to: email,
                    subject: 'Password Reset Request',
                    html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
            <h2 style="color: #2c3e50; margin-bottom: 20px;">Password Reset</h2>
            <p style="font-size: 16px; line-height: 1.5;">Your password reset code is:</p>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; text-align: center;">
              <span style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #2c3e50;">${otp}</span>
            </div>
            <p style="font-size: 14px; color: #666;">This code will expire in 15 minutes.</p>
            <p style="font-size: 14px; color: #666;">If you didn't request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="margin-bottom: 5px;">Thanks,</p>
            <p style="font-weight: bold; color: #2c3e50;">The Needles Team</p>
          </div>
        `
                },
                (error, info) => {
                    if (error) {
                        return console.log('Error sending email:', error);
                    }

                    console.log('Message sent: %s', info.messageId);
                }
            );
        } catch (error) {
            throw new AppError('Error sending password reset email', 500);
        }
    }
}

const emailService = new EmailService();
module.exports = emailService;
