const cron = require("node-cron");
const User = require("../models/User");
const Activity = require("../models/Activity");

// Chạy mỗi 1 giờ để kiểm tra và tự động unban
const scheduleAutoUnban = () => {
  cron.schedule("0 * * * *", async () => {
    console.log("[CRON] Checking for expired bans...");

    try {
      const now = new Date();

      // Tìm users bị ban có thời hạn và đã hết hạn
      const expiredBans = await User.find({
        isBanned: true,
        banExpiresAt: { $lte: now, $ne: null }
      });

      if (expiredBans.length === 0) {
        console.log("[CRON] No expired bans found");
        return;
      }

      let unbanCount = 0;

      for (const user of expiredBans) {
        try {
          user.isBanned = false;
          user.banReason = null;
          user.bannedAt = null;
          user.banExpiresAt = null;
          await user.save();

          // Ghi log activity
          const activity = new Activity({
            user: user._id,
            action: { category: "user", type: "auto_unbanned" },
            target: user._id,
            targetModel: "User",
            details: `User ${user.fullName} automatically unbanned after ban period expired`
          });
          await activity.save();

          console.log(`[CRON] Auto-unbanned user: ${user.email}`);
          unbanCount++;
        } catch (err) {
          console.error(`[CRON] Failed to unban ${user.email}:`, err.message);
        }
      }

      console.log(`[CRON] Auto-unbanned ${unbanCount}/${expiredBans.length} users`);
    } catch (error) {
      console.error("[CRON] Error in auto-unban job:", error.message);
    }
  });

  console.log("[CRON] Auto-unban job scheduled (hourly)");
};

module.exports = { scheduleAutoUnban };