// BSC服务 - 与BSC区块链交互的函数

class BscService {
    constructor() {
        console.log('初始化BscService...');

        // 检查ethers是否可用
        if (typeof ethers === 'undefined') {
            console.error('BscService初始化失败: ethers库未加载');
            throw new Error('ethers库未加载，无法初始化BSC服务');
        }

        // 记录ethers版本
        console.log('使用ethers版本:', ethers.version);

        // BSC主网RPC URL列表 (备用节点)
        this.rpcUrls = [
            'https://bsc-dataseed.binance.org/',
            'https://bsc-dataseed1.binance.org/',
            'https://bsc-dataseed2.binance.org/',
            'https://bsc-dataseed3.binance.org/',
            'https://bsc-dataseed4.binance.org/'
        ];

        // 当前使用的RPC URL
        this.rpcUrl = this.rpcUrls[0];

        // BSCScan API URL和Key
        this.bscScanApiUrl = 'https://api.bscscan.com/api';
        // 注意：BSCScan API有使用限制，免费账户每天5次/秒，每天10,000次调用
        this.apiKey = '15CVJ7U55ZTY71S3IBRIM2R2MKIDJVJ1X8'; // 请在此处填入您在BSCScan申请的API Key

        // 如果没有API Key，使用替代方案
        this.useAlternativeMethod = !this.apiKey;

        try {
            // 初始化provider
            console.log('初始化ethers provider，使用RPC:', this.rpcUrl);
            this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
            console.log('Provider初始化成功');
        } catch (error) {
            console.error('初始化provider失败:', error);
            alert('初始化BSC连接失败，请检查网络连接或刷新页面重试');
            throw error;
        }
    }

    // 尝试切换到备用RPC节点
    async switchToBackupRpc() {
        const currentIndex = this.rpcUrls.indexOf(this.rpcUrl);
        const nextIndex = (currentIndex + 1) % this.rpcUrls.length;

        this.rpcUrl = this.rpcUrls[nextIndex];
        console.log('切换到备用RPC节点:', this.rpcUrl);

        try {
            this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
            // 测试连接
            await this.provider.getBlockNumber();
            console.log('备用RPC节点连接成功');
            return true;
        } catch (error) {
            console.error('备用RPC节点连接失败:', error);
            return false;
        }
    }

