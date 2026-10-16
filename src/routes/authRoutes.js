const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Resend } = require("resend");
const User = require("../models/User");

const router = express.Router();

const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;

function createToken(userId) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing.");
  }

  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function formatUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function isValidEmail(email) {
  return (
    typeof email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  );
}

function isValidPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    Buffer.byteLength(password, "utf8") <= 72
  );
}

function clearResetToken(user) {
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
}

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (
      typeof name !== "string" ||
      !isValidEmail(email) ||
      !isValidPassword(password)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid name, email and password.",
      });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedName.length < 2 || normalizedName.length > 60) {
      return res.status(400).json({
        success: false,
        message: "Name must contain between 2 and 60 characters.",
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      authProvider: "local",
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token: createToken(user._id.toString()),
      user: formatUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to register right now.",
    });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!isValidEmail(email) || typeof password !== "string" || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      authProvider: "local",
    }).select("+passwordHash");

    if (
      !user ||
      !user.passwordHash ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token: createToken(user._id.toString()),
      user: formatUser(user),
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to log in right now.",
    });
  }
});

// FORGOT PASSWORD
router.post("/forgot-password", async (req, res) => {
  const genericMessage =
    "If an account exists for that email, password reset instructions will be sent.";

  try {
    const { email } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(200).json({
        success: true,
        message: genericMessage,
      });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY is missing.");

      return res.status(503).json({
        success: false,
        message: "Password reset email is temporarily unavailable.",
      });
    }

    const resetBaseUrl = process.env.PASSWORD_RESET_URL;

    let resetUrl;

    try {
      resetUrl = new URL(resetBaseUrl);

      if (
        !["http:", "https:"].includes(resetUrl.protocol) ||
        resetUrl.username ||
        resetUrl.password
      ) {
        throw new Error("Invalid reset URL.");
      }
    } catch {
      console.error("PASSWORD_RESET_URL is missing or invalid.");

      return res.status(503).json({
        success: false,
        message: "Password reset is temporarily unavailable.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
      $or: [
        { authProvider: "local" },
        {
          authProvider: { $exists: false },
          passwordHash: { $exists: true },
        },
      ],
    }).select("+passwordHash");

    if (!user) {
      // Generic response avoids disclosing account existence.
      return res.status(200).json({
        success: true,
        message: genericMessage,
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpires = new Date(
      Date.now() + RESET_TOKEN_EXPIRY_MS,
    );
    user.authProvider = "local";

    await user.save();

    resetUrl.searchParams.set("token", rawToken);

    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL ||
        "Persona AI <onboarding@resend.dev>",
      to: [normalizedEmail],
      subject: "Reset your Persona AI password",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033;line-height:1.6">
          <h2>Reset your Persona AI password</h2>
          <p>We received a request to reset your account password.</p>
          <p>
            <a
              href="${resetUrl.toString()}"
              style="display:inline-block;background:#208AEF;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px"
            >
              Reset password
            </a>
          </p>
          <p>This link expires in 15 minutes and can only be used once.</p>
          <p>If you did not request a reset, ignore this email.</p>
        </div>
      `,
    });

    if (error || !data?.id) {
      clearResetToken(user);
      await user.save();

      console.error(
        "Resend rejected password-reset email:",
        error?.message || "No email ID returned.",
      );

      return res.status(503).json({
        success: false,
        message: "Unable to send the reset email. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: genericMessage,
    });
  } catch (error) {
    console.error("Password-reset request failed:", error.message);

    return res.status(503).json({
      success: false,
      message: "Unable to send password-reset instructions right now.",
    });
  }
});

// RESET PASSWORD
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(token) ||
      !isValidPassword(password)
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid reset token and an 8–72 character password are required.",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
      authProvider: "local",
    }).select("+passwordResetTokenHash +passwordResetExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "The reset link is invalid or expired. Request a new one.",
      });
    }

    user.passwordHash = await bcrypt.hash(password, 12);

    clearResetToken(user);

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. Please log in again.",
    });
  } catch (error) {
    console.error("Password reset failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to reset the password right now.",
    });
  }
});

module.exports = router;
