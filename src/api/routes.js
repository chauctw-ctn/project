"use strict";

const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

// Đường dẫn tuyệt đối trỏ thẳng tới file loginconfig.json của bạn
const configPath = path.join(__dirname, "../../config/loginconfig.json");

/**
 * API Xử lý Đăng nhập
 * POST /api/auth/login
 */
router.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  // Kiểm tra dữ liệu đầu vào rỗng
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng nhập đầy đủ tài khoản và mật khẩu!"
    });
  }

  try {
    // 1. Đọc và phân tích file loginconfig.json trên ổ cứng
    if (!fs.existsSync(configPath)) {
      console.error(`[Lỗi] Không tìm thấy file cấu hình tại: ${configPath}`);
      return res.status(500).json({ success: false, message: "Lỗi cấu hình hệ thống!" });
    }

    const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));
    
    // 2. Tìm kiếm tài khoản trùng khớp trong mảng accounts
    const user = configData.accounts.find(
      (acc) => acc.username === username && acc.password === password
    );

    // 3. Nếu sai tài khoản hoặc mật khẩu -> Trả về lỗi 401
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: "Tài khoản hoặc mật khẩu không chính xác!" 
      });
    }

    // Kiểm tra trạng thái tài khoản
    if (user.status === "locked") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đã bị khóa và không thể đăng nhập!"
      });
    }

    // 4. Nếu đúng -> Cấp HttpOnly Cookie bằng chuỗi token cấu hình trong file JSON
    res.cookie("auth_token", configData.token, {
      httpOnly: true,     // Chống XSS độc hại chiếm đoạt token từ Frontend
      secure: false,      // Đổi thành true khi hệ thống của bạn triển khai HTTPS thực tế
      maxAge: 28800000,   // Thời hạn phiên làm việc (8 tiếng đồng hồ)
      path: "/"           // Có hiệu lực trên toàn bộ các đường dẫn hệ thống
    });

    // 5. Trả về phản hồi thành công và đường dẫn điều hướng cho Frontend nhận lệnh nhảy trang
    return res.json({
      success: true,
      message: "Đăng nhập thành công!",
      redirectPath: configData.redirectPath, // Sẽ lấy giá trị "/index.html" từ file của bạn
      user: { username: user.username, role: user.role }
    });

  } catch (error) {
    console.error("❌ Lỗi xử lý hệ thống tại API Login:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống nội bộ!" });
  }
});

/**
 * API Xử lý Đăng xuất
 * POST /api/auth/logout
 */
router.post("/api/auth/logout", (req, res) => {
  // Xóa sạch dấu vết cookie bảo mật trên trình duyệt
  res.clearCookie("auth_token", { path: "/" });
  return res.json({ success: true, message: "Đã đăng xuất khỏi hệ thống thành công!" });
});

const modalsConfigPath = path.join(__dirname, "../../config/modalsconfig.json");

/**
 * API Lấy Cấu hình Modals (Telegram & Coordinates)
 * GET /api/config/modals
 */
