# BSC Explorer 后端服务

这是 BSC Explorer 的后端服务，提供代币销毁验证和交易记录查询功能。

## 功能

- 代币销毁验证
- 交易记录查询
- 代币转账记录查询
- 合约信息查询

## 安装

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 生产模式运行
npm start
```

## 环境变量

创建 `.env` 文件并设置以下环境变量：

```
PORT=3000
SESSION_SECRET=your-secret-key
CORS_ORIGINS=http://localhost:8080,http://your-domain.com
NODE_ENV=development
```

## API 文档

### 验证代币销毁

```
POST /api/verify-burn
```

请求体：
```json
{
  "txHash": "0x..."
}
```

### 获取验证状态

```
GET /api/verification-status
```

### 获取交易记录

```
POST /api/transactions
```

请求体：
```json
{
  "address": "0x...",
  "page": 1,
  "offset": 100
}
```

### 获取代币转账记录

```
POST /api/token-transfers
```

请求体：
```json
{
  "address": "0x...",
  "page": 1,
  "offset": 100
}
```

### 获取合约信息

```
POST /api/contract-info
```

请求体：
```json
{
  "contractAddress": "0x..."
}
```

## 安全说明

- 所有敏感配置都存储在服务器端
- 使用会话管理确保只有验证通过的用户才能查询数据
- 实施请求速率限制，防止滥用
- 使用 CORS 限制请求来源
