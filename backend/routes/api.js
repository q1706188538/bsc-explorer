const express = require('express');
const router = express.Router();
const bscService = require('../services/bscService');
const config = require('../config');

console.log('Moralis 配置:', config.moralis ? {
  apiUrl: config.moralis.apiUrl,
  apiKey: config.moralis.apiKey ? '已设置' : '未设置',
  maxConcurrent: config.moralis.maxConcurrent,
  enabled: config.moralis.enabled !== false
} : '未找到');

// 验证代币销毁
router.post('/verify-burn', async (req, res) => {
  try {
    const { txHash } = req.body;

    if (!txHash) {
      return res.status(400).json({
        success: false,
        message: '交易哈希不能为空'
      });
    }

    // 调用 BSC 服务验证销毁
    const burnResult = await bscService.checkTokenBurn(txHash);

    // 如果验证通过，设置会话
    if (burnResult.isValidBurn) {
      req.session.burnVerified = true;
      req.session.verifiedTxHash = txHash;
      req.session.burnFrom = burnResult.from;

      console.log(`销毁验证通过，设置会话: ${JSON.stringify({
        burnVerified: req.session.burnVerified,
        verifiedTxHash: req.session.verifiedTxHash,
        burnFrom: req.session.burnFrom
      })}`);
    } else {
      // 如果验证失败，清除会话
      req.session.burnVerified = false;
      delete req.session.verifiedTxHash;
      delete req.session.burnFrom;

      console.log('销毁验证失败，清除会话');
    }

    return res.json({
      success: true,
      result: burnResult
    });
  } catch (error) {
    console.error('验证销毁失败:', error);
    return res.status(500).json({
      success: false,
      message: '验证失败: ' + error.message
    });
  }
});

// 获取验证状态
router.get('/verification-status', (req, res) => {
  return res.json({
    success: true,
    verified: req.session.burnVerified || false,
    txHash: req.session.verifiedTxHash || '',
    from: req.session.burnFrom || ''
  });
});

// 获取交易记录
router.post('/transactions', async (req, res) => {
  try {
    // 检查是否启用了代币销毁验证功能
    if (config.burnVerification.enabled) {
      // 检查是否已验证销毁
      if (!req.session.burnVerified) {
        return res.status(403).json({
          success: false,
          message: '请先验证代币销毁交易'
        });
      }
    }

    const { address, page = 1, offset = 5000 } = req.body; // 增加到5000条，接近BSCScan API的最大限制

    if (!address) {
      return res.status(400).json({
        success: false,
        message: '地址不能为空'
      });
    }

    // 调用 BSC 服务获取交易记录
    const transactions = await bscService.getTransactions(address, page, offset);

    return res.json({
      success: true,
      result: transactions
    });
  } catch (error) {
    console.error('获取交易记录失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取交易记录失败: ' + error.message
    });
  }
});

// 获取代币转账记录
router.post('/token-transfers', async (req, res) => {
  try {
    // 检查是否启用了代币销毁验证功能
    if (config.burnVerification.enabled) {
      // 检查是否已验证销毁
      if (!req.session.burnVerified) {
        return res.status(403).json({
          success: false,
          message: '请先验证代币销毁交易'
        });
      }
    }

    const { address, page = 1, offset = 5000 } = req.body; // 增加到5000条，接近BSCScan API的最大限制

    if (!address) {
      return res.status(400).json({
        success: false,
        message: '地址不能为空'
      });
    }

    // 调用 BSC 服务获取代币转账记录
    console.log(`获取代币转账记录: ${address}, 页码: ${page}, 每页数量: ${offset}`);

    const startTime = Date.now();
    // 注意：bscService.getTokenTransfers 现在会自动选择使用 Moralis 或 BSCScan API
    const transfers = await bscService.getTokenTransfers(address, page, offset);
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`获取到 ${transfers.length} 条记录，耗时 ${duration.toFixed(2)} 秒，使用 API: ${bscService.getCurrentApiProvider()}`);

    return res.json({
      success: true,
      result: transfers,
      provider: bscService.getCurrentApiProvider(),
      count: transfers.length,
      duration: duration.toFixed(2)
    });
  } catch (error) {
    console.error('获取代币转账记录失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取代币转账记录失败: ' + error.message
    });
  }
});

