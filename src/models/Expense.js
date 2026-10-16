const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: [true, "Expense title is required."],
      trim: true,
      minlength: 1,
      maxlength: 100,
    },

    amount: {
      type: Number,
      required: [true, "Expense amount is required."],
      min: [0.01, "Expense amount must be greater than zero."],
      validate: {
        validator: Number.isFinite,
        message: "Expense amount must be a valid number.",
      },
    },

    category: {
      type: String,
      required: [true, "Expense category is required."],
      trim: true,
      minlength: 1,
      maxlength: 40,
    },

    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

expenseSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model("Expense", expenseSchema);
