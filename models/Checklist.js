const mongoose = require("mongoose");

const checklistItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  completed: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const checklistSchema = new mongoose.Schema({
  title: { type: String, required: true },
  items: [checklistItemSchema],
  isDeleted: { type: Boolean, default: false },
});

module.exports = checklistSchema;