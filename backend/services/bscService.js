const axios = require('axios');
const { ethers } = require('ethers');
const config = require('../config');

// 当前使用的 API 提供商
let currentApiProvider = 'bscscan';

class BSCService {
  constructor() {
    // 初始化 BSC 提供者
    this.initProvider();

    // 初始化 API 密钥索引
    this.currentApiKeyIndex = 0;
  }

  // 初始化 BSC 提供者
  initProvider() {
    try {
      this.provider = new ethers.providers.JsonRpcProvider(config.bscNode.rpcUrls[0]);
      console.log('BSC 提供者初始化成功');
    } catch (error) {
      console.error('BSC 提供者初始化失败:', error);
      throw error;
    }
  }

  // 获取下一个 API 密钥
  getNextApiKey() {
    this.currentApiKeyIndex = (this.currentApiKeyIndex + 1) % config.bscScan.apiKeys.length;
    return config.bscScan.apiKeys[this.currentApiKeyIndex];
  }

  // 获取当前 API 密钥
  getCurrentApiKey() {
    return config.bscScan.apiKeys[this.currentApiKeyIndex];
  }

  // 调用 BSCScan API
  async callBscScanApi(module, action, params = {}) {
    try {
      const apiKey = this.getCurrentApiKey();

      const url = new URL(config.bscScan.apiUrl);
      url.searchParams.append('module', module);
      url.searchParams.append('action', action);
      url.searchParams.append('apikey', apiKey);

      // 添加其他参数
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
      }

      console.log(`调用 BSCScan API: ${url.toString()}`);

      const response = await axios.get(url.toString());

      // 轮换到下一个 API 密钥
      this.getNextApiKey();

      // 打印完整响应，用于调试
      //console.log(`BSCScan API 响应 (${module}.${action}): ${JSON.stringify(response.data, null, 2)}, 当前使用的API Key: ${apiKey.substring(0, 5)}..., 参数: ${JSON.stringify(params)}`);

      // 特殊处理某些 API 响应
      if (module === 'contract' && action === 'getabi' && response.data.result === 'Contract source code not verified') {
        console.log('合约源代码未验证');
        return response.data.result;
      }

      if (module === 'contract' && action === 'getsourcecode' && Array.isArray(response.data.result) && response.data.result.length > 0) {
        console.log('获取合约源代码成功');
        return response.data.result;
      }

      if (module === 'contract' && action === 'getcontractcreation') {
        if (Array.isArray(response.data.result) && response.data.result.length > 0) {
          console.log('获取合约创建者信息成功');
          return response.data.result;
        } else if (response.data.status === '0' && response.data.message === 'No contract creation information found') {
          console.log('未找到合约创建者信息');
          return [];
        }
      }

      // 检查 API 响应状态
      if (response.data.status === '0') {
        console.error(`BSCScan API 错误 (${module}.${action}):`, response.data.message || '未知错误');

        // 对于某些错误，返回空结果而不是抛出错误
        if (response.data.message === 'No transactions found' ||
            response.data.message === 'No records found') {
          return [];
        }

        throw new Error(response.data.message || '调用 BSCScan API 失败');
      }

      return response.data.result;
    } catch (error) {
      console.error(`调用 BSCScan API 失败 (${module}.${action}):`, error);

      // 返回适当的默认值，而不是抛出错误
      if (module === 'contract') {
        if (action === 'getabi') {
          return 'Error: ' + error.message;
        } else if (action === 'getsourcecode') {
          return [];
        } else if (action === 'getcontractcreation') {
          return [];
        }
      }

      throw error;
    }
  }

  // 获取交易收据
  async getTransactionReceipt(txHash) {
    try {
      return await this.provider.getTransactionReceipt(txHash);
    } catch (error) {
      console.error('获取交易收据失败:', error);
      throw error;
    }
  }

  // 获取交易详情
  async getTransaction(txHash) {
    try {
      return await this.provider.getTransaction(txHash);
    } catch (error) {
      console.error('获取交易详情失败:', error);
      throw error;
    }
  }

  // 检查交易是否包含代币销毁操作
  async checkTokenBurn(txHash) {
    console.log(`检查交易 ${txHash} 是否包含代币销毁操作...`);

    if (!txHash || txHash.trim() === '') {
      throw new Error('交易哈希不能为空');
    }

    try {
      // 获取交易收据
      const receipt = await this.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new Error('未找到交易收据，请确认交易哈希是否正确');
      }

      // 检查交易是否成功
      if (receipt.status === 0) {
        throw new Error('交易执行失败，无法检查代币销毁');
      }

      // 获取交易详情
      const tx = await this.getTransaction(txHash);
      if (!tx) {
        throw new Error('未找到交易详情，请确认交易哈希是否正确');
      }

      console.log(`交易发送者: ${tx.from}, 接收者: ${tx.to || '合约创建'}`);

      // 存储销毁信息
      const burnInfo = {
        found: false,
        token: null,
        amount: '0',
        symbol: '',
        decimals: 18,
        from: tx.from,
        burnAddress: ''
      };

      // 检查交易日志中是否有代币销毁事件
      if (receipt.logs && receipt.logs.length > 0) {
        console.log(`分析交易日志，共 ${receipt.logs.length} 条`);

        // 定义销毁地址
        const burnAddress = config.burnVerification.burnAddress;

        // 遍历所有日志
        for (const log of receipt.logs) {
          // 检查是否是 Transfer 事件（ERC20 标准事件）
          if (log.topics && log.topics.length >= 3 &&
              log.topics[0].toLowerCase() === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {

            // 解析 from 地址（topics[1]）
            const fromAddress = '0x' + log.topics[1].substring(26);

            // 解析 to 地址（topics[2]）
            const toAddress = '0x' + log.topics[2].substring(26);

            // 检查是否转账到销毁地址
            if (toAddress.toLowerCase() === burnAddress.toLowerCase()) {
              console.log(`发现代币销毁事件: 从 ${fromAddress} 到销毁地址 ${toAddress}`);

              // 获取代币合约地址
              const tokenAddress = log.address;

              // 解析销毁金额
              let amount = '0';
              if (log.data && log.data !== '0x') {
                amount = ethers.BigNumber.from(log.data).toString();
              }

              console.log(`代币地址: ${tokenAddress}, 销毁金额: ${amount}`);

              // 获取代币信息（符号、小数位等）
              try {
                const tokenContract = new ethers.Contract(
                  tokenAddress,
                  [
                    'function name() view returns (string)',
                    'function symbol() view returns (string)',
                    'function decimals() view returns (uint8)'
                  ],
                  this.provider
                );

                // 获取代币符号
                let symbol = await tokenContract.symbol();
                // 获取代币名称
                let name = await tokenContract.name();
                // 获取代币小数位
                const decimals = await tokenContract.decimals();

                // 确保保留原始大小写
                console.log(`原始代币名称: ${name}, 原始符号: ${symbol}, 小数位: ${decimals}`);

                // 如果名称或符号是全小写，尝试使用更常见的大小写形式
                if (symbol === symbol.toLowerCase() && symbol.length > 0) {
                  // 检查是否是常见的代币符号，如果是，使用常见的大小写形式
                  const commonSymbols = {
                    'btc': 'BTC',
                    'eth': 'ETH',
                    'bnb': 'BNB',
                    'usdt': 'USDT',
                    'usdc': 'USDC',
                    'busd': 'BUSD',
                    'dai': 'DAI',
                    'cake': 'CAKE',
                    'xrp': 'XRP',
                    'ada': 'ADA',
                    'doge': 'DOGE',
                    'shib': 'SHIB',
                    'dot': 'DOT',
                    'matic': 'MATIC',
                    'link': 'LINK',
                    'uni': 'UNI',
                    'sol': 'SOL',
                    'avax': 'AVAX',
                    'ltc': 'LTC',
                    'trx': 'TRX',
                    'donkey': 'DONKEY'
                  };

                  if (commonSymbols[symbol.toLowerCase()]) {
                    symbol = commonSymbols[symbol.toLowerCase()];
                    console.log(`使用常见大小写形式的符号: ${symbol}`);
                  } else {
                    // 如果不是常见符号，将首字母大写
                    symbol = symbol.toUpperCase();
                    console.log(`将符号转换为大写: ${symbol}`);
                  }
                }

                // 如果名称是全小写，将首字母大写
                if (name === name.toLowerCase() && name.length > 0) {
                  name = name.charAt(0).toUpperCase() + name.slice(1);
                  console.log(`将名称首字母大写: ${name}`);
                }

                console.log(`最终代币名称: ${name}, 最终符号: ${symbol}, 小数位: ${decimals}`);

                // 格式化销毁金额
                const formattedAmount = ethers.utils.formatUnits(amount, decimals);

                console.log(`销毁了 ${formattedAmount} ${symbol} 代币`);

                // 更新销毁信息
                burnInfo.found = true;
                burnInfo.token = {
                  address: tokenAddress,
                  name: name,
                  symbol: symbol,
                  decimals: decimals
                };
                burnInfo.amount = formattedAmount;
                burnInfo.symbol = symbol;
                burnInfo.decimals = decimals;
                burnInfo.burnAddress = toAddress;

                // 检查是否是特定的代币合约和数量
                const targetContractAddress = config.burnVerification.targetContractAddress;
                const targetAmount = config.burnVerification.targetAmount;

                // 精确比较合约地址（不区分大小写）
                burnInfo.isTargetContract = tokenAddress.toLowerCase() === targetContractAddress.toLowerCase();

                // 精确比较数量（必须恰好是100，不能多也不能少）
                // 使用字符串比较以避免浮点数精度问题
                const exactAmount = formattedAmount.includes('.')
                  ? formattedAmount.replace(/\.?0+$/, '') // 移除尾部的零和小数点
                  : formattedAmount;
                const exactTargetAmount = targetAmount.includes('.')
                  ? targetAmount.replace(/\.?0+$/, '')
                  : targetAmount;

                burnInfo.isTargetAmount = exactAmount === exactTargetAmount;
                burnInfo.isValidBurn = burnInfo.isTargetContract && burnInfo.isTargetAmount;

                console.log(`销毁数量比较: 实际=${exactAmount}, 目标=${exactTargetAmount}, 匹配=${burnInfo.isTargetAmount}`);

                // 找到销毁事件后，可以继续查找其他销毁事件，或者直接返回
                // 这里选择继续查找，以支持一个交易中销毁多种代币的情况
              } catch (error) {
                console.error(`获取代币信息失败: ${error.message}`);

                // 即使获取代币信息失败，也标记为找到销毁事件
                burnInfo.found = true;
                burnInfo.token = {
                  address: tokenAddress,
                  name: 'Unknown Token',
                  symbol: 'UNKNOWN',
                  decimals: 18
                };
                burnInfo.amount = ethers.utils.formatUnits(amount, 18); // 假设小数位是18
                burnInfo.symbol = 'UNKNOWN';
                burnInfo.burnAddress = toAddress;

                // 检查是否是特定的代币合约
                const targetContractAddress = config.burnVerification.targetContractAddress;
                burnInfo.isTargetContract = tokenAddress.toLowerCase() === targetContractAddress.toLowerCase();
                burnInfo.isTargetAmount = false; // 无法确定数量，默认为 false
                burnInfo.isValidBurn = false; // 无法确定，默认为 false
              }
            }
          }
        }
      }

      // 返回销毁信息
      return burnInfo;

    } catch (error) {
      console.error(`检查代币销毁失败: ${error.message}`);
      throw error;
    }
  }

  // 获取地址的交易记录
  async getTransactions(address, page = 1, offset = 5000, sort = 'desc') { // 增加到5000条，接近BSCScan API的最大限制
    try {
      const transactions = await this.callBscScanApi('account', 'txlist', {
        address,
        page,
        offset,
        sort
      });

      return transactions;
    } catch (error) {
      console.error('获取交易记录失败:', error);
      throw error;
    }
  }

  // 获取地址的代币转账记录
  async getTokenTransfers(address, page = 1, offset = 5000, sort = 'desc') { // 增加到5000条，接近BSCScan API的最大限制
    try {
      // 检查是否启用了 Moralis
      if (config.moralis && config.moralis.enabled && config.moralis.apiKey) {
        try {
          console.log('尝试使用 Moralis API 获取代币转账记录...');
          currentApiProvider = 'moralis';

          // 使用 Moralis API 获取代币转账记录
          const transfers = await this.getTokenTransfersFromMoralis(address, offset);

          // 验证返回的数据格式
          if (transfers && transfers.length > 0) {
            const firstTx = transfers[0];
            console.log('Moralis 返回的第一条记录字段:', Object.keys(firstTx));

            // 检查必要字段是否存在
            const requiredFields = ['hash', 'from', 'to', 'contractAddress', 'tokenName', 'tokenSymbol', 'tokenDecimal', 'value'];
            const missingFields = requiredFields.filter(field => !firstTx[field]);

            if (missingFields.length > 0) {
              console.error(`Moralis 返回的数据缺少必要字段: ${missingFields.join(', ')}`);
              throw new Error(`数据格式不兼容: 缺少字段 ${missingFields.join(', ')}`);
            }
          }

          return transfers;
        } catch (moralisError) {
          console.error('Moralis API 调用失败，回退到 BSCScan API:', moralisError);
          currentApiProvider = 'bscscan';
          // 回退到 BSCScan API
        }
      }

      // 使用 BSCScan API
      console.log('使用 BSCScan API 获取代币转账记录...');
      currentApiProvider = 'bscscan';
      const transfers = await this.callBscScanApi('account', 'tokentx', {
        address,
        page,
        offset,
        sort
      });

      return transfers;
    } catch (error) {
      console.error('获取代币转账记录失败:', error);
      throw error;
    }
  }

  // 从 Moralis API 获取代币转账记录
  async getTokenTransfersFromMoralis(address, targetLimit = 5000) {
    try {
      console.log(`从 Moralis 获取代币转账记录: ${address}, 目标记录数: ${targetLimit}`);

      // 构建 Moralis API URL 和基本参数
      const url = `${config.moralis.apiUrl}/${address}/erc20/transfers`;

      // Moralis API 每次请求的最大记录数为 100
      const pageLimit = 100;

      // 用于存储所有获取的记录
      let allTransfers = [];
      // 游标，用于分页
      let cursor = null;
      // 请求计数器
      let requestCount = 0;
      // 最大请求次数（防止无限循环）
      const maxRequests = Math.ceil(targetLimit / pageLimit);

      console.log(`Moralis API URL: ${url}`);
      console.log(`每页记录数: ${pageLimit}, 最大请求次数: ${maxRequests}`);

      // 循环请求，直到获取足够的记录或达到最大请求次数
      while (allTransfers.length < targetLimit && requestCount < maxRequests) {
        requestCount++;

        // 构建请求参数
        const params = {
          chain: 'bsc',
          limit: pageLimit,
          order: 'DESC'
        };

        // 如果有游标，添加到参数中
        if (cursor) {
          params.cursor = cursor;
        }

        console.log(`发送第 ${requestCount} 次请求, 参数:`, params);

        // 发送请求
        const response = await axios.get(url, {
          headers: {
            'Accept': 'application/json',
            'X-API-Key': config.moralis.apiKey
          },
          params: params
        });

        // 检查响应
        console.log(`第 ${requestCount} 次请求响应状态:`, response.status);

        // 获取结果和游标
        const result = response.data.result || [];
        cursor = response.data.cursor || null;

        console.log(`第 ${requestCount} 次请求返回 ${result.length} 条记录`);
        if (cursor) {
          console.log(`获取到游标: ${cursor.substring(0, 20)}...`);
        } else {
          console.log('没有更多游标，这是最后一页');
        }

        // 将结果添加到总记录中
        allTransfers = allTransfers.concat(result);

        // 如果没有游标或结果为空，说明没有更多数据了
        if (!cursor || result.length === 0) {
          console.log('没有更多数据，停止请求');
          break;
        }

        // 不添加延迟，直接进行下一次请求
        if (requestCount < maxRequests && allTransfers.length < targetLimit) {
          console.log('继续发送下一次请求...');
        }
      }

      console.log(`总共获取了 ${allTransfers.length} 条记录，发送了 ${requestCount} 次请求`);

      if (allTransfers.length === 0) {
        console.log('Moralis API 返回空结果');
        return [];
      }

      // 如果有记录，打印第一条记录示例
      if (allTransfers.length > 0) {
        console.log('第一条记录示例:', JSON.stringify(allTransfers[0], null, 2));
      }

      // 转换为与 BSCScan API 相同的格式
      const transfers = allTransfers.map(tx => {
        // 打印原始字段，帮助调试
        console.log('Moralis 原始字段:', Object.keys(tx));

        // 构建与 BSCScan API 兼容的格式
        return {
          hash: tx.transaction_hash,
          blockNumber: tx.block_number,
          timeStamp: tx.block_timestamp ? Math.floor(new Date(tx.block_timestamp).getTime() / 1000).toString() : '',
          from: tx.from_address,
          to: tx.to_address,
          value: tx.value,
          // 重要：确保 contractAddress 字段正确映射
          contractAddress: tx.token_address || tx.address,
          // 重要：确保 tokenName 和 tokenSymbol 字段正确映射
          tokenName: tx.token_name || 'Unknown Token',
          tokenSymbol: tx.token_symbol || 'UNKNOWN',
          tokenDecimal: tx.token_decimals || '18',
          gas: tx.gas || '',
          gasPrice: tx.gas_price || '',
          gasUsed: tx.receipt_gas_used || '',
          nonce: tx.nonce || '',
          transactionIndex: tx.transaction_index || '',
          input: '',
          confirmations: ''
        };
      });

      // 限制返回的记录数量
      const limitedTransfers = transfers.slice(0, targetLimit);
      console.log(`最终返回 ${limitedTransfers.length} 条记录`);

      return limitedTransfers;
    } catch (error) {
      console.error('从 Moralis 获取代币转账记录失败:', error);
      throw error;
    }
  }

  // 获取合约 ABI
  async getContractABI(contractAddress) {
    try {
      console.log(`获取合约 ABI: ${contractAddress}`);

      const abi = await this.callBscScanApi('contract', 'getabi', {
        address: contractAddress
      });

      // 检查 ABI 是否有效
      if (abi === 'Contract source code not verified') {
        console.log(`合约 ${contractAddress} 源代码未验证，但仍将尝试获取创建者信息`);
        return abi;
      }

      // 尝试解析 ABI
      try {
        if (typeof abi === 'string') {
          JSON.parse(abi);
        }
        console.log(`合约 ${contractAddress} ABI 有效`);
      } catch (parseError) {
        console.error(`合约 ${contractAddress} ABI 解析失败:`, parseError);
        return 'Error: Invalid ABI format';
      }

      return abi;
    } catch (error) {
      console.error(`获取合约 ${contractAddress} ABI 失败:`, error);
      return 'Error: ' + error.message;
    }
  }

  // 获取合约源代码
  async getContractSourceCode(contractAddress) {
    try {
      console.log(`获取合约源代码: ${contractAddress}`);

      const sourceCode = await this.callBscScanApi('contract', 'getsourcecode', {
        address: contractAddress
      });

      // 检查源代码是否有效
      if (Array.isArray(sourceCode) && sourceCode.length > 0) {
        console.log(`合约 ${contractAddress} 源代码获取成功`);

        // 打印源代码的一些关键信息
        const firstItem = sourceCode[0];
        console.log('合约名称:', firstItem.ContractName || 'Unknown');
        console.log('编译器版本:', firstItem.CompilerVersion || 'Unknown');
        console.log('是否已验证:', firstItem.ABI !== 'Contract source code not verified');
      } else {
        console.log(`合约 ${contractAddress} 源代码为空或格式不正确`);
      }

      return sourceCode;
    } catch (error) {
      console.error(`获取合约 ${contractAddress} 源代码失败:`, error);
      return [];
    }
  }

  // 获取合约创建者信息
  async getContractCreator(contractAddress) {
    try {
      // 获取当前API Key
      const apiKey = this.getCurrentApiKey();
      console.log(`获取合约创建者信息: ${contractAddress}, 使用API Key: ${apiKey.substring(0, 5)}...`);

      const creationInfo = await this.callBscScanApi('contract', 'getcontractcreation', {
        contractaddresses: contractAddress
      });

      // 检查创建者信息是否有效
      if (Array.isArray(creationInfo) && creationInfo.length > 0) {
        console.log(`合约 ${contractAddress} 创建者信息获取成功:`);
        console.log('创建者:', creationInfo[0].contractCreator);
        console.log('创建交易:', creationInfo[0].txHash);
        //console.log(`当前查询的合约地址: ${contractAddress}, 当前使用的API Key: ${this.getCurrentApiKey().substring(0, 5)}...`);
      } else {
        console.log(`未找到合约 ${contractAddress} 的创建者信息`);
        //console.log(`当前查询的合约地址: ${contractAddress}, 当前使用的API Key: ${this.getCurrentApiKey().substring(0, 5)}...`);
      }

      return creationInfo;
    } catch (error) {
      console.error(`获取合约 ${contractAddress} 创建者信息失败:`, error);
      //console.log(`当前查询的合约地址: ${contractAddress}, 当前使用的API Key: ${this.getCurrentApiKey().substring(0, 5)}...`);
      return [];
    }
  }

  // 获取合约信息
  async getContractInfo(contractAddress) {
    try {
      console.log(`获取合约信息: ${contractAddress}`);

      // 获取合约 ABI
      const abi = await this.getContractABI(contractAddress);

      // 获取合约源代码
      const sourceCode = await this.getContractSourceCode(contractAddress);

      // 获取合约创建者信息
      const creationInfo = await this.getContractCreator(contractAddress);

      // 获取合约字节码大小
      const bytecodeSize = await this.getContractBytecode(contractAddress);

      // 获取合约余额
      const balance = await this.getAddressBalance(contractAddress);

      // 检查是否是代币合约
      let isToken = false;
      let totalSupply = '0';

      try {
        // 尝试获取代币总供应量，如果成功则认为是代币合约
        totalSupply = await this.getTokenTotalSupply(contractAddress);
        if (totalSupply !== 'Unknown') {
          isToken = true;
        }
      } catch (error) {
        console.log(`不是代币合约或获取代币信息失败: ${error.message}`);
      }

      // 检查创建者信息是否有效
      if (Array.isArray(creationInfo) && creationInfo.length > 0) {
        console.log(`合约 ${contractAddress} 创建者信息有效:`);
        console.log('创建者:', creationInfo[0].contractCreator);
        console.log('创建交易:', creationInfo[0].txHash);
      } else {
        console.log(`未找到合约 ${contractAddress} 的创建者信息，将使用空数组`);
      }

      // 构建合约信息对象
      const contractInfo = {
        success: true,
        result: {
          abi: abi,
          sourceCode: sourceCode,
          creator: creationInfo, // 确保这里包含创建者信息数组
          bytecodeSize: bytecodeSize,
          balance: balance,
          totalSupply: totalSupply,
          isToken: isToken // 添加是否是代币合约的标志
        }
      };

      // 打印完整的合约信息，用于调试
      console.log(`合约信息响应 - 合约地址: ${contractAddress}, API Key: ${this.getCurrentApiKey().substring(0, 10)}..., API 提供商: ${this.getCurrentApiProvider()}`);
      console.log(`合约信息详情:`, JSON.stringify({
        abi: typeof abi === 'string' && abi.length > 100 ? abi.substring(0, 100) + '...' : abi,
        sourceCode: Array.isArray(sourceCode) && sourceCode.length > 0 ? '有源代码' : '无源代码',
        creator: creationInfo,
        bytecodeSize: bytecodeSize,
        balance: balance,
        totalSupply: totalSupply,
        isToken: isToken
      }, null, 2));

      console.log(`合约信息获取成功: ${contractAddress}`);
      return contractInfo;
    } catch (error) {
      console.error(`获取合约信息失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 获取合约字节码
  async getContractBytecode(contractAddress) {
    try {
      console.log(`获取合约字节码: ${contractAddress}`);

      // 使用 eth_getCode RPC 调用获取合约字节码
      const response = await axios.post(this.rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getCode',
        params: [contractAddress, 'latest']
      });

      if (response.data && response.data.result) {
        const bytecode = response.data.result;
        // 计算字节码大小（去掉 '0x' 前缀，每两个字符代表一个字节）
        const bytecodeSize = bytecode.startsWith('0x') ? (bytecode.length - 2) / 2 : bytecode.length / 2;
        console.log(`合约 ${contractAddress} 字节码大小: ${bytecodeSize} 字节`);
        return bytecodeSize;
      } else {
        console.log(`获取合约 ${contractAddress} 字节码失败`);
        return 0;
      }
    } catch (error) {
      console.error(`获取合约 ${contractAddress} 字节码失败:`, error);
      return 0;
    }
  }

  // 获取地址的 BNB 余额
  async getAddressBalance(address) {
    try {
      console.log(`获取地址 ${address} 的 BNB 余额`);

      const balance = await this.callBscScanApi('account', 'balance', {
        address: address,
        tag: 'latest'
      });

      // 将 wei 转换为 BNB
      const bnbBalance = parseFloat(balance) / 1e18;
      console.log(`地址 ${address} 的 BNB 余额: ${bnbBalance} BNB`);
      return bnbBalance.toFixed(6);
    } catch (error) {
      console.error(`获取地址 ${address} 的 BNB 余额失败:`, error);
      return '0';
    }
  }

  // 获取代币的总供应量
  async getTokenTotalSupply(contractAddress) {
    try {
      console.log(`获取代币 ${contractAddress} 的总供应量`);

      const totalSupply = await this.callBscScanApi('stats', 'tokensupply', {
        contractaddress: contractAddress
      });

      // 获取代币小数位
      let decimals = 18; // 默认值
      try {
        // 尝试从合约调用中获取小数位
        const response = await axios.post(this.rpcUrl, {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{
            to: contractAddress,
            data: '0x313ce567' // decimals() 函数的签名
          }, 'latest']
        });

        if (response.data && response.data.result) {
          // 将十六进制结果转换为十进制
          decimals = parseInt(response.data.result, 16);
          console.log(`代币 ${contractAddress} 的小数位: ${decimals}`);
        }
      } catch (error) {
        console.error(`获取代币 ${contractAddress} 的小数位失败:`, error);
      }

      // 将 wei 转换为代币单位
      const tokenTotalSupply = parseFloat(totalSupply) / Math.pow(10, decimals);
      console.log(`代币 ${contractAddress} 的总供应量: ${tokenTotalSupply}`);
      return tokenTotalSupply.toLocaleString();
    } catch (error) {
      console.error(`获取代币 ${contractAddress} 的总供应量失败:`, error);
      return 'Unknown';
    }
  }
}

// 添加获取当前 API 提供商的方法
BSCService.prototype.getCurrentApiProvider = function() {
  return currentApiProvider;
};

module.exports = new BSCService();