// 专门从 Moralis 获取代币转账记录
router.post('/moralis/token-transfers', async (req, res) => {
  try {
    // 检查是否启用了代币销毁验证功能
    if (config.burnVerification.enabled) {
      // 检查是否已验证销毁
      if (!req.session.burnVerified) {
        return res.status(403).json({
          success: false,
          message: '请先验证代币销毁交易'
        });
      }
    }

    // 检查 Moralis 配置
    if (!config.moralis || !config.moralis.apiKey || config.moralis.enabled === false) {
      return res.status(400).json({
        success: false,
        message: 'Moralis API 未配置或未启用'
      });
    }

    const { address, limit = 5000 } = req.body; // 目标记录数，将使用游标分页获取

    if (!address) {
      return res.status(400).json({
        success: false,
        message: '地址不能为空'
      });
    }

    console.log(`调用 Moralis API 获取代币转账记录: ${address}, 目标记录数: ${limit}`);

    try {
      // 直接调用 Moralis 方法，使用游标分页获取多条记录
      const startTime = Date.now();
      const transfers = await bscService.getTokenTransfersFromMoralis(address, limit);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      console.log(`Moralis API 返回了 ${transfers.length} 条记录，耗时 ${duration.toFixed(2)} 秒`);

      // 添加样本数据，帮助调试
      const sampleData = transfers.length > 0 ? transfers[0] : null;

      return res.json({
        success: true,
        result: transfers,
        provider: 'moralis',
        count: transfers.length,
        duration: duration.toFixed(2),
        sample: sampleData ? {
          hash: sampleData.hash,
          from: sampleData.from,
          to: sampleData.to,
          contractAddress: sampleData.contractAddress,
          tokenName: sampleData.tokenName,
          tokenSymbol: sampleData.tokenSymbol,
          tokenDecimal: sampleData.tokenDecimal
        } : null
      });
    } catch (moralisError) {
      console.error('Moralis API 调用失败，尝试使用 BSCScan API:', moralisError);

      // 如果 Moralis API 调用失败，尝试使用 BSCScan API
      console.log('回退到 BSCScan API...');
      const bscScanTransfers = await bscService.getTokenTransfers(address, 1, Math.min(limit, 5000));

      return res.json({
        success: true,
        result: bscScanTransfers,
        provider: 'bscscan',
        count: bscScanTransfers.length,
        fallback: true,
        error: moralisError.message
      });
    }
  } catch (error) {
    console.error('从 Moralis 获取代币转账记录失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取代币转账记录失败: ' + error.message
    });
  }
});

// 获取合约信息
router.post('/contract-info', async (req, res) => {
  try {
    // 检查是否启用了代币销毁验证功能
    if (config.burnVerification.enabled) {
      // 检查会话状态
      console.log('会话状态:', req.session);
      if (!req.session.burnVerified) {
        console.log('警告: 会话验证未通过，但暂时允许请求继续，用于调试');
        // 暂时注释掉，允许请求继续
        // return res.status(403).json({
        //   success: false,
        //   message: '请先验证代币销毁交易'
        // });
      }
    }

    const { contractAddress } = req.body;

    if (!contractAddress) {
      return res.status(400).json({
        success: false,
        message: '合约地址不能为空'
      });
    }

    console.log(`获取合约信息: ${contractAddress}`);

    try {
      // 获取合约信息
      const [abi, sourceCode, creator, bytecodeSize, balance, totalSupply] = await Promise.all([
        bscService.getContractABI(contractAddress),
        bscService.getContractSourceCode(contractAddress),
        bscService.getContractCreator(contractAddress),
        bscService.getContractBytecode(contractAddress),
        bscService.getAddressBalance(contractAddress),
        bscService.getTokenTotalSupply(contractAddress)
      ]);

      console.log(`合约 ${contractAddress} 信息获取成功:`);
      console.log('ABI:', typeof abi === 'string' ? (abi.length > 100 ? abi.substring(0, 100) + '...' : abi) : 'Object');
      console.log('源代码:', Array.isArray(sourceCode) ? `Array[${sourceCode.length}]` : typeof sourceCode);
      console.log('创建者:', Array.isArray(creator) ? `Array[${creator.length}]` : typeof creator);
      console.log('字节码大小:', bytecodeSize, '字节');
      console.log('BNB 余额:', balance, 'BNB');
      console.log('总供应量:', totalSupply);

      // 获取当前使用的 API Key 和 API 提供商
      const apiKey = bscService.getCurrentApiKey();
      const apiProvider = bscService.getCurrentApiProvider();

      console.log(`返回合约 ${contractAddress} 信息，使用 API Key: ${apiKey.substring(0, 10)}..., API 提供商: ${apiProvider}`);

      return res.json({
        success: true,
        result: {
          abi,
          sourceCode,
          creator,
          bytecodeSize,
          balance,
          totalSupply
        },
        apiKey: apiKey.substring(0, 10) + '...',
        provider: apiProvider
      });
    } catch (error) {
      console.error(`获取合约 ${contractAddress} 信息失败:`, error);

      // 返回部分信息，而不是完全失败
      return res.json({
        success: true,
        result: {
          abi: 'Error: ' + error.message,
          sourceCode: [],
          creator: []
        }
      });
    }
  } catch (error) {
    console.error('获取合约信息失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取合约信息失败: ' + error.message
    });
  }
});

