const mongoose = require("mongoose");
const Card = require("../models/Card");
const List = require("../models/List");
const Board = require("../models/Board");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");
const User = require("../models/User");

// Tạo thẻ mới
const createCard = async (req, res, io) => {
  try {
    const { title, description, list, board } = req.body;

    console.log("Received createCard request:", {
      title,
      list,
      board,
      userId: req.user?._id?.toString() || "unknown",
      time: new Date().toISOString(),
    });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin người dùng!" });
    }

    if (!title || !list || !board) {
      console.log("Missing required fields:", { title, list, board });
      return res.status(400).json({ message: "Title, list và board là bắt buộc!" });
    }

    if (typeof title !== "string") {
      console.log("Invalid title:", title);
      return res.status(400).json({ message: "Title phải là chuỗi!" });
    }

    if (description && typeof description !== "string") {
      console.log("Invalid description:", description);
      return res.status(400).json({ message: "Description phải là chuỗi!" });
    }

    if (!mongoose.Types.ObjectId.isValid(list)) {
      console.log("Invalid listId:", list);
      return res.status(400).json({ message: "List ID không hợp lệ!" });
    }
    if (!mongoose.Types.ObjectId.isValid(board)) {
      console.log("Invalid boardId:", board);
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }

    const listExists = await List.findOne({ _id: list, isDeleted: false });
    if (!listExists) {
      console.log("List not found or deleted:", list);
      return res.status(404).json({ message: "List không tồn tại hoặc đã bị ẩn!" });
    }

    const boardExists = await Board.findOne({ _id: board, isDeleted: false }).populate("members.user");
    if (!boardExists) {
      console.log("Board not found or deleted:", board);
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    if (listExists.board.toString() !== board) {
      console.log("List does not belong to board:", { list, board });
      return res.status(400).json({ message: "List không thuộc board này!" });
    }

    const isMember = boardExists.members.some(
      (m) => m.user && m.user._id.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền tạo thẻ trong board này!" });
    }

    const cardsInList = await Card.find({ list, isDeleted: false })
      .sort({ position: -1 })
      .limit(1);
    const newPosition = cardsInList.length > 0 ? cardsInList[0].position + 1 : 0;

    const card = await Card.create({
      title,
      description,
      list,
      board,
      members: [req.user._id],
      position: newPosition,
      isDeleted: false,
      activities: [],
      checklists: [],
    });

    listExists.cardOrderIds = listExists.cardOrderIds || [];
    if (!listExists.cardOrderIds.includes(card._id)) {
      listExists.cardOrderIds.push(card._id);
    }
    await listExists.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "card_created",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} created card "${title}" in list "${listExists.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    listExists.activities = listExists.activities || [];
    listExists.activities.push(activity._id);
    boardExists.activities = boardExists.activities || [];
    boardExists.activities.push(activity._id);
    await Promise.all([card.save(), listExists.save(), boardExists.save()]);

    const populatedCard = await Card.findById(card._id)
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName avatar")
      .populate("notes.createdBy", "email fullName avatar")
      .populate({ path: "activities", match: { isDeleted: false } });

    io.to(board.toString()).emit("card-created", {
      card: populatedCard,
      listId: list,
      message: `Card "${title}" đã được tạo bởi ${userName} trong list "${listExists.title}"`,
    });

    console.log("Card created successfully:", {
      cardId: card._id.toString(),
      listId: list,
      boardId: board,
    });

    return res.status(201).json(populatedCard);
  } catch (err) {
    console.error("Error in createCard:", {
      message: err.message,
      stack: err.stack,
      requestBody: req.body,
      userId: req.user?._id?.toString() || "unknown",
    });
    return res.status(500).json({ message: "Lỗi server khi tạo thẻ!", error: err.message });
  }
};

