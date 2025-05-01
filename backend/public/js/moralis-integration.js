// Moralis API集成

// 获取代币交易记录
async function getTokenTransactions(address) {
    if (!address) return [];

    try {
        // 设置当前查询地址
        this.currentQueryAddress = address;

        // 清空之前的查询结果
        this.tokenTransactions = [];
        this.tokenContracts = {};
        this.createdContracts = {};

        // 根据配置决定使用哪个API
        if (this.useMoralis && this.moralisApiKey) {
            return await this.getTokenTransactionsFromMoralis(address);
        } else {
            return await this.getTokenTransactionsFromBscScan(address);
        }
    } catch (error) {
        console.error('获取代币交易记录失败:', error);
        throw error;
    }
}

// 从Moralis API获取代币交易记录
async function getTokenTransactionsFromMoralis(address) {
    console.log('使用Moralis API获取代币交易记录...');
    
    try {
        // 获取代币交易记录
        const url = `${this.moralisApiUrl}/${address}/erc20/transfers?chain=bsc&limit=5000`;
        console.log('Moralis API URL:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-API-Key': this.moralisApiKey
            }
        });
        
        if (!response.ok) {
            console.error(`Moralis API返回错误: ${response.status}`);
            console.log('尝试使用BSCScan API作为备选...');
            return await this.getTokenTransactionsFromBscScan(address);
        }

        const data = await response.json();
        console.log('Moralis代币交易记录响应:', data);

        if (data.result && data.result.length > 0) {
            // 处理交易记录
            this.tokenTransactions = data.result.map(tx => {
                // 添加交易类型（转入/转出）
                let type = 'unknown';
                if (tx.from_address.toLowerCase() === address.toLowerCase()) {
                    type = 'out';
                } else if (tx.to_address.toLowerCase() === address.toLowerCase()) {
                    type = 'in';
                }

                // 添加代币合约信息
                const contractAddress = tx.address.toLowerCase();
                if (!this.tokenContracts[contractAddress]) {
                    this.tokenContracts[contractAddress] = {
                        address: contractAddress,
                        name: tx.token_name || 'Unknown Token',
                        symbol: tx.token_symbol || 'UNKNOWN',
                        decimals: parseInt(tx.token_decimals || '18')
                    };
                }

                // 转换为与BSCScan API相同的格式
                return {
                    hash: tx.transaction_hash,
                    timeStamp: tx.block_timestamp ? Math.floor(new Date(tx.block_timestamp).getTime() / 1000).toString() : '',
                    from: tx.from_address,
                    to: tx.to_address,
                    value: tx.value,
                    tokenName: tx.token_name,
                    tokenSymbol: tx.token_symbol,
                    tokenDecimal: tx.token_decimals,
                    contractAddress: contractAddress,
                    blockNumber: tx.block_number,
                    type,
                    // 添加原始Moralis数据，以便需要时使用
                    moralisData: tx
                };
            });

            console.log(`从Moralis获取到 ${this.tokenTransactions.length} 条代币交易记录`);
            return this.tokenTransactions;
        } else {
            console.log('Moralis未找到代币交易记录');
            return [];
        }
    } catch (error) {
        console.error('从Moralis获取代币交易记录失败:', error);
        console.log('尝试使用BSCScan API作为备选...');
        return await this.getTokenTransactionsFromBscScan(address);
    }
}

// 从BSCScan API获取代币交易记录
async function getTokenTransactionsFromBscScan(address) {
    console.log('使用BSCScan API获取代币交易记录...');
    
    try {
        // 获取代币交易记录
        const url = `${this.bscScanApiUrl}?module=account&action=tokentx&address=${address}&startblock=0&endblock=999999999&sort=desc&apikey=${this.apiKey}`;
        console.log('BSCScan API URL:', url);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }

        const data = await response.json();
        console.log('BSCScan代币交易记录响应:', data);

        if (data.status === '1' && data.result && data.result.length > 0) {
            // 处理交易记录
            this.tokenTransactions = data.result.map(tx => {
                // 添加交易类型（转入/转出）
                let type = 'unknown';
                if (tx.from.toLowerCase() === address.toLowerCase()) {
                    type = 'out';
                } else if (tx.to.toLowerCase() === address.toLowerCase()) {
                    type = 'in';
                }

                // 添加代币合约信息
                const contractAddress = tx.contractAddress.toLowerCase();
                if (!this.tokenContracts[contractAddress]) {
                    this.tokenContracts[contractAddress] = {
                        address: contractAddress,
                        name: tx.tokenName || 'Unknown Token',
                        symbol: tx.tokenSymbol || 'UNKNOWN',
                        decimals: parseInt(tx.tokenDecimal || '18')
                    };
                }

                // 返回处理后的交易记录
                return {
                    ...tx,
                    type,
                    contractAddress: contractAddress
                };
            });

            console.log(`从BSCScan获取到 ${this.tokenTransactions.length} 条代币交易记录`);
            return this.tokenTransactions;
        } else {
            console.log('BSCScan未找到代币交易记录或API返回错误');
            return [];
        }
    } catch (error) {
        console.error('从BSCScan获取代币交易记录失败:', error);
        throw error;
    }
}

// 将方法添加到BscService原型
if (typeof BscService !== 'undefined') {
    BscService.prototype.getTokenTransactions = getTokenTransactions;
    BscService.prototype.getTokenTransactionsFromMoralis = getTokenTransactionsFromMoralis;
    BscService.prototype.getTokenTransactionsFromBscScan = getTokenTransactionsFromBscScan;
    
    console.log('Moralis API集成已加载');
}
