// 配置文件
require('dotenv').config();

module.exports = {
  port: 3000,
  sessionSecret: "bsc-explorer-secret-key",
  bscScan: {
    apiUrl: "https://api.bscscan.com/api",
    apiKeys: [
      "R4M4YEXGGE9EKDUIP3YTXHUKVYX9TX91DA",
      "15CVJ7U55ZTY71S3IBRIM2R2MKIDJVJ1X8"
    ],
    maxConcurrent: 1
  },
  moralis: {
    apiUrl: "https://deep-index.moralis.io/api/v2",
    apiKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImY0Y2MyNDdiLTFjZjYtNGRiNy1hY2FkLTA5YzQ2NzU1YmVmNiIsIm9yZ0lkIjoiNDQ0ODM2IiwidXNlcklkIjoiNDU3NjgzIiwidHlwZUlkIjoiYzIzNTZlNDEtMGE4Ny00MTkyLWFhNTMtYzg0ZmM3ZWNlZTBlIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NDYxMzExNzEsImV4cCI6NDkwMTg5MTE3MX0.lOWmKlgh5nHLn58d4Dej8GIMUU5Ti5Sn5nAhwPh_T0s",
    maxConcurrent: 20
  },
  bscNode: {
    rpcUrls: [
      "https://bsc-dataseed.binance.org/",
      "https://bsc-dataseed1.defibit.io/",
      "https://bsc-dataseed1.ninicoin.io/"
    ]
  },
  burnVerification: {
    enabled: true,
    targetContractAddress: "0xA49fA5E8106E2d6d6a69E78df9B6A20AaB9c4444",
    targetAmount: "100",
    burnAddress: "0x000000000000000000000000000000000000dead"
  },
  security: {
    rateLimitWindow: 900000,
    rateLimitMax: 500000,
    corsOrigins: [
      "http://localhost:8080"
    ]
  }
};
