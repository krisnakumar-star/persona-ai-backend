
const mongoose = require("mongoose");

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing from the .env file.");
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
  } catch (error) {
    throw new Error(`MongoDB connection failed: ${error.message}`);
  }

  console.log("Persona AI connected to MongoDB Atlas.");
}

module.exports = connectDB;
