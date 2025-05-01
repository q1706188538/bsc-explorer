// 前端 API 服务
class ApiService {
    constructor() {
        this.API_BASE_URL = 'http://localhost:3000/api';
        this.transactionsCache = {};
        this.tokenContracts = {};
        this.createdContracts = {};
        this.contractCreatorsQueryProgress = {
            isQuerying: false,
            total: 0,
            completed: 0,
            withCreator: 0
        };

        // 默认并发限制
        this.maxConcurrent = 3;

        // 加载配置
        this.loadConfig();
    }

    // 加载配置
    async loadConfig() {
        try {
            console.log('从后端加载配置...');
            const response = await fetch(`${this.API_BASE_URL}/config`);
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }

            const config = await response.json();
            console.log('配置加载成功:', config);

            // 设置并发限制
            if (config.bscScan && config.bscScan.maxConcurrent) {
                this.maxConcurrent = config.bscScan.maxConcurrent;
                console.log(`设置并发限制为: ${this.maxConcurrent}`);
            }
        } catch (error) {
            console.error('加载配置失败:', error);
            console.log('使用默认配置');
        }
    }

    // 通用 API 调用函数
    async callApi(endpoint, method = 'GET', data = null) {
        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include' // 包含 cookies
            };

            if (data && (method === 'POST' || method === 'PUT')) {
                options.body = JSON.stringify(data);
            }

            console.log(`调用 API: ${this.API_BASE_URL}${endpoint}`, method, data);

            const response = await fetch(`${this.API_BASE_URL}${endpoint}`, options);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || '请求失败');
            }

            return result;
        } catch (error) {
            console.error('API 调用失败:', error);
            throw error;
        }
    }

    // 验证代币销毁
    async checkTokenBurn(txHash) {
        try {
            const response = await this.callApi('/verify-burn', 'POST', { txHash });
            return response.result;
        } catch (error) {
            console.error('验证代币销毁失败:', error);
            throw error;
        }
    }

    // 获取验证状态
    async getVerificationStatus() {
        try {
            const response = await this.callApi('/verification-status');
            return {
                verified: response.verified,
                txHash: response.txHash,
                from: response.from
            };
        } catch (error) {
            console.error('获取验证状态失败:', error);
            return { verified: false };
        }
    }

    // 获取交易记录
    async getTransactions(address, page = 1, pageSize = 5000) { // 增加到5000条，接近BSCScan API的最大限制
        try {
            // 检查缓存
            const cacheKey = `${address}_${page}_${pageSize}`;
            if (this.transactionsCache[cacheKey]) {
                console.log(`从缓存获取交易记录: ${cacheKey}`);
                return this.transactionsCache[cacheKey];
            }

            console.log('===== 开始获取交易记录 =====');

            // 获取普通交易记录
            const normalTxResponse = await this.callApi('/transactions', 'POST', {
                address,
                page,
                offset: pageSize
            });

            // 获取代币交易记录
            const tokenTxResponse = await this.callApi('/token-transfers', 'POST', {
                address,
                page,
                offset: pageSize
            });

            console.log(`普通交易API返回了 ${normalTxResponse.result ? normalTxResponse.result.length : 0} 条交易记录`);
            console.log(`代币交易API返回了 ${tokenTxResponse.result ? tokenTxResponse.result.length : 0} 条交易记录`);

            // 处理普通交易记录
            const normalTransactions = normalTxResponse.result ? normalTxResponse.result.map(tx => {
                // 添加方向（转入/转出）
                tx.direction = tx.from.toLowerCase() === address.toLowerCase() ? 'out' : 'in';

                // 格式化值
                if (tx.value && !isNaN(tx.value)) {
                    const bnbValue = parseFloat(tx.value) / 1e18;
                    tx.value = `${bnbValue.toFixed(6)} BNB`;
                }

                // 添加交易类型
                tx.type = 'BNB';

                return tx;
            }) : [];

            // 收集所有代币合约地址
            const tokenContracts = new Set();
            if (tokenTxResponse.result) {
                tokenTxResponse.result.forEach(tx => {
                    if (tx.contractAddress) {
                        tokenContracts.add(tx.contractAddress.toLowerCase());
                    }
                });
            }
            console.log(`发现 ${tokenContracts.size} 个代币合约地址`);

            // 初始化合约与交易的关联信息
            this.contractTransactions = this.contractTransactions || {};

            // 处理代币交易记录
            const tokenTransactions = tokenTxResponse.result ? tokenTxResponse.result.map(tx => {
                // 添加方向（转入/转出）
                tx.direction = tx.from.toLowerCase() === address.toLowerCase() ? 'out' : 'in';

                // 格式化值（使用代币小数位）
                if (tx.value && !isNaN(tx.value) && tx.tokenDecimal) {
                    const tokenValue = parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal));
                    tx.value = `${tokenValue.toFixed(6)} ${tx.tokenSymbol || 'TOKEN'}`;
                }

                // 添加交易类型
                tx.type = 'Token';

                // 记录代币信息
                if (tx.contractAddress) {
                    const contractAddr = tx.contractAddress.toLowerCase();
                    console.log(`代币交易 ${tx.hash} 包含代币信息: ${tx.tokenName || 'Unknown'} (${tx.tokenSymbol || 'UNKNOWN'}), 合约: ${tx.contractAddress || 'Unknown'}`);

                    // 将代币信息添加到代币合约列表
                    if (!this.tokenContracts[contractAddr]) {
                        // 获取代币名称和符号，使用原始值
                        let tokenSymbol = tx.tokenSymbol || '';
                        let tokenName = tx.tokenName || '';

                        // 如果仍然没有有效的名称和符号，使用默认值
                        if (!tokenSymbol) tokenSymbol = 'UNKNOWN';
                        if (!tokenName) tokenName = 'Unknown Token';

                        console.log(`添加代币合约: ${tx.contractAddress}, 名称: ${tokenName}, 符号: ${tokenSymbol}`);

                        this.tokenContracts[contractAddr] = {
                            address: tx.contractAddress,
                            name: tokenName,
                            symbol: tokenSymbol,
                            decimals: tx.tokenDecimal || 18,
                            creator: null, // 初始化创建者为null
                            createdByCurrentAddress: false, // 是否由当前地址创建
                            relatedTransactions: [], // 关联的交易
                            fromTokenTx: true // 标记为从代币交易中发现的合约
                        };
                    }

                    // 记录合约与交易的关联
                    if (!this.contractTransactions[contractAddr]) {
                        this.contractTransactions[contractAddr] = [];
                    }

                    // 添加交易信息
                    const txInfo = {
                        hash: tx.hash,
                        from: tx.from,
                        to: tx.to,
                        value: tx.value,
                        timeStamp: tx.timeStamp,
                        tokenName: tx.tokenName,
                        tokenSymbol: tx.tokenSymbol
                    };

                    // 避免重复添加
                    if (!this.contractTransactions[contractAddr].some(t => t.hash === tx.hash)) {
                        this.contractTransactions[contractAddr].push(txInfo);

                        // 同时更新合约对象中的关联交易
                        if (this.tokenContracts[contractAddr].relatedTransactions &&
                            !this.tokenContracts[contractAddr].relatedTransactions.some(t => t.hash === tx.hash)) {
                            this.tokenContracts[contractAddr].relatedTransactions.push(txInfo);
                        }
                    }
                }

                return tx;
            }) : [];

            // 输出样本交易记录详细信息
            if (normalTransactions.length > 0 || tokenTransactions.length > 0) {
                // 只输出前3条记录的详细信息，避免日志过多
                const sampleNormalTxs = normalTransactions.slice(0, 1);
                const sampleTokenTxs = tokenTransactions.slice(0, 2);

                console.log('样本交易记录详细信息:');

                // 输出普通交易样本
                sampleNormalTxs.forEach((tx, index) => {
                    console.log(`--- 普通交易 ${index + 1} ---`);
                    console.log('交易完整信息:');
                    for (const [key, value] of Object.entries(tx)) {
                        console.log(`${key}: ${value}`);
                    }
                    console.log('-------------------');
                });

                // 输出代币交易样本
                sampleTokenTxs.forEach((tx, index) => {
                    console.log(`--- 代币交易 ${index + 1} ---`);
                    console.log('交易完整信息:');
                    for (const [key, value] of Object.entries(tx)) {
                        console.log(`${key}: ${value}`);
                    }
                    console.log('-------------------');
                });
            } else {
                console.log('API未返回交易记录或返回数据格式不正确');
            }

            // 合并交易记录并按时间戳排序
            const allTransactions = [...normalTransactions, ...tokenTransactions].sort((a, b) =>
                parseInt(b.timeStamp) - parseInt(a.timeStamp)
            );

            console.log(`合并后共有 ${allTransactions.length} 条交易记录`);
            console.log('===== 交易记录获取完成 =====');

            // 创建分页信息
            const result = {
                transactions: allTransactions,
                pagination: {
                    currentPage: page,
                    pageSize,
                    totalRecords: allTransactions.length,
                    hasPreviousPage: page > 1,
                    hasNextPage: allTransactions.length === pageSize // 如果返回的记录数等于页大小，假设有下一页
                }
            };

            // 缓存结果
            this.transactionsCache[cacheKey] = result;

            return result;
        } catch (error) {
            console.error('获取交易记录失败:', error);
            throw error;
        }
    }

    // 获取缓存的交易记录
    getCachedTransactions(address, page, pageSize) {
        const cacheKey = `${address}_${page}_${pageSize}`;
        return this.transactionsCache[cacheKey];
    }

    // 清除交易记录缓存
    clearTransactionsCache(address = null, clearTokenContracts = false) {
        if (address) {
            // 清除特定地址的缓存
            Object.keys(this.transactionsCache).forEach(key => {
                if (key.startsWith(`${address}_`)) {
                    delete this.transactionsCache[key];
                }
            });
        } else {
            // 清除所有缓存
            this.transactionsCache = {};
        }

        // 如果需要，清除代币合约缓存
        if (clearTokenContracts) {
            this.tokenContracts = {};
            this.createdContracts = {};
        }

        console.log('缓存已清除', address, clearTokenContracts);
    }

    // 设置当前查询地址
    setCurrentQueryAddress(address) {
        this.currentQueryAddress = address;
    }

    // 获取合约信息
    async getContractInfo(contractAddress, currentQueryAddress = null) {
        try {
            console.log(`获取合约信息: ${contractAddress}`);
            const response = await this.callApi('/contract-info', 'POST', { contractAddress });

            // 打印响应，帮助调试
            console.log('合约信息响应:', JSON.stringify(response, null, 2));

            // 处理合约信息
            const contractInfo = response.result;

            // 检查响应是否包含必要的字段
            if (!contractInfo) {
                console.error('合约信息响应中没有 result 字段');
                return {
                    address: contractAddress,
                    balance: 'Unknown',
                    bytecodeSize: 'Unknown',
                    creator: 'Unknown',
                    creationTx: 'Unknown',
                    hasVerifiedSource: false,
                    isToken: false,
                    tokenInfo: null,
                    error: '无法获取合约信息'
                };
            }

            // 解析 ABI
            let abiMessage = '';

            if (contractInfo.abi) {
                try {
                    // 如果 ABI 是字符串，尝试解析为 JSON
                    if (typeof contractInfo.abi === 'string') {
                        if (contractInfo.abi === 'Contract source code not verified') {
                            abiMessage = '合约源代码未验证';
                        } else {
                            try {
                                JSON.parse(contractInfo.abi);
                            } catch (e) {
                                console.error('解析 ABI 失败:', e);
                                abiMessage = '无法解析 ABI';
                            }
                        }
                    }
                } catch (error) {
                    console.error('处理 ABI 失败:', error);
                    abiMessage = '处理 ABI 时出错';
                }
            } else {
                abiMessage = '没有 ABI 信息';
            }

            // 解析源代码
            let sourceCodeInfo = null;

            if (contractInfo.sourceCode && Array.isArray(contractInfo.sourceCode) && contractInfo.sourceCode.length > 0) {
                sourceCodeInfo = contractInfo.sourceCode[0];
            } else if (contractInfo.sourceCode && typeof contractInfo.sourceCode === 'object') {
                sourceCodeInfo = contractInfo.sourceCode;
            }

            // 检查是否是代币合约
            let isToken = false;
            let tokenName = 'Unknown Token';
            let tokenSymbol = 'UNKNOWN';

            if (sourceCodeInfo && sourceCodeInfo.ABI) {
                try {
                    // 检查 ABI 是否包含代币方法
                    isToken = sourceCodeInfo.ABI.includes('totalSupply') &&
                              sourceCodeInfo.ABI.includes('balanceOf') &&
                              sourceCodeInfo.ABI.includes('transfer');

                    // 获取代币名称和符号
                    if (isToken) {
                        // 尝试从合约名称获取代币名称和符号
                        if (sourceCodeInfo.ContractName) {
                            tokenName = sourceCodeInfo.ContractName;
                            // 如果合约名称包含空格，可能是 "Token Name"，取第一个单词作为符号
                            if (sourceCodeInfo.ContractName.includes(' ')) {
                                const parts = sourceCodeInfo.ContractName.split(' ');
                                tokenSymbol = parts[0].toUpperCase();
                            } else {
                                tokenSymbol = sourceCodeInfo.ContractName.toUpperCase();
                            }
                        }

                        // 如果有更具体的代币信息，使用它们
                        if (sourceCodeInfo.TokenName) {
                            tokenName = sourceCodeInfo.TokenName;
                        }

                        if (sourceCodeInfo.TokenSymbol) {
                            tokenSymbol = sourceCodeInfo.TokenSymbol.toUpperCase();
                        }
                    }
                } catch (error) {
                    console.error('检查代币合约失败:', error);
                }
            }

            // 如果已经有这个代币合约的信息，并且不是默认值，使用已有的信息
            if (this.tokenContracts[contractAddress.toLowerCase()]) {
                const existingContract = this.tokenContracts[contractAddress.toLowerCase()];

                if (existingContract.name && existingContract.name !== 'Unknown Token' && existingContract.name !== 'Unknown Contract') {
                    tokenName = existingContract.name;
                }

                if (existingContract.symbol && existingContract.symbol !== 'UNKNOWN') {
                    tokenSymbol = existingContract.symbol;
                }
            }

            // 获取创建者信息
            let creator = 'Unknown';
            let creationTx = 'Unknown';
            let createdByCurrentAddress = false;

            if (contractInfo.creator && Array.isArray(contractInfo.creator) && contractInfo.creator.length > 0) {
                creator = contractInfo.creator[0].contractCreator || 'Unknown';
                creationTx = contractInfo.creator[0].txHash || 'Unknown';

                if (currentQueryAddress && creator) {
                    createdByCurrentAddress = creator.toLowerCase() === currentQueryAddress.toLowerCase();
                }
            }

            // 如果是代币合约，添加到代币合约列表
            if (isToken) {
                this.tokenContracts[contractAddress.toLowerCase()] = {
                    address: contractAddress,
                    name: tokenName,
                    symbol: tokenSymbol,
                    creator: creator,
                    createdByCurrentAddress: createdByCurrentAddress
                };
            }

            // 获取后端返回的额外信息
            const bytecodeSize = contractInfo.bytecodeSize || 'Unknown';
            const balance = contractInfo.balance || 'Unknown';
            const totalSupply = contractInfo.totalSupply || 'Unknown';

            // 返回处理后的合约信息
            return {
                address: contractAddress,
                balance: balance + ' BNB', // 使用后端返回的 BNB 余额
                bytecodeSize: bytecodeSize + ' 字节', // 使用后端返回的字节码大小
                creator: creator,
                creationTx: creationTx,
                hasVerifiedSource: sourceCodeInfo && sourceCodeInfo.ABI && sourceCodeInfo.ABI !== 'Contract source code not verified',
                isToken: isToken,
                abiMessage: abiMessage,
                tokenInfo: isToken ? {
                    name: tokenName,
                    symbol: tokenSymbol,
                    decimals: 18, // 默认值
                    totalSupply: totalSupply // 使用后端返回的总供应量
                } : null
            };
        } catch (error) {
            console.error('获取合约信息失败:', error);

            // 返回错误信息
            return {
                address: contractAddress,
                balance: 'Unknown',
                bytecodeSize: 'Unknown',
                creator: 'Error',
                creationTx: 'Error',
                hasVerifiedSource: false,
                isToken: false,
                tokenInfo: null,
                error: error.message
            };
        }
    }

    // 获取代币合约列表
    getTokenContracts() {
        return this.tokenContracts;
    }

    // 更新所有代币合约的名称和符号
    updateAllTokenContractNames() {
        console.log('开始更新所有代币合约的名称和符号...');

        // 获取所有代币合约
        const contracts = Object.values(this.tokenContracts || {});

        if (contracts.length === 0) {
            console.log('没有代币合约需要更新');
            return;
        }

        console.log(`共有 ${contracts.length} 个代币合约需要更新`);

        // 遍历所有合约，更新名称和符号
        for (const contract of contracts) {
            const contractAddr = contract.address.toLowerCase();

            // 从BSCScan API获取的代币信息
            if (contract.tokenName && contract.tokenSymbol) {
                contract.name = contract.tokenName;
                contract.symbol = contract.tokenSymbol;
                console.log(`更新合约 ${contractAddr} 的名称和符号: ${contract.name} (${contract.symbol})`);
                continue;
            }

            // 如果没有名称和符号，尝试从交易记录中获取
            if (this.contractTransactions && this.contractTransactions[contractAddr]) {
                const transactions = this.contractTransactions[contractAddr];

                for (const tx of transactions) {
                    if (tx.tokenName && tx.tokenSymbol) {
                        contract.name = tx.tokenName;
                        contract.symbol = tx.tokenSymbol;
                        console.log(`从交易记录中获取合约 ${contractAddr} 的名称和符号: ${contract.name} (${contract.symbol})`);
                        break;
                    }
                }
            } else {
                // 如果没有关联交易，尝试从交易缓存中查找
                let foundTokenInfo = false;

                // 遍历所有缓存的交易记录
                Object.values(this.transactionsCache).forEach(cachedResult => {
                    if (cachedResult && cachedResult.transactions && !foundTokenInfo) {
                        // 查找与该合约相关的代币交易
                        const tokenTxs = cachedResult.transactions.filter(tx =>
                            tx.type === 'Token' &&
                            tx.contractAddress &&
                            tx.contractAddress.toLowerCase() === contractAddr
                        );

                        // 如果找到了代币交易，使用其中的代币名称和符号
                        if (tokenTxs.length > 0) {
                            for (const tx of tokenTxs) {
                                if (tx.tokenName && tx.tokenSymbol) {
                                    if (tx.tokenName !== 'Unknown Token') {
                                        contract.name = tx.tokenName;
                                        console.log(`从交易缓存中更新合约 ${contractAddr} 的名称: ${contract.name}`);
                                    }

                                    if (tx.tokenSymbol !== 'UNKNOWN') {
                                        contract.symbol = tx.tokenSymbol;
                                        console.log(`从交易缓存中更新合约 ${contractAddr} 的符号: ${contract.symbol}`);
                                    }

                                    foundTokenInfo = true;
                                    break;
                                }
                            }
                        }
                    }
                });
            }

            // 如果仍然没有名称和符号，使用标准的未知值
            if (!contract.name) {
                contract.name = 'Unknown Token';
                console.log(`合约 ${contractAddr} 使用标准未知名称: ${contract.name}`);
            }

            if (!contract.symbol) {
                contract.symbol = 'UNKNOWN';
                console.log(`合约 ${contractAddr} 使用标准未知符号: ${contract.symbol}`);
            }
        }

        console.log('所有代币合约的名称和符号更新完成');
    }

    // 获取由当前地址创建的合约
    async getCreatedContracts() {
        // 如果没有当前查询地址，返回空对象
        if (!this.currentQueryAddress) {
            console.log('没有当前查询地址，无法获取创建的合约');
            return {};
        }

        // 如果已经有缓存的创建合约，直接返回
        if (Object.keys(this.createdContracts).length > 0) {
            console.log(`返回缓存的创建合约: ${Object.keys(this.createdContracts).length} 个`);
            return this.createdContracts;
        }

        // 重置创建合约缓存
        this.createdContracts = {};

        // 遍历所有代币合约，检查创建者是否是当前地址
        const currentAddress = this.currentQueryAddress.toLowerCase();

        console.log(`检查由地址 ${currentAddress} 创建的合约...`);
        console.log(`当前有 ${Object.keys(this.tokenContracts).length} 个代币合约`);

        // 遍历所有代币合约
        for (const [contractAddress, contract] of Object.entries(this.tokenContracts)) {
            // 如果合约有创建者信息，并且创建者是当前地址
            if (contract.creator && contract.creator.toLowerCase() === currentAddress) {
                console.log(`找到由当前地址创建的合约: ${contractAddress}`);

                // 标记为由当前地址创建
                contract.createdByCurrentAddress = true;

                // 如果合约没有关联交易数组，添加一个空数组
                if (!contract.relatedTransactions) {
                    contract.relatedTransactions = [];
                }

                // 添加到创建合约缓存
                this.createdContracts[contractAddress] = contract;
            }
        }

        console.log(`共找到 ${Object.keys(this.createdContracts).length} 个由当前地址创建的合约`);

        return this.createdContracts;
    }

    // 检查地址是否是代币合约
    isTokenContract(address) {
        if (!address) return false;

        const lowerAddr = address.toLowerCase();

        // 检查是否在已知的代币合约列表中，并且有关联交易
        if (this.tokenContracts[lowerAddr] !== undefined) {
            // 检查是否有关联交易
            return this.tokenContracts[lowerAddr].relatedTransactions &&
                   this.tokenContracts[lowerAddr].relatedTransactions.length > 0;
        }

        // 检查交易记录中是否有与该地址相关的代币交易
        let isToken = false;

        // 遍历所有缓存的交易记录
        Object.values(this.transactionsCache).forEach(cachedResult => {
            if (cachedResult && cachedResult.transactions && !isToken) {
                // 查找与该地址相关的代币交易
                const tokenTxs = cachedResult.transactions.filter(tx =>
                    tx.type === 'Token' &&
                    tx.contractAddress &&
                    tx.contractAddress.toLowerCase() === lowerAddr
                );

                if (tokenTxs.length > 0) {
                    isToken = true;

                    // 如果找到了代币交易，但该合约不在代币合约列表中，添加它
                    if (this.tokenContracts[lowerAddr] === undefined) {
                        const tx = tokenTxs[0];
                        this.tokenContracts[lowerAddr] = {
                            address: address,
                            name: tx.tokenName || 'Unknown Token',
                            symbol: tx.tokenSymbol || 'UNKNOWN',
                            decimals: tx.tokenDecimal || 18,
                            creator: null,
                            createdByCurrentAddress: false,
                            relatedTransactions: [{
                                hash: tx.hash,
                                from: tx.from,
                                to: tx.to,
                                value: tx.value,
                                timeStamp: tx.timeStamp,
                                tokenName: tx.tokenName,
                                tokenSymbol: tx.tokenSymbol
                            }]
                        };
                        console.log(`从交易记录中添加代币合约: ${address}, 名称: ${tx.tokenName || 'Unknown Token'}, 符号: ${tx.tokenSymbol || 'UNKNOWN'}`);
                    }
                }

                // 如果还没有找到，检查是否有调用该地址的合约交易
                if (!isToken) {
                    const contractCalls = cachedResult.transactions.filter(tx =>
                        tx.to &&
                        tx.to.toLowerCase() === lowerAddr &&
                        (tx.methodId || tx.functionName || (tx.input && tx.input.length > 10))
                    );

                    // 如果有多个合约调用，这很可能是一个合约
                    // 但我们不会自动将其标记为代币合约，除非有明确的证据
                    if (contractCalls.length >= 3) {
                        console.log(`地址 ${address} 有 ${contractCalls.length} 个合约调用，可能是合约但不一定是代币合约`);
                    }
                }
            }
        });

        return isToken;
    }

    // 获取代币合约信息
    getTokenContractInfo(address) {
        if (!address) return null;

        const lowerAddr = address.toLowerCase();

        // 检查是否在已知的代币合约列表中
        if (this.tokenContracts[lowerAddr] !== undefined) {
            return this.tokenContracts[lowerAddr];
        }

        // 检查交易记录中是否有与该地址相关的代币交易
        let foundContract = false;

        // 遍历所有缓存的交易记录
        Object.values(this.transactionsCache).forEach(cachedResult => {
            if (cachedResult && cachedResult.transactions && !foundContract) {
                // 查找与该地址相关的代币交易
                const tokenTxs = cachedResult.transactions.filter(tx =>
                    tx.type === 'Token' &&
                    tx.contractAddress &&
                    tx.contractAddress.toLowerCase() === lowerAddr
                );

                if (tokenTxs.length > 0) {
                    foundContract = true;

                    // 如果找到了代币交易，但该合约不在代币合约列表中，添加它
                    if (this.tokenContracts[lowerAddr] === undefined) {
                        const tx = tokenTxs[0];
                        this.tokenContracts[lowerAddr] = {
                            address: address,
                            name: tx.tokenName || 'Unknown Token',
                            symbol: tx.tokenSymbol || 'UNKNOWN',
                            decimals: tx.tokenDecimal || 18,
                            creator: null,
                            createdByCurrentAddress: false,
                            relatedTransactions: [{
                                hash: tx.hash,
                                from: tx.from,
                                to: tx.to,
                                value: tx.value,
                                timeStamp: tx.timeStamp,
                                tokenName: tx.tokenName,
                                tokenSymbol: tx.tokenSymbol
                            }]
                        };
                        console.log(`从交易记录中添加代币合约: ${address}, 名称: ${tx.tokenName || 'Unknown Token'}, 符号: ${tx.tokenSymbol || 'UNKNOWN'}`);
                    }
                }
            }
        });

        // 如果找到了合约，返回它
        if (foundContract) {
            return this.tokenContracts[lowerAddr];
        }

        return null;
    }

    // 获取合约相关的交易
    getContractTransactions(contractAddress) {
        // 从缓存中获取所有交易
        const allTransactions = [];

        // 遍历所有缓存的交易记录
        Object.values(this.transactionsCache).forEach(cachedResult => {
            if (cachedResult && cachedResult.transactions) {
                // 筛选与指定合约相关的交易
                const relatedTxs = cachedResult.transactions.filter(tx =>
                    tx.to && tx.to.toLowerCase() === contractAddress.toLowerCase() ||
                    tx.from && tx.from.toLowerCase() === contractAddress.toLowerCase() ||
                    tx.contractAddress && tx.contractAddress.toLowerCase() === contractAddress.toLowerCase()
                );

                // 添加到结果中
                allTransactions.push(...relatedTxs);
            }
        });

        // 按时间戳排序（从新到旧）
        return allTransactions.sort((a, b) => parseInt(b.timeStamp) - parseInt(a.timeStamp));
    }

    // 获取合约创建者查询进度
    getContractCreatorsQueryProgress() {
        return this.contractCreatorsQueryProgress;
    }

    // 查询所有合约创建者信息
    async queryAllContractCreators() {
        // 获取所有代币合约
        const contractAddresses = Object.keys(this.tokenContracts);

        // 打印当前的代币合约列表，用于调试
        console.log('查询合约创建者信息前的代币合约列表:');
        Object.entries(this.tokenContracts).forEach(([address, contract]) => {
            console.log(`- ${address}: ${contract.name} (${contract.symbol})`);
        });

        // 如果没有合约，直接返回
        if (contractAddresses.length === 0) {
            console.log('没有代币合约，无需查询创建者信息');
            return;
        }

        // 初始化查询进度
        this.contractCreatorsQueryProgress = {
            isQuerying: true,
            total: contractAddresses.length,
            completed: 0,
            withCreator: 0
        };

        console.log(`开始查询 ${contractAddresses.length} 个合约的创建者信息...`);

        // 创建一个队列，用于并发查询
        const queue = [...contractAddresses];
        // 使用从配置中获取的并发限制，默认为3
        const concurrentLimit = this.maxConcurrent || 3;
        console.log(`使用并发限制: ${concurrentLimit}`);
        const activePromises = [];

        // 处理单个合约的创建者信息
        const processContract = async (contractAddress) => {
            try {
                // 如果合约已经有创建者信息，跳过查询
                if (this.tokenContracts[contractAddress].creator) {
                    console.log(`合约 ${contractAddress} 已有创建者信息，跳过查询`);
                    this.contractCreatorsQueryProgress.completed++;
                    this.contractCreatorsQueryProgress.withCreator++;
                    return;
                }

                console.log(`查询合约 ${contractAddress} 的创建者信息...`);

                // 查询合约信息
                const contractInfo = await this.getContractInfo(contractAddress, this.currentQueryAddress);

                // 更新合约信息
                if (contractInfo && contractInfo.creator && contractInfo.creator !== 'Unknown' && contractInfo.creator !== 'Error') {
                    console.log(`获取到合约 ${contractAddress} 的创建者信息: ${contractInfo.creator}`);

                    // 更新代币合约信息
                    this.tokenContracts[contractAddress].creator = contractInfo.creator;

                    // 检查是否由当前地址创建
                    if (this.currentQueryAddress && contractInfo.creator.toLowerCase() === this.currentQueryAddress.toLowerCase()) {
                        console.log(`合约 ${contractAddress} 由当前地址创建`);
                        this.tokenContracts[contractAddress].createdByCurrentAddress = true;

                        // 添加到创建合约缓存
                        this.createdContracts[contractAddress] = this.tokenContracts[contractAddress];
                    }

                    // 更新进度
                    this.contractCreatorsQueryProgress.withCreator++;
                } else {
                    console.log(`未获取到合约 ${contractAddress} 的创建者信息`);
                }

                // 更新进度
                this.contractCreatorsQueryProgress.completed++;

            } catch (error) {
                console.error(`查询合约 ${contractAddress} 的创建者信息失败:`, error);

                // 更新进度
                this.contractCreatorsQueryProgress.completed++;
            }
        };

        // 处理队列
        return new Promise(resolve => {
            const processQueue = async () => {
                // 如果队列为空，等待所有活动的Promise完成后返回
                if (queue.length === 0 && activePromises.length === 0) {
                    console.log('所有合约创建者信息查询完成');
                    this.contractCreatorsQueryProgress.isQuerying = false;

                    // 更新所有代币合约的名称和符号
                    this.updateAllTokenContractNames();

                    resolve();
                    return;
                }

                // 如果队列不为空，并且活动的Promise数量小于并发限制，启动新的查询
                while (queue.length > 0 && activePromises.length < concurrentLimit) {
                    const contractAddress = queue.shift();

                    // 创建一个新的Promise，处理完成后从活动Promise列表中移除
                    const promise = processContract(contractAddress).finally(() => {
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

                // 如果队列为空，但还有活动的Promise，等待它们完成
                if (queue.length === 0 && activePromises.length > 0) {
                    // 不需要做任何事情，活动的Promise完成后会调用processQueue
                }
            };

            // 开始处理队列
            processQueue();
        });
    }

    // 格式化时间戳
    formatTimestamp(timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    }
}

// 创建 API 服务实例
const apiService = new ApiService();
