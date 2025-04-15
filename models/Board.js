const mongoose = require("mongoose");

const boardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    background: { type: String },
    visibility: { type: String, enum: ["public", "private"], default: "public" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    listOrderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "List" }],
    invitedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

// Tạo index để tối ưu truy vấn
boardSchema.index({ workspace: 1, owner: 1 });
boardSchema.index({ members: 1 });

module.exports = mongoose.model("Board", boardSchema);