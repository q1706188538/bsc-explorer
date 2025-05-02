const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const apiRoutes = require('./routes/api');

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
});
