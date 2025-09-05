const mongoose = require("mongoose");

const automationSchema = new mongoose.Schema({
  board: { type: mongoose.Schema.Types.ObjectId, ref: "Board", required: true },
  name: { type: String, required: true },
  trigger: {
    type: { type: String, enum: ["card_moved", "card_completed", "due_date", "member_added", "comment_added"], required: true },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  conditions: [
    {
      field: { type: String, enum: ["label", "member", "dueDate"] },
      operator: { type: String, enum: ["equals", "contains", "greaterThan"] },
      value: { type: mongoose.Schema.Types.Mixed },
    },
  ],
  actions: [
    {
      type: { type: String, enum: ["move_card", "add_label", "send_notification", "add_checklist"], required: true },
      details: { type: mongoose.Schema.Types.Mixed },
    },
  ],
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

module.exports = mongoose.model("Automation", automationSchema);