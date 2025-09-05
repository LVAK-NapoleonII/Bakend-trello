const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  card: { type: mongoose.Schema.Types.ObjectId, ref: "Card", required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Comment", commentSchema);