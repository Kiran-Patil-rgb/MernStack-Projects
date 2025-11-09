import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { redisClient } from "../utils/redisClient.js";
import { companyModel } from "../controllers/companySchema.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

dotenv.config({ path: "./config.env" });

// Setup transporter
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.USER_EMAIL,
        pass: process.env.USER_EMAIL_PASSWORD,
    },
});

// Generate OTP
function generateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Send OTP (generic)
async function sendOTP(email, keyPrefix, subject) {
    try {
        const otp = generateOTP();
        const mailOptions = {
            from: process.env.USER_EMAIL,
            to: email,
            subject,
            text: `Your OTP is ${otp}. It is valid for 5 minutes.`,
        };

        await transporter.sendMail(mailOptions);
        await redisClient.setEx(`${keyPrefix}:${email}`, 300, otp);

        return { success: true };
    } catch (err) {
        console.error("Error sending OTP:", err);
        return { success: false, message: err.message };
    }
}

// Test Route
const test = (req, res) => res.status(200).json({ message: "Company routes working fine!" });

// Register Company
const handleCompanyRegister = async (req, res) => {
    try {
        const { companyDetails, contact_person, email, phone, password } = req.body;

        if (!companyDetails || !contact_person || !email || !phone || !password)
            throw "Missing required fields!";

        const existing = await companyModel.findOne({
            $or: [{ "email.userEmail": email }, { phone }],
        });

        if (existing) throw "Company already exists with given email/phone.";

        const emailObject = { userEmail: email, verified: false };

        const otpSent = await sendOTP(
            email,
            "companyEmail",
            "Company Registration Verification | valid for 5 mins"
        );
        if (!otpSent.success) throw "Failed to send verification OTP.";

        const newCompany = new companyModel({
            companyDetails,
            contact_person,
            email: emailObject,
            phone,
            password,
        });

        await newCompany.save();

        res.status(201).json({
            message: `Company registered successfully! Verify your email using OTP sent to ${email}.`,
        });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(400).json({ message: "Unable to register company!", error: err });
    }
};

// Verify Company OTP
const handleCompanyOTPVerification = async (req, res) => {
    try {
        const { email, companyOtp } = req.body;

        const company = await companyModel.findOne({ "email.userEmail": email });
        if (!company) throw `Company with email ${email} not found.`;

        const storedOtp = await redisClient.get(`companyEmail:${email}`);
        if (!storedOtp) throw "OTP expired or not found!";
        if (storedOtp !== companyOtp) throw "Invalid OTP!";

        await companyModel.updateOne(
            { "email.userEmail": email },
            { $set: { "email.verified": true } }
        );

        await redisClient.del(`companyEmail:${email}`);

        res.status(200).json({ message: "Email verified successfully! You can now login." });
    } catch (err) {
        console.error("OTP Verification Error:", err);
        res.status(400).json({ message: "Failed to verify OTP!", error: err });
    }
};

// Login Company
const handleCompanyLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const company = await companyModel.findOne({ "email.userEmail": email });
        if (!company) throw "Company not found!";

        if (!company.email.verified) {
            await sendOTP(email, "companyEmail", "Email Verification Required | valid for 5 mins");
            throw `Email not verified! OTP sent again to ${email}.`;
        }

        const isMatch = await bcrypt.compare(password, company.password);
        if (!isMatch) throw "Invalid credentials!";

        const token = jwt.sign({ companyEmail: email }, process.env.JWT_SECRET_KEY, {
            expiresIn: "24h",
        });

        res.status(200).json({
            message: `Welcome ${company.companyDetails.name}! Login successful.`,
            token,
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(400).json({ message: "Unable to login!", error: err });
    }
};

// Request Password Reset OTP
const handleCompanyPasswordResetRequest = async (req, res) => {
    try {
        const { email } = req.body;

        const company = await companyModel.findOne({ "email.userEmail": email });
        if (!company) throw "Company not found!";

        const result = await sendOTP(
            email,
            "companyPasswordReset",
            "Company Password Reset | valid for 5 mins"
        );
        if (!result.success) throw "Unable to send OTP.";

        res.status(200).json({ message: `OTP sent to ${email} for password reset.` });
    } catch (err) {
        console.error("Password Reset Request Error:", err);
        res.status(400).json({ message: "Password reset request failed!", error: err });
    }
};

// Verify OTP & Reset Password
const handleCompanyOTPForPasswordReset = async (req, res) => {
    try {
        const { email, companyOtp, newPassword } = req.body;

        const company = await companyModel.findOne({ "email.userEmail": email });
        if (!company) throw "Company not found!";

        const storedOtp = await redisCllient.get(`companyPasswordReset:${email}`);
        if (!storedOtp) throw "OTP expired or not found!";
        if (storedOtp !== companyOtp) throw "Invalid OTP!";

        const hash = await bcrypt.hash(newPassword, 10);

        await companyModel.updateOne(
            { "email.userEmail": email },
            { $set: { password: hash } }
        );

        await redisClient.del(`companyPasswordReset:${email}`);

        res.status(200).json({ message: "Password reset successfully! Please login." });
    } catch (err) {
        console.error("Password Reset Error:", err);
        res.status(400).json({ message: "Failed to reset password!", error: err });
    }
};

export {
    test,
    handleCompanyRegister,
    handleCompanyOTPVerification,
    handleCompanyLogin,
    handleCompanyPasswordResetRequest,
    handleCompanyOTPForPasswordReset,
};