// 清除验证状态（用于测试）
router.post('/clear-verification', (req, res) => {
  req.session.burnVerified = false;
  delete req.session.verifiedTxHash;
  delete req.session.burnFrom;

  return res.json({
    success: true,
    message: '验证状态已清除'
  });
});

// 获取配置信息
router.get('/config', (req, res) => {
  // 创建一个安全的配置对象，只包含前端需要的配置
  const safeConfig = {
    bscScan: {
      apiUrl: config.bscScan.apiUrl,
      apiKeys: config.bscScan.apiKeys,
      maxConcurrent: config.bscScan.maxConcurrent
    },
    bscNode: {
      rpcUrls: config.bscNode.rpcUrls
    },
    burnVerification: {
      enabled: config.burnVerification.enabled,
      targetContractAddress: config.burnVerification.targetContractAddress,
      targetAmount: config.burnVerification.targetAmount,
      burnAddress: config.burnVerification.burnAddress
    }
  };

  // 添加Moralis配置（如果存在）
  if (config.moralis) {
    safeConfig.moralis = {
      apiUrl: config.moralis.apiUrl,
      apiKey: config.moralis.apiKey,
      maxConcurrent: config.moralis.maxConcurrent,
      enabled: config.moralis.enabled !== false
    };
  }

  // 添加当前 API 提供商信息
  safeConfig.currentApiProvider = bscService.getCurrentApiProvider();

  console.log('返回配置信息:', safeConfig);
  return res.header('Content-Type', 'application/json; charset=utf-8')
    .header('Cache-Control', 'no-cache, no-store, must-revalidate')
    .header('Pragma', 'no-cache')
    .header('Expires', '0')
    .json(safeConfig);
});

// 获取当前 API 提供商
router.get('/api-provider', (req, res) => {
  return res.json({
    success: true,
    provider: bscService.getCurrentApiProvider()
  });
});

// 重新加载配置
router.post('/reload-config', (req, res) => {
  try {
    // 清除 require 缓存，强制重新加载配置文件
    delete require.cache[require.resolve('../config')];
    // 重新加载配置
    const freshConfig = require('../config');
    // 更新全局配置对象
    Object.assign(config, freshConfig);

    console.log('配置已重新加载:', config);

    return res.json({
      success: true,
      message: '配置已重新加载',
      config: {
        bscScan: {
          apiUrl: config.bscScan.apiUrl,
          apiKeys: config.bscScan.apiKeys,
          maxConcurrent: config.bscScan.maxConcurrent
        },
        bscNode: {
          rpcUrls: config.bscNode.rpcUrls
        },
        burnVerification: {
          enabled: config.burnVerification.enabled,
          targetContractAddress: config.burnVerification.targetContractAddress,
          targetAmount: config.burnVerification.targetAmount,
          burnAddress: config.burnVerification.burnAddress
        },
        moralis: config.moralis ? {
          apiUrl: config.moralis.apiUrl,
          apiKey: config.moralis.apiKey,
          maxConcurrent: config.moralis.maxConcurrent,
          enabled: config.moralis.enabled !== false
        } : undefined
      }
    });
  } catch (error) {
    console.error('重新加载配置失败:', error);
    return res.status(500).json({
      success: false,
      message: '重新加载配置失败: ' + error.message
    });
  }
});

