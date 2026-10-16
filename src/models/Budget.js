const mongoose = require("mongoose");

const DEFAULT_CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Health",
  "Education",
  "Entertainment",
  "Travel",
  "Other",
];

const DEFAULT_CATEGORY_BUDGETS = {
  Food: 4000,
  Transport: 1500,
  Shopping: 2000,
  Bills: 2500,
  Health: 1000,
  Education: 1000,
  Entertainment: 1000,
  Travel: 1000,
  Other: 1000,
};

const budgetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    monthlyBudget: {
      type: Number,
      required: true,
      default: 15000,
      min: [0, "Monthly budget cannot be negative."],
      validate: {
        validator: Number.isFinite,
        message: "Monthly budget must be a valid number.",
      },
    },

    // Stores predefined and user-created category budgets.
    categoryBudgets: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_CATEGORY_BUDGETS }),
    },

    // Stores the categories belonging to this user's account.
    categories: {
      type: [String],
      default: () => [...DEFAULT_CATEGORIES],
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Budget", budgetSchema);
