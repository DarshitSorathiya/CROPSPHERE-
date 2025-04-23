import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "None",
};

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) throw new ApiError(400, "User doesn't exist in database");

    accessToken = User.generateAccessToken();
    refreshToken = User.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access token"
    );
  }
};

const register = asyncHandler(async (req, res) => {
  const { fullname, email, password, phoneNo, dob } = req.body;
  const { username, gender } = req.body.toLowerCase();

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

  const { accessToken, refreshToken } = generateAccessAndRefreshToken(user._id);

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

  const user = User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) throw new ApiError(401, "User doesn't exist");

  const isCorrect = await User.isPasswordCorrect(password);

  if (!isCorrect) throw new ApiError(401, "Invalid credentials");

  const { refreshToken, accessToken } = generateAccessAndRefreshToken(user._id);

  const loggedIn = await User.findById(user?._id).select(
    "-password -refreshToken"
  );

  if (!loggedIn)
    throw new ApiError(500, "Something went wrong while login user");

  return res
    .status(200)
    .cookie(accessToken, cookieOptions)
    .cookie(refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { loggedIn, accessToken, refreshToken },
        "User Logged In Successfully"
      )
    );
});

const logout = asyncHandler(async (req, res) => {
  User.findByIdAndUpdate(
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
  const { Id } = req.params;
  const user = await User.findByIdAndDelete(Id);

  if (!user) throw new ApiError(400, "User not found");

  return res.status(200).json(200, {}, "User deleted Successfully");
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, phoneNo, email, dob } = req.body;

  if (!fullname || !phoneNo || !email || !dob)
    throw new ApiError(400, "All fields cannot be empty");

  const user = await User.findById(req.user?._id);

  if (!user) throw new ApiError(400, "User doesn't exist");

  user.fullname = fullname || user.fullname;
  user.phoneNo = phoneNo || user.phoneNo;
  user.email = email || user.email;
  user.dob = dob || user.dob;

  await user.save({ validateBeforeSave: false });

  const updatedUser = User.findById(req.user?._id).select(
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

  const user = User.findById(req.user?._id);

  if (!user) throw new ApiError(400, "User doesn't exist");

  const isCorrect = await User.isPasswordCorrect(oldPassword);

  if (!isCorrect) throw new ApiError(400, "Password is not true");

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

export {
  register,
  login,
  logout,
  deleteAccount,
  changeCurrentPassword,
  updateAccountDetails,
};