router.get("/api/config/modals", (req, res) => {
  try {
    let config = { telegram: {}, coordinates: {} };
    if (fs.existsSync(modalsConfigPath)) {
      const fileContent = fs.readFileSync(modalsConfigPath, "utf8").trim();
      if (fileContent) {
        config = JSON.parse(fileContent);
      }
    }
    return res.json({ success: true, data: config });
  } catch (error) {
    console.error("❌ Lỗi đọc modals config:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
  }
});

/**
 * API Lưu Cấu hình Modals (Telegram & Coordinates)
 * POST /api/config/modals
 */
router.post("/api/config/modals", (req, res) => {
  try {
    let config = { telegram: {}, coordinates: {} };
    if (fs.existsSync(modalsConfigPath)) {
      const fileContent = fs.readFileSync(modalsConfigPath, "utf8").trim();
      if (fileContent) {
        config = JSON.parse(fileContent);
      }
    }
    
    const { telegram, coordinates } = req.body;
    if (telegram !== undefined) {
      config.telegram = telegram;
    }
    if (coordinates !== undefined) {
      config.coordinates = coordinates;
    }

    fs.writeFileSync(modalsConfigPath, JSON.stringify(config, null, 2), "utf8");
    return res.json({ success: true, message: "Lưu cấu hình thành công!" });
  } catch (error) {
    console.error("❌ Lỗi ghi modals config:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
  }
});

/**
 * API Lấy danh sách người dùng
 * GET /api/users
 */
router.get("/api/users", (req, res) => {
  try {
    if (!fs.existsSync(configPath)) {
      return res.status(500).json({ success: false, message: "Lỗi cấu hình hệ thống!" });
    }
    const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const users = configData.accounts.map(acc => ({
      username: acc.username,
      role: acc.role,
      status: acc.status || "active"
    }));
    return res.json({ success: true, data: users });
  } catch (error) {
    console.error("❌ Lỗi lấy danh sách user:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
  }
});

/**
 * API Thêm người dùng mới
 * POST /api/users
 */
router.post("/api/users", (req, res) => {
  const { username, password, role, status } = req.body;
  if (!username || !password || !role || !status) {
    return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin!" });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: "Mật khẩu tối thiểu phải từ 8 ký tự!" });
  }

  try {
    if (!fs.existsSync(configPath)) {
      return res.status(500).json({ success: false, message: "Lỗi cấu hình hệ thống!" });
    }
    const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const exist = configData.accounts.find(acc => acc.username === username);
    if (exist) {
      return res.status(400).json({ success: false, message: "Tên đăng nhập đã tồn tại!" });
    }

    configData.accounts.push({ username, password, role, status });
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), "utf8");
    return res.json({ success: true, message: "Thêm người dùng thành công!" });
  } catch (error) {
    console.error("❌ Lỗi thêm user:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
  }
});

/**
 * API Cập nhật thông tin người dùng
 * PUT /api/users/:username
 */
router.put("/api/users/:username", (req, res) => {
  const targetUsername = req.params.username;
  const { role, status, password } = req.body;

  if (!role || !status) {
    return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin vai trò và trạng thái!" });
  }
  if (password && password.length < 8) {
    return res.status(400).json({ success: false, message: "Mật khẩu mới tối thiểu từ 8 ký tự!" });
  }

  try {
    if (!fs.existsSync(configPath)) {
      return res.status(500).json({ success: false, message: "Lỗi cấu hình hệ thống!" });
    }
    const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const userIndex = configData.accounts.findIndex(acc => acc.username === targetUsername);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng!" });
    }

    configData.accounts[userIndex].role = role;
    configData.accounts[userIndex].status = status;
    if (password) {
      configData.accounts[userIndex].password = password;
    }

    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), "utf8");
    return res.json({ success: true, message: "Cập nhật người dùng thành công!" });
  } catch (error) {
    console.error("❌ Lỗi cập nhật user:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
  }
});

/**
 * API Xóa người dùng
 * DELETE /api/users/:username
 */
router.delete("/api/users/:username", (req, res) => {
  const targetUsername = req.params.username;

  try {
    if (!fs.existsSync(configPath)) {
      return res.status(500).json({ success: false, message: "Lỗi cấu hình hệ thống!" });
    }
    const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const userIndex = configData.accounts.findIndex(acc => acc.username === targetUsername);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng!" });
    }

    configData.accounts.splice(userIndex, 1);
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), "utf8");
    return res.json({ success: true, message: "Xóa người dùng thành công!" });
  } catch (error) {
    console.error("❌ Lỗi xóa user:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
  }
});

/**
 * API Đổi mật khẩu
 * POST /api/users/change-password
 */
router.post("/api/users/change-password", (req, res) => {
  const { username, currentPassword, newPassword } = req.body;
  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ các thông tin mật khẩu!" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: "Mật khẩu mới tối thiểu từ 8 ký tự!" });
  }

  try {
    if (!fs.existsSync(configPath)) {
      return res.status(500).json({ success: false, message: "Lỗi cấu hình hệ thống!" });
    }
    const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const userIndex = configData.accounts.findIndex(
      acc => acc.username === username && acc.password === currentPassword
    );
    if (userIndex === -1) {
      return res.status(400).json({ success: false, message: "Mật khẩu hiện tại không chính xác!" });
    }

    configData.accounts[userIndex].password = newPassword;
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), "utf8");
    return res.json({ success: true, message: "Đổi mật khẩu thành công!" });
  } catch (error) {
    console.error("❌ Lỗi đổi mật khẩu:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
  }
});

module.exports = router;