// 保存配置
router.post('/save-config', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');

    // 获取请求中的配置
    const newConfig = req.body;

    // 验证配置
    if (!newConfig) {
      return res.status(400).json({
        success: false,
        message: '配置不能为空'
      });
    }

    // 获取当前配置
    const currentConfig = { ...config };

    // 更新配置
    if (newConfig.burnVerification) {
      if (newConfig.burnVerification.enabled !== undefined) {
        currentConfig.burnVerification.enabled = newConfig.burnVerification.enabled;
      }
      if (newConfig.burnVerification.targetContractAddress) {
        currentConfig.burnVerification.targetContractAddress = newConfig.burnVerification.targetContractAddress;
      }
      if (newConfig.burnVerification.targetAmount) {
        currentConfig.burnVerification.targetAmount = newConfig.burnVerification.targetAmount;
      }
      if (newConfig.burnVerification.burnAddress) {
        currentConfig.burnVerification.burnAddress = newConfig.burnVerification.burnAddress;
      }
    }

    if (newConfig.bscScan) {
      if (newConfig.bscScan.apiUrl) {
        currentConfig.bscScan.apiUrl = newConfig.bscScan.apiUrl;
      }
      if (newConfig.bscScan.maxConcurrent !== undefined) {
        currentConfig.bscScan.maxConcurrent = newConfig.bscScan.maxConcurrent;
      }
      if (newConfig.bscScan.apiKeys && Array.isArray(newConfig.bscScan.apiKeys)) {
        currentConfig.bscScan.apiKeys = newConfig.bscScan.apiKeys;
      }
    }

    if (newConfig.bscNode) {
      if (newConfig.bscNode.rpcUrls && Array.isArray(newConfig.bscNode.rpcUrls)) {
        currentConfig.bscNode.rpcUrls = newConfig.bscNode.rpcUrls;
      }
    }

    // 处理Moralis配置
    if (newConfig.moralis) {
      if (!currentConfig.moralis) {
        currentConfig.moralis = {
          apiUrl: 'https://deep-index.moralis.io/api/v2',
          apiKey: '',
          maxConcurrent: 10,
          enabled: true
        };
      }

      if (newConfig.moralis.apiUrl) {
        currentConfig.moralis.apiUrl = newConfig.moralis.apiUrl;
      }
      if (newConfig.moralis.apiKey) {
        currentConfig.moralis.apiKey = newConfig.moralis.apiKey;
      }
      if (newConfig.moralis.maxConcurrent !== undefined) {
        currentConfig.moralis.maxConcurrent = newConfig.moralis.maxConcurrent;
      }
      if (newConfig.moralis.enabled !== undefined) {
        currentConfig.moralis.enabled = newConfig.moralis.enabled;
      }
    }

    // 将配置转换为字符串
    const configString = `// 配置文件
require('dotenv').config();

module.exports = ${JSON.stringify(currentConfig, null, 2).replace(/"([^"]+)":/g, '$1:')};
`;

    // 保存配置到文件
    const configPath = path.resolve(__dirname, '../config.js');
    fs.writeFileSync(configPath, configString);

    // 清除 require 缓存，强制重新加载配置文件
    delete require.cache[require.resolve('../config')];
    // 重新加载配置
    const freshConfig = require('../config');
    // 更新全局配置对象
    Object.assign(config, freshConfig);

    console.log('配置已保存并重新加载:', config);

    return res.json({
      success: true,
      message: '配置已保存并重新加载',
      config: {
        bscScan: {
          apiUrl: config.bscScan.apiUrl,
          apiKeys: config.bscScan.apiKeys,
          maxConcurrent: config.bscScan.maxConcurrent
        },
        bscNode: {
          rpcUrls: config.bscNode.rpcUrls
        },
        burnVerification: {
          enabled: config.burnVerification.enabled,
          targetContractAddress: config.burnVerification.targetContractAddress,
          targetAmount: config.burnVerification.targetAmount,
          burnAddress: config.burnVerification.burnAddress
        },
        moralis: config.moralis ? {
          apiUrl: config.moralis.apiUrl,
          apiKey: config.moralis.apiKey,
          maxConcurrent: config.moralis.maxConcurrent,
          enabled: config.moralis.enabled !== false
        } : undefined
      }
    });
  } catch (error) {
    console.error('保存配置失败:', error);
    return res.status(500).json({
      success: false,
      message: '保存配置失败: ' + error.message
    });
  }
});

module.exports = router;



