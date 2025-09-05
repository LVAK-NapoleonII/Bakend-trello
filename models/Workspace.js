const mongoose = require("mongoose");

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    background: { type: String, default: "#ffffff" },
    isPublic: { type: Boolean, default: false },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    activities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Activity" }],
    joinRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Thêm index
workspaceSchema.index({ members: 1 });
workspaceSchema.index({ owner: 1 });
workspaceSchema.index({ activities: 1 });

module.exports = mongoose.model("Workspace", workspaceSchema);