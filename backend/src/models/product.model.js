import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      index: true,
    },
    price: {
      type: Number,
      index: true,
      required: true,
    },
    discount: {
      type: Number,
      sparse: true,
      validate: {
        validator: function (val) {
          return val >= 0 && val <= 100;
        },
        message: (props) => `${props.value} is not between 0 and 100`,
      },
    },
    stock: {
      type: Number,
      validate: {
        validator: function (val) {
          return v >= 0;
        },
        message: (props) => `${props.value} is not > 0`,
      },
      default: 0,
      required: true,
    },
    coverPhoto: {
      type: String,
    },
    description: {
      type: String,
    },
    descriptionPhotos: [
      {
        url: { type: String },
        public_id: { type: String },
      },
    ],
  },
  { timeseries: true }
);

export const Product = mongoose.model("Product", productSchema);
