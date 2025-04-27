const mongoose = require("mongoose");

const checklistItemSchema = new mongoose.Schema({
  text: String,
  completed: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false }, 
});

const checklistSchema = new mongoose.Schema({
  title: String,
  items: [checklistItemSchema],
  isDeleted: { type: Boolean, default: false }, 
});

module.exports = checklistSchema;