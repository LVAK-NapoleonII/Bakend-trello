// jobs/inactiveUserCleanup.js
const cron = require("node-cron");
const User = require("../models/User");
const Activity = require("../models/Activity");
const sendEmail = require("../utils/sendEmail");

// Chạy mỗi ngày lúc 2:00 AM
const scheduleInactiveUserCleanup = () => {
  cron.schedule("0 2 * * *", async () => {
    console.log("[CRON] Running inactive user cleanup job...");

    try {
      // 1. Gửi thông báo cho users không hoạt động > 90 ngày
      await sendInactivityNotices();

      // 2. Xóa users đã được thông báo và hết thời hạn
      await deleteScheduledUsers();

      console.log("[CRON] Inactive user cleanup completed");
    } catch (error) {
      console.error("[CRON] Error in inactive user cleanup:", error.message);
    }
  });

  console.log("[CRON] Inactive user cleanup job scheduled (daily at 2:00 AM)");
};

// Gửi thông báo cho users không hoạt động
const sendInactivityNotices = async () => {
  const inactiveDate = new Date();
  inactiveDate.setDate(inactiveDate.getDate() - 90);

  const users = await User.find({
    lastActive: { $lt: inactiveDate },
    isHidden: false,
    inactiveNoticeSent: false,
  });

  let sentCount = 0;
  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + 7); // Xóa sau 7 ngày

  for (const user of users) {
    try {
      await sendEmail({
        to: user.email,
        subject: " Thông báo tài khoản không hoạt động",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #0079bf; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f4f5f7; }
              .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
              .button { display: inline-block; padding: 12px 24px; background-color: #0079bf; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>APP TEAM</h1>
              </div>
              <div class="content">
                <h2> Tài khoản của bạn đang không hoạt động</h2>
                <p>Xin chào <strong>${user.fullName}</strong>,</p>
                
                <p>Chúng tôi nhận thấy tài khoản của bạn (<strong>${user.email}</strong>) đã không hoạt động trong hơn <strong>90 ngày</strong>.</p>
                
                <div class="warning">
                  <strong> Cảnh báo quan trọng:</strong><br>
                  Nếu bạn không đăng nhập trong vòng <strong>7 ngày</strong> tới, tài khoản của bạn sẽ bị xóa vào ngày <strong>${deletionDate.toLocaleDateString("vi-VN")}</strong>.
                </div>

                <p>Để giữ tài khoản và tất cả dữ liệu của bạn, vui lòng:</p>
                <ul>
                  <li>Đăng nhập vào hệ thống</li>
                  <li>Hoặc trả lời email này nếu bạn cần hỗ trợ</li>
                </ul>

                <center>
                  <a href="${process.env.FRONTEND_URL}/login" class="button">Đăng nhập ngay</a>
                </center>

                <p>Nếu bạn không muốn tiếp tục sử dụng tài khoản, bạn không cần làm gì cả.</p>
              </div>
              <div class="footer">
                <p>Đây là email tự động, vui lòng không trả lời.</p>
                <p>&copy; 2025 APP TEAM. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      user.inactiveNoticeSent = true;
      user.scheduledDeletion = deletionDate;
      await user.save();

      console.log(`[CRON] Sent inactivity notice to ${user.email}`);
      sentCount++;
    } catch (emailError) {
      console.error(`[CRON] Failed to send email to ${user.email}:`, emailError.message);
    }
  }

  console.log(`[CRON] Sent inactivity notices to ${sentCount}/${users.length} users`);
  return sentCount;
};

// Xóa users đã hết hạn
const deleteScheduledUsers = async () => {
  const now = new Date();

  const users = await User.find({
    scheduledDeletion: { $lte: now },
    isHidden: false,
    inactiveNoticeSent: true,
  });

  let deletedCount = 0;

  for (const user of users) {
    try {
      // Soft delete
      user.isHidden = true;
      user.isOnline = false;
      await user.save();

      // Log activity
      const activity = new Activity({
        user: user._id,
        action: { category: "user", type: "auto_deleted_inactive" },
        target: user._id,
        targetModel: "User",
        details: `User ${user.fullName} automatically deleted due to 90+ days of inactivity`,
      });
      await activity.save();

      // Gửi email thông báo đã xóa
      await sendEmail({
        to: user.email,
        subject: "Tài khoản đã bị xóa do không hoạt động",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #eb5a46; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f4f5f7; }
              .info-box { background-color: #fff; border: 1px solid #ddd; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Tài khoản đã bị xóa</h1>
              </div>
              <div class="content">
                <p>Xin chào <strong>${user.fullName}</strong>,</p>
                
                <p>Tài khoản của bạn (<strong>${user.email}</strong>) đã bị xóa do không hoạt động trong hơn 90 ngày.</p>
                
                <div class="info-box">
                  <h3>Thông tin:</h3>
                  <ul>
                    <li><strong>Email:</strong> ${user.email}</li>
                    <li><strong>Lần hoạt động cuối:</strong> ${user.lastActive.toLocaleDateString("vi-VN")}</li>
                    <li><strong>Ngày xóa:</strong> ${now.toLocaleDateString("vi-VN")}</li>
                  </ul>
                </div>

                <p>Nếu bạn muốn khôi phục tài khoản hoặc có bất kỳ thắc mắc nào, vui lòng liên hệ với chúng tôi qua email: <strong>${process.env.EMAIL_USER}</strong></p>

                <p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.</p>
              </div>
              <div class="footer">
                <p>&copy; 2025 APP TEAM. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      console.log(`[CRON] Deleted inactive user: ${user.email}`);
      deletedCount++;
    } catch (error) {
      console.error(`[CRON] Failed to delete user ${user.email}:`, error.message);
    }
  }

  console.log(`[CRON] Deleted ${deletedCount}/${users.length} inactive users`);
  return deletedCount;
};

module.exports = {
  scheduleInactiveUserCleanup,
  sendInactivityNotices,
  deleteScheduledUsers,
};