// Lấy danh sách thẻ trong list
const getCardsByList = async (req, res) => {
  try {
    const listId = req.params.listId;

    console.log("Fetching cards for list:", { listId, user: req.user?.email });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(listId)) {
      console.log("Invalid listId:", listId);
      return res.status(400).json({ message: "List ID không hợp lệ!" });
    }

    const listExists = await List.findOne({ _id: listId, isDeleted: false });
    if (!listExists) {
      console.log("List not found or deleted:", listId);
      return res.status(404).json({ message: "List không tồn tại hoặc đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: listExists.board, isDeleted: false });
    if (!board) {
      console.log("Board not found or deleted:", listExists.board.toString());
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền truy cập list này!" });
    }

    const cards = await Card.find({ list: listId, isDeleted: false })
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName avatar")
      .populate("notes.createdBy", "email fullName avatar")
      .populate({ path: "activities", match: { isDeleted: false } });

    const orderedCards = (listExists.cardOrderIds || [])
      .map((cardId) => cards.find((card) => card._id.toString() === cardId.toString()))
      .filter((card) => card);

    const remainingCards = cards.filter((card) => !listExists.cardOrderIds.includes(card._id));
    const finalCards = [...orderedCards, ...remainingCards];

    console.log("Found cards:", finalCards.map((c) => ({ id: c._id.toString(), title: c.title })));

    res.status(200).json(finalCards);
  } catch (err) {
    console.error("Error in getCardsByList:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi lấy thẻ", error: err.message });
  }
};

// Lấy thông tin thẻ theo ID
const getCardById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("Fetching card with ID:", id);

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log("Invalid cardId:", id);
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: id, isDeleted: false })
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName avatar")
      .populate("notes.createdBy", "email fullName avatar")
      .populate({ path: "activities", match: { isDeleted: false } });

    if (!card) {
      console.log("Card not found or deleted:", id);
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) {
      console.log("Board not found or deleted:", card.board.toString());
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền truy cập thẻ này!" });
    }

    console.log("Card found:", { id, title: card.title });

    return res.status(200).json(card);
  } catch (err) {
    console.error("Error in getCardById:", err.message, err.stack);
    return res.status(500).json({ message: "Lỗi khi lấy thông tin thẻ", error: err.message });
  }
};

// Cập nhật thẻ
const updateCard = async (req, res, io) => {
  try {
    const { id: cardId } = req.params;
    const { title, description } = req.body;

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false }).populate("members.user");
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user._id.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật thẻ!" });
    }

    if (title) card.title = title;
    if (description !== undefined) card.description = description;

    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "card_updated",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} updated card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    await card.save();

    const populatedCard = await Card.findById(cardId)
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName avatar")
      .populate("notes.createdBy", "email fullName avatar")
      .populate({ path: "activities", match: { isDeleted: false } });

    io.to(card.board.toString()).emit("card-updated", {
      card: populatedCard,
      message: `${userName} đã cập nhật card "${card.title}"`,
    });

    return res.status(200).json(populatedCard);
  } catch (err) {
    console.error("Error in updateCard:", err.message);
    return res.status(500).json({ message: "Lỗi khi cập nhật thẻ", error: err.message });
  }
};

