const mongoose = require("mongoose");
const boardSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  background: { type: String },
  visibility: { type: String, enum: ["public", "private"], default: "public" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  members: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      isActive: { type: Boolean, default: true }, 
    },
  ],
  listOrderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "List" }],
  invitedUsers: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      isActive: { type: Boolean, default: true },
    },
  ],
  automations: [{ type: mongoose.Schema.Types.ObjectId, ref: "Automation" }],
  joinRequests: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    },
  ],
  activities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Activity" }], 
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });
boardSchema.index({ workspace: 1, owner: 1 });
module.exports = mongoose.model("Board", boardSchema);