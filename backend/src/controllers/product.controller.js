import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Product } from "../models/product.model.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";

const addProduct = asyncHandler(async (req, res) => {
  const { productName, description, price, discount, stock } = req.body;

  if (!productName || !description || !price || !stock)
    throw new ApiError(400, "All Feilds are Required");

  if (price < 0) throw new ApiError(400, "Price cannot be negative");

  if (stock < 0) throw new ApiError(400, "Stock cannot be negative");

  const product = await Product.create({
    productName,
    price,
    description,
    discount,
    stock,
  });

  await product.save();

  if (!product)
    throw new ApiError(400, "Something went wrong while adding product");

  return res
    .status(200)
    .json(new ApiResponse(200, product, "Product saved successfully"));
});

const uploadCoverPhoto = asyncHandler(async (req, res) => {
  const coverLocalPath = req.file?.path;

  if (!coverLocalPath) throw new ApiError(400, "Cover File is missing");

  const coverPhoto = await uploadOnCloudinary(coverLocalPath);

  if (!coverPhoto.url)
    throw new ApiError(400, "Error while uploading cover photo on cloudinary");

  const productId = req.params.productId;

  if (!productId)
    throw new ApiError(400, "Product ID should be given in params");

  const tempProduct = await Product.findById(productId);
  if (!tempProduct) throw new ApiError(404, "Product not found");

  const oldPath = tempProduct?.coverPhoto;

  const product = await Product.findByIdAndUpdate(
    productId,
    {
      $set: {
        coverPhoto: coverPhoto.url,
      },
    },
    { new: true }
  );

  if (oldPhoto?.includes("cloudinary.com")) {
    const publicId = oldPath.split("/").pop().split(".")[0];
    const result = await deleteFromCloudinary(publicId);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, product, "Cover Photo updated successfully"));
});

const uploadDescriptionPhotos = asyncHandler(async (req, res) => {
  const files = req.files;

  const productId = req.params.productId;

  if (!productId)
    throw new ApiError(400, "Product ID should be given in params");

  if (!files || files.length === 0) {
    throw new ApiError(400, "Description photo files are missing");
  }

  const uploadedPhotos = await Promise.all(
    files.map((file) => uploadOnCloudinary(file.path))
  );

  const photoEntries = uploadedPhotos
    .filter((photo) => photo?.url)
    .map((photo) => ({
      url: photo.url,
      public_id: photo.public_id,
    }));

  if (photoEntries.length === 0) {
    throw new ApiError(400, "Error uploading description photos to Cloudinary");
  }

  const product = await Product.findByIdAndUpdate(
    productId,
    {
      $push: { descriptionPhotos: { $each: photoEntries } },
    },
    { new: true }
  );

  if (!product)
    throw new ApiError(400, "Error while updating description photos");

  return res
    .status(200)
    .json(
      new ApiResponse(200, product, "description photos updating successfully")
    );
});

const deleteDescriptionPhotos = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { publicIds } = req.body;

  if (!productId || !Array.isArray(publicIds) || publicIds.length === 0) {
    throw new ApiError(400, "Product ID and publicIds are required");
  }

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, "Product not found");

  const remainingPhotos = [];

  for (const photo of product.descriptionPhotos) {
    if (publicIds.includes(photo.public_id)) {
      await deleteFromCloudinary(photo.public_id);
    } else {
      remainingPhotos.push(photo);
    }
  }

  product.descriptionPhotos = remainingPhotos;
  await product.save();

  return res
    .status(200)
    .json(
      new ApiResponse(200, product, "Selected photos deleted successfully")
    );
});

export {
  addProduct,
  uploadCoverPhoto,
  uploadDescriptionPhotos,
  deleteDescriptionPhotos,
};
