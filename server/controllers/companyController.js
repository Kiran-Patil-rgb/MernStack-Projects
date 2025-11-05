import nodemailer from "nodemailer"
import dotenv from "dotenv"
import { redisClient } from "../utils/redisClient.js"
import { companyModel } from "../models/companySchema.js"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

dotenv.config({ path: "./config.env" })

// setup transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.USER_EMAIL,
        pass: process.env.USER_EMAIL_PASSWORD,
    }
})

function generateRandomNumber() {
    return Math.floor((Math.random() * 9000) + 1000).toString();
}

//  Send OTP (Register)

async function sendOTP(email) {
    try {
        const otp = generateRandomNumber();

        const mailOptions = {
            from: process.env.USER_EMAIL,
            to: email,
            subject: "Company Email Verification OTP | valid for 5 mins",
            text: `Your OTP is ${otp}. It is valid for 5 minutes.`
        }

        await transporter.sendMail(mailOptions)

        await redisClient.setEx(`companyEmail:${email}`, 300, otp)

        return { message: "OTP sent successfully!", status: true }
    } catch (err) {
        console.log("Error sending OTP:", err)
        return { message: "Unable to send OTP!", status: false }
    }
}

//  Send OTP (Password Reset)

async function sendOTPForPasswordReset(email) {
    try {
        const otp = generateRandomNumber()

        const mailOptions = {
            from: process.env.USER_EMAIL,
            to: email,
            subject: "Company Password Reset Request",
            text: `Your OTP is ${otp}. It is valid for 5 minutes. Use this OTP to reset your password.`
        }

        await transporter.sendMail(mailOptions)

        await redisClient.setEx(`companyPasswordReset:${email}`, 300, otp)

        return { message: "OTP sent successfully!", status: true }
    } catch (err) {
        console.log("Error sending OTP:", err)
        return { message: "Unable to send OTP!", status: false }
    }
}

//  Test Route

const test = (req, res) => {
    res.status(200).json({ message: "Welcome to company test route!" });
}
//  Register Company

const handleCompanyRegister = async (req, res) => {
    try {
        let { companyName, email, phone, address, description, password } = req.body;

        if (!companyName || !email || !phone || !address || !description || !password)
            throw ("Invalid/Missing data!")

        let checkCompany = await companyModel.findOne({
            $or: [{ "email.companyEmail": email }, { "phone": phone }]
        })

        if (checkCompany) throw ("Company already exists, change email/phone and try again!");

        let emailObject = { companyEmail: email, verified: false }

        let result = await sendOTP(email)

        if (!result.status) throw (`Unable to send OTP at ${email} | ${result.message}`);

        let newCompany = new companyModel({
            companyName, phone, email: emailObject, address, description, password
        })

        await newCompany.save()

        res.status(202).json({
            message: `Company registered successfully! Please verify the email using OTP sent to ${email}.`
        })

    } catch (err) {
        console.log("Error while registering company:", err)
        res.status(400).json({ message: "Unable to register company!", err });
    }
}
//  Verify Company OTP

const handleCompanyOTPVerification = async (req, res) => {
    try {
        const { email, companyOtp } = req.body;

        const company = await companyModel.findOne({ "email.companyEmail": email });
        if (!company) throw (`Email ${email} is not registered!`);

        const storedOtp = await redisClient.get(`companyEmail:${email}`)
        if (!storedOtp) throw ("OTP expired or not found!")
        if (storedOtp != companyOtp) throw ("Invalid OTP!")

        await companyModel.updateOne(
            { "email.companyEmail": email },
            { $set: { "email.verified": true } }
        )

        await redisClient.del(`companyEmail:${email}`);

        res.status(202).json({ message: "Company email verified successfully! Please login." });

    } catch (err) {
        console.log("Error while verifying company OTP:", err)
        res.status(500).json({ message: "Failed to verify OTP!", err })
    }
}
//  Company Login

const handleCompanyLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const company = await companyModel.findOne({ "email.companyEmail": email });
        if (!company) throw ("Company not found! Please register first.")

        if (!company.email.verified) {
            let result = await sendOTP(email);
            if (!result.status) throw (`Unable to send OTP to ${email}`)
            throw (`Company email not verified! OTP sent to ${email}.`)
        }

        const isMatch = await bcrypt.compare(password, company.password)
        if (!isMatch) throw ("Invalid email/password!")

        const token = jwt.sign({ email }, process.env.JWT_SECRET_KEY, { expiresIn: "24h" });

        res.status(202).json({
            message: `Welcome ${company.companyName}! Login successful.`,
            token
        })

    } catch (err) {
        console.log("Error while login:", err);
        res.status(400).json({ message: "Unable to login!", err })
    }
}

//  Password Reset Request

const handleCompanyPasswordResetRequest = async (req, res) => {
    try {
        const { email } = req.body

        if (!email) throw ("Invalid/incomplete data!")

        const company = await companyModel.findOne({ "email.companyEmail": email })
        if (!company) throw ("Invalid email address / Please register first!")

        const result = await sendOTPForPasswordReset(email);
        if (!result.status) throw (`Unable to send OTP at ${email} | ${result.message}`)

        res.status(201).json({
            message: `An OTP has been sent to your email ${email} | valid for 5 mins to reset your password!`
        })

    } catch (err) {
        console.log("Password reset request failed!", err)
        res.status(400).json({ message: "Password reset request failed!", err })
    }
}
//  Verify OTP for Password Reset

const handleCompanyOTPForPasswordReset = async (req, res) => {
    try {
        const { email, companyOtp, newPassword } = req.body

        const company = await companyModel.findOne({ "email.companyEmail": email });
        if (!company) throw (`Email ${email} is not registered!`)

        const storedOtp = await redisClient.get(`companyPasswordReset:${email}`);
        if (!storedOtp) throw ("OTP expired or not found!")
        if (storedOtp != companyOtp) throw ("Invalid OTP!")

        const hash = await bcrypt.hash(newPassword, 10)

        await companyModel.updateOne(
            { "email.companyEmail": email },
            { $set: { password: hash } }
        )

        await redisClient.del(`companyPasswordReset:${email}`)

        res.status(202).json({ message: "Password changed successfully! Please login." })

    } catch (err) {
        console.log("Error while resetting password:", err)
        res.status(500).json({ message: "Failed to reset password!", err })
    }
}

//  Exports
export {
    test,
    handleCompanyRegister,
    handleCompanyOTPVerification,
    handleCompanyLogin,
    handleCompanyPasswordResetRequest,
    handleCompanyOTPForPasswordReset
}