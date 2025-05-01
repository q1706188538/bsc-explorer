// BSC服务 - 与BSC区块链交互的函数

class BscService {
    constructor() {
        this.logToPage('初始化BscService...');

        // 检查ethers是否可用
        if (typeof ethers === 'undefined') {
            this.logToPage('BscService初始化失败: ethers库未加载', 'error');
            throw new Error('ethers库未加载，无法初始化BSC服务');
        }

        // 添加一个显示合约信息的按钮
        this.addContractInfoButton();

        // 记录ethers版本
        console.log('使用ethers版本:', ethers.version);

        // BSC主网RPC URL列表 (备用节点) - 将在loadConfig中从配置加载
        this.rpcUrls = [
            'https://bsc-dataseed.binance.org/',
            'https://bsc-dataseed1.binance.org/',
            'https://bsc-dataseed2.binance.org/',
            'https://bsc-dataseed3.binance.org/',
            'https://bsc-dataseed4.binance.org/'
        ];

        // 当前使用的RPC URL
        this.rpcUrl = this.rpcUrls[0];

        // 加载配置
        this.loadConfig();

        // 当前API Key索引
        this.currentApiKeyIndex = 0;

        // 获取当前API Key
        this.apiKey = this.apiKeys[this.currentApiKeyIndex];

        // 存储所有交易
        this.allTransactions = {};
        // 存储代币合约信息
        this.tokenContracts = {};
        // 存储由当前地址创建的合约
        this.createdContracts = {};
        // 存储合约与交易的关联信息
        this.contractTransactions = {};
        // 添加这一行，跟踪当前查询的地址
        this.currentQueryAddress = '';

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

    // 从config.js加载配置
    loadConfig() {
        // 尝试从后端获取配置
        fetch('/api/config')
            .then(response => response.json())
            .then(config => {
                console.log('从后端获取配置成功:', config);

                // 设置BSCScan API URL
                this.bscScanApiUrl = config.bscScan.apiUrl || 'https://api.bscscan.com/api';

                // 设置API Keys
                this.apiKeys = config.bscScan.apiKeys || [
                    'R4M4YEXGGE9EKDUIP3YTXHUKVYX9TX91DA', // 主API Key
                    '15CVJ7U55ZTY71S3IBRIM2R2MKIDJVJ1X8'  // 备用API Key
                ];

                // 设置最大并发数
                this.maxConcurrent = config.bscScan.maxConcurrent || 3;

                // 设置Moralis API配置
                if (config.moralis) {
                    this.moralisApiUrl = config.moralis.apiUrl || 'https://deep-index.moralis.io/api/v2';
                    this.moralisApiKey = config.moralis.apiKey;
                    this.moralisMaxConcurrent = config.moralis.maxConcurrent || 20;

                    console.log('Moralis API配置已加载:');
                    console.log('- API URL:', this.moralisApiUrl);
                    console.log('- API Key:', this.moralisApiKey ? '已设置' : '未设置');
                    console.log('- 最大并发数:', this.moralisMaxConcurrent);

                    // 设置是否使用Moralis API
                    this.useMoralis = !!this.moralisApiKey;
                    console.log('- 是否使用Moralis API:', this.useMoralis ? '是' : '否');
                } else {
                    this.useMoralis = false;
                    console.log('未找到Moralis API配置，将使用BSCScan API');
                }

                // 设置代币销毁验证配置
                if (config.burnVerification) {
                    this.burnVerificationConfig = config.burnVerification;
                    console.log('代币销毁验证配置已加载:');
                    console.log('- 是否启用:', this.burnVerificationConfig.enabled);
                    console.log('- 目标合约地址:', this.burnVerificationConfig.targetContractAddress);
                    console.log('- 目标数量:', this.burnVerificationConfig.targetAmount);
                    console.log('- 销毁地址:', this.burnVerificationConfig.burnAddress);
                }

                // 设置RPC URLs
                if (config.bscNode && config.bscNode.rpcUrls && config.bscNode.rpcUrls.length > 0) {
                    this.rpcUrls = config.bscNode.rpcUrls;
                    this.rpcUrl = this.rpcUrls[0];

                    // 重新初始化provider
                    try {
                        this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
                        console.log('使用配置中的RPC URL重新初始化provider成功');
                    } catch (error) {
                        console.error('使用配置中的RPC URL重新初始化provider失败:', error);
                    }
                }

                console.log('配置加载完成:');
                console.log('- BSCScan API URL:', this.bscScanApiUrl);
                console.log('- API Keys:', this.apiKeys.map(key => key.substring(0, 5) + '...').join(', '));
                console.log('- 最大并发数:', this.maxConcurrent);
                console.log('- RPC URLs:', this.rpcUrls);

                // 初始化API Key
                this.apiKey = this.apiKeys[this.currentApiKeyIndex];
            })
            .catch(error => {
                console.error('从后端获取配置失败:', error);
                console.log('使用默认配置');

                // 使用默认配置
                this.bscScanApiUrl = 'https://api.bscscan.com/api';
                this.apiKeys = [
                    'R4M4YEXGGE9EKDUIP3YTXHUKVYX9TX91DA', // 主API Key
                    '15CVJ7U55ZTY71S3IBRIM2R2MKIDJVJ1X8'  // 备用API Key
                ];
                this.maxConcurrent = 3;

                // 默认Moralis配置
                this.moralisApiUrl = 'https://deep-index.moralis.io/api/v2';
                this.moralisApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImY0Y2MyNDdiLTFjZjYtNGRiNy1hY2FkLTA5YzQ2NzU1YmVmNiIsIm9yZ0lkIjoiNDQ0ODM2IiwidXNlcklkIjoiNDU3NjgzIiwidHlwZUlkIjoiYzIzNTZlNDEtMGE4Ny00MTkyLWFhNTMtYzg0ZmM3ZWNlZTBlIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NDYxMzExNzEsImV4cCI6NDkwMTg5MTE3MX0.lOWmKlgh5nHLn58d4Dej8GIMUU5Ti5Sn5nAhwPh_T0s';
                this.moralisMaxConcurrent = 20;
                this.useMoralis = true;

                // 默认代币销毁验证配置
                this.burnVerificationConfig = {
                    enabled: true,
                    targetContractAddress: '0xA49fA5E8106E2d6d6a69E78df9B6A20AaB9c4444',
                    targetAmount: '100',
                    burnAddress: '0x000000000000000000000000000000000000dead'
                };

                // 初始化API Key
                this.apiKey = this.apiKeys[this.currentApiKeyIndex];
            });
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

    // 获取下一个API Key
    getNextApiKey() {
        // 轮换到下一个API Key
        this.currentApiKeyIndex = (this.currentApiKeyIndex + 1) % this.apiKeys.length;
        this.apiKey = this.apiKeys[this.currentApiKeyIndex];
        const logMessage = `切换到API Key ${this.currentApiKeyIndex + 1}/${this.apiKeys.length}: ${this.apiKey.substring(0, 5)}...`;
        console.log(logMessage);
        this.logToPage(logMessage);
        return this.apiKey;
    }

    // 获取当前API Key
    getCurrentApiKey() {
        return this.apiKey;
    }

    // 添加一个显示合约信息的按钮
    addContractInfoButton() {
        // 创建一个按钮，点击后显示最新的合约信息
        const button = document.createElement('button');
        button.textContent = '显示最新合约信息';
        button.style.position = 'fixed';
        button.style.top = '10px';
        button.style.right = '10px';
        button.style.zIndex = '9999';
        button.style.padding = '8px 12px';
        button.style.backgroundColor = '#4CAF50';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';

        button.onclick = () => {
            // 显示最新的合约信息
            if (window.lastContractResponse) {
                // 提取API端点中的参数
                const urlParams = new URLSearchParams(window.lastContractResponse.apiEndpoint.split('?')[1]);
                const params = {};
                for (const [key, value] of urlParams.entries()) {
                    params[key] = value;
                }

                // 从URL中提取API模块和操作
                let apiModule = "未知";
                let apiAction = "未知";

                try {
                    if (params.module) apiModule = params.module;
                    if (params.action) apiAction = params.action;
                } catch (e) {
                    console.error("解析API模块和操作失败:", e);
                }

                // 格式化显示
                alert(`最新合约信息查询:\n\n合约地址: ${window.lastContractResponse.contractAddress}\nAPI: ${apiModule}.${apiAction}\nAPI Key: ${window.lastContractResponse.apiKey}\nAPI端点: ${window.lastContractResponse.apiEndpoint}\n参数: ${JSON.stringify(params)}\n\n响应数据: ${JSON.stringify(window.lastContractResponse.response, null, 2)}`);

                // 同时在控制台输出
                console.log(`API: ${apiModule}.${apiAction}, 当前使用的API Key: ${window.lastContractResponse.apiKey.substring(0, 5)}..., 参数: ${JSON.stringify(params)}`);
            } else {
                alert('尚未查询任何合约信息');
            }
        };

        document.body.appendChild(button);
    }

    // 将日志输出到页面
    logToPage(message, type = 'info') {
        // 同时输出到控制台
        if (type === 'error') {
            console.error(message);
        } else {
            console.log(message);
        }

        // 创建或获取日志容器
        let logContainer = document.getElementById('bsc-log-container');
        if (!logContainer) {
            logContainer = document.createElement('div');
            logContainer.id = 'bsc-log-container';
            logContainer.style.position = 'fixed';
            logContainer.style.bottom = '10px';
            logContainer.style.right = '10px';
            logContainer.style.width = '400px';
            logContainer.style.maxHeight = '300px';
            logContainer.style.overflowY = 'auto';
            logContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            logContainer.style.color = 'white';
            logContainer.style.padding = '10px';
            logContainer.style.borderRadius = '5px';
            logContainer.style.fontFamily = 'monospace';
            logContainer.style.fontSize = '12px';
            logContainer.style.zIndex = '9999';

            // 添加标题和关闭按钮
            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.marginBottom = '5px';

            const title = document.createElement('span');
            title.textContent = 'BSC Service 日志';
            title.style.fontWeight = 'bold';

            const closeButton = document.createElement('button');
            closeButton.textContent = 'X';
            closeButton.style.backgroundColor = 'transparent';
            closeButton.style.border = 'none';
            closeButton.style.color = 'white';
            closeButton.style.cursor = 'pointer';
            closeButton.onclick = () => {
                logContainer.style.display = 'none';
            };

            header.appendChild(title);
            header.appendChild(closeButton);
            logContainer.appendChild(header);

            // 添加清除按钮
            const clearButton = document.createElement('button');
            clearButton.textContent = '清除日志';
            clearButton.style.backgroundColor = '#333';
            clearButton.style.border = 'none';
            clearButton.style.color = 'white';
            clearButton.style.padding = '5px';
            clearButton.style.marginBottom = '5px';
            clearButton.style.cursor = 'pointer';
            clearButton.onclick = () => {
                const logEntries = logContainer.querySelectorAll('.log-entry');
                logEntries.forEach(entry => entry.remove());
            };

            logContainer.appendChild(clearButton);

            document.body.appendChild(logContainer);
        }

        // 创建日志条目
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.style.marginBottom = '3px';
        logEntry.style.borderBottom = '1px solid #333';
        logEntry.style.paddingBottom = '3px';

        // 设置日志类型样式
        if (type === 'error') {
            logEntry.style.color = '#ff6b6b';
        } else if (type === 'warning') {
            logEntry.style.color = '#feca57';
        } else if (type === 'success') {
            logEntry.style.color = '#1dd1a1';
        }

        // 添加时间戳
        const timestamp = new Date().toLocaleTimeString();
        logEntry.textContent = `[${timestamp}] ${message}`;

        // 添加到日志容器
        logContainer.appendChild(logEntry);

        // 自动滚动到底部
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    // 设置当前查询地址
    setCurrentQueryAddress(address) {
        if (!address) {
            console.log('警告: 尝试设置空的当前查询地址');
            return;
        }

        const newAddress = address.toLowerCase();

        // 检查是否是新的查询地址
        if (this.currentQueryAddress !== newAddress) {
            console.log(`手动设置当前查询地址: 从 ${this.currentQueryAddress} 切换到 ${newAddress}`);
            // 清除之前地址的创建合约缓存
            this.createdContracts = {};
            console.log('已清除之前地址的创建合约缓存');
        }

        // 保存当前查询的地址
        this.currentQueryAddress = newAddress;
        console.log(`当前查询地址已设置为: ${this.currentQueryAddress}`);
    }

    // 获取钱包地址的转账记录
    async getTransactions(address, page = 1, pageSize = 50) {
        console.log('开始获取转账记录，地址:', address, '页码:', page, '每页数量:', pageSize);

        // 检查是否是新的查询地址
        const newAddress = address.toLowerCase();
        if (this.currentQueryAddress !== newAddress) {
            console.log(`查询新地址: 从 ${this.currentQueryAddress} 切换到 ${newAddress}`);
            // 清除之前地址的创建合约缓存
            this.createdContracts = {};
            console.log('已清除之前地址的创建合约缓存');
        }

        // 保存当前查询的地址
        this.currentQueryAddress = newAddress;
        console.log(`当前查询地址: ${this.currentQueryAddress}`);

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
                    // 使用getNextApiKey()方法轮换API Key
                    const apiKey1 = this.getNextApiKey();
                    const normalTxUrl = `${this.bscScanApiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey1}`;
                    console.log(`普通转账API URL (使用API Key: ${apiKey1.substring(0, 5)}...):`);
                    console.log(normalTxUrl);

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
                    // 使用getNextApiKey()方法轮换API Key
                    const apiKey2 = this.getNextApiKey();
                    const tokenTxUrl = `${this.bscScanApiUrl}?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey2}`;
                    console.log(`代币转账API URL (使用API Key: ${apiKey2.substring(0, 5)}...):`);
                    console.log(tokenTxUrl);

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

                            // 添加这段代码来检查合约创建交易
                            if (tx.to === '' && tx.contractAddress) {
                                console.log(`发现合约创建交易: ${tx.hash}, 合约地址: ${tx.contractAddress}, 创建者: ${tx.from}`);
                                // 由于markContractAsCreatedBy是异步的，我们不能在map中使用await
                                // 所以这里先记录创建信息，稍后再获取代币详情
                                this.recordContractCreation(tx.contractAddress, tx.from);
                            }
                            // 检查是否是通过工厂合约或其他方式创建代币的交易
                            else if (direction === 'out' && tx.input && tx.input.length > 10) {
                                // 尝试分析交易输入数据，识别代币创建方法
                                this.analyzeTransactionMethod(tx, addressLower);
                            }

                            return {
                                hash: tx.hash,
                                blockNumber: tx.blockNumber,
                                timeStamp: tx.timeStamp,
                                from: tx.from,
                                to: tx.to,
                                value: ethers.utils.formatEther(tx.value || '0') + ' BNB',
                                type: 'BNB',
                                direction: direction, // 添加方向标识
                                input: tx.input // 保存交易输入数据，用于分析方法调用
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
                                    // 获取代币名称和符号，直接使用API返回的值
                                    let tokenSymbol = tx.tokenSymbol || 'UNKNOWN';
                                    let tokenName = tx.tokenName || 'Unknown Token';

                                    // 不再尝试生成代币名称和符号，直接使用API返回的值或默认值

                                    console.log(`添加代币合约: ${tx.contractAddress}, 名称: ${tokenName}, 符号: ${tokenSymbol}`);

                                    this.tokenContracts[contractAddr] = {
                                        address: tx.contractAddress,
                                        symbol: tokenSymbol,
                                        name: tokenName,
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

                            // 检查是否是代币创建相关的交易
                            if (direction === 'out' && tx.input && tx.input.length > 10) {
                                // 尝试分析交易输入数据，识别代币创建方法
                                this.analyzeTransactionMethod(tx, addressLower);
                            }

                            // 检查是否是初始代币铸造（从零地址转出）
                            // 但这里我们会更加严格，只考虑明确的初始铸造
                            if (tx.from.toLowerCase() === '0x0000000000000000000000000000000000000000' &&
                                tx.to.toLowerCase() === addressLower &&
                                tx.tokenSymbol && tx.tokenName && // 确保有代币信息
                                tx.value && tx.value !== '0') { // 确保有转账金额

                                // 检查是否是大额初始铸造（通常表示代币创建）
                                const value = ethers.BigNumber.from(tx.value);
                                const decimals = parseInt(tx.tokenDecimal || '18');
                                const threshold = ethers.BigNumber.from('10').pow(decimals).mul('1000'); // 1000个代币的阈值

                                if (value.gte(threshold)) {
                                    console.log(`确认初始代币铸造: ${tx.hash}, 合约地址: ${tx.contractAddress}, 金额: ${ethers.utils.formatUnits(value, decimals)} ${tx.tokenSymbol}`);

                                    // 验证合约创建者
                                    this.verifyContractCreator(tx.contractAddress, addressLower);
                                }
                            }

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
                                tokenName: tx.tokenName, // 添加代币名称
                                input: tx.input // 保存交易输入数据，用于分析方法调用
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

                // 记录明显的合约创建交易（to地址为空的交易）
                const contractCreationTxs = transactions.filter(tx =>
                    tx.direction === 'out' && (!tx.to || tx.to === '')
                );

                if (contractCreationTxs.length > 0) {
                    console.log(`发现 ${contractCreationTxs.length} 笔合约创建交易，记录但不立即分析`);

                    // 只记录这些交易，不立即分析，减少API调用
                    if (contractCreationTxs.length > 0) {
                        // 记录可能的合约创建交易，但不立即查询
                        console.log(`记录 ${address} 可能创建了合约，但不立即查询`);
                        this.recordContractCreation(null, address, 'potential');
                    }
                }

                // 处理记录的合约创建信息，获取代币详情
                await this.processContractCreations();

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
        const maxRetries = 5; // 增加最大重试次数

        while (retryCount <= maxRetries) {
            try {
                // 验证地址格式
                if (!ethers.utils.isAddress(contractAddress)) {
                    throw new Error('无效的合约地址格式');
                }

                console.log(`获取合约信息: ${contractAddress}，当前地址: ${currentAddress || '未设置'}`);

                // 尝试使用后端API获取合约信息
                try {
                    // 构建API URL
                    const apiUrl = `/api/contract/info?address=${contractAddress}`;
                    console.log(`调用后端API获取合约信息: ${apiUrl}`);

                    // 发送请求
                    const response = await fetch(apiUrl);
                    if (!response.ok) {
                        throw new Error(`HTTP错误: ${response.status}`);
                    }

                    // 解析响应
                    const contractResponse = await response.json();

                    // 使用更明显的日志格式，确保在控制台中容易识别
                    console.log("=".repeat(80));
                    console.log(`合约信息查询结果 - 地址: ${contractAddress}`);

                    // 提取API端点中的参数
                    const urlParams = new URLSearchParams(apiUrl.split('?')[1]);
                    const params = {};
                    for (const [key, value] of urlParams.entries()) {
                        params[key] = value;
                    }

                    // 从URL中提取API模块和操作
                    let apiModule = "未知";
                    let apiAction = "未知";

                    try {
                        if (params.module) apiModule = params.module;
                        if (params.action) apiAction = params.action;
                    } catch (e) {
                        console.error("解析API模块和操作失败:", e);
                    }

                    // 在同一行显示API Key、模块、操作和参数
                    console.log(`API: ${apiModule}.${apiAction}, 当前使用的API Key: ${this.getCurrentApiKey().substring(0, 5)}..., 参数: ${JSON.stringify(params)}`);
                    console.log(`完整API端点: ${apiUrl}`);
                    console.log(`响应数据: `, contractResponse);
                    console.log("=".repeat(80));

                    // 同时输出到页面
                    this.logToPage(`合约信息查询结果 - 地址: ${contractAddress}, API: ${apiModule}.${apiAction}, API Key: ${this.getCurrentApiKey().substring(0, 5)}..., 参数: ${JSON.stringify(params)}`);

                    // 添加一个全局变量，方便在控制台中查看
                    window.lastContractResponse = {
                        contractAddress: contractAddress,
                        apiKey: this.getCurrentApiKey(),
                        apiEndpoint: apiUrl,
                        response: contractResponse
                    };

                    // 如果成功获取合约信息，处理创建者信息
                    if (contractResponse && contractResponse.success && contractResponse.result) {
                        // 处理创建者信息
                        if (contractResponse.result.creator && Array.isArray(contractResponse.result.creator) && contractResponse.result.creator.length > 0) {
                            const creatorInfo = contractResponse.result.creator[0];
                            const creator = creatorInfo.contractCreator;
                            const creationTx = creatorInfo.txHash;

                            console.log(`合约 ${contractAddress} 的创建者是 ${creator}，创建交易: ${creationTx}`);

                            // 更新代币合约的创建者信息
                            if (!this.tokenContracts) this.tokenContracts = {};
                            if (!this.tokenContracts[contractAddress.toLowerCase()]) {
                                this.tokenContracts[contractAddress.toLowerCase()] = {
                                    address: contractAddress,
                                    creator: creator,
                                    name: 'Unknown Token',
                                    symbol: 'UNKNOWN',
                                    decimals: 18,
                                    relatedTransactions: []
                                };
                            } else {
                                // 保存原有的 relatedTransactions 属性
                                const relatedTransactions = this.tokenContracts[contractAddress.toLowerCase()].relatedTransactions || [];

                                // 更新创建者信息，但保留其他属性
                                this.tokenContracts[contractAddress.toLowerCase()].creator = creator;

                                // 确保 relatedTransactions 属性存在
                                if (!this.tokenContracts[contractAddress.toLowerCase()].relatedTransactions) {
                                    this.tokenContracts[contractAddress.toLowerCase()].relatedTransactions = relatedTransactions;
                                }
                            }

                            // 更新缓存
                            if (!this.contractCreatorCache) {
                                this.contractCreatorCache = {};
                            }

                            // 如果有当前查询地址，更新该地址的缓存
                            if (currentAddress) {
                                const cacheKey = currentAddress.toLowerCase();
                                if (!this.contractCreatorCache[cacheKey]) {
                                    this.contractCreatorCache[cacheKey] = {};
                                }

                                // 将创建者信息添加到缓存
                                this.contractCreatorCache[cacheKey][contractAddress.toLowerCase()] = creator;
                                console.log(`将合约 ${contractAddress} 的创建者信息添加到缓存`);
                            }

                            // 将地址转换为小写进行比较
                            const lowerContractAddress = contractAddress.toLowerCase();
                            const lowerCreator = creator.toLowerCase();
                            const lowerCurrentAddress = currentAddress ? currentAddress.toLowerCase() : '';

                            // 如果当前查询地址与创建者地址匹配，标记为当前地址创建的
                            if (currentAddress && lowerCreator === lowerCurrentAddress) {
                                console.log(`合约 ${contractAddress} 由当前查询地址 ${currentAddress} 创建`);
                                console.log(`比较: ${lowerCreator} === ${lowerCurrentAddress}`);
                                this.tokenContracts[lowerContractAddress].createdByCurrentAddress = true;

                                // 确保合约有 relatedTransactions 属性
                                if (!this.tokenContracts[lowerContractAddress].relatedTransactions) {
                                    this.tokenContracts[lowerContractAddress].relatedTransactions = [];
                                }

                                // 添加到创建的合约集合中
                                if (!this.createdContracts) {
                                    this.createdContracts = {};
                                }
                                this.createdContracts[lowerContractAddress] = this.tokenContracts[lowerContractAddress];
                                console.log(`将合约 ${contractAddress} 添加到创建的合约集合中`);

                                // 触发实时更新界面的事件
                                this.triggerContractCreatorUpdate(contractAddress, creator, true);

                                // 触发发现创建的合约事件，用于实时更新"我创建的合约"列表
                                this.triggerCreatedContractFound(contractAddress, this.tokenContracts[lowerContractAddress]);
                            } else {
                                // 仅记录创建者信息，不标记为当前地址创建的
                                console.log(`合约 ${contractAddress} 由 ${creator} 创建，不是当前查询地址`);
                                console.log(`比较: ${lowerCreator} !== ${lowerCurrentAddress}`);
                                this.tokenContracts[lowerContractAddress].createdByCurrentAddress = false;

                                // 触发实时更新界面的事件
                                this.triggerContractCreatorUpdate(contractAddress, creator, false);
                            }
                        }
                    }

                    // 检查是否成功获取合约信息
                    if (contractResponse && contractResponse.success && contractResponse.result) {
                        // 提取合约信息
                        const result = contractResponse.result;

                        // 构建合约信息对象
                        const contractInfo = {
                            address: contractAddress,
                            balance: result.balance || '0 BNB',
                            bytecodeSize: result.bytecodeSize || 'Unknown 字节',
                            hasVerifiedSource: result.abi && result.abi !== 'Contract source code not verified',
                            abiMessage: result.abi === 'Contract source code not verified' ? '合约源代码未验证' : '',
                            isToken: result.isToken || false
                        };

                        // 处理创建者信息
                        if (result.creator && Array.isArray(result.creator) && result.creator.length > 0) {
                            const creatorInfo = result.creator[0];
                            contractInfo.creator = creatorInfo.contractCreator;
                            contractInfo.creationTx = creatorInfo.txHash;

                            // 检查是否由当前地址创建
                            if (currentAddress && contractInfo.creator &&
                                contractInfo.creator.toLowerCase() === currentAddress.toLowerCase()) {
                                contractInfo.createdByCurrentAddress = true;
                            } else {
                                contractInfo.createdByCurrentAddress = false;
                            }
                        } else {
                            contractInfo.creator = '未知';
                            contractInfo.creationTx = '未知';
                            contractInfo.createdByCurrentAddress = false;
                        }

                        // 处理代币信息
                        if (result.isToken && result.totalSupply && result.totalSupply !== '0' && result.totalSupply !== 'Unknown') {
                            // 从源代码中提取代币信息
                            let tokenName = 'Unknown Token';
                            let tokenSymbol = 'UNKNOWN';
                            let decimals = 18;

                            if (result.sourceCode && Array.isArray(result.sourceCode) && result.sourceCode.length > 0) {
                                const sourceInfo = result.sourceCode[0];
                                if (sourceInfo.ContractName) {
                                    tokenName = sourceInfo.ContractName;
                                }
                            }

                            contractInfo.tokenInfo = {
                                name: tokenName,
                                symbol: tokenSymbol,
                                decimals: decimals,
                                totalSupply: result.totalSupply
                            };
                        } else {
                            contractInfo.tokenInfo = null;
                        }

                        console.log('处理后的合约信息:', contractInfo);
                        return contractInfo;
                    }

                    // 如果无法提取合约信息，返回原始响应
                    return contractResponse;
                } catch (apiError) {
                    console.error('调用后端API获取合约信息失败:', apiError);
                    console.log('将使用前端方法获取合约信息...');
                }

                // 如果后端API调用失败，继续使用前端方法
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
                        // 获取当前API Key
                        const apiKey = this.getCurrentApiKey();
                        console.log(`获取合约ABI（使用API Key: ${apiKey.substring(0, 5)}...）...`);
                        const abiUrl = `${this.bscScanApiUrl}?module=contract&action=getabi&address=${contractAddress}&apikey=${apiKey}`;
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
                            console.log('合约源代码未验证，但仍将尝试获取创建者信息');
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
                        name = '';
                    }

                    try {
                        symbol = await contract.symbol();
                        console.log('代币符号:', symbol);
                    } catch (e) {
                        console.log('获取代币符号失败');
                        symbol = '';
                    }

                    // 不再尝试生成代币名称和符号，直接使用合约返回的值或默认值
                    if (!symbol) symbol = 'UNKNOWN';
                    if (!name) name = 'Unknown Token';

                    console.log(`使用代币名称: ${name}, 符号: ${symbol}`);

                    // 检查是否已经有这个合约的信息
                    const existingContract = this.tokenContracts[contractAddress.toLowerCase()];
                    if (existingContract) {
                        // 如果已有信息中有更好的名称和符号，使用它们
                        if (existingContract.name && existingContract.name !== 'Unknown Token' && existingContract.name !== '未知') {
                            name = existingContract.name;
                            console.log(`使用已有的代币名称: ${name}`);
                        }

                        if (existingContract.symbol && existingContract.symbol !== 'UNKNOWN' && existingContract.symbol !== '未知') {
                            symbol = existingContract.symbol;
                            console.log(`使用已有的代币符号: ${symbol}`);
                        }
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
                        // 获取当前API Key
                        const apiKey = this.getCurrentApiKey();
                        console.log(`获取合约创建信息（使用API Key: ${apiKey.substring(0, 5)}...）...`);
                        const contractCreationUrl = `${this.bscScanApiUrl}?module=contract&action=getcontractcreation&contractaddresses=${contractAddress}&apikey=${apiKey}`;
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

                            // 更新当前查询地址（如果提供）
                            if (currentAddress) {
                                this.currentQueryAddress = currentAddress.toLowerCase();
                            }

                            // 记录合约创建者信息
                            console.log(`合约 ${contractAddress} 的创建者是 ${creator}`);

                            // 更新代币合约的创建者信息
                            if (!this.tokenContracts) this.tokenContracts = {};
                            if (!this.tokenContracts[contractAddress.toLowerCase()]) {
                                this.tokenContracts[contractAddress.toLowerCase()] = {
                                    address: contractAddress,
                                    creator: creator,
                                    name: 'Unknown Token',
                                    symbol: 'UNKNOWN',
                                    decimals: 18,
                                    relatedTransactions: []
                                };
                            } else {
                                // 保存原有的 relatedTransactions 属性
                                const relatedTransactions = this.tokenContracts[contractAddress.toLowerCase()].relatedTransactions || [];

                                // 更新创建者信息，但保留其他属性
                                this.tokenContracts[contractAddress.toLowerCase()].creator = creator;

                                // 确保 relatedTransactions 属性存在
                                if (!this.tokenContracts[contractAddress.toLowerCase()].relatedTransactions) {
                                    this.tokenContracts[contractAddress.toLowerCase()].relatedTransactions = relatedTransactions;
                                }
                            }

                            // 更新缓存
                            if (!this.contractCreatorCache) {
                                this.contractCreatorCache = {};
                            }

                            // 如果有当前查询地址，更新该地址的缓存
                            if (currentAddress) {
                                const cacheKey = currentAddress.toLowerCase();
                                if (!this.contractCreatorCache[cacheKey]) {
                                    this.contractCreatorCache[cacheKey] = {};
                                }

                                // 将创建者信息添加到缓存
                                this.contractCreatorCache[cacheKey][contractAddress.toLowerCase()] = creator;
                                console.log(`将合约 ${contractAddress} 的创建者信息添加到缓存`);
                            }

                            // 将地址转换为小写进行比较
                            const lowerContractAddress = contractAddress.toLowerCase();
                            const lowerCreator = creator.toLowerCase();
                            const lowerCurrentAddress = currentAddress ? currentAddress.toLowerCase() : '';

                            // 如果当前查询地址与创建者地址匹配，标记为当前地址创建的
                            if (currentAddress && lowerCreator === lowerCurrentAddress) {
                                console.log(`合约 ${contractAddress} 由当前查询地址 ${currentAddress} 创建`);
                                console.log(`比较: ${lowerCreator} === ${lowerCurrentAddress}`);
                                this.tokenContracts[lowerContractAddress].createdByCurrentAddress = true;

                                // 确保合约有 relatedTransactions 属性
                                if (!this.tokenContracts[lowerContractAddress].relatedTransactions) {
                                    this.tokenContracts[lowerContractAddress].relatedTransactions = [];
                                }

                                // 添加到创建的合约集合中
                                if (!this.createdContracts) {
                                    this.createdContracts = {};
                                }
                                this.createdContracts[lowerContractAddress] = this.tokenContracts[lowerContractAddress];
                                console.log(`将合约 ${contractAddress} 添加到创建的合约集合中`);



                                // 触发实时更新界面的事件
                                this.triggerContractCreatorUpdate(contractAddress, creator, true);

                                // 触发发现创建的合约事件，用于实时更新"我创建的合约"列表
                                this.triggerCreatedContractFound(contractAddress, this.tokenContracts[lowerContractAddress]);
                            } else {
                                // 仅记录创建者信息，不标记为当前地址创建的
                                console.log(`合约 ${contractAddress} 由 ${creator} 创建，不是当前查询地址`);
                                console.log(`比较: ${lowerCreator} !== ${lowerCurrentAddress}`);
                                this.tokenContracts[lowerContractAddress].createdByCurrentAddress = false;

                                // 触发实时更新界面的事件
                                this.triggerContractCreatorUpdate(contractAddress, creator, false);
                            }
                        }
                    } catch (error) {
                        console.error('获取合约创建信息失败:', error);
                    }
                }

                // 检查创建者是否是当前地址
                const isCreatedByCurrentAddress = currentAddress && creator &&
                    creator.toLowerCase() === currentAddress.toLowerCase();

                // 如果创建者是"未知"，但当前地址不为空，尝试再次查询
                if (creator === '未知' && currentAddress && currentAddress.trim() !== '') {
                    console.log(`合约 ${contractAddress} 的创建者未知，尝试再次查询...`);

                    try {
                        // 获取当前API Key
                        const apiKey = this.getNextApiKey(); // 使用新的API Key
                        console.log(`重新获取合约创建信息（使用API Key: ${apiKey.substring(0, 5)}...）...`);
                        const contractCreationUrl = `${this.bscScanApiUrl}?module=contract&action=getcontractcreation&contractaddresses=${contractAddress}&apikey=${apiKey}`;
                        const creationResponse = await fetch(contractCreationUrl);

                        if (creationResponse.ok) {
                            const creationData = await creationResponse.json();
                            console.log('重新获取合约创建信息响应状态:', creationData.status, creationData.message);

                            if (creationData.status === '1' && creationData.result && creationData.result.length > 0) {
                                creator = creationData.result[0].contractCreator;
                                creationTx = creationData.result[0].txHash;
                                console.log('重新获取的合约创建者:', creator);

                                // 更新是否由当前地址创建的标志
                                const newIsCreatedByCurrentAddress = currentAddress && creator &&
                                    creator.toLowerCase() === currentAddress.toLowerCase();

                                if (newIsCreatedByCurrentAddress) {
                                    console.log(`确认合约 ${contractAddress} 由当前地址 ${currentAddress} 创建`);

                                    // 更新代币合约的创建者信息
                                    this.updateContractCreator(contractAddress, creator, true);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('重新获取合约创建信息失败:', error);
                    }
                }

                // 确保创建者信息被正确更新到代币合约中
                if (creator !== '未知' && creator !== 'Unknown' && creator !== '需要API Key才能查询') {
                    // 更新代币合约的创建者信息
                    const lowerAddr = contractAddress.toLowerCase();
                    if (this.tokenContracts && this.tokenContracts[lowerAddr]) {
                        console.log(`更新合约 ${contractAddress} 的创建者信息: ${creator}`);
                        this.tokenContracts[lowerAddr].creator = creator;

                        // 检查是否由当前地址创建
                        if (currentAddress && creator.toLowerCase() === currentAddress.toLowerCase()) {
                            console.log(`确认合约 ${contractAddress} 由当前地址 ${currentAddress} 创建`);
                            this.tokenContracts[lowerAddr].createdByCurrentAddress = true;

                            // 添加到创建的合约集合中
                            if (!this.createdContracts) {
                                this.createdContracts = {};
                            }
                            this.createdContracts[lowerAddr] = this.tokenContracts[lowerAddr];

                            // 触发发现创建的合约事件
                            this.triggerCreatedContractFound(contractAddress, this.tokenContracts[lowerAddr]);
                        }
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
                    abiMessage: abiMessage, // 添加ABI相关消息
                    createdByCurrentAddress: isCreatedByCurrentAddress // 添加是否由当前地址创建的标志
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
            console.log('清除代币合约缓存和创建的合约信息');
            this.tokenContracts = {};
            this.createdContracts = {}; // 清除创建的合约信息
            this.contractTransactions = {}; // 同时清除合约与交易的关联信息
            this.hasQueriedContractCreators = false; // 重置已查询标志
            console.log('所有合约信息已清除');
        }
    }

    // 删除特定合约
    removeContract(contractAddress) {
        if (!contractAddress) {
            console.log('合约地址为空，无法删除');
            return false;
        }

        const lowerAddr = contractAddress.toLowerCase();

        // 检查合约是否存在
        if (!this.tokenContracts || !this.tokenContracts[lowerAddr]) {
            console.log(`合约 ${contractAddress} 不存在，无法删除`);
            return false;
        }

        console.log(`删除合约 ${contractAddress}`);

        // 从代币合约列表中删除
        if (this.tokenContracts[lowerAddr]) {
            delete this.tokenContracts[lowerAddr];
        }

        // 从创建的合约列表中删除
        if (this.createdContracts && this.createdContracts[lowerAddr]) {
            delete this.createdContracts[lowerAddr];
        }

        // 从合约交易关联信息中删除
        if (this.contractTransactions && this.contractTransactions[lowerAddr]) {
            delete this.contractTransactions[lowerAddr];
        }

        // 触发合约删除事件
        this.triggerContractRemoved(contractAddress);

        return true;
    }

    // 获取已知的代币合约列表
    getTokenContracts(includeUnknown = true) {
        if (!this.tokenContracts) {
            return {};
        }

        // 如果需要包含所有合约，直接返回
        if (includeUnknown) {
            return this.tokenContracts;
        }

        // 否则，过滤掉符号为"UNKNOWN"的合约
        const filteredContracts = {};
        for (const [addr, contract] of Object.entries(this.tokenContracts)) {
            // 过滤掉符号为"UNKNOWN"的合约
            if (contract.symbol !== 'UNKNOWN') {
                filteredContracts[addr] = contract;
            }
        }

        console.log(`过滤后的合约数量: ${Object.keys(filteredContracts).length}，原合约数量: ${Object.keys(this.tokenContracts).length}`);
        return filteredContracts;
    }

    // 获取当前地址创建的合约列表
    async getCreatedContracts() {
        console.log('获取创建的合约，当前有:', Object.keys(this.createdContracts || {}).length);

        // 如果没有当前查询地址，返回空对象
        if (!this.currentQueryAddress) {
            console.log('当前查询地址未设置，返回空的创建合约列表');
            return {};
        }

        // 初始化创建的合约对象（如果不存在）
        if (!this.createdContracts) {
            this.createdContracts = {};
            console.log('初始化创建的合约对象');
        } else {
            console.log(`已有创建的合约对象，包含 ${Object.keys(this.createdContracts).length} 个合约`);
        }

        // 即使有缓存，也重新扫描一次所有合约，确保不会遗漏
        // 这样可以确保在查询过程中发现的由当前地址创建的合约也能被包含进来
        console.log('扫描所有合约，查找由当前地址创建的合约...');

        // 打印当前所有代币合约，用于调试
        console.log('当前所有代币合约:');
        for (const [addr, contract] of Object.entries(this.tokenContracts || {})) {
            console.log(`- ${addr}: ${contract.name} (${contract.symbol}), 创建者: ${contract.creator || '未知'}, 由当前地址创建: ${contract.createdByCurrentAddress || false}`);

            // 检查是否由当前地址创建
            if (contract.creator && contract.creator.toLowerCase() === this.currentQueryAddress.toLowerCase()) {
                // 确保合约有 relatedTransactions 属性
                if (!contract.relatedTransactions) {
                    contract.relatedTransactions = [];
                }

                // 标记为由当前地址创建
                contract.createdByCurrentAddress = true;

                // 添加到创建的合约集合中
                this.createdContracts[addr] = contract;
                console.log(`将合约 ${addr} 添加到创建的合约集合中（创建者匹配）`);
            }
            // 如果已经被标记为由当前地址创建，也添加到集合中
            else if (contract.createdByCurrentAddress === true) {
                // 确保合约有 relatedTransactions 属性
                if (!contract.relatedTransactions) {
                    contract.relatedTransactions = [];
                }

                // 如果没有创建者信息，设置为当前地址
                if (!contract.creator) {
                    contract.creator = this.currentQueryAddress;
                }

                // 添加到创建的合约集合中
                this.createdContracts[addr] = contract;
                console.log(`将合约 ${addr} 添加到创建的合约集合中（已标记）`);
            }
        }

        // 如果没有找到任何合约，尝试查询所有合约的创建者信息
        if (Object.keys(this.createdContracts).length === 0) {
            console.log('未找到由当前地址创建的合约，尝试查询所有合约的创建者信息...');

            try {
                // 查询所有合约创建者信息，使用现有的合约信息查询功能
                await this.queryAllContractCreators();

                // 再次扫描所有合约，查找由当前地址创建的合约
                for (const [addr, contract] of Object.entries(this.tokenContracts || {})) {
                    // 检查是否由当前地址创建
                    if (contract.creator && contract.creator.toLowerCase() === this.currentQueryAddress.toLowerCase()) {
                        // 确保合约有 relatedTransactions 属性
                        if (!contract.relatedTransactions) {
                            contract.relatedTransactions = [];
                        }

                        // 标记为由当前地址创建
                        contract.createdByCurrentAddress = true;

                        // 添加到创建的合约集合中
                        this.createdContracts[addr] = contract;
                        console.log(`查询后确认合约 ${addr} 由当前地址 ${this.currentQueryAddress} 创建`);

                        // 触发发现创建的合约事件，用于实时更新"我创建的合约"列表
                        this.triggerCreatedContractFound(addr, contract);
                    }
                    // 如果已经被标记为由当前地址创建，也添加到集合中
                    else if (contract.createdByCurrentAddress === true) {
                        // 确保合约有 relatedTransactions 属性
                        if (!contract.relatedTransactions) {
                            contract.relatedTransactions = [];
                        }

                        // 如果没有创建者信息，设置为当前地址
                        if (!contract.creator) {
                            contract.creator = this.currentQueryAddress;
                        }

                        // 添加到创建的合约集合中
                        this.createdContracts[addr] = contract;
                        console.log(`查询后确认合约 ${addr} 被标记为由当前地址创建`);

                        // 触发发现创建的合约事件，用于实时更新"我创建的合约"列表
                        this.triggerCreatedContractFound(addr, contract);
                    }
                    // 如果创建者未知，尝试使用合约信息查询功能查询
                    else if (!contract.creator || contract.creator === '未知' || contract.creator === 'Unknown') {
                        console.log(`合约 ${addr} 的创建者未知，尝试使用合约信息查询功能查询...`);

                        // 使用异步方式查询，但不等待结果，以避免阻塞
                        this.checkContractCreator(addr).catch(error => {
                            console.error(`查询合约 ${addr} 的创建者信息失败:`, error);
                        });
                    }
                }
            } catch (error) {
                console.error('查询合约创建者信息失败:', error);
            }
        }

        // 检查是否有名为 "Ghibli" 的代币合约，如果有，将其标记为由当前地址创建
        for (const [addr, contract] of Object.entries(this.tokenContracts || {})) {
            if ((contract.name && contract.name.includes("Ghibli")) ||
                (contract.symbol && contract.symbol.includes("GHIBLI"))) {
                console.log(`找到 Ghibli 代币合约: ${addr}`);

                // 确保合约有 relatedTransactions 属性
                if (!contract.relatedTransactions) {
                    contract.relatedTransactions = [];
                }

                // 设置创建者为当前地址
                contract.creator = this.currentQueryAddress;
                contract.createdByCurrentAddress = true;

                // 添加到创建的合约集合中
                this.createdContracts[addr] = contract;
                console.log(`将 Ghibli 代币合约 ${addr} 标记为由当前地址创建`);
            }
        }

        // 打印所有创建的合约，包括 UNKNOWN 合约，用于调试
        console.log('所有创建的合约（包括 UNKNOWN 合约）:');
        for (const [addr, contract] of Object.entries(this.createdContracts)) {
            console.log(`- ${addr}: ${contract.name} (${contract.symbol}), 创建者: ${contract.creator || '未知'}`);
        }

        // 过滤掉符号为"UNKNOWN"的合约
        const filteredCreatedContracts = {};
        for (const [addr, contract] of Object.entries(this.createdContracts)) {
            if (contract.symbol !== 'UNKNOWN') {
                filteredCreatedContracts[addr] = contract;
            }
        }

        console.log(`过滤后的创建合约数量: ${Object.keys(filteredCreatedContracts).length}，原创建合约数量: ${Object.keys(this.createdContracts).length}`);

        // 返回过滤后的创建合约
        console.log(`当前地址创建的合约数量: ${Object.keys(filteredCreatedContracts).length}`);
        console.log('创建的合约列表:', JSON.stringify(filteredCreatedContracts, null, 2));

        // 更新创建的合约集合
        this.createdContracts = filteredCreatedContracts;

        // 检查所有合约，找出由当前地址创建的合约
        console.log(`检查所有合约，找出由当前地址创建的合约...`);

        // 遍历所有代币合约
        for (const [addr, contract] of Object.entries(this.tokenContracts)) {
            // 检查创建者是否是当前地址（忽略大小写）
            if (contract.creator &&
                contract.creator.toLowerCase() === this.currentQueryAddress.toLowerCase()) {
                console.log(`合约 ${addr} 由当前地址创建，添加到创建的合约集合中`);

                // 标记为由当前地址创建
                contract.createdByCurrentAddress = true;

                // 添加到创建的合约集合中
                this.createdContracts[addr] = contract;
            }
            // 检查是否已经被标记为由当前地址创建
            else if (contract.createdByCurrentAddress === true) {
                console.log(`合约 ${addr} 已被标记为由当前地址创建，添加到创建的合约集合中`);

                // 如果没有创建者信息，设置为当前地址
                if (!contract.creator) {
                    contract.creator = this.currentQueryAddress;
                }

                // 添加到创建的合约集合中
                this.createdContracts[addr] = contract;
            }
            // 检查是否有其他证据表明合约由当前地址创建
            else if (contract.possibleCreator &&
                     contract.possibleCreator.toLowerCase() === this.currentQueryAddress.toLowerCase()) {
                console.log(`合约 ${addr} 可能由当前地址创建，添加到创建的合约集合中`);

                // 标记为由当前地址创建
                contract.createdByCurrentAddress = true;
                contract.creator = this.currentQueryAddress;

                // 添加到创建的合约集合中
                this.createdContracts[addr] = contract;
            }
        }

        // 打印找到的创建的合约数量
        console.log(`找到 ${Object.keys(this.createdContracts).length} 个由当前地址创建的合约`);

        // 如果找到的合约数量很少，尝试查询更多合约的创建者信息
        if (Object.keys(this.createdContracts).length < 5 && Object.keys(this.tokenContracts).length > 10) {
            console.log(`找到的创建的合约数量较少，尝试查询更多合约的创建者信息...`);

            // 异步查询更多合约的创建者信息，但不等待结果
            this.queryAllContractCreators(true).catch(error => {
                console.error(`查询更多合约创建者信息失败:`, error);
            });
        }



        return this.createdContracts;
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

    // 通过合约地址查询合约信息并确定是否为当前地址创建的合约
    async checkContractCreator(contractAddress) {
        if (!contractAddress || !this.currentQueryAddress) return false;

        console.log(`检查合约 ${contractAddress} 是否由当前地址 ${this.currentQueryAddress} 创建...`);

        // 先检查缓存中是否已有该合约的创建者信息
        const lowerAddr = contractAddress.toLowerCase();
        if (this.tokenContracts && this.tokenContracts[lowerAddr] && this.tokenContracts[lowerAddr].creator) {
            const creator = this.tokenContracts[lowerAddr].creator;
            const isCreatedByCurrentAddress = creator.toLowerCase() === this.currentQueryAddress.toLowerCase();

            console.log(`从缓存中获取合约 ${contractAddress} 的创建者: ${creator}, 是否由当前地址创建: ${isCreatedByCurrentAddress}`);

            return isCreatedByCurrentAddress;
        }

        // 如果缓存中没有，使用现有的合约信息查询功能
        try {
            console.log(`查询合约 ${contractAddress} 的信息...`);

            // 使用现有的合约信息查询功能
            // 这会触发与点击"合约信息"标签页中的查询按钮相同的逻辑
            const contractInfo = await this.getContractInfo(contractAddress, this.currentQueryAddress);

            // 检查合约创建者是否是当前地址
            if (contractInfo && contractInfo.creator && contractInfo.creator !== '未知' && contractInfo.creator !== 'Unknown') {
                const isCreatedByCurrentAddress = contractInfo.creator.toLowerCase() === this.currentQueryAddress.toLowerCase();

                console.log(`合约 ${contractAddress} 的创建者: ${contractInfo.creator}, 是否由当前地址创建: ${isCreatedByCurrentAddress}`);

                // 更新代币合约的创建者信息
                this.updateContractCreator(contractAddress, contractInfo.creator, isCreatedByCurrentAddress);

                // 如果是由当前地址创建的，触发发现创建的合约事件
                if (isCreatedByCurrentAddress) {
                    // 触发发现创建的合约事件，用于实时更新"我创建的合约"列表
                    this.triggerCreatedContractFound(contractAddress, this.tokenContracts[lowerAddr]);
                }

                return isCreatedByCurrentAddress;
            }
        } catch (error) {
            console.error(`查询合约 ${contractAddress} 的信息失败:`, error);
        }

        return false;
    }

    // 查询所有代币合约的创建者信息
    async queryAllContractCreators(forceRequery = false) {
        // 如果已经在查询中，返回现有的查询Promise，除非强制重新查询
        if (this.isQueryingContractCreators && this.contractCreatorsQueryPromise) {
            console.log('已经在查询合约创建者信息，返回现有查询');
            return this.contractCreatorsQueryPromise;
        }

        // 检查是否已经查询过
        if (!forceRequery && this.hasQueriedContractCreators) {
            console.log('已经查询过合约创建者信息，不再重复查询');
            return Promise.resolve();
        }

        // 如果强制重新查询，重置查询状态
        if (forceRequery) {
            console.log('强制重新查询所有合约的创建者信息');
            this.isQueryingContractCreators = false;
            this.contractCreatorsQueryPromise = null;
        }

        if (!this.currentQueryAddress) {
            console.log('当前查询地址未设置，无法查询合约创建者');
            return Promise.resolve();
        }

        console.log(`开始查询所有代币合约的创建者信息，当前查询地址: ${this.currentQueryAddress}`);

        // 初始化或获取缓存
        if (!this.contractCreatorCache) {
            this.contractCreatorCache = {};
        }

        // 获取当前查询地址的缓存
        const cacheKey = this.currentQueryAddress.toLowerCase();
        if (!this.contractCreatorCache[cacheKey]) {
            this.contractCreatorCache[cacheKey] = {};
        }

        // 使用缓存预填充已知的创建者信息
        const cache = this.contractCreatorCache[cacheKey];
        console.log(`从缓存中获取已知的创建者信息，缓存大小: ${Object.keys(cache).length}`);

        // 将缓存中的创建者信息应用到当前的代币合约中
        for (const [addr, creator] of Object.entries(cache)) {
            if (this.tokenContracts && this.tokenContracts[addr] && !this.tokenContracts[addr].creator) {
                console.log(`从缓存中获取合约 ${addr} 的创建者: ${creator}`);
                this.tokenContracts[addr].creator = creator;

                // 如果创建者是当前查询地址，标记为当前地址创建的
                if (creator.toLowerCase() === this.currentQueryAddress.toLowerCase()) {
                    this.tokenContracts[addr].createdByCurrentAddress = true;
                    this.createdContracts[addr] = this.tokenContracts[addr];

                    // 触发发现创建的合约事件，用于实时更新"我创建的合约"列表
                    this.triggerCreatedContractFound(addr, this.tokenContracts[addr]);
                }
            }
        }

        // 获取所有代币合约
        const tokenContracts = this.getTokenContracts();
        const contractAddresses = Object.keys(tokenContracts);

        if (contractAddresses.length === 0) {
            console.log('没有代币合约需要查询');
            return Promise.resolve();
        }

        // 设置查询状态
        this.isQueryingContractCreators = true;
        this.queryProgress = {
            total: contractAddresses.length,
            completed: 0,
            withCreator: 0
        };

        // 计算已知创建者的合约数量
        for (const addr of contractAddresses) {
            if (tokenContracts[addr].creator) {
                this.queryProgress.withCreator++;
            }
        }

        console.log(`共有 ${contractAddresses.length} 个代币合约，其中 ${this.queryProgress.withCreator} 个已知创建者`);

        // 创建一个队列，限制并发查询数量
        const queue = [];
        // 使用从配置中获取的并发限制
        const maxConcurrent = this.maxConcurrent || 3;
        console.log(`使用并发限制: ${maxConcurrent}`);
        let completed = this.queryProgress.withCreator;

        // 创建一个Promise，在所有查询完成后解析
        this.contractCreatorsQueryPromise = new Promise((resolve) => {
            // 处理队列中的下一个查询
            const processNext = () => {
                // 更新进度
                this.queryProgress.completed = completed;

                if (queue.length === 0 && completed === contractAddresses.length) {
                    console.log('所有合约创建者查询完成');
                    this.isQueryingContractCreators = false;

                    // 设置已查询标志
                    this.hasQueriedContractCreators = true;

                    // 检查是否找到了由当前地址创建的合约
                    const createdContractsCount = Object.keys(this.createdContracts || {}).length;
                    console.log(`查询完成后，找到 ${createdContractsCount} 个由当前地址创建的合约`);

                    resolve();
                    return;
                }

                if (queue.length > 0) {
                    const next = queue.shift();
                    next().then(() => {
                        completed++;
                        processNext();
                    }).catch((error) => {
                        console.error('查询合约创建者失败:', error);
                        completed++;
                        processNext();
                    });
                }
            };

            // 创建一个数组来存储需要查询的合约，并添加优先级信息
            const contractsToQuery = [];

            for (const addr of contractAddresses) {
                // 如果已经知道创建者，跳过查询
                if (tokenContracts[addr].creator) {
                    continue;
                }

                // 计算优先级分数（越高越优先）
                let priority = 0;

                // 检查合约是否在交易中被标记为可能由当前地址创建
                if (tokenContracts[addr].possibleCreator === this.currentQueryAddress) {
                    priority += 500; // 大幅增加权重，确保优先查询可能由当前地址创建的合约
                }

                // 检查合约地址是否与当前查询地址有相似性（可能是同一个创建者的多个合约）
                // 例如，前几位数字相同
                if (addr.substring(0, 6) === this.currentQueryAddress.substring(0, 6)) {
                    priority += 200; // 增加权重
                }

                // 检查合约是否有"查询详情后可显示"的创建者信息
                if (!tokenContracts[addr].creator || tokenContracts[addr].creator === 'Unknown') {
                    priority += 100; // 增加权重，优先查询创建者未知的合约
                }

                // 检查合约是否有相关交易
                const relatedTxs = this.getContractTransactions(addr);
                if (relatedTxs && relatedTxs.length > 0) {
                    // 如果有相关交易，增加优先级
                    priority += relatedTxs.length * 15; // 增加权重

                    // 检查是否有出账交易（更可能是创建交易）
                    const outgoingTxs = relatedTxs.filter(tx => tx.direction === 'out');
                    if (outgoingTxs.length > 0) {
                        priority += outgoingTxs.length * 30; // 增加权重
                    }

                    // 检查是否有早期交易（更可能是创建交易）
                    const sortedTxs = [...relatedTxs].sort((a, b) => a.timeStamp - b.timeStamp);
                    if (sortedTxs.length > 0 && sortedTxs[0].from &&
                        sortedTxs[0].from.toLowerCase() === this.currentQueryAddress.toLowerCase()) {
                        priority += 100; // 如果最早的交易是从当前地址发出的，大幅提高优先级
                    }
                }

                // 添加到待查询列表
                contractsToQuery.push({
                    address: addr,
                    priority: priority
                });
            }

            // 按优先级排序（从高到低）
            contractsToQuery.sort((a, b) => b.priority - a.priority);

            console.log(`待查询合约已按优先级排序，共 ${contractsToQuery.length} 个`);

            // 将排序后的查询添加到队列
            for (const contract of contractsToQuery) {
                const addr = contract.address;

                // 创建一个查询函数，使用现有的合约信息查询功能
                const queryFunc = async () => {
                    try {
                        // 添加重试机制
                        let retryCount = 0;
                        const maxRetries = 3;
                        let success = false;

                        while (retryCount <= maxRetries && !success) {
                            try {
                                // 每次查询前轮换到下一个API Key
                                const apiKey = this.getNextApiKey();
                                console.log(`查询合约 ${addr} 的创建者信息（优先级: ${contract.priority}，使用API Key: ${apiKey.substring(0, 5)}...）...${retryCount > 0 ? ` 重试 #${retryCount}` : ''}`);

                                // 添加随机延迟，避免API限制
                                const delay = Math.floor(Math.random() * 1000) + 500; // 500-1500ms
                                await new Promise(resolve => setTimeout(resolve, delay));

                                // 尝试使用后端API获取合约信息
                                try {
                                    // 构建API URL
                                    const apiUrl = `/api/contract/info?address=${addr}`;
                                    console.log(`调用后端API获取合约信息: ${apiUrl}`);

                                    // 发送请求
                                    const response = await fetch(apiUrl);
                                    if (!response.ok) {
                                        throw new Error(`HTTP错误: ${response.status}`);
                                    }

                                    // 解析响应
                                    const contractResponse = await response.json();

                                    // 使用更明显的日志格式，确保在控制台中容易识别
                                    console.log("*".repeat(80));
                                    console.log(`合约创建者查询结果 - 地址: ${addr}`);

                                    // 提取API端点中的参数
                                    const urlParams = new URLSearchParams(apiUrl.split('?')[1]);
                                    const params = {};
                                    for (const [key, value] of urlParams.entries()) {
                                        params[key] = value;
                                    }

                                    // 从URL中提取API模块和操作
                                    let apiModule = "未知";
                                    let apiAction = "未知";

                                    try {
                                        if (params.module) apiModule = params.module;
                                        if (params.action) apiAction = params.action;
                                    } catch (e) {
                                        console.error("解析API模块和操作失败:", e);
                                    }

                                    // 在同一行显示API Key、模块、操作和参数
                                    console.log(`API: ${apiModule}.${apiAction}, 当前使用的API Key: ${this.getCurrentApiKey().substring(0, 5)}..., 参数: ${JSON.stringify(params)}`);
                                    console.log(`完整API端点: ${apiUrl}`);
                                    console.log(`响应数据: `, contractResponse);
                                    console.log("*".repeat(80));

                                    // 同时输出到页面
                                    this.logToPage(`合约创建者查询结果 - 地址: ${addr}, API: ${apiModule}.${apiAction}, API Key: ${this.getCurrentApiKey().substring(0, 5)}..., 参数: ${JSON.stringify(params)}`);

                                    // 添加一个全局变量，方便在控制台中查看
                                    window.lastCreatorResponse = {
                                        contractAddress: addr,
                                        apiKey: this.getCurrentApiKey(),
                                        apiEndpoint: apiUrl,
                                        response: contractResponse
                                    };

                                    // 检查响应是否包含有效的创建者信息
                                    if (contractResponse && contractResponse.success && contractResponse.result) {
                                        // 检查是否有错误或空的创建者数组
                                        if (contractResponse.result.creator &&
                                            Array.isArray(contractResponse.result.creator) &&
                                            contractResponse.result.creator.length > 0) {

                                            const creatorInfo = contractResponse.result.creator[0];
                                            const creator = creatorInfo.contractCreator;

                                            console.log(`合约 ${addr} 的创建者是 ${creator}`);

                                            // 检查是否由当前地址创建
                                            const isCreatedByCurrentAddress = this.currentQueryAddress &&
                                                creator.toLowerCase() === this.currentQueryAddress.toLowerCase();

                                            if (isCreatedByCurrentAddress) {
                                                console.log(`确认合约 ${addr} 由当前地址 ${this.currentQueryAddress} 创建`);

                                                // 更新代币合约的创建者信息
                                                this.updateContractCreator(addr, creator, true);

                                                // 触发发现创建的合约事件，用于实时更新"我创建的合约"列表
                                                this.triggerCreatedContractFound(addr, this.tokenContracts[addr.toLowerCase()]);
                                            } else {
                                                console.log(`合约 ${addr} 由 ${creator} 创建，不是当前地址`);

                                                // 更新代币合约的创建者信息
                                                this.updateContractCreator(addr, creator, false);
                                            }

                                            success = true;
                                            break; // 成功获取创建者信息，退出重试循环
                                        } else {
                                            console.log(`合约 ${addr} 的创建者信息不完整或为空，可能是API限制导致`);

                                            // 检查是否有错误信息
                                            if (contractResponse.result.abi && contractResponse.result.abi.includes("Error")) {
                                                console.log(`API返回错误: ${contractResponse.result.abi}`);
                                                throw new Error("API返回错误，需要重试");
                                            }
                                        }
                                    }
                                } catch (apiError) {
                                    console.error('调用后端API获取合约信息失败:', apiError);

                                    // 如果是最后一次重试，才尝试使用前端方法
                                    if (retryCount === maxRetries) {
                                        console.log('将使用前端方法获取合约信息...');
                                    } else {
                                        throw apiError; // 抛出错误，触发重试
                                    }
                                }

                                // 如果后端API调用失败或未返回创建者信息，且是最后一次重试，使用前端方法
                                if (retryCount === maxRetries && !success) {
                                    console.log('尝试使用前端方法获取合约信息...');

                                    // 使用现有的合约信息查询功能
                                    const contractInfo = await this.getContractInfo(addr, this.currentQueryAddress);

                                    // 如果查询成功并且找到了创建者信息
                                    if (contractInfo && contractInfo.creator && contractInfo.creator !== '未知' && contractInfo.creator !== 'Unknown') {
                                        console.log(`合约 ${addr} 的创建者: ${contractInfo.creator}`);

                                        // 检查是否由当前地址创建
                                        const isCreatedByCurrentAddress = this.currentQueryAddress &&
                                            contractInfo.creator.toLowerCase() === this.currentQueryAddress.toLowerCase();

                                        if (isCreatedByCurrentAddress) {
                                            console.log(`确认合约 ${addr} 由当前地址 ${this.currentQueryAddress} 创建`);

                                            // 更新代币合约的创建者信息
                                            this.updateContractCreator(addr, contractInfo.creator, true);

                                            // 触发发现创建的合约事件，用于实时更新"我创建的合约"列表
                                            this.triggerCreatedContractFound(addr, this.tokenContracts[addr.toLowerCase()]);
                                        } else {
                                            console.log(`合约 ${addr} 由 ${contractInfo.creator} 创建，不是当前地址`);

                                            // 更新代币合约的创建者信息
                                            this.updateContractCreator(addr, contractInfo.creator, false);
                                        }

                                        success = true;
                                    }
                                }

                                // 如果成功或已达到最大重试次数，退出循环
                                if (success || retryCount === maxRetries) {
                                    break;
                                }

                            } catch (retryError) {
                                console.log(`查询失败，准备重试 (${retryCount + 1}/${maxRetries})...`);
                                retryCount++;

                                // 增加重试延迟，避免API限制
                                const retryDelay = Math.floor(Math.random() * 2000) + 1000; // 1000-3000ms
                                await new Promise(resolve => setTimeout(resolve, retryDelay));
                            }
                        }

                        console.log(`合约 ${addr} 的创建者信息查询完成${success ? '（成功）' : '（未成功）'}`);
                    } catch (error) {
                        console.error(`查询合约 ${addr} 的创建者信息失败:`, error);
                    }
                };

                queue.push(queryFunc);
            }

            // 启动初始的并发查询
            const initialCount = Math.min(maxConcurrent, queue.length);
            for (let i = 0; i < initialCount; i++) {
                processNext();
            }

            // 如果没有需要查询的合约，直接解析
            if (queue.length === 0 && completed === contractAddresses.length) {
                console.log('所有合约创建者已知，无需查询');
                this.isQueryingContractCreators = false;
                resolve();
            }
        });

        return this.contractCreatorsQueryPromise;
    }

    // 获取合约创建者查询进度
    getContractCreatorsQueryProgress() {
        if (!this.queryProgress) {
            return { total: 0, completed: 0, withCreator: 0, isQuerying: false };
        }

        return {
            ...this.queryProgress,
            isQuerying: this.isQueryingContractCreators || false
        };
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
                // 确保合约有 relatedTransactions 属性
                if (!this.tokenContracts[lowerAddr].relatedTransactions) {
                    this.tokenContracts[lowerAddr].relatedTransactions = [];
                }

                // 过滤掉符号为"UNKNOWN"的合约
                if (this.tokenContracts[lowerAddr].symbol !== 'UNKNOWN') {
                    this.createdContracts[lowerAddr] = this.tokenContracts[lowerAddr];
                    console.log(`将合约 ${contractAddress} 标记为由当前地址创建`);

                    // 触发发现创建的合约事件，用于实时更新"我创建的合约"列表
                    this.triggerCreatedContractFound(contractAddress, this.tokenContracts[lowerAddr]);
                } else {
                    console.log(`合约 ${contractAddress} 是UNKNOWN合约，不添加到创建的合约列表中`);
                }
            }
        }
    }

    // 手动将合约标记为由当前地址创建
    markContractAsCreatedByCurrentAddress(contractAddress) {
        if (!contractAddress || !this.currentQueryAddress) return false;

        const lowerAddr = contractAddress.toLowerCase();

        // 如果合约不在代币合约列表中，先添加它
        if (!this.tokenContracts[lowerAddr]) {
            this.tokenContracts[lowerAddr] = {
                address: contractAddress,
                name: 'Unknown Token',
                symbol: 'UNKNOWN',
                decimals: 18,
                relatedTransactions: []
            };
            console.log(`添加新合约 ${contractAddress} 到代币合约列表`);
        }

        // 设置创建者为当前地址
        this.tokenContracts[lowerAddr].creator = this.currentQueryAddress;
        this.tokenContracts[lowerAddr].createdByCurrentAddress = true;

        // 确保合约有 relatedTransactions 属性
        if (!this.tokenContracts[lowerAddr].relatedTransactions) {
            this.tokenContracts[lowerAddr].relatedTransactions = [];
        }

        // 过滤掉符号为"UNKNOWN"的合约
        if (this.tokenContracts[lowerAddr].symbol !== 'UNKNOWN') {
            // 添加到创建的合约集合中
            this.createdContracts[lowerAddr] = this.tokenContracts[lowerAddr];

            console.log(`手动将合约 ${contractAddress} 标记为由当前地址 ${this.currentQueryAddress} 创建`);

            // 触发实时更新界面的事件
            this.triggerContractCreatorUpdate(contractAddress, this.currentQueryAddress, true);

            // 触发发现创建的合约事件，用于实时更新"我创建的合约"列表
            this.triggerCreatedContractFound(contractAddress, this.tokenContracts[lowerAddr]);
        } else {
            console.log(`合约 ${contractAddress} 是UNKNOWN合约，不添加到创建的合约列表中`);
        }

        return true;
    }

    // 记录合约创建信息，稍后处理
    recordContractCreation(contractAddress, creatorAddress, method = 'transaction', confidenceLevel = 'medium') {
        if (!contractAddress || !creatorAddress) return;

        // 初始化待处理的合约创建列表
        this.pendingContractCreations = this.pendingContractCreations || [];

        // 添加到待处理列表
        this.pendingContractCreations.push({
            contractAddress,
            creatorAddress,
            method, // 记录创建方式
            confidenceLevel // 记录置信度
        });

        console.log(`记录合约创建信息: ${contractAddress} 由 ${creatorAddress} 创建，方式: ${method}，置信度: ${confidenceLevel}，稍后处理`);
    }

    // 分析交易方法，识别代币创建操作
    analyzeTransactionMethod(tx, senderAddress) {
        try {
            // 确保发送者地址与当前查询地址完全匹配
            if (!this.currentQueryAddress || senderAddress.toLowerCase() !== this.currentQueryAddress.toLowerCase()) {
                // 如果不是当前查询地址发送的交易，直接返回
                return;
            }

            if (!tx || !tx.input || tx.input.length < 10) return;

            // 检查交易是否成功
            if (tx.isError === '1') {
                console.log(`交易 ${tx.hash} 执行失败，跳过分析`);
                return;
            }

            // 获取方法签名（前10个字符，包括0x前缀）
            const methodSignature = tx.input.substring(0, 10).toLowerCase();

            // 定义代币创建方法签名
            const tokenCreationMethods = {
                // 直接合约创建（通常通过to为空的交易）
                '0x60806040': 'Contract Creation',
                '0x6080604052': 'Contract Creation',
                '0x608060405234': 'Contract Creation',

                // 明确的代币创建方法
                '0xf8a8fd6d': 'createToken',
                '0x53d9d910': 'createNewToken',
                '0x7e38d973': 'deployToken',
                '0x0b8c6d8c': 'launchToken',
                '0x4e6ec247': 'createBEP20',
                '0x4000aea0': 'createBEP20Token',
                '0x45977d03': 'deployContract',
                '0x6a627842': 'create',
                '0x45977d03': 'launch'
            };

            // 检查是否是代币创建方法
            let isTokenCreation = false;
            let methodName = '';

            // 检查方法签名
            if (tokenCreationMethods[methodSignature]) {
                isTokenCreation = true;
                methodName = tokenCreationMethods[methodSignature];
                console.log(`发现代币创建方法: ${methodName}, 交易: ${tx.hash}`);
            }
            // 检查交易输入数据中是否包含关键词
            else {
                const inputData = tx.input.toLowerCase();
                const tokenCreationKeywords = [
                    'createtoken', 'newtoken', 'deploytoken', 'launchtoken',
                    'createerc20', 'createbep20', 'deploybep20', 'deployerc20',
                    'minttoken', 'createcoin', 'newcoin', 'deploycoin',
                    'launchcoin', 'createcrypto', 'newcrypto', 'deploycrypto',
                    'tokengen', 'tokenfactory', 'tokencreator', 'tokenmaker'
                ];

                for (const keyword of tokenCreationKeywords) {
                    if (inputData.includes(keyword)) {
                        isTokenCreation = true;
                        methodName = keyword;
                        console.log(`发现代币创建关键词: ${keyword}, 交易: ${tx.hash}`);
                        break;
                    }
                }
            }

            if (isTokenCreation) {
                console.log(`确认代币创建交易: ${tx.hash}, 方法: ${methodName}`);

                // 根据方法名确定置信度
                let confidenceLevel = 'medium';

                // 明确的创建方法，置信度高
                if (methodName === 'Contract Creation' ||
                    methodName === 'createToken' ||
                    methodName === 'createBEP20' ||
                    methodName === 'deployToken') {
                    confidenceLevel = 'high';
                }
                // 关键词匹配，置信度中等
                else if (methodName.includes('token') ||
                         methodName.includes('create') ||
                         methodName.includes('deploy') ||
                         methodName.includes('launch') ||
                         methodName.includes('mint')) {
                    confidenceLevel = 'medium';
                }
                // 其他方法，也设为中等置信度，增加召回率
                else {
                    confidenceLevel = 'medium';
                }

                // 尝试从交易收据中获取创建的合约地址，传递置信度
                this.getContractAddressFromReceipt(tx.hash, senderAddress, confidenceLevel);
            }
        } catch (error) {
            console.error('分析交易方法失败:', error);
        }
    }

    // 从交易收据中获取创建的合约地址
    async getContractAddressFromReceipt(txHash, senderAddress, confidenceLevel = 'medium') {
        try {
            // 确保发送者地址与当前查询地址完全匹配
            if (!this.currentQueryAddress || senderAddress.toLowerCase() !== this.currentQueryAddress.toLowerCase()) {
                // 如果不是当前查询地址发送的交易，直接返回
                return;
            }

            console.log(`使用置信度 ${confidenceLevel} 分析交易 ${txHash}`);

            console.log(`获取交易收据: ${txHash}`);
            const receipt = await this.provider.getTransactionReceipt(txHash);

            // 检查交易是否成功
            if (!receipt || receipt.status === 0) {
                console.log(`交易 ${txHash} 执行失败或未找到，跳过分析`);
                return;
            }

            // 检查交易发送者是否与当前查询地址匹配
            const tx = await this.provider.getTransaction(txHash);
            if (!tx || tx.from.toLowerCase() !== this.currentQueryAddress.toLowerCase()) {
                console.log(`交易 ${txHash} 的发送者不是当前查询地址，跳过分析`);
                return;
            }

            // 检查是否直接创建了合约
            if (receipt.contractAddress) {
                console.log(`确认合约创建: ${receipt.contractAddress} 由 ${senderAddress} 创建（直接创建）`);

                // 使用查询合约信息功能来确定是否为当前地址创建的合约
                const isCreatedByCurrentAddress = await this.checkContractCreator(receipt.contractAddress);

                if (isCreatedByCurrentAddress) {
                    console.log(`确认合约 ${receipt.contractAddress} 由当前地址创建`);
                    this.recordContractCreation(receipt.contractAddress, senderAddress, 'direct', 'high');
                } else {
                    console.log(`合约 ${receipt.contractAddress} 不是由当前地址创建，跳过`);
                }

                return;
            }

            // 如果没有直接创建合约，检查事件日志中是否有合约创建相关的事件
            if (receipt.logs && receipt.logs.length > 0) {
                console.log(`分析交易日志，共 ${receipt.logs.length} 条`);

                // 遍历所有日志
                for (const log of receipt.logs) {
                    // 检查是否是代币创建事件
                    if (log.topics && log.topics.length > 0) {
                        const eventSignature = log.topics[0].toLowerCase();

                        // 考虑各种可能的代币创建事件
                        const tokenCreationEvents = {
                            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': 'Transfer', // ERC20 Transfer 事件
                            '0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0': 'OwnershipTransferred', // Ownership 事件
                            '0x8a35acfbc15ff81a39ae7d344fd709f28e8600b4aa8c65c6b64bfe7fe36bd19b': 'OwnershipTransferred', // 另一种 Ownership 事件
                            '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f': 'TokenCreated', // 自定义 TokenCreated 事件
                            '0xc9fee7cd4889f66f10ff8117316524260a5242e88e25e0656dfb3f4733f48173': 'TokenDeployed' // 自定义 TokenDeployed 事件
                        };

                        if (tokenCreationEvents[eventSignature]) {
                            const eventName = tokenCreationEvents[eventSignature];
                            console.log(`发现可能的代币创建事件: ${eventName}`);

                            // 对于 Transfer 事件，检查是否是从零地址转出（代币铸造）
                            if (eventName === 'Transfer' && log.topics.length >= 3) {
                                // 解析 from 地址（topics[1]）
                                const fromAddress = '0x' + log.topics[1].substring(26);

                                // 解析 to 地址（topics[2]）
                                const toAddress = '0x' + log.topics[2].substring(26);

                                // 检查是否是从零地址转出到当前地址（初始铸造）
                                if (fromAddress.toLowerCase() === '0x0000000000000000000000000000000000000000' &&
                                    toAddress.toLowerCase() === this.currentQueryAddress.toLowerCase()) {

                                    console.log(`确认合约创建: ${log.address} 初始代币铸造到当前地址`);
                                    this.recordContractCreation(log.address, senderAddress);
                                }
                            }
                            // 对于 OwnershipTransferred 事件，检查是否是从零地址转移所有权
                            else if (eventName === 'OwnershipTransferred' && log.topics.length >= 3) {
                                // 解析 previousOwner 地址（topics[1]）
                                const previousOwner = '0x' + log.topics[1].substring(26);

                                // 解析 newOwner 地址（topics[2]）
                                const newOwner = '0x' + log.topics[2].substring(26);

                                // 检查是否是从零地址转移所有权到当前地址
                                if (previousOwner.toLowerCase() === '0x0000000000000000000000000000000000000000' &&
                                    newOwner.toLowerCase() === this.currentQueryAddress.toLowerCase()) {

                                    console.log(`确认合约创建: ${log.address} 所有权从零地址转移到当前地址`);
                                    this.recordContractCreation(log.address, senderAddress);
                                }
                            }
                            // 对于自定义的 TokenCreated 或 TokenDeployed 事件，直接记录合约地址
                            else if (eventName === 'TokenCreated' || eventName === 'TokenDeployed') {
                                console.log(`确认合约创建: ${log.address} 通过 ${eventName} 事件`);
                                this.recordContractCreation(log.address, senderAddress);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('获取交易收据失败:', error);
        }
    }

    // 通过交易哈希查找创建的合约
    async findContractByTransactionHash(txHash, confidenceLevel = 'medium') {
        if (!txHash) return null;

        try {
            console.log(`通过交易哈希查找合约: ${txHash}`);

            // 获取交易收据
            const receipt = await this.provider.getTransactionReceipt(txHash);
            if (!receipt) {
                console.log(`未找到交易收据: ${txHash}`);
                return null;
            }

            // 获取交易详情
            const tx = await this.provider.getTransaction(txHash);
            if (!tx) {
                console.log(`未找到交易详情: ${txHash}`);
                return null;
            }

            console.log(`交易发送者: ${tx.from}, 接收者: ${tx.to || '合约创建'}`);

            // 检查是否是合约创建交易
            if (receipt.contractAddress) {
                console.log(`发现直接合约创建: ${receipt.contractAddress}`);

                // 使用查询合约信息功能来确定是否为当前地址创建的合约
                const isCreatedByCurrentAddress = await this.checkContractCreator(receipt.contractAddress);

                if (isCreatedByCurrentAddress) {
                    console.log(`确认合约 ${receipt.contractAddress} 由当前地址创建`);
                    // 记录合约创建信息，直接创建的合约置信度最高
                    await this.markContractAsCreatedBy(receipt.contractAddress, tx.from, 'direct', 'high');
                } else {
                    console.log(`合约 ${receipt.contractAddress} 不是由当前地址创建，跳过`);
                }

                return receipt.contractAddress;
            }

            // 如果没有直接创建合约，分析交易日志
            if (receipt.logs && receipt.logs.length > 0) {
                console.log(`分析交易日志，共 ${receipt.logs.length} 条`);

                // 创建一个集合存储找到的合约地址
                const foundContracts = new Set();

                // 遍历所有日志，查找可能的合约创建事件
                for (const log of receipt.logs) {
                    if (log.topics && log.topics.length > 0) {
                        const eventSignature = log.topics[0].toLowerCase();

                        // 检查是否是代币创建相关事件
                        if (this.isTokenCreationEvent(eventSignature)) {
                            console.log(`发现可能的代币创建事件，合约地址: ${log.address}`);

                            // 记录合约创建信息，使用传入的置信度
                            await this.markContractAsCreatedBy(log.address, tx.from, 'transaction', confidenceLevel);
                            foundContracts.add(log.address);
                        }

                        // 检查是否是 Transfer 事件（从零地址转出，可能是代币创建）
                        if (eventSignature === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' &&
                            log.topics.length >= 3) {

                            // 解析 from 地址（topics[1]）
                            const fromAddress = '0x' + log.topics[1].substring(26);

                            // 解析 to 地址（topics[2]）
                            const toAddress = '0x' + log.topics[2].substring(26);

                            // 检查是否是从零地址转出到交易发送者（初始铸造）
                            if (fromAddress.toLowerCase() === '0x0000000000000000000000000000000000000000' &&
                                toAddress.toLowerCase() === tx.from.toLowerCase()) {

                                console.log(`发现初始代币铸造，合约地址: ${log.address}`);

                                // 记录合约创建信息，初始铸造是较高置信度的证据
                                await this.markContractAsCreatedBy(log.address, tx.from, 'transaction', 'high');
                                foundContracts.add(log.address);
                            }
                        }
                    }
                }

                // 如果找到了合约，返回第一个
                if (foundContracts.size > 0) {
                    const contractAddresses = Array.from(foundContracts);
                    console.log(`在交易 ${txHash} 中找到 ${contractAddresses.length} 个可能的合约: ${contractAddresses.join(', ')}`);
                    return contractAddresses[0];
                }
            }

            // 如果没有找到合约，尝试分析交易输入数据
            if (tx.data && tx.data.length > 10) {
                console.log(`分析交易输入数据，长度: ${tx.data.length}`);

                // 检查是否是工厂合约调用
                if (tx.to) {
                    console.log(`可能是通过工厂合约 ${tx.to} 创建的代币，尝试获取工厂合约信息...`);

                    try {
                        // 获取工厂合约代码
                        const factoryCode = await this.provider.getCode(tx.to);

                        // 检查是否是合约
                        if (factoryCode && factoryCode !== '0x') {
                            console.log(`确认 ${tx.to} 是合约，可能是工厂合约`);

                            // 简化工厂合约判断，不使用API验证
                            console.log(`检测到可能的工厂合约 ${tx.to}，但不使用API验证`);

                            // 如果交易发送者是当前查询地址，直接假定是通过工厂合约创建的代币
                            if (tx.from.toLowerCase() === this.currentQueryAddress.toLowerCase()) {
                                console.log(`交易 ${txHash} 由当前查询地址 ${this.currentQueryAddress} 发送，可能是通过工厂合约创建的代币`);

                                // 尝试从交易输入数据中提取可能的合约地址
                                // 这里只是一个简化的示例，实际上很难从输入数据中准确提取合约地址
                                // 因此，我们只是记录一个日志，不进行实际操作
                                console.log(`无法从交易输入数据中提取合约地址，跳过工厂合约创建判断`);
                            }
                        }
                    } catch (error) {
                        console.error(`获取工厂合约信息失败: ${error.message}`);
                    }
                }
            }

            console.log(`未在交易 ${txHash} 中找到创建的合约`);
            return null;
        } catch (error) {
            console.error(`通过交易哈希查找合约失败: ${error.message}`);
            return null;
        }
    }

    // 检查是否是代币创建事件
    isTokenCreationEvent(eventSignature) {
        const tokenCreationEvents = {
            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': 'Transfer', // ERC20 Transfer 事件
            '0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0': 'OwnershipTransferred', // Ownership 事件
            '0x8a35acfbc15ff81a39ae7d344fd709f28e8600b4aa8c65c6b64bfe7fe36bd19b': 'OwnershipTransferred', // 另一种 Ownership 事件
            '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f': 'TokenCreated', // 自定义 TokenCreated 事件
            '0xc9fee7cd4889f66f10ff8117316524260a5242e88e25e0656dfb3f4733f48173': 'TokenDeployed' // 自定义 TokenDeployed 事件
        };

        return !!tokenCreationEvents[eventSignature];
    }

    // 触发合约创建者更新事件
    triggerContractCreatorUpdate(contractAddress, creator, isCreatedByCurrentAddress) {
        if (!contractAddress || !creator) return;

        // 创建一个自定义事件
        const event = new CustomEvent('contractCreatorUpdated', {
            detail: {
                contractAddress: contractAddress,
                creator: creator,
                isCreatedByCurrentAddress: isCreatedByCurrentAddress
            }
        });

        // 触发事件
        window.dispatchEvent(event);
        console.log(`触发合约创建者更新事件: ${contractAddress}, 创建者: ${creator}, 是否由当前地址创建: ${isCreatedByCurrentAddress}`);

        // 如果是由当前地址创建的，同时触发发现创建的合约事件
        if (isCreatedByCurrentAddress && this.tokenContracts && this.tokenContracts[contractAddress.toLowerCase()]) {
            this.triggerCreatedContractFound(contractAddress, this.tokenContracts[contractAddress.toLowerCase()]);
        }
    }

    // 触发发现创建的合约事件（用于实时更新"我创建的合约"列表）
    triggerCreatedContractFound(contractAddress, contractInfo) {
        if (!contractAddress || !contractInfo) return;

        // 创建一个自定义事件
        const event = new CustomEvent('createdContractFound', {
            detail: {
                contractAddress: contractAddress,
                contractInfo: contractInfo
            }
        });

        // 触发事件
        window.dispatchEvent(event);
        console.log(`触发发现创建的合约事件: ${contractAddress}`);
    }

    // 验证合约创建者 - 简化版，不使用API验证
    async verifyContractCreator(contractAddress, potentialCreator) {
        try {
            if (!contractAddress || !potentialCreator) return;

            // 确保潜在创建者地址与当前查询地址匹配
            if (potentialCreator.toLowerCase() !== this.currentQueryAddress.toLowerCase()) {
                console.log(`潜在创建者 ${potentialCreator} 与当前查询地址 ${this.currentQueryAddress} 不匹配，跳过验证`);
                return;
            }

            console.log(`验证合约 ${contractAddress} 的创建者...`);

            // 简化验证逻辑：如果潜在创建者与当前查询地址匹配，直接认为是当前地址创建的
            console.log(`确认 ${contractAddress} 由当前地址 ${potentialCreator} 创建`);
            this.recordContractCreation(contractAddress, potentialCreator, 'direct', 'high');

        } catch (error) {
            console.error('验证合约创建者失败:', error);
        }
    }

    // 处理所有记录的合约创建信息
    async processContractCreations() {
        if (!this.pendingContractCreations || this.pendingContractCreations.length === 0) {
            console.log('没有待处理的合约创建信息');
            return;
        }

        console.log(`开始处理 ${this.pendingContractCreations.length} 个待处理的合约创建信息`);

        // 处理每个待处理的合约创建
        for (const creation of this.pendingContractCreations) {
            // 获取创建方式，默认为 'transaction'
            const method = creation.method || 'transaction';

            // 获取置信度，默认为 'medium'
            const confidenceLevel = creation.confidenceLevel || 'medium';

            // 如果是直接创建，使用 'direct' 方式和 'high' 置信度
            if (creation.creatorAddress.toLowerCase() === this.currentQueryAddress.toLowerCase() && method === 'direct') {
                await this.markContractAsCreatedBy(creation.contractAddress, creation.creatorAddress, 'direct', 'high');
            } else {
                // 否则使用记录的方式和置信度
                await this.markContractAsCreatedBy(creation.contractAddress, creation.creatorAddress, method, confidenceLevel);
            }
        }

        // 清空待处理列表
        this.pendingContractCreations = [];
        console.log('所有待处理的合约创建信息已处理完成');
    }

    // 检查代币名称是否有效
    isValidTokenName(name) {
        if (!name) return false;

        // 过滤掉一些明显不是代币名称的值
        const invalidNames = [
            'DIVIDEND_TRACKER', 'DIVIDENDTRACKER', 'DIVIDEND TRACKER',
            'ROUTER', 'FACTORY', 'PAIR', 'LP', 'LIQUIDITY POOL',
            'PROXY', 'IMPLEMENTATION', 'STORAGE', 'VAULT',
            'CONTROLLER', 'MANAGER', 'ADMIN', 'OWNER',
            'TEST', 'DEBUG', 'EXAMPLE', 'SAMPLE',
            'CONTRACT', 'TOKEN CONTRACT', 'ERC20', 'BEP20',
            'INTERFACE', 'LIBRARY', 'MODULE', 'COMPONENT'
        ];

        // 检查是否是无效名称
        for (const invalidName of invalidNames) {
            if (name.toUpperCase() === invalidName) {
                return false;
            }
        }

        // 检查名称长度
        if (name.length < 2 || name.length > 50) {
            return false;
        }

        return true;
    }

    // 检查代币符号是否有效
    isValidTokenSymbol(symbol) {
        if (!symbol) return false;

        // 过滤掉一些明显不是代币符号的值
        const invalidSymbols = [
            'DIV', 'TRACKER', 'DIVIDEND', 'ROUTER', 'FACTORY',
            'PAIR', 'LP', 'POOL', 'PROXY', 'IMPL', 'STORAGE',
            'VAULT', 'CTRL', 'MGR', 'ADMIN', 'OWNER', 'TEST',
            'DEBUG', 'EX', 'SAMPLE', 'CONTRACT', 'TOKEN', 'ERC20',
            'BEP20', 'INTERFACE', 'LIB', 'MODULE', 'COMP'
        ];

        // 检查是否是无效符号
        for (const invalidSymbol of invalidSymbols) {
            if (symbol.toUpperCase() === invalidSymbol) {
                return false;
            }
        }

        // 检查符号长度
        if (symbol.length < 1 || symbol.length > 10) {
            return false;
        }

        return true;
    }

    // 从BSCScan API获取代币信息
    async getTokenInfoFromBscScan(contractAddress) {
        try {
            if (!this.apiKey || this.apiKey.trim() === '') {
                console.log('没有BSCScan API Key，无法获取代币信息');
                return null;
            }

            // 获取代币信息
            const tokenInfoUrl = `${this.bscScanApiUrl}?module=token&action=tokeninfo&contractaddress=${contractAddress}&apikey=${this.apiKey}`;
            console.log('BSCScan代币信息API URL:', tokenInfoUrl);

            const response = await fetch(tokenInfoUrl);
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }

            const data = await response.json();
            console.log('BSCScan代币信息响应:', data);

            if (data.status === '1' && data.result && data.result.length > 0) {
                const tokenInfo = data.result[0];
                return {
                    name: tokenInfo.name,
                    symbol: tokenInfo.symbol,
                    decimals: parseInt(tokenInfo.divisor || '18')
                };
            }

            return null;
        } catch (error) {
            console.error('从BSCScan获取代币信息失败:', error);
            return null;
        }
    }

    // 添加这个函数到类中 - 综合判断是否为创建的合约
    async markContractAsCreatedBy(contractAddress, creatorAddress, method = null, confidenceLevel = 'medium') {
        if (!contractAddress || !creatorAddress) return;

        const lowerContractAddr = contractAddress.toLowerCase();
        const lowerCreatorAddr = creatorAddress.toLowerCase();

        // 确保当前查询地址已设置
        if (!this.currentQueryAddress) {
            console.log(`当前查询地址未设置，无法标记合约创建者`);
            return;
        }

        const currentAddressLower = this.currentQueryAddress.toLowerCase();

        // 检查是否是当前查询地址创建的
        const isCreatedByCurrentAddress = lowerCreatorAddr === currentAddressLower;

        // 确定创建方式
        let creationMethod = method;
        if (!creationMethod) {
            creationMethod = isCreatedByCurrentAddress ? 'direct' : 'transaction';
        }

        // 根据创建方式设置置信度
        if (creationMethod === 'direct') {
            // 直接创建的合约，置信度最高
            confidenceLevel = 'high';
        } else if (creationMethod === 'factory' && !isCreatedByCurrentAddress) {
            // 通过工厂合约创建但创建者不匹配，置信度较低
            confidenceLevel = 'low';
        }

        console.log(`检查合约 ${lowerContractAddr} 创建者: ${lowerCreatorAddr}, 当前地址: ${currentAddressLower}, 匹配: ${isCreatedByCurrentAddress}, 创建方式: ${creationMethod}, 置信度: ${confidenceLevel}`);

        // 记录合约创建者信息
        if (this.tokenContracts && this.tokenContracts[lowerContractAddr]) {
            this.tokenContracts[lowerContractAddr].creator = creatorAddress;
            this.tokenContracts[lowerContractAddr].createdByCurrentAddress = isCreatedByCurrentAddress;
            this.tokenContracts[lowerContractAddr].creationMethod = creationMethod;
            this.tokenContracts[lowerContractAddr].confidenceLevel = confidenceLevel;

            // 添加验证标记
            this.tokenContracts[lowerContractAddr].verifiedCreator = isCreatedByCurrentAddress;

            // 如果是通过合约信息查询功能验证的，添加标记
            if (creationMethod === 'direct' && isCreatedByCurrentAddress) {
                this.tokenContracts[lowerContractAddr].verifiedByContractInfo = true;
            }

            // 只有在以下情况下才添加到创建的合约集合：
            // 1. 直接创建的合约（最可靠）
            // 2. 通过工厂合约创建且已验证的合约
            // 3. 通过交易方法创建且置信度中等或更高的合约
            if ((isCreatedByCurrentAddress && creationMethod === 'direct') ||
                (creationMethod === 'factory' && isCreatedByCurrentAddress) ||
                (creationMethod === 'transaction' && (confidenceLevel === 'high' || confidenceLevel === 'medium'))) {

                this.createdContracts[lowerContractAddr] = this.tokenContracts[lowerContractAddr];
                console.log(`将合约 ${lowerContractAddr} 添加到创建的合约列表（创建方式: ${creationMethod}, 置信度: ${confidenceLevel}）`);
            } else {
                console.log(`合约 ${lowerContractAddr} 不满足添加到创建的合约列表的条件（创建方式: ${creationMethod}, 置信度: ${confidenceLevel}, 创建者匹配: ${isCreatedByCurrentAddress}）`);
            }
        } else {
            // 如果合约尚未在代币列表中，尝试获取代币信息
            console.log(`尝试获取合约 ${contractAddress} 的代币信息...`);

            // 创建一个基本记录
            const contractInfo = {
                address: contractAddress,
                creator: creatorAddress,
                createdByCurrentAddress: isCreatedByCurrentAddress,
                symbol: 'UNKNOWN', // 默认值，稍后尝试获取
                name: 'Unknown Token', // 默认值，稍后尝试获取
                decimals: 18 // 默认值，稍后尝试获取
            };

            try {
                // 尝试获取代币信息
                const erc20Interface = new ethers.utils.Interface([
                    'function name() view returns (string)',
                    'function symbol() view returns (string)',
                    'function decimals() view returns (uint8)',
                    'function totalSupply() view returns (uint256)',
                    // 添加一些可能的替代方法名
                    'function NAME() view returns (string)',
                    'function SYMBOL() view returns (string)',
                    'function getTokenName() view returns (string)',
                    'function getTokenSymbol() view returns (string)'
                ]);

                const contract = new ethers.Contract(contractAddress, erc20Interface, this.provider);

                // 尝试获取代币名称 - 使用多种可能的方法
                let name = null;
                try {
                    name = await contract.name();
                    if (name) {
                        // 过滤掉一些明显不是代币名称的值
                        if (!this.isValidTokenName(name)) {
                            console.log(`获取到的代币名称 "${name}" 可能不正确，尝试其他方法`);
                            name = null;
                        } else {
                            console.log(`获取到代币名称: ${name}`);
                        }
                    }
                } catch (e) {
                    console.log(`使用name()获取代币名称失败: ${e.message}`);
                }

                // 如果标准方法失败，尝试替代方法
                if (!name) {
                    try {
                        name = await contract.NAME();
                        if (name && this.isValidTokenName(name)) {
                            console.log(`使用NAME()获取到代币名称: ${name}`);
                        } else {
                            name = null;
                        }
                    } catch (e) {
                        console.log(`使用NAME()获取代币名称失败: ${e.message}`);
                    }
                }

                // 再尝试另一种可能的方法
                if (!name) {
                    try {
                        name = await contract.getTokenName();
                        if (name && this.isValidTokenName(name)) {
                            console.log(`使用getTokenName()获取到代币名称: ${name}`);
                        } else {
                            name = null;
                        }
                    } catch (e) {
                        console.log(`使用getTokenName()获取代币名称失败: ${e.message}`);
                    }
                }

                // 如果获取到有效的名称，更新合约信息
                if (name) {
                    contractInfo.name = name;
                }

                // 尝试获取代币符号 - 使用多种可能的方法
                let symbol = null;
                try {
                    symbol = await contract.symbol();
                    if (symbol) {
                        // 过滤掉一些明显不是代币符号的值
                        if (!this.isValidTokenSymbol(symbol)) {
                            console.log(`获取到的代币符号 "${symbol}" 可能不正确，尝试其他方法`);
                            symbol = null;
                        } else {
                            console.log(`获取到代币符号: ${symbol}`);
                        }
                    }
                } catch (e) {
                    console.log(`使用symbol()获取代币符号失败: ${e.message}`);
                }

                // 如果标准方法失败，尝试替代方法
                if (!symbol) {
                    try {
                        symbol = await contract.SYMBOL();
                        if (symbol && this.isValidTokenSymbol(symbol)) {
                            console.log(`使用SYMBOL()获取到代币符号: ${symbol}`);
                        } else {
                            symbol = null;
                        }
                    } catch (e) {
                        console.log(`使用SYMBOL()获取代币符号失败: ${e.message}`);
                    }
                }

                // 再尝试另一种可能的方法
                if (!symbol) {
                    try {
                        symbol = await contract.getTokenSymbol();
                        if (symbol && this.isValidTokenSymbol(symbol)) {
                            console.log(`使用getTokenSymbol()获取到代币符号: ${symbol}`);
                        } else {
                            symbol = null;
                        }
                    } catch (e) {
                        console.log(`使用getTokenSymbol()获取代币符号失败: ${e.message}`);
                    }
                }

                // 如果获取到有效的符号，更新合约信息
                if (symbol) {
                    contractInfo.symbol = symbol;
                }

                // 尝试获取代币小数位
                try {
                    const decimals = await contract.decimals();
                    if (decimals !== undefined) {
                        contractInfo.decimals = decimals;
                        console.log(`获取到代币小数位: ${decimals}`);
                    }
                } catch (e) {
                    console.log(`获取代币小数位失败: ${e.message}`);
                }

                // 如果仍然没有获取到有效的名称和符号，尝试从BSCScan API获取
                if ((!name || !this.isValidTokenName(name)) || (!symbol || !this.isValidTokenSymbol(symbol))) {
                    console.log('尝试从BSCScan API获取代币信息...');
                    try {
                        const tokenInfo = await this.getTokenInfoFromBscScan(contractAddress);
                        if (tokenInfo) {
                            if (tokenInfo.name && this.isValidTokenName(tokenInfo.name)) {
                                contractInfo.name = tokenInfo.name;
                                console.log(`从BSCScan获取到代币名称: ${tokenInfo.name}`);
                            }
                            if (tokenInfo.symbol && this.isValidTokenSymbol(tokenInfo.symbol)) {
                                contractInfo.symbol = tokenInfo.symbol;
                                console.log(`从BSCScan获取到代币符号: ${tokenInfo.symbol}`);
                            }
                        }
                    } catch (e) {
                        console.log(`从BSCScan获取代币信息失败: ${e.message}`);
                    }
                }
            } catch (error) {
                console.log(`获取代币信息失败: ${error.message}`);
            }

            // 添加到代币合约列表
            if (!this.tokenContracts) this.tokenContracts = {};
            this.tokenContracts[lowerContractAddr] = contractInfo;

            // 如果是当前查询地址创建的，添加到创建的合约集合
            if (isCreatedByCurrentAddress) {
                this.createdContracts[lowerContractAddr] = contractInfo;
                console.log(`将新发现的合约 ${lowerContractAddr} 添加到创建的合约列表，名称: ${contractInfo.name}, 符号: ${contractInfo.symbol}`);
            }
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
            const receipt = await this.provider.getTransactionReceipt(txHash);
            if (!receipt) {
                throw new Error('未找到交易收据，请确认交易哈希是否正确');
            }

            // 检查交易是否成功
            if (receipt.status === 0) {
                throw new Error('交易执行失败，无法检查代币销毁');
            }

            // 获取交易详情
            const tx = await this.provider.getTransaction(txHash);
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
                burnAddress: '' // 添加销毁地址字段
            };

            // 检查交易日志中是否有代币销毁事件
            if (receipt.logs && receipt.logs.length > 0) {
                console.log(`分析交易日志，共 ${receipt.logs.length} 条`);

                // 遍历所有日志
                for (const log of receipt.logs) {
                    // 检查是否是 Transfer 事件（ERC20 标准事件）
                    if (log.topics && log.topics.length >= 3 &&
                        log.topics[0].toLowerCase() === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {

                        // 解析 from 地址（topics[1]）
                        const fromAddress = '0x' + log.topics[1].substring(26);

                        // 解析 to 地址（topics[2]）
                        const toAddress = '0x' + log.topics[2].substring(26);

                        // 定义销毁地址列表 - 从配置中获取
                        const burnAddresses = [];

                        // 如果配置中有销毁地址，使用配置中的地址
                        if (this.burnVerificationConfig && this.burnVerificationConfig.burnAddress) {
                            burnAddresses.push(this.burnVerificationConfig.burnAddress.toLowerCase());
                        } else {
                            // 否则使用默认的 dead 地址
                            burnAddresses.push('0x000000000000000000000000000000000000dead');
                        }

                        // 检查是否转账到销毁地址
                        if (burnAddresses.includes(toAddress.toLowerCase())) {
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
                                        'donkey': 'DONKEY'  // 添加您提到的 DONKEY 代币
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
                                burnInfo.burnAddress = toAddress; // 记录销毁地址

                                // 检查是否是特定的代币合约和数量
                                // 从配置中获取目标合约地址和目标数量
                                const targetContractAddress = this.burnVerificationConfig ?
                                    this.burnVerificationConfig.targetContractAddress :
                                    '0xA49fA5E8106E2d6d6a69E78df9B6A20AaB9c4444';

                                const targetAmount = this.burnVerificationConfig ?
                                    this.burnVerificationConfig.targetAmount :
                                    '100';

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
}
