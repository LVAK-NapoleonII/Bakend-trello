const mongoose = require("mongoose"); 
const Card = require("../models/Card");

// Tạo thẻ mới
const createCard = async (req, res) => {
  try {
    const { title, description, list, board } = req.body;

    // Kiểm tra req.user.id
    if (!req.user || !req.user.id) { 
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    // Kiểm tra title, list, và board
    if (!title || !list || !board) { 
      return res.status(400).json({ message: "Title, list, và board là bắt buộc!" });
    }

    // Kiểm tra list và board có phải ObjectId hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(list)) { 
      return res.status(400).json({ message: "List ID không hợp lệ!" });
    }
    if (!mongoose.Types.ObjectId.isValid(board)) { 
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }

    const card = await Card.create({
      title,
      description,
      list,
      board,
      members: [req.user.id], 
    });
    res.status(201).json(card);
  } catch (err) {
    res.status(500).json({ message: "Lỗi tạo thẻ", error: err.message }); 
  }
};

// Lấy danh sách thẻ trong list
const getCardsByList = async (req, res) => {
  try {
    const listId = req.params.listId;

    // Kiểm tra listId
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(400).json({ message: "List ID không hợp lệ!" });
    }

    const cards = await Card.find({ list: listId }).sort("position");
    res.status(200).json(cards);
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy thẻ", error: err.message });
  }
};

// Cập nhật thẻ
const updateCard = async (req, res) => {
  try {
    const card = await Card.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!card) { 
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }
    res.status(200).json(card);
  } catch (err) {
    res.status(500).json({ message: "Lỗi cập nhật thẻ", error: err.message });
  }
};

// Xoá thẻ
const deleteCard = async (req, res) => {
  try {
    const card = await Card.findByIdAndDelete(req.params.id);
    if (!card) { 
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }
    res.status(200).json({ message: "Đã xoá thẻ" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi xoá thẻ", error: err.message }); 
  }
};

// Thêm bình luận
const addComment = async (req, res) => {
  const { cardId } = req.params;
  const { text } = req.body;

  try {
    // Kiểm tra req.user.id
    if (!req.user || !req.user.id) { 
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    // Kiểm tra text
    if (!text) { 
      return res.status(400).json({ message: "Text là bắt buộc!" });
    }

    // Kiểm tra cardId
    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const card = await Card.findById(cardId);
    if (!card) { 
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    const comment = {
      user: req.user.id, 
      text,
    };

    card.comments.push(comment);
    await card.save();

    const updatedCard = await Card.findById(cardId).populate("comments.user", "email");
    res.status(200).json(updatedCard.comments);
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi thêm bình luận", error: err.message }); 
  }
};

// Thêm ghi chú
const addNote = async (req, res) => {
  const { cardId } = req.params;
  const { content } = req.body;

  try {
    // Kiểm tra req.user.id
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    // Kiểm tra content
    if (!content) { 
      return res.status(400).json({ message: "Content là bắt buộc!" });
    }

    // Kiểm tra cardId
    if (!mongoose.Types.ObjectId.isValid(cardId)) { 
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const card = await Card.findById(cardId);
    if (!card) { 
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    const note = {
      content,
      createdBy: req.user.id, 
    };

    card.notes.push(note);
    await card.save();

    res.status(200).json(card.notes);
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi thêm ghi chú", error: err.message }); 
  }
};

// Thêm checklist
const addChecklist = async (req, res) => {
  const { cardId } = req.params;
  const { title } = req.body;

  try {
    // Kiểm tra title
    if (!title) { 
      return res.status(400).json({ message: "Title là bắt buộc!" });
    }

    // Kiểm tra cardId
    if (!mongoose.Types.ObjectId.isValid(cardId)) { 
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const card = await Card.findById(cardId);
    if (!card) { 
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    const checklist = {
      title,
      items: [],
    };

    card.checklists.push(checklist);
    await card.save();

    res.status(200).json(card.checklists);
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi thêm checklist", error: err.message }); 
  }
};

// Thêm item vào checklist
const addChecklistItem = async (req, res) => {
  const { cardId, checklistIndex } = req.params;
  const { text } = req.body;

  try {
    // Kiểm tra text
    if (!text) {
      return res.status(400).json({ message: "Text là bắt buộc!" });
    }

    // Kiểm tra cardId
    if (!mongoose.Types.ObjectId.isValid(cardId)) { 
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    // Kiểm tra checklistIndex
    const index = parseInt(checklistIndex);
    if (isNaN(index) || index < 0) { 
      return res.status(400).json({ message: "Checklist index không hợp lệ!" });
    }

    const card = await Card.findById(cardId);
    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ!" });

    // Kiểm tra checklist tồn tại
    if (!card.checklists[index]) {
      return res.status(404).json({ message: "Không tìm thấy checklist!" });
    }

    card.checklists[index].items.push({ text });
    await card.save();

    res.status(200).json(card.checklists);
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi thêm item vào checklist", error: err.message }); 
  }
};

// Export đồng bộ 1 lần
module.exports = {
  createCard,
  getCardsByList,
  updateCard,
  deleteCard,
  addComment,
  addNote,
  addChecklist,
  addChecklistItem,
};