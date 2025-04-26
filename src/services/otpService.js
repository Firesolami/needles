const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const OTP = prisma.otp;

class OTPService {
    generateOTP() {
        return crypto.randomInt(100000, 999999).toString();
    }

    async createOTP(user, type) {
        await OTP.deleteMany({
            where: {
                user_id: user.id,
                type: type
            }
        });

        const otp = this.generateOTP();
        const expiry_time = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await OTP.create({
            data: {
                user: { connect: { id: user.id } },
                otp,
                type,
                expiry_time
            }
        });

        return otp;
    }

    async verifyOTP(user, otp, type) {
        const otpDoc = await OTP.findFirst({
            where: {
                user_id: user.id,
                otp,
                type,
                expiry_time: {
                    gte: new Date()
                }
            }
        });

        if (!otpDoc) {
            return false;
        }

        await OTP.delete({
            where: {
                id: otpDoc.id
            }
        });
        return true;
    }
}

const otpService = new OTPService();
module.exports = otpService;
