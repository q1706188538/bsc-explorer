const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const apiRoutes = require('./routes/api');

// 创建 Express 应用
const app = express();
const port = config.port;

// 安全中间件 - 允许内联脚本执行，禁用 HSTS
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "http:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "http:"],
      styleSrc: ["'self'", "'unsafe-inline'", "http:"],
      imgSrc: ["'self'", "data:", "http:"],
      connectSrc: ["'self'", "http:"],
      fontSrc: ["'self'", "http:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "http:"],
      frameSrc: ["'self'", "http:"],
    },
  },
  // 禁用 HSTS
  hsts: false,
  // 添加 referrerPolicy 设置
  referrerPolicy: { policy: 'no-referrer' },
}));

// CORS 配置
app.use(cors({
  origin: config.security.corsOrigins,
  credentials: true
}));

// 添加头信息，告诉浏览器不要升级到 HTTPS
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=0');
  next();
});

// 请求日志
app.use(morgan('dev'));

// 请求速率限制
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindow,
  max: config.security.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试'
  }
});
app.use(limiter);

// 解析 JSON 请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 会话管理
app.use(session({
  secret: config.sessionSecret,
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
