const mongoose = require("mongoose");
const checklistSchema = require("./Checklist");

const labelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  color: { type: String, default: "#b6c2cf" },
});

const attachmentSchema = new mongoose.Schema({
  type: { type: String, enum: ["google_drive", "local", "other"], required: true },
  url: { type: String, required: true },
  fileId: { type: String },
  name: { type: String, required: true },
  mimeType: { type: String },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false },
});

const cardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    list: { type: mongoose.Schema.Types.ObjectId, ref: "List", required: true },
    board: { type: mongoose.Schema.Types.ObjectId, ref: "Board", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],
    cover: { type: String },
    dueDate: { type: Date },
    completed: { type: Boolean, default: false },
    position: { type: Number, default: 0 },
    labels: [labelSchema],
    attachments: [attachmentSchema],
    checklists: [checklistSchema],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: [] }],
    notes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Note", default: [] }],
    activities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Activity", default: [] }],
    isDeleted: { type: Boolean, default: false },
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

cardSchema.index({ board: 1, isDeleted: 1, position: 1 });
cardSchema.index({ list: 1, isDeleted: 1, position: 1 });
cardSchema.index({ list: 1, board: 1, dueDate: 1, completed: 1 });
cardSchema.index({ members: 1 });
cardSchema.index({ "labels.name": 1 });

module.exports = mongoose.model("Card", cardSchema);