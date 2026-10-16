const express = require("express");
const mongoose = require("mongoose");
const Expense = require("../models/Expense");
const Budget = require("../models/Budget");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

function normalizeCategoryName(name) {
  if (typeof name !== "string") return "";
  return name.trim().replace(/\s+/g, " ");
}

function validateExpense(body, partial = false) {
  const errors = [];

  if (!partial || body.title !== undefined) {
    if (
      typeof body.title !== "string" ||
      !body.title.trim() ||
      body.title.trim().length > 100
    ) {
      errors.push("Title must contain between 1 and 100 characters.");
    }
  }

  if (!partial || body.amount !== undefined) {
    if (
      typeof body.amount !== "number" ||
      !Number.isFinite(body.amount) ||
      body.amount <= 0
    ) {
      errors.push("Amount must be a number greater than zero.");
    }
  }

  if (!partial || body.category !== undefined) {
    const category = normalizeCategoryName(body.category);

    if (!category || category.length > 40) {
      errors.push("Please select a valid expense category.");
    }
  }

  if (body.date !== undefined) {
    if (
      typeof body.date !== "string" ||
      !Number.isFinite(Date.parse(body.date))
    ) {
      errors.push("Please provide a valid expense date.");
    }
  }

  return errors;
}

async function userHasCategory(userId, category) {
  const budget = await Budget.findOne({ user: userId }).lean();

  if (!budget || !Array.isArray(budget.categories)) {
    return false;
  }

  return budget.categories.includes(category);
}

function formatExpense(expense) {
  return {
    id: expense._id.toString(),
    title: expense.title,
    amount: expense.amount,
    category: expense.category,
    date: new Date(expense.date).toISOString(),
  };
}

// GET /api/expenses
router.get("/", authMiddleware, async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.user.id })
      .sort({ date: -1 })
      .lean();

    return res.json({
      success: true,
      expenses: expenses.map(formatExpense),
    });
  } catch (error) {
    console.error("Fetch expenses error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve expenses.",
    });
  }
});

// POST /api/expenses
router.post("/", authMiddleware, async (req, res) => {
  try {
    const errors = validateExpense(req.body);

    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: errors[0],
      });
    }

    const category = normalizeCategoryName(req.body.category);

    if (!(await userHasCategory(req.user.id, category))) {
      return res.status(400).json({
        success: false,
        message: "This category does not exist in your account.",
      });
    }

    const expense = await Expense.create({
      user: req.user.id,
      title: req.body.title.trim(),
      amount: req.body.amount,
      category,
      ...(req.body.date ? { date: new Date(req.body.date) } : {}),
    });

    return res.status(201).json({
      success: true,
      message: "Expense created successfully.",
      expense: formatExpense(expense),
    });
  } catch (error) {
    console.error("Create expense error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create expense.",
    });
  }
});

// PATCH /api/expenses/:id
router.patch("/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID.",
      });
    }

    const allowedFields = ["title", "amount", "category", "date"];
    const keys = Object.keys(req.body);

    if (!keys.length || keys.some((key) => !allowedFields.includes(key))) {
      return res.status(400).json({
        success: false,
        message: "Provide valid expense fields to update.",
      });
    }

    const errors = validateExpense(req.body, true);

    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: errors[0],
      });
    }

    const updates = {};

    if (req.body.title !== undefined) {
      updates.title = req.body.title.trim();
    }

    if (req.body.amount !== undefined) {
      updates.amount = req.body.amount;
    }

    if (req.body.category !== undefined) {
      const category = normalizeCategoryName(req.body.category);

      if (!(await userHasCategory(req.user.id, category))) {
        return res.status(400).json({
          success: false,
          message: "This category does not exist in your account.",
        });
      }

      updates.category = category;
    }

    if (req.body.date !== undefined) {
      updates.date = new Date(req.body.date);
    }

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: updates },
      { new: true, runValidators: true },
    ).lean();

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found.",
      });
    }

    return res.json({
      success: true,
      message: "Expense updated successfully.",
      expense: formatExpense(expense),
    });
  } catch (error) {
    console.error("Update expense error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update expense.",
    });
  }
});

// DELETE /api/expenses/:id
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID.",
      });
    }

    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found.",
      });
    }

    return res.json({
      success: true,
      message: "Expense deleted successfully.",
    });
  } catch (error) {
    console.error("Delete expense error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to delete expense.",
    });
  }
});

module.exports = router;
