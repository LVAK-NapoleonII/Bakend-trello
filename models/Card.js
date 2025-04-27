const mongoose = require("mongoose");
const checklistSchema = require("./Checklist");
const commentSchema = require("./Comment");
const noteSchema = require("./Note");

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
    checklists: [checklistSchema],
    comments: [commentSchema],
    notes: [noteSchema],
    activities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Activity", default: [] }],
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Card", cardSchema);