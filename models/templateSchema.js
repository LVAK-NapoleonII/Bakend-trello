const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  lists: [
    {
      title: { type: String, required: true },
      cards: [
        {
          title: { type: String, required: true },
          description: { type: String },
          labels: [
            {
              name: { type: String, required: true },
              color: { type: String, default: "#b6c2cf" },
            },
          ],
          checklists: [
            {
              title: { type: String, required: true },
              items: [
                {
                  title: { type: String, required: true },
                  content: { type: String, required: true },
                  completed: { type: Boolean, default: false },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isPublic: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Template", templateSchema);