// Xóa thẻ
const deleteCard = async (req, res, io) => {
  try {
    const { id: cardId } = req.params;

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false }).populate("members.user");
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user._id.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền xóa thẻ!" });
    }

    card.isDeleted = true;
    await card.save();

    const list = await List.findOne({ _id: card.list, isDeleted: false });
    if (list) {
      list.cardOrderIds = list.cardOrderIds.filter((id) => id.toString() !== cardId);
      await list.save();
    }

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "card_hidden",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} hid card "${card.title}"`,
    });
    await activity.save();

    io.to(card.board.toString()).emit("card-hidden", {
      cardId,
      listId: card.list,
      message: `${userName} đã ẩn card "${card.title}"`,
    });

    return res.status(200).json({ message: "Đã ẩn thẻ thành công" });
  } catch (err) {
    console.error("Error in deleteCard:", err.message);
    return res.status(500).json({ message: "Lỗi khi xóa thẻ", error: err.message });
  }
};

// Di chuyển thẻ giữa các list
const moveCard = async (req, res, io) => {
  let cardId;
  try {
    cardId = req.params.cardId;
    const { newListId, newBoardId, newPosition } = req.body;

    console.log("Received moveCard request:", {
      cardId,
      newListId,
      newBoardId,
      newPosition,
      user: req.user?.email,
      time: new Date().toISOString(),
    });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!cardId || typeof cardId !== "string") {
      console.log("CardId is missing or not a string:", { cardId });
      return res.status(400).json({ message: "Card ID bị thiếu hoặc không hợp lệ!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      console.log("Invalid cardId format:", { cardId });
      return res.status(400).json({ message: "Card ID không đúng định dạng ObjectId!" });
    }

    if (!mongoose.Types.ObjectId.isValid(newListId)) {
      console.log("Invalid newListId:", newListId);
      return res.status(400).json({ message: "New List ID không hợp lệ!" });
    }
    if (!mongoose.Types.ObjectId.isValid(newBoardId)) {
      console.log("Invalid newBoardId:", newBoardId);
      return res.status(400).json({ message: "New Board ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      console.log("Card not found or deleted:", cardId);
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    const newList = await List.findOne({ _id: newListId, isDeleted: false });
    if (!newList) {
      console.log("New list not found or deleted:", newListId);
      return res.status(404).json({ message: "List đích không tồn tại hoặc đã bị ẩn!" });
    }

    const newBoard = await Board.findOne({ _id: newBoardId, isDeleted: false }).populate("members.user");
    if (!newBoard) {
      console.log("New board not found or deleted:", newBoardId);
      return res.status(404).json({ message: "Board đích không tồn tại hoặc đã bị ẩn!" });
    }

    if (newList.board.toString() !== newBoardId) {
      console.log("List does not belong to board:", { newListId, newBoardId });
      return res.status(400).json({ message: "List không thuộc board này!" });
    }

    const isMember = newBoard.members.some(
      (m) => m.user && m.user._id.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền di chuyển thẻ đến board này!" });
    }

    const oldList = await List.findOne({ _id: card.list, isDeleted: false });
    const isSameList = oldList && oldList._id.toString() === newListId;

    let finalPosition = newPosition !== undefined ? newPosition : card.position;

    if (isSameList) {
      if (newPosition !== undefined) {
        oldList.cardOrderIds = oldList.cardOrderIds.filter(
          (id) => id.toString() !== cardId
        );
        if (newPosition >= oldList.cardOrderIds.length) {
          oldList.cardOrderIds.push(card._id);
          finalPosition = oldList.cardOrderIds.length - 1;
        } else {
          oldList.cardOrderIds.splice(newPosition, 0, card._id);
          finalPosition = newPosition;
        }
        await oldList.save();
      }
    } else {
      if (oldList) {
        oldList.cardOrderIds = oldList.cardOrderIds.filter(
          (id) => id.toString() !== cardId
        );
        await oldList.save();
      }

      newList.cardOrderIds = newList.cardOrderIds || [];
      if (newPosition !== undefined && newPosition < newList.cardOrderIds.length) {
        newList.cardOrderIds.splice(newPosition, 0, card._id);
        finalPosition = newPosition;
      } else {
        newList.cardOrderIds.push(card._id);
        finalPosition = newList.cardOrderIds.length - 1;
      }
      await newList.save();

      card.list = newListId;
      card.board = newBoardId;
    }

    card.position = finalPosition;
    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "card_moved",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} moved card "${card.title}" to list "${newList.title}"${
        isSameList ? " at position " + finalPosition : ""
      }`,
    });
    await activity.save();

    card.activities = card.activities || [];
    card.activities.push(activity._id);
    newBoard.activities = newBoard.activities || [];
    newBoard.activities.push(activity._id);

    for (const member of card.members) {
      if (member.toString() !== req.user._id.toString()) {
        const notification = new Notification({
          user: member,
          message: `${userName} đã di chuyển card "${card.title}" đến list "${newList.title}"`,
          type: "activity",
          target: card._id,
          targetModel: "Card",
        });
        await notification.save();
        io.to(member.toString()).emit("new-notification", notification);
      }
    }

    await Promise.all([card.save(), newBoard.save()]);

    const updatedCard = await Card.findById(cardId)
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName avatar")
      .populate("notes.createdBy", "email fullName avatar")
      .populate({ path: "activities", match: { isDeleted: false } });

    io.to(newBoardId).emit("card-moved", {
      card: updatedCard,
      oldListId: oldList ? oldList._id : null,
      newListId,
      newPosition: finalPosition,
      message: `${userName} đã di chuyển card "${card.title}" đến list "${newList.title}"`,
    });

    if (!isSameList && oldList) {
      io.to(card.board.toString()).emit("card-moved", {
        card: updatedCard,
        oldListId: oldList._id,
        newListId,
        newPosition: finalPosition,
        message: `${userName} đã di chuyển card "${card.title}" từ list "${oldList.title}"`,
      });
    }

    console.log("Card moved successfully:", {
      cardId,
      newListId,
      newBoardId,
      newPosition: finalPosition,
    });

    return res.status(200).json({
      message: "Di chuyển thẻ thành công",
      card: updatedCard,
    });
  } catch (err) {
    console.error("Error in moveCard:", {
      message: err.message,
      stack: err.stack,
      cardId: cardId || req.params.cardId,
      newListId: req.body.newListId,
      newBoardId: req.body.newBoardId,
      userId: req.user?._id?.toString(),
    });
    return res.status(500).json({
      message: "Lỗi khi di chuyển thẻ",
      error: err.message,
    });
  }
};

