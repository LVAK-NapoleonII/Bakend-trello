// commentSchema.js
const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: String,
  createdAt: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false }, 
});

module.exports = commentSchema;