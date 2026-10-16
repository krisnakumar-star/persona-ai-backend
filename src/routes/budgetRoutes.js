const express = require("express");
const Budget = require("../models/Budget");
const Expense = require("../models/Expense");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

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

const DEFAULT_CATEGORIES = Object.keys(DEFAULT_CATEGORY_BUDGETS);

function getUserId(req) {
  return req.user?.id || req.user?._id || req.user?.userId;
}

function normalizeCategoryName(name) {
  if (typeof name !== "string") return "";
  return name.trim().replace(/\s+/g, " ");
}

function validAmount(amount) {
  return (
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    amount >= 0
  );
}

function serializeBudget(budget) {
  return {
    monthlyBudget: budget.monthlyBudget,
    categoryBudgets: {
      ...DEFAULT_CATEGORY_BUDGETS,
      ...(budget.categoryBudgets || {}),
    },
    categories: Array.isArray(budget.categories)
      ? budget.categories
      : [...DEFAULT_CATEGORIES],
  };
}

async function getOrCreateBudget(userId) {
  let budget = await Budget.findOne({ user: userId });

  if (!budget) {
    budget = await Budget.create({
      user: userId,
      monthlyBudget: 15000,
      categoryBudgets: { ...DEFAULT_CATEGORY_BUDGETS },
      categories: [...DEFAULT_CATEGORIES],
    });
  } else {
    const categories = Array.isArray(budget.categories)
      ? [...budget.categories]
      : [];

    const categoryBudgets = {
      ...DEFAULT_CATEGORY_BUDGETS,
      ...(budget.categoryBudgets || {}),
    };

    for (const category of DEFAULT_CATEGORIES) {
      if (!categories.includes(category)) {
        categories.push(category);
      }
    }

    for (const category of Object.keys(categoryBudgets)) {
      if (!categories.includes(category)) {
        categories.push(category);
      }
    }

    budget.categories = categories;
    budget.categoryBudgets = categoryBudgets;
    await budget.save();
  }

  return budget;
}

function validCategoryName(name) {
  return name.length > 0 && name.length <= 40;
}

// GET /api/budgets
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const budget = await getOrCreateBudget(userId);

    return res.json({
      success: true,
      budget: serializeBudget(budget),
    });
  } catch (error) {
    console.error("Get budgets error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load budgets.",
    });
  }
});

// PUT /api/budgets
router.put("/", authMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const { monthlyBudget, categoryBudgets } = req.body;
    const budget = await getOrCreateBudget(userId);

    if (monthlyBudget !== undefined) {
      if (!validAmount(monthlyBudget)) {
        return res.status(400).json({
          success: false,
          message: "Monthly budget must be a valid non-negative number.",
        });
      }

      budget.monthlyBudget = monthlyBudget;
    }

    if (
      categoryBudgets !== undefined &&
      (!categoryBudgets ||
        typeof categoryBudgets !== "object" ||
        Array.isArray(categoryBudgets))
    ) {
      return res.status(400).json({
        success: false,
        message: "Category budgets must be an object.",
      });
    }

    if (categoryBudgets) {
      for (const [category, amount] of Object.entries(categoryBudgets)) {
        if (!budget.categories.includes(category)) {
          return res.status(400).json({
            success: false,
            message: `Unknown category: ${category}. Add it first.`,
          });
        }

        if (!validAmount(amount)) {
          return res.status(400).json({
            success: false,
            message: `Invalid budget amount for ${category}.`,
          });
        }
      }

      budget.categoryBudgets = {
        ...budget.categoryBudgets,
        ...categoryBudgets,
      };
    }

    await budget.save();

    return res.json({
      success: true,
      message: "Budgets saved successfully.",
      budget: serializeBudget(budget),
    });
  } catch (error) {
    console.error("Update budgets error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to save budgets.",
    });
  }
});

// POST /api/budgets/categories
router.post("/categories", authMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req);
    const name = normalizeCategoryName(req.body.name);
    const amount = req.body.amount === undefined ? 0 : req.body.amount;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!validCategoryName(name)) {
      return res.status(400).json({
        success: false,
        message: "Category name must contain 1–40 characters.",
      });
    }

    if (!validAmount(amount)) {
      return res.status(400).json({
        success: false,
        message: "Category budget must be non-negative.",
      });
    }

    const budget = await getOrCreateBudget(userId);

    if (
      budget.categories.some(
        (category) => category.toLowerCase() === name.toLowerCase(),
      )
    ) {
      return res.status(409).json({
        success: false,
        message: "This category already exists.",
      });
    }

    budget.categories.push(name);
    budget.categoryBudgets = {
      ...budget.categoryBudgets,
      [name]: amount,
    };

    await budget.save();

    return res.status(201).json({
      success: true,
      message: "Category created successfully.",
      budget: serializeBudget(budget),
    });
  } catch (error) {
    console.error("Create category error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create category.",
    });
  }
});

// PATCH /api/budgets/categories/:name
router.patch("/categories/:name", authMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req);
    const oldName = normalizeCategoryName(req.params.name);
    const newName = normalizeCategoryName(req.body.name);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!validCategoryName(newName)) {
      return res.status(400).json({
        success: false,
        message: "Category name must contain 1–40 characters.",
      });
    }

    const budget = await getOrCreateBudget(userId);

    if (!budget.categories.includes(oldName)) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    if (
      budget.categories.some(
        (category) =>
          category.toLowerCase() === newName.toLowerCase() &&
          category !== oldName,
      )
    ) {
      return res.status(409).json({
        success: false,
        message: "A category with that name already exists.",
      });
    }

    if (oldName !== newName) {
      // Update existing expenses belonging to this user.
      await Expense.updateMany(
        { user: userId, category: oldName },
        { $set: { category: newName } },
      );

      budget.categories = budget.categories.map((category) =>
        category === oldName ? newName : category,
      );

      const updatedBudgets = { ...budget.categoryBudgets };
      updatedBudgets[newName] = updatedBudgets[oldName] ?? 0;
      delete updatedBudgets[oldName];
      budget.categoryBudgets = updatedBudgets;
    }

    await budget.save();

    return res.json({
      success: true,
      message: "Category renamed successfully.",
      budget: serializeBudget(budget),
    });
  } catch (error) {
    console.error("Rename category error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to rename category.",
    });
  }
});

// DELETE /api/budgets/categories/:name
router.delete("/categories/:name", authMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req);
    const name = normalizeCategoryName(req.params.name);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const budget = await getOrCreateBudget(userId);

    if (!budget.categories.includes(name)) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    if (DEFAULT_CATEGORIES.includes(name)) {
      return res.status(400).json({
        success: false,
        message: "Default categories cannot be deleted.",
      });
    }

    const existingExpense = await Expense.exists({
      user: userId,
      category: name,
    });

    if (existingExpense) {
      return res.status(409).json({
        success: false,
        message:
          "This category has existing expenses. Reassign or delete those expenses before deleting the category.",
      });
    }

    budget.categories = budget.categories.filter(
      (category) => category !== name,
    );

    const updatedBudgets = { ...budget.categoryBudgets };
    delete updatedBudgets[name];
    budget.categoryBudgets = updatedBudgets;

    await budget.save();

    return res.json({
      success: true,
      message: "Category deleted successfully.",
      budget: serializeBudget(budget),
    });
  } catch (error) {
    console.error("Delete category error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete category.",
    });
  }
});

module.exports = router;
