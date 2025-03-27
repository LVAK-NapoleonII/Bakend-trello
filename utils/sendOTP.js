const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465, // Thử với 465 hoặc 587
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOTP = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Mã OTP Xác Minh Tài Khoản",
    text: `Mã OTP của bạn là: ${otp}. Mã sẽ hết hạn sau 5 phút.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("OTP Sent to", email);
  } catch (error) {
    console.error("Error sending email", error);
  }
};

module.exports = sendOTP;
