const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema({
  content: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  card: { type: mongoose.Schema.Types.ObjectId, ref: "Card", required: true },
  createdAt: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Note", noteSchema);