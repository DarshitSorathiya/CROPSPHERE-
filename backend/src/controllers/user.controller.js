import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { sendEmail } from "../utils/sendEmail.js";

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "None",
};

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) throw new ApiError(400, "User doesn't exist in database");

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.error(error);
    throw new ApiError(
      500,
      "Something went wrong while generating access token"
    );
  }
};

const register = asyncHandler(async (req, res) => {
  const { fullname, email, password, phoneNo, dob } = req.body;
  const username = req.body.username.toLowerCase();
  const gender = req.body.gender.toLowerCase();

  if (
    [username, fullname, email, password, phoneNo, dob].some(
      (field) => field?.trim() === ""
    )
  )
    throw new ApiError(400, "All fields are required");

  const existed = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existed)
    throw new ApiError(400, "User Already Exists Please Try to Login");

  const user = await User.create({
    username,
    fullname,
    email,
    password,
    phoneNo,
    gender,
    dob,
  });

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser)
    throw new ApiError(500, "Something went wrong while registering user");

  return res
    .status(201)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        201,
        { createdUser, accessToken, refreshToken },
        "User Registerd Successfully"
      )
    );
});

const login = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!(username || email))
    throw new ApiError(400, "username or email cannot be empty");

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) throw new ApiError(401, "User doesn't exist");

  const isCorrect = await user.isPasswordCorrect(password);

  if (!isCorrect) throw new ApiError(401, "Invalid credentials");

  const { refreshToken, accessToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedIn = await User.findById(user?._id).select(
    "-password -refreshToken"
  );

  if (!loggedIn)
    throw new ApiError(500, "Something went wrong while login user");

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { loggedIn, accessToken, refreshToken },
        "User Logged In Successfully"
      )
    );
});

const logout = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    throw new ApiError(400, "User is not authenticated");
  }

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
    },
    { new: true }
  );

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, "User Logged Out Successfully"));
});

const deleteAccount = asyncHandler(async (req, res) => {
  const Id = req.user?._id;

  const user = await User.findByIdAndDelete(Id);

  if (!user) throw new ApiError(400, "User not found");

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "User deleted Successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, phoneNo, email, dob } = req.body;

  if (!fullname && !phoneNo && !email && !dob)
    throw new ApiError(400, "All fields cannot be empty");

  const user = await User.findById(req.user?._id);

  if (!user) throw new ApiError(400, "User doesn't exist");

  user.fullname = fullname || user.fullname;
  user.phoneNo = phoneNo || user.phoneNo;
  user.email = email || user.email;
  user.dob = dob || user.dob;

  await user.save({ validateBeforeSave: false });

  const updatedUser = await User.findById(req.user?._id).select(
    "-password -refreshToken"
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedUser, "Account details updated successfully")
    );
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword, confPassword } = req.body;
  if (!(confPassword === newPassword))
    throw new ApiError(400, "New password and confirm password must match");

  const user = await User.findById(req.user?._id);

  if (!user) throw new ApiError(400, "User doesn't exist");

  const isCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isCorrect) throw new ApiError(400, "Password is not true");

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const sendOTPEmail = asyncHandler(async (req, res) => {
  const email = req.user?.email;

  if (!email) throw new ApiError(400, "Email is required");

  const user = await User.findOne({ email });

  const AppName = "Cropsphere";

  if (user.googleId) {
    sendEmail(
      email,
      "Your Login Confirmation of Cropsphere",
      `Hello ${user.username || "there"},

Welcome back! You've successfully logged in to ${AppName}. We're glad to have you back.

If you need anything or have questions, just reply to this email or visit our support center.

Enjoy your session!  
The ${AppName} Team
`
    );

    user.isVerified = true;
  } else {
    const otp = crypto.randomInt(100000, 999999).toString();
    user.otp = otp;

    user.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    sendEmail(
      email,
      "Your One-Time Password (OTP) for Secure Verification",
      `Hello ${user.username || "there"},

Your One-Time Password (OTP) is:

🔐 **${otp}**

This OTP is valid for **5 minutes** only. Please do not share it with anyone for your security.

If you did not request this, you can safely ignore this email.

Thanks,  
The ${AppName} Team
`
    );
  }
  await user.save();

  return res.status(200).json(new ApiResponse(200, "Email sent successfully"));
});

const verifyOTP = asyncHandler(async (req, res) => {
  const { uotp } = req.body;
  const email = req.user?.email;
  
  const user = await User.findOne({ email });

  if (!user.googleId) {
    if (!user || user.otp == uotp || user.otpExpiresAt < new Date())
      throw new ApiError(400, "Invalid or expired OTP");

    user.otp = null;
    user.otpExpiresAt = null;
    user.isVerified = true;
  }
  await user.save();

  return res.status(200).json(new ApiResponse(200, "Verified Successfully"));
});

const googleAuth = async (req, res) => {
  const { accessToken, refreshToken } = req.cookies;

  const userId = req.user._id;

  const user = await User.findById(userId).select("-password -refreshToken");
  if (!user) throw new ApiError(404, "User does not exists");

  return res
    .status(200)
    .cookie("accessToken", accessToken, option)
    .cookie("refreshToken", refreshToken, option)
    .json(
      new ApiResponse(
        200,
        { user, accessToken, refreshToken },
        "Google Login successful"
      )
    );
};

export {
  register,
  login,
  logout,
  deleteAccount,
  changeCurrentPassword,
  updateAccountDetails,
  sendOTPEmail,
  verifyOTP,
  googleAuth,
};
