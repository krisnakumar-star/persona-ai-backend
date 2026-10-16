const express = require("express");
const mongoose = require("mongoose");
const RecurringBill = require("../models/RecurringBill");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

const ALLOWED_FREQUENCIES = [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
];

function getUserId(req) {
  return req.user?.id || req.user?._id || req.user?.userId;
}

function validateBill(body, partial = false) {
  const errors = [];

  if (!partial || body.name !== undefined) {
    if (
      typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.trim().length > 100
    ) {
      errors.push("Bill name must contain 1–100 characters.");
    }
  }

  if (!partial || body.amount !== undefined) {
    const amount = Number(body.amount);

    if (
      body.amount === "" ||
      body.amount === null ||
      body.amount === undefined ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      errors.push("Bill amount must be greater than zero.");
    }
  }

  if (!partial || body.category !== undefined) {
    if (
      typeof body.category !== "string" ||
      !body.category.trim() ||
      body.category.trim().length > 40
    ) {
      errors.push("A valid bill category is required.");
    }
  }

  if (!partial || body.dueDate !== undefined) {
    const date = new Date(body.dueDate);

    if (
      !body.dueDate ||
      Number.isNaN(date.getTime())
    ) {
      errors.push("A valid due date is required.");
    }
  }

  if (body.frequency !== undefined) {
    if (!ALLOWED_FREQUENCIES.includes(body.frequency)) {
      errors.push("Invalid recurrence frequency.");
    }
  } else if (!partial) {
    body.frequency = "monthly";
  }

  return errors;
}

// GET /api/recurring-bills
// Fetch the authenticated user's recurring bills.
router.get("/", async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        message: "Invalid authenticated user.",
      });
    }

    const bills = await RecurringBill.find({
      user: userId,
    }).sort({ dueDate: 1, createdAt: -1 });

    return res.status(200).json({ bills });
  } catch (error) {
    console.error("Fetch recurring bills error:", error);

    return res.status(500).json({
      message: "Unable to fetch recurring bills.",
    });
  }
});

// POST /api/recurring-bills
// Create a recurring bill.
router.post("/", async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        message: "Invalid authenticated user.",
      });
    }

    const errors = validateBill(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        message: errors[0],
        errors,
      });
    }

    const bill = await RecurringBill.create({
      user: userId,
      name: req.body.name.trim(),
      amount: Number(req.body.amount),
      category: req.body.category.trim(),
      dueDate: new Date(req.body.dueDate),
      frequency: req.body.frequency || "monthly",
      isActive: req.body.isActive ?? true,
    });

    return res.status(201).json({
      message: "Recurring bill created successfully.",
      bill,
    });
  } catch (error) {
    console.error("Create recurring bill error:", error);

    return res.status(500).json({
      message: "Unable to create recurring bill.",
    });
  }
});

// PATCH /api/recurring-bills/:id
// Update a recurring bill owned by the authenticated user.
router.patch("/:id", async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        message: "Invalid authenticated user.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid recurring bill ID.",
      });
    }

    const allowedFields = [
  "name",
  "amount",
  "category",
  "dueDate",
  "frequency",
  "isActive",
  "lastPaidDate",
];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "Provide at least one field to update.",
      });
    }

    const errors = validateBill(updates, true);
    if (body.lastPaidDate !== undefined && body.lastPaidDate !== null) {
  const date = new Date(body.lastPaidDate);

  if (Number.isNaN(date.getTime())) {
    errors.push("A valid payment date is required.");
  }
}

    if (errors.length > 0) {
      return res.status(400).json({
        message: errors[0],
        errors,
      });
    }

    if (updates.name !== undefined) {
      updates.name = updates.name.trim();
    }

    if (updates.category !== undefined) {
      updates.category = updates.category.trim();
    }

    if (updates.amount !== undefined) {
      updates.amount = Number(updates.amount);
    }

    if (updates.dueDate !== undefined) {
      updates.dueDate = new Date(updates.dueDate);
    }
    if (updates.lastPaidDate !== undefined && updates.lastPaidDate !== null) {
  updates.lastPaidDate = new Date(updates.lastPaidDate);
}

    const bill = await RecurringBill.findOneAndUpdate(
      {
        _id: req.params.id,
        user: userId,
      },
      { $set: updates },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!bill) {
      return res.status(404).json({
        message: "Recurring bill not found.",
      });
    }

    return res.status(200).json({
      message: "Recurring bill updated successfully.",
      bill,
    });
  } catch (error) {
    console.error("Update recurring bill error:", error);

    return res.status(500).json({
      message: "Unable to update recurring bill.",
    });
  }
});

// DELETE /api/recurring-bills/:id
// Delete a recurring bill owned by the authenticated user.
router.delete("/:id", async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        message: "Invalid authenticated user.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid recurring bill ID.",
      });
    }

    const bill = await RecurringBill.findOneAndDelete({
      _id: req.params.id,
      user: userId,
    });

    if (!bill) {
      return res.status(404).json({
        message: "Recurring bill not found.",
      });
    }

    return res.status(200).json({
      message: "Recurring bill deleted successfully.",
    });
  } catch (error) {
    console.error("Delete recurring bill error:", error);

    return res.status(500).json({
      message: "Unable to delete recurring bill.",
    });
  }
});

module.exports = router;
