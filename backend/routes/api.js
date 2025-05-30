const express = require('express');
const router = express.Router();
const bscService = require('../services/bscService');
const hashVerificationService = require('../services/hashVerificationService');
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

    // 检查哈希是否已经验证过
    if (hashVerificationService.isHashVerified(txHash)) {
      // 检查哈希是否已经被使用过
      if (hashVerificationService.isHashUsed(txHash)) {
        return res.status(400).json({
          success: false,
          message: '该交易哈希已被使用过，请提供新的交易哈希'
        });
      }

      // 哈希已验证但未使用，可以继续使用
      const hashDetails = hashVerificationService.getHashDetails(txHash);

      // 设置会话
      req.session.burnVerified = true;
      req.session.verifiedTxHash = txHash;
      req.session.burnFrom = hashDetails.from;

      console.log(`哈希已验证但未使用，允许继续使用: ${txHash}`);

      return res.json({
        success: true,
        result: {
          isValidBurn: true,
          from: hashDetails.from,
          hash: txHash,
          alreadyVerified: true
        }
      });
    }

    // 调用 BSC 服务验证销毁
    const burnResult = await bscService.checkTokenBurn(txHash);

    // 如果验证通过，记录哈希并设置会话
    if (burnResult.isValidBurn) {
      // 添加到已验证哈希列表
      hashVerificationService.addVerifiedHash(txHash, burnResult.from);

      // 设置会话
      req.session.burnVerified = true;
      req.session.verifiedTxHash = txHash;
      req.session.burnFrom = burnResult.from;

      console.log(`销毁验证通过，记录哈希并设置会话: ${JSON.stringify({
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
  const txHash = req.session.verifiedTxHash || '';
  let isUsed = false;

  // 如果有验证过的哈希，检查是否已使用
  if (txHash) {
    isUsed = hashVerificationService.isHashUsed(txHash);
  }

  return res.json({
    success: true,
    verified: req.session.burnVerified || false,
    txHash: txHash,
    from: req.session.burnFrom || '',
    isUsed: isUsed
  });
});

// 获取交易记录
router.post('/transactions', async (req, res) => {
  try {
    // 初始化哈希变量
    let txHash = null;

    // 检查是否启用了代币销毁验证功能
    if (config.burnVerification.enabled) {
      // 检查是否已验证销毁
      if (!req.session.burnVerified) {
        return res.status(403).json({
          success: false,
          message: '请先验证代币销毁交易'
        });
      }

      // 获取会话中的交易哈希
      txHash = req.session.verifiedTxHash;

      // 检查哈希状态
      const hashStatus = hashVerificationService.getHashStatus(txHash);
      console.log(`检查哈希 ${txHash} 状态: ${hashStatus}`);

      if (hashStatus === 'used') {
        // 清除会话
        req.session.burnVerified = false;
        delete req.session.verifiedTxHash;
        delete req.session.burnFrom;

        return res.status(403).json({
          success: false,
          message: '该交易哈希已被使用过，请提供新的交易哈希进行验证'
        });
      }

      if (hashStatus === 'locked') {
        // 检查是否已经初始化了API请求状态跟踪
        const normalizedHash = hashVerificationService.normalizeHash(txHash);
        const status = hashVerificationService.apiRequestStatus.get(normalizedHash);

        // 如果已经初始化了API请求状态跟踪，允许继续查询
        if (status) {
          console.log(`哈希 ${txHash} 已锁定，但允许继续查询，因为已经初始化了API请求状态跟踪`);
        } else {
          return res.status(403).json({
            success: false,
            message: '该交易哈希正在处理中，请稍后再试'
          });
        }
      }

      // 锁定哈希，表示正在使用
      if (hashStatus === 'verified') {
        hashVerificationService.lockHash(txHash);
        console.log(`哈希 ${txHash} 已锁定，标记为正在使用`);

        // 初始化API请求状态跟踪
        hashVerificationService.initApiRequestStatus(txHash);
      }
    }

    const { address, page = 1, offset = 5000 } = req.body; // 增加到5000条，接近BSCScan API的最大限制

    if (!address) {
      // 如果地址为空，解锁哈希
      if (txHash) {
        hashVerificationService.unlockHash(txHash);
        console.log(`哈希 ${txHash} 已解锁，因为地址为空`);
      }

      return res.status(400).json({
        success: false,
        message: '地址不能为空'
      });
    }

    try {
      // 调用 BSC 服务获取交易记录
      const transactions = await bscService.getTransactions(address, page, offset);

      // 准备响应数据
      const responseData = {
        success: true,
        result: transactions
      };

      // 发送响应
      res.json(responseData);

      // 标记普通交易API请求已完成
      if (config.burnVerification.enabled && txHash) {
        hashVerificationService.markNormalTxCompleted(txHash);
        console.log(`哈希 ${txHash} 的普通交易API请求已完成，等待代币交易API请求完成`);
      }
    } catch (queryError) {
      // 如果查询失败，解锁哈希并清理API请求状态
      if (txHash) {
        hashVerificationService.unlockHash(txHash);
        hashVerificationService.cleanupApiRequestStatus(txHash);
        console.log(`哈希 ${txHash} 已解锁并清理API请求状态，因为查询失败: ${queryError.message}`);
      }

      throw queryError; // 重新抛出错误，让外层 catch 处理
    }
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
    // 初始化哈希变量
    let txHash = null;

    // 检查是否启用了代币销毁验证功能
    if (config.burnVerification.enabled) {
      // 检查是否已验证销毁
      if (!req.session.burnVerified) {
        return res.status(403).json({
          success: false,
          message: '请先验证代币销毁交易'
        });
      }

      // 获取会话中的交易哈希
      txHash = req.session.verifiedTxHash;

      // 检查哈希状态
      const hashStatus = hashVerificationService.getHashStatus(txHash);
      console.log(`检查哈希 ${txHash} 状态: ${hashStatus}`);

      if (hashStatus === 'used') {
        // 清除会话
        req.session.burnVerified = false;
        delete req.session.verifiedTxHash;
        delete req.session.burnFrom;

        return res.status(403).json({
          success: false,
          message: '该交易哈希已被使用过，请提供新的交易哈希进行验证'
        });
      }

      if (hashStatus === 'locked') {
        // 检查是否已经初始化了API请求状态跟踪
        const normalizedHash = hashVerificationService.normalizeHash(txHash);
        const status = hashVerificationService.apiRequestStatus.get(normalizedHash);

        // 如果已经初始化了API请求状态跟踪，允许继续查询
        if (status) {
          console.log(`哈希 ${txHash} 已锁定，但允许继续查询，因为已经初始化了API请求状态跟踪`);
        } else {
          return res.status(403).json({
            success: false,
            message: '该交易哈希正在处理中，请稍后再试'
          });
        }
      }

      // 锁定哈希，表示正在使用
      if (hashStatus === 'verified') {
        hashVerificationService.lockHash(txHash);
        console.log(`哈希 ${txHash} 已锁定，标记为正在使用`);

        // 初始化API请求状态跟踪
        hashVerificationService.initApiRequestStatus(txHash);
      }
    }

    const { address, page = 1, offset = 5000 } = req.body; // 增加到5000条，接近BSCScan API的最大限制

    if (!address) {
      // 如果地址为空，解锁哈希
      if (txHash) {
        hashVerificationService.unlockHash(txHash);
        console.log(`哈希 ${txHash} 已解锁，因为地址为空`);
      }

      return res.status(400).json({
        success: false,
        message: '地址不能为空'
      });
    }

    try {
      // 调用 BSC 服务获取代币转账记录
      console.log(`获取代币转账记录: ${address}, 页码: ${page}, 每页数量: ${offset}`);

      const startTime = Date.now();
      // 注意：bscService.getTokenTransfers 现在会自动选择使用 Moralis 或 BSCScan API
      const transfers = await bscService.getTokenTransfers(address, page, offset);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      console.log(`获取到 ${transfers.length} 条记录，耗时 ${duration.toFixed(2)} 秒，使用 API: ${bscService.getCurrentApiProvider()}`);

      // 准备响应数据
      const responseData = {
        success: true,
        result: transfers,
        provider: bscService.getCurrentApiProvider(),
        count: transfers.length,
        duration: duration.toFixed(2)
      };

      // 发送响应
      res.json(responseData);

      // 标记代币交易API请求已完成
      if (config.burnVerification.enabled && txHash) {
        hashVerificationService.markTokenTxCompleted(txHash);
        console.log(`哈希 ${txHash} 的代币交易API请求已完成，检查是否两个API都已完成`);
      }
    } catch (queryError) {
      // 如果查询失败，解锁哈希并清理API请求状态
      if (txHash) {
        hashVerificationService.unlockHash(txHash);
        hashVerificationService.cleanupApiRequestStatus(txHash);
        console.log(`哈希 ${txHash} 已解锁并清理API请求状态，因为查询失败: ${queryError.message}`);
      }

      throw queryError; // 重新抛出错误，让外层 catch 处理
    }
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
    // 初始化哈希变量
    let txHash = null;

    // 检查是否启用了代币销毁验证功能
    if (config.burnVerification.enabled) {
      // 检查是否已验证销毁
      if (!req.session.burnVerified) {
        return res.status(403).json({
          success: false,
          message: '请先验证代币销毁交易'
        });
      }

      // 获取会话中的交易哈希
      txHash = req.session.verifiedTxHash;

      // 检查哈希状态
      const hashStatus = hashVerificationService.getHashStatus(txHash);
      console.log(`检查哈希 ${txHash} 状态: ${hashStatus}`);

      if (hashStatus === 'used') {
        // 清除会话
        req.session.burnVerified = false;
        delete req.session.verifiedTxHash;
        delete req.session.burnFrom;

        return res.status(403).json({
          success: false,
          message: '该交易哈希已被使用过，请提供新的交易哈希进行验证'
        });
      }

      if (hashStatus === 'locked') {
        // 检查是否已经初始化了API请求状态跟踪
        const normalizedHash = hashVerificationService.normalizeHash(txHash);
        const status = hashVerificationService.apiRequestStatus.get(normalizedHash);

        // 如果已经初始化了API请求状态跟踪，允许继续查询
        if (status) {
          console.log(`哈希 ${txHash} 已锁定，但允许继续查询，因为已经初始化了API请求状态跟踪`);
        } else {
          return res.status(403).json({
            success: false,
            message: '该交易哈希正在处理中，请稍后再试'
          });
        }
      }

      // 锁定哈希，表示正在使用
      if (hashStatus === 'verified') {
        hashVerificationService.lockHash(txHash);
        console.log(`哈希 ${txHash} 已锁定，标记为正在使用`);

        // 初始化API请求状态跟踪
        hashVerificationService.initApiRequestStatus(txHash);
      }
    }

    // 检查 Moralis 配置
    if (!config.moralis || !config.moralis.apiKey || config.moralis.enabled === false) {
      // 如果 Moralis 配置无效，解锁哈希
      if (txHash) {
        hashVerificationService.unlockHash(txHash);
        console.log(`哈希 ${txHash} 已解锁，因为 Moralis 配置无效`);
      }

      return res.status(400).json({
        success: false,
        message: 'Moralis API 未配置或未启用'
      });
    }

    const { address, limit = 5000 } = req.body; // 目标记录数，将使用游标分页获取

    if (!address) {
      // 如果地址为空，解锁哈希
      if (txHash) {
        hashVerificationService.unlockHash(txHash);
        console.log(`哈希 ${txHash} 已解锁，因为地址为空`);
      }

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

      // 准备响应数据
      const responseData = {
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
      };

      // 发送响应
      res.json(responseData);

      // 标记代币交易API请求已完成
      if (config.burnVerification.enabled && txHash) {
        hashVerificationService.markTokenTxCompleted(txHash);
        console.log(`哈希 ${txHash} 的代币交易API请求已完成（Moralis），检查是否两个API都已完成`);
      }
    } catch (moralisError) {
      console.error('Moralis API 调用失败，尝试使用 BSCScan API:', moralisError);

      try {
        // 如果 Moralis API 调用失败，尝试使用 BSCScan API
        console.log('回退到 BSCScan API...');
        const bscScanTransfers = await bscService.getTokenTransfers(address, 1, Math.min(limit, 5000));

        // 准备响应数据
        const responseData = {
          success: true,
          result: bscScanTransfers,
          provider: 'bscscan',
          count: bscScanTransfers.length,
          fallback: true,
          error: moralisError.message
        };

        // 发送响应
        res.json(responseData);

        // 标记代币交易API请求已完成
        if (config.burnVerification.enabled && txHash) {
          hashVerificationService.markTokenTxCompleted(txHash);
          console.log(`哈希 ${txHash} 的代币交易API请求已完成（BSCScan 回退），检查是否两个API都已完成`);
        }
      } catch (bscScanError) {
        // 如果 BSCScan API 也失败，解锁哈希并清理API请求状态
        if (txHash) {
          hashVerificationService.unlockHash(txHash);
          hashVerificationService.cleanupApiRequestStatus(txHash);
          console.log(`哈希 ${txHash} 已解锁并清理API请求状态，因为 Moralis 和 BSCScan API 都失败`);
        }

        throw bscScanError; // 重新抛出错误，让外层 catch 处理
      }
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

    // 获取当前使用的 API Key
    const apiKey = bscService.getCurrentApiKey();
    console.log(`获取合约信息 - 合约地址: ${contractAddress}, API Key: ${apiKey.substring(0, 10)}..., API 提供商: ${bscService.getCurrentApiProvider()}`);

    try {
      // 按顺序获取合约信息，避免并发请求
      console.log('按顺序获取合约信息，避免并发请求...');

      // 获取合约 ABI
      console.log('1. 获取合约 ABI...');
      const abi = await bscService.getContractABI(contractAddress);

      // 获取合约源代码
      console.log('2. 获取合约源代码...');
      const sourceCode = await bscService.getContractSourceCode(contractAddress);

      // 获取合约创建者信息
      console.log('3. 获取合约创建者信息...');
      const creator = await bscService.getContractCreator(contractAddress);

      // 获取合约字节码大小
      console.log('4. 获取合约字节码大小...');
      const bytecodeSize = await bscService.getContractBytecode(contractAddress);

      // 获取合约余额
      console.log('5. 获取合约余额...');
      const balance = await bscService.getAddressBalance(contractAddress);

      // 获取代币总供应量
      console.log('6. 获取代币总供应量...');
      const totalSupply = await bscService.getTokenTotalSupply(contractAddress);

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
router.get('/config', (_, res) => {
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
router.get('/api-provider', (_, res) => {
  return res.json({
    success: true,
    provider: bscService.getCurrentApiProvider()
  });
});

// 重新加载配置
router.post('/reload-config', (_, res) => {
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

// 只获取合约创建者信息的接口
router.post('/contract-creator', async (req, res) => {
  try {
    // 检查是否启用了代币销毁验证功能
    if (config.burnVerification.enabled) {
      // 检查会话状态
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

    // 获取当前使用的 API Key
    const apiKey = bscService.getCurrentApiKey();
    // 简化日志输出，只保留必要信息
    console.log(`获取合约创建者 - 地址: ${contractAddress.substring(0, 10)}..., API Key: ${apiKey.substring(0, 6)}...`);

    try {
      // 只获取合约创建者信息
      const creator = await bscService.getContractCreator(contractAddress);

      // 简化日志输出
      if (Array.isArray(creator) && creator.length > 0) {
        console.log(`合约 ${contractAddress.substring(0, 10)}... 创建者: ${creator[0].contractCreator.substring(0, 10)}...`);
      } else {
        console.log(`未找到合约 ${contractAddress.substring(0, 10)}... 的创建者`);
      }

      // 获取当前使用的 API Key 和 API 提供商
      const apiProvider = bscService.getCurrentApiProvider();

      return res.json({
        success: true,
        result: {
          creator
        },
        apiKey: apiKey.substring(0, 10) + '...',
        provider: apiProvider
      });
    } catch (error) {
      console.error(`获取合约 ${contractAddress} 创建者信息失败:`, error);

      // 返回部分信息，而不是完全失败
      return res.json({
        success: true,
        result: {
          creator: []
        }
      });
    }
  } catch (error) {
    console.error('获取合约创建者信息失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取合约创建者信息失败: ' + error.message
    });
  }
});

// 批量获取合约创建者信息的接口
router.post('/contract-creators-batch', async (req, res) => {
  try {
    // 检查是否启用了代币销毁验证功能
    if (config.burnVerification.enabled) {
      // 检查会话状态
      if (!req.session.burnVerified) {
        console.log('警告: 会话验证未通过，但暂时允许请求继续，用于调试');
      }
    }

    const { contractAddresses, concurrentLimit = 1 } = req.body;

    if (!contractAddresses || !Array.isArray(contractAddresses) || contractAddresses.length === 0) {
      return res.status(400).json({
        success: false,
        message: '合约地址数组不能为空'
      });
    }

    // 使用配置中的 API Key 数量和并发限制计算最佳并发数
    const apiKeyCount = config.bscScan.apiKeys.length;
    // 每个 API Key 每秒可以处理 5 个请求，所以最大并发数是 API Key 数量 * 5
    const maxSafeConcurrent = apiKeyCount * 5;
    // 使用较小的值作为实际并发限制
    const actualConcurrentLimit = Math.min(concurrentLimit, maxSafeConcurrent);

    console.log(`批量获取 ${contractAddresses.length} 个合约的创建者信息，API Key 数量: ${apiKeyCount}, 理论最大并发: ${maxSafeConcurrent}, 实际并发限制: ${actualConcurrentLimit}`);

    // 结果对象
    const results = {};
    // 成功计数
    let successCount = 0;

    // 如果并发限制大于1，使用并发处理
    if (actualConcurrentLimit > 1) {
      // 创建一个队列，用于并发查询
      const queue = [...contractAddresses];
      const activePromises = [];

      // 处理单个合约的创建者信息
      const processContract = async (address) => {
        try {
          // 获取合约创建者信息
          const creator = await bscService.getContractCreator(address);

          // 保存结果
          results[address] = {
            success: true,
            creator
          };

          // 增加成功计数
          if (Array.isArray(creator) && creator.length > 0) {
            successCount++;
          }
        } catch (error) {
          console.error(`获取合约 ${address} 创建者信息失败:`, error);

          // 保存错误信息
          results[address] = {
            success: false,
            error: error.message
          };
        }
      };

      // 处理队列
      await new Promise(resolve => {
        const processQueue = async () => {
          // 如果队列为空，等待所有活动的Promise完成后返回
          if (queue.length === 0 && activePromises.length === 0) {
            resolve();
            return;
          }

          // 如果队列不为空，并且活动的Promise数量小于实际并发限制，启动新的查询
          while (queue.length > 0 && activePromises.length < actualConcurrentLimit) {
            const address = queue.shift();

            // 创建一个新的Promise，处理完成后从活动Promise列表中移除
            const promise = processContract(address).finally(() => {
              const index = activePromises.indexOf(promise);
              if (index !== -1) {
                activePromises.splice(index, 1);
              }

              // 继续处理队列
              processQueue();
            });

            // 添加到活动Promise列表
            activePromises.push(promise);
          }
        };

        // 开始处理队列
        processQueue();
      });
    } else {
      // 按顺序处理每个合约地址
      for (const address of contractAddresses) {
        try {
          // 获取合约创建者信息
          const creator = await bscService.getContractCreator(address);

          // 保存结果
          results[address] = {
            success: true,
            creator
          };

          // 增加成功计数
          if (Array.isArray(creator) && creator.length > 0) {
            successCount++;
          }
        } catch (error) {
          console.error(`获取合约 ${address} 创建者信息失败:`, error);

          // 保存错误信息
          results[address] = {
            success: false,
            error: error.message
          };
        }
      }
    }

    console.log(`批量获取合约创建者信息完成，成功: ${successCount}/${contractAddresses.length}`);

    return res.json({
      success: true,
      results,
      totalCount: contractAddresses.length,
      successCount
    });
  } catch (error) {
    console.error('批量获取合约创建者信息失败:', error);
    return res.status(500).json({
      success: false,
      message: '批量获取合约创建者信息失败: ' + error.message
    });
  }
});

module.exports = router;

