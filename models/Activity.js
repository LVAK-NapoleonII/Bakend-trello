const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: {
      category: {
        type: String,
        enum: ["workspace", "board", "list", "card", "checklist", "comment", "note", "member"],
        required: true,
      },
      type: { type: String, required: true }, 
    },
    target: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "targetModel",
      required: true,
    },
    targetModel: {
      type: String,
      enum: ["Workspace", "Board", "List", "Card"],
      required: true,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    details: { type: String },
    changes: {
      field: { type: String },
      oldValue: { type: mongoose.Schema.Types.Mixed },
      newValue: { type: mongoose.Schema.Types.Mixed },
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Activity", activitySchema);