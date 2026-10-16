
const express = require("express");
const mongoose = require("mongoose");

const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const Expense = require("../models/Expense");
const Budget = require("../models/Budget");
const RecurringBill = require("../models/RecurringBill");

const router = express.Router();

// GET /api/users/me
router.get("/me", authMiddleware, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Authenticated user retrieved successfully.",
    user: req.user,
  });
});

// DELETE /api/users/me
// Permanently deletes the authenticated account and its associated records.
router.delete("/me", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid authenticated user ID.",
    });
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // Delete only records owned by this authenticated user.
      await Expense.deleteMany({ user: userId }).session(session);
      await Budget.deleteMany({ user: userId }).session(session);
      await RecurringBill.deleteMany({ user: userId }).session(session);

      // Delete the user last, within the same transaction.
      const deletedUser = await User.findByIdAndDelete(userId).session(
        session,
      );

      if (!deletedUser) {
        const error = new Error("User account not found.");
        error.status = 404;
        throw error;
      }
    });

    return res.status(200).json({
      success: true,
      message: "Account and associated financial records deleted successfully.",
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Account deletion failed:", error.message);

    return res.status(500).json({
      success: false,
      message:
        "Account deletion failed. No partial deletion should be assumed; please verify the database before retrying.",
    });
  } finally {
    await session.endSession();
  }
});

module.exports = router;
