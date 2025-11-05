import express from "express"
import { 
    test, 
    handleCompanyRegister, 
    handleCompanyOTPVerification, 
    handleCompanyLogin, 
    handleCompanyPasswordResetRequest, 
    handleCompanyOTPForPasswordReset 
} from "../controllers/companyController.js"

let companyRouter = express.Router()

companyRouter.get("/test", test)

companyRouter.post("/register", handleCompanyRegister)

companyRouter.post("/verify-otp", handleCompanyOTPVerification)

companyRouter.post("/login", handleCompanyLogin)

companyRouter.post("/password-reset-request", handleCompanyPasswordResetRequest)

companyRouter.post("/verify-reset-password-request", handleCompanyOTPForPasswordReset)

export { companyRouter }