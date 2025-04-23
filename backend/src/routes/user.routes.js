import passport from "passport";
import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import {
  register,
  login,
  logout,
  deleteAccount,
  changeCurrentPassword,
  updateAccountDetails,
  sendOTPEmail,
  verifyOTP,
  googleAuth,
} from "../controllers/user.controller.js";

const router = Router();

router.route("/register").post(register);

router.route("/login").post(login);

router.route("/logout").post(verifyJWT, logout);

router.route("/delete-account/:userId").delete(verifyJWT, deleteAccount);

router.route("/change-password").post(verifyJWT, changeCurrentPassword);

router.route("/update-account").post(verifyJWT, updateAccountDetails);

router.route("/send-otp").post(verifyJWT, sendOTPEmail);

router.route("/verify-otp").post(verifyJWT, verifyOTP);

router
  .route("/auth/google")
  .get(passport.authenticate("google", { scope: ["profile", "email"] }));

router.route("/auth/google/callback").get(
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: true,
  }),
  googleAuth
);

export default router;