    // 获取钱包地址的转账记录
    async getTransactions(address, page = 1, pageSize = 50) {
        console.log('开始获取转账记录，地址:', address, '页码:', page, '每页数量:', pageSize);
        let retryCount = 0;
        const maxRetries = 3;

        // 存储所有交易记录
        this.allTransactions = this.allTransactions || {};

        while (retryCount <= maxRetries) {
            try {
                // 验证地址格式
                if (!ethers.utils.isAddress(address)) {
                    console.error('地址格式无效:', address);
                    throw new Error('无效的地址格式');
                }

                // 尝试获取最新区块号，测试RPC连接
                try {
                    const blockNumber = await this.provider.getBlockNumber();
                    console.log('当前区块高度:', blockNumber);
                } catch (rpcError) {
                    console.error('RPC连接失败，尝试切换节点:', rpcError);
                    if (await this.switchToBackupRpc()) {
                        console.log('成功切换到备用节点，重试操作');
                        continue;
                    } else {
                        throw new Error('无法连接到BSC网络，请稍后再试');
                    }
                }

                // 交易数据
                let normalTxData = { status: '0', result: [], message: '无数据' };
                let tokenTxData = { status: '0', result: [], message: '无数据' };

                if (this.useAlternativeMethod) {
                    // 替代方案：直接使用RPC查询最近的区块和交易
                    console.log('使用替代方案获取交易记录（无API Key）...');

                    try {
                        // 获取最新区块号
                        const latestBlockNumber = await this.provider.getBlockNumber();
                        console.log('当前最新区块:', latestBlockNumber);

                        // 只查询最近的100个区块（约5分钟的交易）
                        const startBlock = Math.max(0, latestBlockNumber - 100);
                        console.log(`查询区块范围: ${startBlock} - ${latestBlockNumber}`);

                        // 存储找到的交易
                        const transactions = [];
                        const addressLower = address.toLowerCase();

                        // 查询最近的10个区块（为了演示，实际可以查询更多）
                        for (let i = 0; i < 10; i++) {
                            const blockNumber = latestBlockNumber - i;
                            if (blockNumber < 0) break;

                            console.log(`获取区块 ${blockNumber} 的信息...`);
                            const block = await this.provider.getBlockWithTransactions(blockNumber);

                            if (block && block.transactions) {
                                console.log(`区块 ${blockNumber} 包含 ${block.transactions.length} 笔交易`);

                                // 过滤与指定地址相关的交易
                                const relevantTxs = block.transactions.filter(tx =>
                                    tx.from && tx.from.toLowerCase() === addressLower ||
                                    tx.to && tx.to.toLowerCase() === addressLower
                                );

                                if (relevantTxs.length > 0) {
                                    console.log(`找到 ${relevantTxs.length} 笔相关交易`);

                                    // 处理交易数据
                                    for (const tx of relevantTxs) {
                                        transactions.push({
                                            hash: tx.hash,
                                            blockNumber: tx.blockNumber,
                                            timeStamp: block.timestamp,
                                            from: tx.from,
                                            to: tx.to || '合约创建',
                                            value: ethers.utils.formatEther(tx.value) + ' BNB',
                                            type: 'BNB'
                                        });
                                    }
                                }
                            }
                        }

                        // 将找到的交易添加到结果中
                        normalTxData = {
                            status: '1',
                            result: transactions,
                            message: '使用RPC直接查询的结果（仅限最近交易）'
                        };

                        console.log(`通过RPC找到 ${transactions.length} 笔相关交易`);
                    } catch (error) {
                        console.error('使用RPC获取交易记录失败:', error);
                    }
                } else {
                    // 使用BSCScan API获取交易记录
                    console.log('开始获取普通转账记录...');
                    const normalTxUrl = `${this.bscScanApiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${this.apiKey}`;
                    console.log('普通转账API URL:', normalTxUrl);

                    try {
                        const normalTxResponse = await fetch(normalTxUrl);
                        if (!normalTxResponse.ok) {
                            throw new Error(`HTTP错误: ${normalTxResponse.status}`);
                        }
                        normalTxData = await normalTxResponse.json();
                        console.log('普通转账API响应状态:', normalTxData.status, normalTxData.message);
                    } catch (error) {
                        console.error('获取普通转账记录失败:', error);
                    }

                    console.log('开始获取代币转账记录...');
                    const tokenTxUrl = `${this.bscScanApiUrl}?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${this.apiKey}`;
                    console.log('代币转账API URL:', tokenTxUrl);

                    try {
                        const tokenTxResponse = await fetch(tokenTxUrl);
                        if (!tokenTxResponse.ok) {
                            throw new Error(`HTTP错误: ${tokenTxResponse.status}`);
                        }
                        tokenTxData = await tokenTxResponse.json();
                        console.log('代币转账API响应状态:', tokenTxData.status, tokenTxData.message);
                    } catch (error) {
                        console.error('获取代币转账记录失败:', error);
                    }
                }

                // 合并并处理交易数据
                let transactions = [];

                if (normalTxData.status === '1' && Array.isArray(normalTxData.result)) {
                    console.log('处理普通转账数据...');
                    try {
                        transactions = transactions.concat(normalTxData.result.map(tx => {
                            // 确定交易方向（转入/转出）
                            const addressLower = address.toLowerCase();
                            const direction = tx.from.toLowerCase() === addressLower ? 'out' : 'in';

                            return {
                                hash: tx.hash,
                                blockNumber: tx.blockNumber,
                                timeStamp: tx.timeStamp,
                                from: tx.from,
                                to: tx.to,
                                value: ethers.utils.formatEther(tx.value || '0') + ' BNB',
                                type: 'BNB',
                                direction: direction // 添加方向标识
                            };
                        }));
                    } catch (formatError) {
                        console.error('处理普通转账数据失败:', formatError);
                    }
                } else {
                    console.warn('获取普通转账记录失败或无数据:', normalTxData.message);
                }

                if (tokenTxData.status === '1' && Array.isArray(tokenTxData.result)) {
                    console.log('处理代币转账数据...');
                    try {
                        // 收集所有代币合约地址
                        const tokenContracts = new Set();
                        tokenTxData.result.forEach(tx => {
                            if (tx.contractAddress) {
                                tokenContracts.add(tx.contractAddress.toLowerCase());
                            }
                        });
                        console.log(`发现 ${tokenContracts.size} 个代币合约地址`);

                        // 存储代币合约信息
                        this.tokenContracts = this.tokenContracts || {};

                        // 初始化当前地址创建的合约集合
                        this.createdContracts = this.createdContracts || {};

                        // 初始化合约与交易的关联信息
                        this.contractTransactions = this.contractTransactions || {};

                        tokenTxData.result.forEach(tx => {
                            if (tx.contractAddress) {
                                const contractAddr = tx.contractAddress.toLowerCase();
                                if (!this.tokenContracts[contractAddr]) {
                                    this.tokenContracts[contractAddr] = {
                                        address: tx.contractAddress,
                                        symbol: tx.tokenSymbol || 'UNKNOWN',
                                        name: tx.tokenName || 'Unknown Token',
                                        decimals: tx.tokenDecimal || 18,
                                        creator: null, // 初始化创建者为null
                                        createdByCurrentAddress: false, // 是否由当前地址创建
                                        relatedTransactions: [] // 关联的交易
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
                                    timeStamp: tx.timeStamp
                                };

                                // 避免重复添加
                                if (!this.contractTransactions[contractAddr].some(t => t.hash === tx.hash)) {
                                    this.contractTransactions[contractAddr].push(txInfo);

                                    // 同时更新合约对象中的关联交易
                                    if (!this.tokenContracts[contractAddr].relatedTransactions.some(t => t.hash === tx.hash)) {
                                        this.tokenContracts[contractAddr].relatedTransactions.push(txInfo);
                                    }
                                }
                            }
                        });

                        transactions = transactions.concat(tokenTxData.result.map(tx => {
                            // 确定交易方向（转入/转出）
                            const addressLower = address.toLowerCase();
                            const direction = tx.from.toLowerCase() === addressLower ? 'out' : 'in';

                            return {
                                hash: tx.hash,
                                blockNumber: tx.blockNumber,
                                timeStamp: tx.timeStamp,
                                from: tx.from,
                                to: tx.to,
                                value: ethers.utils.formatUnits(tx.value || '0', tx.tokenDecimal || 18) + ' ' + (tx.tokenSymbol || 'TOKEN'),
                                type: 'Token',
                                direction: direction, // 添加方向标识
                                contractAddress: tx.contractAddress, // 添加代币合约地址
                                tokenSymbol: tx.tokenSymbol, // 添加代币符号
                                tokenName: tx.tokenName // 添加代币名称
                            };
                        }));
                    } catch (formatError) {
                        console.error('处理代币转账数据失败:', formatError);
                    }
                } else {
                    console.warn('获取代币转账记录失败或无数据:', tokenTxData.message);
                }

                // 按时间戳排序
                console.log('对交易记录排序...');
                try {
                    transactions.sort((a, b) => b.timeStamp - a.timeStamp);
                } catch (sortError) {
                    console.error('排序交易记录失败:', sortError);
                }

                console.log(`成功获取${transactions.length}条交易记录`);

                // 缓存所有交易记录，以便分页使用
                this.allTransactions[address] = transactions;

                // 计算分页
                const totalPages = Math.ceil(transactions.length / pageSize);
                const startIndex = (page - 1) * pageSize;
                const endIndex = Math.min(startIndex + pageSize, transactions.length);

                // 返回分页数据和分页信息
                return {
                    transactions: transactions.slice(startIndex, endIndex),
                    pagination: {
                        currentPage: page,
                        pageSize: pageSize,
                        totalPages: totalPages,
                        totalRecords: transactions.length,
                        hasNextPage: page < totalPages,
                        hasPreviousPage: page > 1
                    }
                };

            } catch (error) {
                console.error(`获取交易记录失败 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, error);
                retryCount++;

                if (retryCount <= maxRetries) {
                    console.log(`将在2秒后重试...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    console.error('达到最大重试次数，操作失败');
                    alert('获取交易记录失败: ' + error.message);
                    throw error;
                }
            }
        }
    }

    // 获取合约信息
    async getContractInfo(contractAddress, currentAddress = '') {
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount <= maxRetries) {
            try {
                // 验证地址格式
                if (!ethers.utils.isAddress(contractAddress)) {
                    throw new Error('无效的合约地址格式');
                }

                // 尝试获取最新区块号，测试RPC连接
                try {
                    await this.provider.getBlockNumber();
                } catch (rpcError) {
                    console.error('RPC连接失败，尝试切换节点:', rpcError);
                    if (await this.switchToBackupRpc()) {
                        console.log('成功切换到备用节点，重试操作');
                        continue;
                    } else {
                        throw new Error('无法连接到BSC网络，请稍后再试');
                    }
                }

                // 获取合约代码
                console.log('获取合约代码...');
                const code = await this.provider.getCode(contractAddress);
                console.log('合约代码长度:', code.length);

                // 如果返回的只是"0x"，说明这不是一个合约地址
                if (code === '0x') {
                    throw new Error('这不是一个合约地址');
                }

                // 获取合约ABI
                let abi = [];
                let abiMessage = '';

                if (this.useAlternativeMethod) {
                    console.log('无API Key，无法获取合约ABI...');
                    abiMessage = '需要API Key才能获取合约ABI和验证状态';
                } else if (this.apiKey && this.apiKey.trim() !== '') {
                    try {
                        console.log('获取合约ABI...');
                        const abiUrl = `${this.bscScanApiUrl}?module=contract&action=getabi&address=${contractAddress}&apikey=${this.apiKey}`;
                        const abiResponse = await fetch(abiUrl);

                        if (!abiResponse.ok) {
                            throw new Error(`HTTP错误: ${abiResponse.status}`);
                        }

                        const abiData = await abiResponse.json();
                        console.log('ABI响应状态:', abiData.status, abiData.message);

                        if (abiData.status === '1' && abiData.result && abiData.result !== 'Contract source code not verified') {
                            try {
                                abi = JSON.parse(abiData.result);
                                console.log('成功解析ABI，包含', abi.length, '个函数/事件');
                            } catch (parseError) {
                                console.error('解析ABI JSON失败:', parseError);
                            }
                        } else if (abiData.result === 'Contract source code not verified') {
                            abiMessage = '合约源代码未验证';
                        }
                    } catch (error) {
                        console.error('获取合约ABI失败:', error);
                        abiMessage = '获取ABI失败: ' + error.message;
                    }
                }

                // 获取合约基本信息
                console.log('获取合约余额...');
                const balance = await this.provider.getBalance(contractAddress);
                console.log('合约余额:', ethers.utils.formatEther(balance), 'BNB');

                // 尝试获取代币信息 (如果是代币合约)
                let tokenInfo = {};
                let isToken = false;

                try {
                    console.log('尝试检测是否为ERC20代币...');
                    // 创建合约实例 (使用基本的ERC20接口)
                    const erc20Interface = new ethers.utils.Interface([
                        'function name() view returns (string)',
                        'function symbol() view returns (string)',
                        'function decimals() view returns (uint8)',
                        'function totalSupply() view returns (uint256)'
                    ]);

                    const contract = new ethers.Contract(contractAddress, erc20Interface, this.provider);

                    // 尝试获取代币信息
                    console.log('获取代币基本信息...');
                    let name, symbol, decimals, totalSupply;

                    try {
                        name = await contract.name();
                        console.log('代币名称:', name);
                        isToken = true;
                    } catch (e) {
                        console.log('获取代币名称失败，可能不是ERC20代币');
                        name = '未知';
                    }

                    try {
                        symbol = await contract.symbol();
                        console.log('代币符号:', symbol);
                    } catch (e) {
                        console.log('获取代币符号失败');
                        symbol = '未知';
                    }

                    try {
                        decimals = await contract.decimals();
                        console.log('代币小数位:', decimals);
                    } catch (e) {
                        console.log('获取代币小数位失败，使用默认值18');
                        decimals = 18;
                    }

                    try {
                        totalSupply = await contract.totalSupply();
                        console.log('代币总供应量:', totalSupply.toString());
                    } catch (e) {
                        console.log('获取代币总供应量失败');
                        totalSupply = '0';
                    }

                    tokenInfo = {
                        name,
                        symbol,
                        decimals,
                        totalSupply: ethers.utils.formatUnits(totalSupply, decimals)
                    };

                    console.log('代币信息获取完成');
                } catch (error) {
                    console.log('不是标准ERC20代币合约或获取代币信息失败:', error.message);
                }

                // 获取合约创建信息
                let creator = '未知';
                let creationTx = '未知';

                if (this.useAlternativeMethod) {
                    // 替代方案：尝试通过RPC获取合约创建信息
                    console.log('使用替代方案获取合约创建信息（无API Key）...');

                    try {
                        // 注意：这种方法不太可靠，因为需要扫描大量区块
                        // 这里仅作为演示，只扫描最近的100个区块
                        const latestBlockNumber = await this.provider.getBlockNumber();
                        const startBlock = Math.max(0, latestBlockNumber - 100);

                        console.log(`尝试在区块范围 ${startBlock} - ${latestBlockNumber} 中查找合约创建交易...`);
                        console.log('注意：此方法仅扫描最近区块，可能找不到较早创建的合约');

                        // 由于扫描所有区块效率太低，这里只是提示用户
                        creator = '需要API Key才能查询';
                        creationTx = '需要API Key才能查询';
                    } catch (error) {
                        console.error('尝试获取合约创建信息失败:', error);
                    }
                } else if (this.apiKey && this.apiKey.trim() !== '') {
                    try {
                        console.log('获取合约创建信息...');
                        const contractCreationUrl = `${this.bscScanApiUrl}?module=contract&action=getcontractcreation&contractaddresses=${contractAddress}&apikey=${this.apiKey}`;
                        const creationResponse = await fetch(contractCreationUrl);

                        if (!creationResponse.ok) {
                            throw new Error(`HTTP错误: ${creationResponse.status}`);
                        }

                        const creationData = await creationResponse.json();
                        console.log('合约创建信息响应状态:', creationData.status, creationData.message);

                        if (creationData.status === '1' && creationData.result && creationData.result.length > 0) {
                            creator = creationData.result[0].contractCreator;
                            creationTx = creationData.result[0].txHash;
                            console.log('合约创建者:', creator);
                            console.log('创建交易:', creationTx);

                            // 检查是否由当前查询的地址创建
                            const isCreatedByCurrentAddress = creator.toLowerCase() === currentAddress.toLowerCase();

                            // 更新代币合约的创建者信息
                            this.updateContractCreator(contractAddress, creator, isCreatedByCurrentAddress);
                        }
                    } catch (error) {
                        console.error('获取合约创建信息失败:', error);
                    }
                }

                // 返回合约信息
                const contractInfo = {
                    address: contractAddress,
                    balance: ethers.utils.formatEther(balance) + ' BNB',
                    bytecodeSize: (code.length - 2) / 2, // 减去"0x"并除以2得到字节数
                    creator,
                    creationTx,
                    isToken,
                    tokenInfo: isToken ? tokenInfo : null,
                    hasVerifiedSource: abi.length > 0,
                    abiMessage: abiMessage // 添加ABI相关消息
                };

                console.log('合约信息获取完成');
                return contractInfo;

            } catch (error) {
                console.error(`获取合约信息失败 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, error);
                retryCount++;

                if (retryCount <= maxRetries) {
                    console.log(`将在2秒后重试...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    console.error('达到最大重试次数，操作失败');
                    throw error;
                }
            }
        }
    }

