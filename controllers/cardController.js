const mongoose = require("mongoose"); 
const Card = require("../models/Card");
const List = require("../models/List");
const Board = require("../models/Board");

// Tạo thẻ mới
const createCard = async (req, res) => {
  try {
    const { title, description, list, board } = req.body;

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!title || !list || !board) {
      return res.status(400).json({ message: "Title, list, và board là bắt buộc!" });
    }

    if (!mongoose.Types.ObjectId.isValid(list)) {
      return res.status(400).json({ message: "List ID không hợp lệ!" });
    }
    if (!mongoose.Types.ObjectId.isValid(board)) {
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }

    const listExists = await List.findById(list); // Dòng này cũng có thể gây lỗi nếu List không được định nghĩa
    if (!listExists) {
      return res.status(404).json({ message: "List không tồn tại!" });
    }

    const boardExists = await Board.findById(board);
    if (!boardExists) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    if (listExists.board.toString() !== board) {
      return res.status(400).json({ message: "List không thuộc board này!" });
    }

    if (!boardExists.members.includes(req.user.id)) {
      return res.status(403).json({ message: "Bạn không có quyền tạo thẻ trong board này!" });
    }

    const cardsInList = await Card.find({ list }).sort({ position: -1 }).limit(1);
    const newPosition = cardsInList.length > 0 ? cardsInList[0].position + 1 : 0;

    const card = await Card.create({
      title,
      description,
      list,
      board,
      members: [req.user.id],
      position: newPosition,
    });

    listExists.cardOrderIds.push(card._id);
    await listExists.save();

    const populatedCard = await Card.findById(card._id).populate("members", "email");
    res.status(201).json(populatedCard);
  } catch (err) {
    res.status(500).json({ message: "Lỗi tạo thẻ", error: err.message });
  }
};
// Lấy danh sách thẻ trong list
const getCardsByList = async (req, res) => {
  try {
    const listId = req.params.listId;

    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(400).json({ message: "List ID không hợp lệ!" });
    }

    const listExists = await List.findById(listId);
    if (!listExists) {
      return res.status(404).json({ message: "List không tồn tại!" });
    }

    const cards = await Card.find({ list: listId })
      .populate("members", "email")
      .populate("comments.user", "email")
      .populate("notes.createdBy", "email"); // Thêm populate cho createdBy trong notes

    // Sắp xếp thẻ theo cardOrderIds
    const orderedCards = listExists.cardOrderIds
      .map((cardId) => cards.find((card) => card._id.toString() === cardId.toString()))
      .filter((card) => card);

    res.status(200).json(orderedCards);
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy thẻ", error: err.message });
  }
};
// Cập nhật thẻ
const updateCard = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    const card = await Card.findById(req.params.id);
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    const board = await Board.findById(card.board);
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    if (!board.members.includes(req.user.id)) {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật thẻ này!" });
    }

    const updatedCard = await Card.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    )
      .populate("members", "email")
      .populate("comments.user", "email")
      .populate("notes.createdBy", "email");

    res.status(200).json(updatedCard);
  } catch (err) {
    res.status(500).json({ message: "Lỗi cập nhật thẻ", error: err.message });
  }
};

// Xoá thẻ
const deleteCard = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    const card = await Card.findById(req.params.id);
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    const board = await Board.findById(card.board);
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    if (!board.members.includes(req.user.id)) {
      return res.status(403).json({ message: "Bạn không có quyền xóa thẻ này!" });
    }

    // Xóa card khỏi cardOrderIds của list
    const list = await List.findById(card.list);
    if (list) {
      list.cardOrderIds = list.cardOrderIds.filter((id) => id.toString() !== card._id.toString());
      await list.save();
    }

    await Card.findByIdAndDelete(req.params.id);
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
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!content) {
      return res.status(400).json({ message: "Content là bắt buộc!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    const board = await Board.findById(card.board);
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    if (!board.members.includes(req.user.id)) {
      return res.status(403).json({ message: "Bạn không có quyền thêm ghi chú vào thẻ này!" });
    }

    const note = {
      content,
      createdBy: req.user.id,
    };

    card.notes.push(note);
    await card.save();

    const updatedCard = await Card.findById(cardId)
      .populate("notes.createdBy", "email") // Populate createdBy trong notes
      .populate("members", "email")
      .populate("comments.user", "email");
    res.status(200).json(updatedCard.notes);
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

// Di chuyển thẻ giữa các list
const moveCard = async (req, res) => {
  try {
    const { id } = req.params;
    const { newListId, newBoardId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }
    if (!mongoose.Types.ObjectId.isValid(newListId)) {
      return res.status(400).json({ message: "New List ID không hợp lệ!" });
    }
    if (!mongoose.Types.ObjectId.isValid(newBoardId)) {
      return res.status(400).json({ message: "New Board ID không hợp lệ!" });
    }

    const card = await Card.findById(id);
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    const newList = await List.findById(newListId);
    if (!newList) {
      return res.status(404).json({ message: "List đích không tồn tại!" });
    }

    const newBoard = await Board.findById(newBoardId);
    if (!newBoard) {
      return res.status(404).json({ message: "Board đích không tồn tại!" });
    }

    if (newList.board.toString() !== newBoardId) {
      return res.status(400).json({ message: "List không thuộc board này!" });
    }

    if (!newBoard.members.includes(req.user.id)) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập board này!" });
    }

    // Cập nhật list và board của card
    card.list = newListId;
    card.board = newBoardId;
    await card.save();

    res.status(200).json({ message: "Di chuyển thẻ thành công", card });
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi di chuyển thẻ", error: err.message });
  }
};

// Cập nhật thứ tự thẻ trong list
const updateCardOrder = async (req, res) => {
  try {
    const { listId } = req.params;
    const { cardOrder } = req.body;

    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(400).json({ message: "List ID không hợp lệ!" });
    }

    if (!Array.isArray(cardOrder)) {
      return res.status(400).json({ message: "Card order phải là một mảng!" });
    }

    const list = await List.findById(listId);
    if (!list) {
      return res.status(404).json({ message: "List không tồn tại!" });
    }

    // Cập nhật cardOrderIds
    list.cardOrderIds = cardOrder;
    await list.save();

    res.status(200).json({ message: "Cập nhật thứ tự thẻ thành công" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi cập nhật thứ tự thẻ", error: err.message });
  }
};

const addMember = async (req, res) => {
  try {
    const { cardId } = req.params;
    const { memberId } = req.body;

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ message: "Member ID không hợp lệ!" });
    }

    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    const board = await Board.findById(card.board);
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    if (!board.members.includes(req.user.id)) {
      return res.status(403).json({ message: "Bạn không có quyền thêm member vào thẻ này!" });
    }

    if (!board.members.includes(memberId)) {
      return res.status(400).json({ message: "Member không thuộc board này!" });
    }

    if (card.members.includes(memberId)) {
      return res.status(400).json({ message: "Member đã có trong thẻ!" });
    }

    card.members.push(memberId);
    await card.save();

    const updatedCard = await Card.findById(cardId).populate("members", "email");
    res.status(200).json(updatedCard);
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi thêm member", error: err.message });
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
  moveCard,
  addMember,
};