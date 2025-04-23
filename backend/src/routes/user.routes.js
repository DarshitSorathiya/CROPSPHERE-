import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  register,
  login,
  logout,
  deleteAccount,
  changeCurrentPassword,
  updateAccountDetails,
} from "../controllers/user.controller.js";

const router = Router();

router.route("/register").post(register());

router.route("/login").post(login());

router.route("/logout").post(verifyJWT, logout());

router.route("/delete-account/:userId").delete(verifyJWT, deleteAccount());

router.route("/change-password").post(verifyJWT, changeCurrentPassword());

router.route("/update-account").post(verifyJWT, updateAccountDetails());

export default router;
