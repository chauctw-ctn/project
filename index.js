"use strict";

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");

const authRoutes = require("./src/api/routes");
const sources = require("./src/sources");
const sourcesApi = require("./src/api/sources");


async function main() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  console.log("====================================================");
  console.log("   KHỞI CHẠY HỆ THỐNG GIÁM SÁT CAWACO SYSTEM 2026   ");
  console.log("====================================================");

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  /*
   * 1. CHẠY NGẦM CÁC NGUỒN DỮ LIỆU
   * Hoàn toàn độc lập với đăng nhập.
   * Không đặt sau middleware auth.
   */
  try {
    if (typeof sources.start === "function") {
      await sources.start();
    } else if (typeof sources === "function") {
      await sources();
    } else {
      console.warn("⚠️ src/sources/index.js chưa export hàm start()");
    }

    console.log("✅ Các scheduler nguồn dữ liệu đã chạy ngầm.");
  } catch (err) {
    console.error("❌ Lỗi khi khởi chạy sources:", err);
  }

  // Đăng ký router API cho MQTT
  app.use("/api/sources", sourcesApi);
  console.log("Sources API registered: /api/sources");

  /*
   * 2. API AUTH
   */
  app.use(authRoutes);

  /*
   * 3. API CACHE DÙNG CHO DASHBOARD
   */
  const cache = require("./src/cache");

  app.get("/api/cache", (req, res) => {
    res.json({
      success: true,
      data: cache.getAll(),
    });
  });

  app.get("/api/cache/latest", (req, res) => {
    res.json({
      success: true,
      data: cache.getLatest(),
    });
  });

  app.get("/api/cache/:source", (req, res) => {
    const source = req.params.source;
    const data = cache.get(source);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: `Không có dữ liệu cache cho source: ${source}`,
      });
    }

    res.json({
      success: true,
      source,
      data,
    });
  });

  /*
   * 4. MIDDLEWARE BẢO VỆ FILE HTML
   */
  app.use((req, res, next) => {
    const token = req.cookies["auth_token"];
    const currentPath = req.path;

    const publicPaths = [
      "/login.html",
      "/logo.png",
      "/favicon.ico",
    ];

    if (
      publicPaths.includes(currentPath) ||
      currentPath.startsWith("/login/") ||
      currentPath.startsWith("/main/") ||
      currentPath.startsWith("/api/auth/")
    ) {
      return next();
    }

    if (!token) {
      console.log(
        `[Bảo mật] Chặn truy cập trái phép: ${currentPath} -> /login.html`
      );
      return res.redirect("/login.html");
    }

    next();
  });

  /*
   * 5. STATIC FRONTEND
   */
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/", (req, res) => {
    res.redirect("/index.html");
  });

  app.listen(PORT, () => {
    console.log(`🚀 CAWACO System đang chạy tại:`);
    console.log(`🔗 http://localhost:${PORT}/login.html`);
    console.log("====================================================");
  });
}

main().catch((err) => {
  console.error("❌ Lỗi nghiêm trọng khi khởi chạy Server:", err);
  process.exit(1);
});