    // 格式化时间戳为本地时间
    formatTimestamp(timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    // 获取已缓存的交易记录（用于分页）
    getCachedTransactions(address, page = 1, pageSize = 50) {
        // 检查是否有缓存的交易记录
        if (!this.allTransactions || !this.allTransactions[address] || this.allTransactions[address].length === 0) {
            return null; // 没有缓存，需要重新获取
        }

        const transactions = this.allTransactions[address];

        // 计算分页
        const totalPages = Math.ceil(transactions.length / pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, transactions.length);

        // 返回分页数据和分页信息
        return {
            transactions: transactions.slice(startIndex, endIndex),
            pagination: {
                currentPage: page,
                pageSize: pageSize,
                totalPages: totalPages,
                totalRecords: transactions.length,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }
        };
    }

    // 清除缓存的交易记录和代币合约
    clearTransactionsCache(address = null, clearTokens = false) {
        if (address) {
            // 清除特定地址的缓存
            if (this.allTransactions && this.allTransactions[address]) {
                delete this.allTransactions[address];
            }
        } else {
            // 清除所有缓存
            this.allTransactions = {};
        }

        // 如果需要，同时清除代币合约缓存
        if (clearTokens) {
            this.tokenContracts = {};
            this.createdContracts = {}; // 同时清除创建的合约缓存
            this.contractTransactions = {}; // 同时清除合约与交易的关联信息
        }
    }

    // 获取已知的代币合约列表
    getTokenContracts() {
        return this.tokenContracts || {};
    }

    // 获取当前地址创建的合约列表
    getCreatedContracts() {
        return this.createdContracts || {};
    }

    // 检查地址是否是代币合约
    isTokenContract(address) {
        if (!address) return false;
        const lowerAddr = address.toLowerCase();
        return this.tokenContracts && this.tokenContracts[lowerAddr] ? true : false;
    }

    // 检查合约是否由当前地址创建
    isCreatedByCurrentAddress(address) {
        if (!address) return false;
        const lowerAddr = address.toLowerCase();
        return this.tokenContracts && this.tokenContracts[lowerAddr] &&
            this.tokenContracts[lowerAddr].createdByCurrentAddress ? true : false;
    }

    // 获取代币合约信息
    getTokenContractInfo(address) {
        if (!address) return null;
        const lowerAddr = address.toLowerCase();
        return this.tokenContracts && this.tokenContracts[lowerAddr] ?
            this.tokenContracts[lowerAddr] : null;
    }

    // 获取合约关联的交易
    getContractTransactions(address) {
        if (!address) return [];
        const lowerAddr = address.toLowerCase();
        return this.contractTransactions && this.contractTransactions[lowerAddr] ?
            this.contractTransactions[lowerAddr] : [];
    }

    // 更新合约创建者信息
    updateContractCreator(contractAddress, creator, isCreatedByCurrentAddress = false) {
        if (!contractAddress) return;

        const lowerAddr = contractAddress.toLowerCase();

        // 更新代币合约的创建者信息
        if (this.tokenContracts && this.tokenContracts[lowerAddr]) {
            this.tokenContracts[lowerAddr].creator = creator;
            this.tokenContracts[lowerAddr].createdByCurrentAddress = isCreatedByCurrentAddress;

            // 如果是当前地址创建的，添加到创建的合约集合中
            if (isCreatedByCurrentAddress) {
                this.createdContracts[lowerAddr] = this.tokenContracts[lowerAddr];
            }
        }
    }
}