// Thêm thành viên vào thẻ
const addMember = async (req, res, io) => {
  try {
    const { cardId } = req.params;
    const { memberId } = req.body;

    console.log("Adding member to card:", { cardId, memberId, user: req.user?.email });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      console.log("Invalid cardId:", cardId);
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      console.log("Invalid memberId:", memberId);
      return res.status(400).json({ message: "Member ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      console.log("Card not found or deleted:", cardId);
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false }).populate("members.user");
    if (!board) {
      console.log("Board not found or deleted:", card.board.toString());
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user._id.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền thêm member vào thẻ này!" });
    }

    const isBoardMember = board.members.some(
      (m) => m.user && m.user._id.toString() === memberId && m.isActive
    );
    if (!isBoardMember) {
      console.log("Member not in board:", memberId);
      return res.status(400).json({ message: "Member không thuộc board này!" });
    }

    if (card.members.some((m) => m.toString() === memberId)) {
      console.log("Member already in card:", memberId);
      return res.status(400).json({ message: "Member đã có trong thẻ!" });
    }

    card.members.push(memberId);
    await card.save();

    const member = await User.findById(memberId);
    if (!member) {
      console.log("Member not found:", memberId);
      return res.status(404).json({ message: "Member không tồn tại!" });
    }

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const memberName = member.fullName || member.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "member_added",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} added ${memberName} to card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    const notification = new Notification({
      user: memberId,
      message: `Bạn đã được thêm vào card "${card.title}" bởi ${userName}`,
      type: "activity",
      target: card._id,
      targetModel: "Card",
    });
    await notification.save();
    io.to(memberId.toString()).emit("new-notification", notification);

    const updatedCard = await Card.findById(cardId)
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName avatar")
      .populate("notes.createdBy", "email fullName avatar")
      .populate({ path: "activities", match: { isDeleted: false } });

    io.to(card.board.toString()).emit("member-added", {
      cardId,
      member: {
        _id: member._id,
        fullName: member.fullName,
        email: member.email,
        avatar: member.avatar || '',
      },
      message: `${userName} đã thêm ${memberName} vào card "${card.title}"`,
    });

    console.log("Member added successfully:", { cardId, memberId });

    res.status(200).json(updatedCard);
  } catch (err) {
    console.error("Error in addMember:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi thêm member", error: err.message });
  }
};

