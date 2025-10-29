// scripts/migrateUsers.js
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");


const migrateUsers = async () => {
  try {
    console.log(" Starting user migration...");
    console.log(" Connecting to MongoDB...");
    
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in .env file!");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB successfully");

    // 1. Cập nhật tất cả users hiện tại
    console.log("\n Updating existing users...");
    const updateResult = await User.updateMany(
      { 
        $or: [
          { lastActive: { $exists: false } },
          { isAdmin: { $exists: false } },
          { inactiveNoticeSent: { $exists: false } }
        ]
      },
      { 
        $set: { 
          lastActive: new Date(),
          inactiveNoticeSent: false
        },
        $setOnInsert: {
          isAdmin: false
        }
      }
    );
    console.log(` Updated ${updateResult.modifiedCount} users with default values`);

    // 2. Tạo hoặc cập nhật admin user
    console.log("\n Setting up admin user...");
    const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123456";
    
    console.log(`   Admin email: ${adminEmail}`);

    let adminUser = await User.findOne({ email: adminEmail });

    if (!adminUser) {
      console.log("   Creating new admin user...");
      adminUser = new User({
        fullName: "System Administrator",
        email: adminEmail,
        password: adminPassword,
        isVerified: true,
        isAdmin: true,
        lastActive: new Date(),
        avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(adminEmail)}`
      });

      await adminUser.save();
      console.log(" Admin user created successfully!");
      console.log("\n Admin Credentials:");
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
    } else {
      console.log("   Admin user already exists, updating...");
      adminUser.isAdmin = true;
      adminUser.lastActive = new Date();
      await adminUser.save();
      console.log(" Admin user updated successfully!");
      console.log("\n Admin Credentials:");
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Note: Password unchanged`);
    }

    // 3. Hiển thị thống kê
    console.log("\n Migration Statistics:");
    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ isAdmin: true });
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    
    console.log(`   Total users: ${totalUsers}`);
    console.log(`   Admin users: ${adminUsers}`);
    console.log(`   Verified users: ${verifiedUsers}`);

    console.log("\n Migration completed successfully!");
    console.log("\n Next steps:");
    console.log("   1. Start your server: npm start");
    console.log("   2. Login with admin credentials");
    console.log("   3. Access admin dashboard: http://localhost:5173/admin");
    
    await mongoose.connection.close();
    console.log("\n Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("\n Migration error:", error.message);
    console.error(error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Check if running directly
if (require.main === module) {
  migrateUsers();
} else {
  module.exports = migrateUsers;
}