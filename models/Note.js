// noteSchema.js
const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema({
  content: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false }, 
});

module.exports = noteSchema;