const mongoose = require("mongoose");

const recurringBillSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Bill name is required."],
      trim: true,
      minlength: 1,
      maxlength: 100,
    },

    amount: {
      type: Number,
      required: [true, "Bill amount is required."],
      min: [0.01, "Bill amount must be greater than zero."],
      validate: {
        validator: Number.isFinite,
        message: "Bill amount must be a valid number.",
      },
    },

    category: {
      type: String,
      required: [true, "Bill category is required."],
      trim: true,
      maxlength: 40,
    },

    dueDate: {
      type: Date,
      required: [true, "Bill due date is required."],
    },

    frequency: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly"],
      default: "monthly",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastPaidDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

recurringBillSchema.index({ user: 1, dueDate: 1 });

module.exports = mongoose.model("RecurringBill", recurringBillSchema);
