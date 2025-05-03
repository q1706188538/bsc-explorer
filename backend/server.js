const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const apiRoutes = require('./routes/api');
const hashVerificationService = require('./services/hashVerificationService');

// 创建 Express 应用
const app = express();
const port = config.port;

// 基本的 CORS 配置
app.use(cors({
  origin: config.security.corsOrigins,
  credentials: true
}));

// 添加头信息，告诉浏览器不要升级到 HTTPS
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=0');
  res.setHeader('Content-Security-Policy', "default-src 'self' http:; script-src 'self' 'unsafe-inline' http:; style-src 'self' 'unsafe-inline' http:; img-src 'self' data: http:; connect-src 'self' http:; font-src 'self' http: data:; object-src 'none'; media-src 'self' http:; frame-src 'self' http:;");
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// 解析 JSON 请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 会话管理
app.use(session({
  secret: config.sessionSecret || 'bsc-explorer-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // 设置为false，只使用HTTP
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24小时
  }
}));

// API 路由
app.use('/api', apiRoutes);

// 静态文件服务（前端构建文件）
app.use(express.static(path.join(__dirname, 'public')));

// 所有其他请求返回 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);

  // 启动时清理过期的哈希记录（15天）
  const RETENTION_DAYS = 15;
  const RETENTION_HOURS = RETENTION_DAYS * 24;

  const cleanedCount = hashVerificationService.cleanupExpiredHashes(RETENTION_HOURS);
  if (cleanedCount > 0) {
    console.log(`服务器启动时清理了 ${cleanedCount} 个超过${RETENTION_DAYS}天的哈希记录`);
  }

  // 设置定期清理任务（每天执行一次）
  setInterval(() => {
    const count = hashVerificationService.cleanupExpiredHashes(RETENTION_HOURS);
    if (count > 0) {
      console.log(`定期清理了 ${count} 个超过${RETENTION_DAYS}天的哈希记录`);
    }
  }, 24 * 60 * 60 * 1000); // 24小时（每天一次）
});