// Xóa thành viên khỏi thẻ
const removeMemberFromCard = async (req, res, io) => {
  const { cardId, memberId } = req.params;

  try {
    console.log("Removing member from card:", { cardId, memberId, user: req.user?.email });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      console.log("Invalid cardId:", cardId);
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }
    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      console.log("Invalid memberId:", memberId);
      return res.status(400).json({ message: "Member ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      console.log("Card not found or deleted:", cardId);
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false }).populate("members.user");
    if (!board) {
      console.log("Board not found or deleted:", card.board?.toString());
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isOwner = board.owner && board.owner.toString() === req.user._id.toString();
    if (!isOwner) {
      console.log("Permission denied: User is not board owner:", req.user._id.toString());
      return res.status(403).json({ message: "Chỉ chủ phòng mới có quyền xóa thành viên khỏi card!" });
    }

    if (!Array.isArray(card.members)) {
      console.error("card.members is not an array:", card.members);
      return res.status(500).json({ message: "Dữ liệu card.members không hợp lệ!" });
    }

    const memberExists = card.members.some((m) => m && m.toString() === memberId);
    if (!memberExists) {
      console.log("Member not found in card:", memberId);
      return res.status(404).json({ message: "Thành viên không tồn tại trong card!" });
    }

    card.members = card.members.filter((m) => m && m.toString() !== memberId);
    await card.save();

    const member = await User.findById(memberId);
    const userName = req.user.fullName || req.user.email || "Unknown User";
    const memberName = member ? (member.fullName || member.email || "Unknown User") : "Unknown User";

    const activity = new Activity({
      user: req.user._id,
      action: "member_removed_from_card",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} removed ${memberName} from card "${card.title}"`,
    });
    await activity.save();
    card.activities = card.activities || [];
    card.activities.push(activity._id);
    board.activities = board.activities || [];
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    if (member) {
      const notification = new Notification({
        user: memberId,
        message: `Bạn đã bị xóa khỏi card "${card.title}" bởi ${userName}`,
        type: "activity",
        target: card._id,
        targetModel: "Card",
      });
      await notification.save();
      io.to(memberId.toString()).emit("new-notification", notification);
    }

    const updatedCard = await Card.findById(cardId)
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName avatar")
      .populate("notes.createdBy", "email fullName avatar")
      .populate({ path: "activities", match: { isDeleted: false } });

    io.to(card.board.toString()).emit("member-removed-from-card", {
      cardId,
      memberId,
      message: `${userName} đã xóa ${memberName} khỏi card "${card.title}"`,
    });

    console.log("Member removed from card successfully:", { cardId, memberId });

    res.status(200).json(updatedCard.members);
  } catch (err) {
    console.error("Error in removeMemberFromCard:", {
      message: err.message,
      stack: err.stack,
      cardId,
      memberId,
      userId: req.user?._id?.toString(),
      cardMembers: card?.members?.map((m) => m?.toString()) || "unknown",
    });
    res.status(500).json({ message: "Lỗi khi xóa thành viên khỏi card", error: err.message });
  }
};

// Đánh dấu hoàn thành/không hoàn thành thẻ
const toggleCardCompletion = async (req, res, io) => {
  try {
    const { id: cardId } = req.params;

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false }).populate("members.user");
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user._id.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật thẻ!" });
    }

    card.completed = !card.completed;
    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: card.completed ? "card_completed" : "card_uncompleted",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} ${card.completed ? "completed" : "uncompleted"} card "${card.title}"`,
    });
    await activity.save();
    card.activities = card.activities || [];
    card.activities.push(activity._id);
    await card.save();

    io.to(card.board.toString()).emit("card-completion-toggled", {
      cardId,
      completed: card.completed,
      message: `${userName} đã ${card.completed ? "hoàn thành" : "bỏ hoàn thành"} card "${card.title}"`,
    });

    return res.status(200).json({
      message: "Cập nhật trạng thái thành công",
      card: {
        _id: card._id,
        title: card.title,
        completed: card.completed,
      },
    });
  } catch (err) {
    console.error("Error in toggleCardCompletion:", err.message);
    return res.status(500).json({ message: "Lỗi khi cập nhật trạng thái", error: err.message });
  }
};

module.exports = {
  createCard,
  getCardsByList,
  getCardById,
  updateCard,
  deleteCard,
  moveCard,
  addMember,
  removeMemberFromCard,
  toggleCardCompletion,
};