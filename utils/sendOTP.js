const nodemailer = require("nodemailer");

const sendOTP = async (email, otp) => {
  try {
    console.log("sendOTP: Preparing to send OTP to:", email);

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Mã OTP Xác Thực",
      text: `Mã OTP của bạn là: ${otp}. Mã này có hiệu lực trong 5 phút.`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("sendOTP: Email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("sendOTP: Error sending email:", error.message, error.stack);
    throw new Error("Không thể gửi OTP: " + error.message);
  }
};

module.exports = sendOTP;