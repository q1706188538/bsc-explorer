// 主应用程序JavaScript

console.log('页面加载中...');

// 添加全局错误处理
window.onerror = function(message, source, lineno, colno, err) {
    console.error('全局JS错误:', message, 'at', source, lineno, colno);
    if (err) {
        console.error('错误详情:', err.stack || err);
    }
    return false;
};

// 检查全局对象
console.log('Window对象:', Object.keys(window).filter(key => key.includes('eth')));

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM内容已加载，初始化应用...');

    // 尝试检测ethers对象
    console.log('检查全局ethers对象...');
    console.log('window.ethers存在?', window.ethers !== undefined);

    // 检查ethers是否正确加载
    if (typeof ethers === 'undefined') {
        console.error('ethers库未正确加载');

        // 尝试手动加载ethers (从本地加载)
        const script = document.createElement('script');
        script.src = '/ethers.min.js'; // 从本地加载
        script.type = 'text/javascript';
        script.onload = function() {
            console.log('手动加载ethers成功，版本:', window.ethers ? window.ethers.version : '未知');
            initApp();
        };
        script.onerror = function() {
            console.error('手动加载ethers失败');
            alert('ethers库加载失败，请检查服务器是否包含ethers.min.js文件');
        };
        document.head.appendChild(script);
        return;
    }

    console.log('ethers库已加载，版本:', ethers.version);
    initApp();
});

// 将应用初始化逻辑移到单独的函数中
function initApp() {
    console.log('开始初始化应用...');

    try {
        // 使用API服务
        console.log('使用ApiService...');
        const bscService = apiService; // 使用apiService替代bscService

        // 加载配置
        loadConfig();

        // 获取DOM元素
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        const addressInput = document.getElementById('address');
        const searchTxBtn = document.getElementById('searchTx');
        const txLoading = document.getElementById('txLoading');
        const txResults = document.getElementById('txResults');
        const txTableBody = document.getElementById('txTableBody');

        // 代币合约提示元素（转账记录页面）
        const contractHint = document.getElementById('contractHint');

        // 币种筛选元素
        let tokenFilterBtns = document.querySelectorAll('.token-filter-btn'); // 使用 let 而不是 const，因为需要更新
        const tokenFilterDropdown = document.getElementById('tokenFilterDropdown');
        const customTokenInput = document.getElementById('customTokenInput');
        const applyCustomTokenBtn = document.getElementById('applyCustomToken');

        // 合约列表页面元素
        const tokenListEmpty = document.getElementById('tokenListEmpty');
        const tokenListGrid = document.getElementById('tokenListGrid');
        const clearTokenListBtn = document.getElementById('clearTokenList');
        const tokenSearchInput = document.getElementById('tokenSearchInput');
        const tokenSearchBtn = document.getElementById('tokenSearchBtn');
        const contractTypeBtns = document.querySelectorAll('.contract-type-btn');

        // 当前合约类型
        let currentContractType = 'all'; // 'all', 'created' 或 'filtered'

        // 存储当前筛选交易中包含的合约
        let filteredTransactionContracts = {};

        // 分页元素
        const txPagination = document.getElementById('txPagination');

        // 当前查询的地址、交易类型和币种
        let currentAddress = '';
        let currentTxType = 'all'; // 'all', 'in', 'out'
        let selectedTokens = []; // 存储多个选中的币种
        const pageSize = 5000; // 增加到5000条，接近BSCScan API的最大限制

        // 设置默认页面大小和页码
        window.currentPageSize = 10;
        window.currentPageNum = 1;

        // 存储交易中出现的所有代币符号
        let tokenSymbols = new Set();

        const contractAddressInput = document.getElementById('contractAddress');
        const searchContractBtn = document.getElementById('searchContract');
        const contractLoading = document.getElementById('contractLoading');
        const contractResults = document.getElementById('contractResults');
        const contractInfo = document.getElementById('contractInfo');

        // 标签切换功能
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');

                // 更新活动标签按钮
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 更新活动内容区域
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === tabId) {
                        content.classList.add('active');
                    }
                });
            });
        });

        // 显示交易记录函数
        function displayTransactions(result) {
            // 清空表格
            txTableBody.innerHTML = '';

            // 获取交易记录
            const { transactions } = result;

            // 收集所有代币符号
            tokenSymbols.clear(); // 清空之前的代币符号
            tokenSymbols.add('BNB'); // 默认添加BNB

            transactions.forEach(tx => {
                // 从交易值中提取代币符号
                const valueMatch = tx.value.match(/([0-9.]+)\s+([A-Za-z0-9]+)$/);
                if (valueMatch && valueMatch[2]) {
                    tokenSymbols.add(valueMatch[2]);
                }
            });

            // 更新代币筛选下拉菜单
            updateTokenFilterDropdown();

            // 过滤交易记录 - 先按交易类型
            let filteredTransactions = transactions;
            if (currentTxType !== 'all') {
                filteredTransactions = transactions.filter(tx => tx.direction === currentTxType);
            }

            // 再按币种筛选（支持多选）
            if (selectedTokens.length > 0) {
                filteredTransactions = filteredTransactions.filter(tx => {
                    const valueMatch = tx.value.match(/([0-9.]+)\s+([A-Za-z0-9]+)$/);
                    return valueMatch && selectedTokens.includes(valueMatch[2]);
                });
            }

            // 保存当前交易记录到全局变量，供分页功能使用
            window.currentTransactions = filteredTransactions;
            window.selectedTokens = selectedTokens;
            window.currentPageNum = 1;

            // 获取页面大小
            const pageSizeSelector = document.getElementById('pageSizeSelector');
            window.currentPageSize = pageSizeSelector ? parseInt(pageSizeSelector.value) || 10 : 10;

            // 确保分页按钮事件处理函数已初始化
            if (typeof initPaginationHandlers === 'function') {
                initPaginationHandlers();
            }

            // 使用分页功能显示交易记录
            // 确保所有必要的 DOM 元素都已经加载
            setTimeout(() => {
                if (typeof window.displayPaginatedTransactions === 'function') {
                    try {
                        console.log('调用 displayPaginatedTransactions 函数');
                        window.displayPaginatedTransactions();
                    } catch (error) {
                        console.error('调用 displayPaginatedTransactions 函数失败:', error);
                    }
                } else {
                    console.error('displayPaginatedTransactions 函数不可用');
                }
            }, 500); // 增加延迟时间，确保 DOM 元素已经加载

            // 清空当前筛选交易中包含的合约
            filteredTransactionContracts = {};

            // 收集筛选后的交易中包含的合约
            filteredTransactions.forEach(tx => {
                // 检查发送方是否是合约地址
                if (tx.from && tx.from.startsWith('0x')) {
                    // 只有在以下情况下才将发送方视为合约：
                    // 1. 已知是代币合约
                    // 2. 是代币交易中的合约地址
                    // 3. 交易中有明确标识这是合约（如methodId、functionName等）
                    const isKnownTokenContract = bscService.isTokenContract(tx.from);
                    const isTokenTxContract = tx.type === 'Token' && tx.contractAddress && tx.contractAddress.toLowerCase() === tx.from.toLowerCase();
                    const hasContractIndicators = tx.methodId || tx.functionName || (tx.input && tx.input.length > 10);

                    if (isKnownTokenContract) {
                        // 如果是已知的代币合约，添加到筛选结果中
                        const contractInfo = bscService.getTokenContractInfo(tx.from);
                        if (contractInfo) {
                            filteredTransactionContracts[tx.from.toLowerCase()] = contractInfo;
                        }
                    } else if (isTokenTxContract || hasContractIndicators) {
                        // 如果是代币交易中的合约地址或有合约调用指标，添加为未知合约
                        //console.log(`将地址 ${tx.from} 识别为可能的合约（发送方）`);

                        filteredTransactionContracts[tx.from.toLowerCase()] = {
                            address: tx.from,
                            name: 'Unknown Contract',
                            symbol: 'UNKNOWN',
                            creator: 'Unknown',
                            createdByCurrentAddress: false,
                            relatedTransactions: [{
                                hash: tx.hash,
                                from: tx.from,
                                to: tx.to,
                                value: tx.value,
                                timeStamp: tx.timeStamp
                            }]
                        };

                        // 添加到代币合约列表，以便后续查询
                        bscService.tokenContracts[tx.from.toLowerCase()] = filteredTransactionContracts[tx.from.toLowerCase()];
                    }
                }

                // 检查接收方是否是合约地址
                if (tx.to && tx.to.startsWith('0x')) {
                    // 只有在以下情况下才将接收方视为合约：
                    // 1. 已知是代币合约
                    // 2. 是代币交易中的合约地址
                    // 3. 交易中有明确标识这是合约调用（如methodId、functionName等）
                    const isKnownTokenContract = bscService.isTokenContract(tx.to);
                    const isTokenTxContract = tx.type === 'Token' && tx.contractAddress && tx.contractAddress.toLowerCase() === tx.to.toLowerCase();
                    const hasContractIndicators = tx.methodId || tx.functionName || (tx.input && tx.input.length > 10);

                    if (isKnownTokenContract) {
                        // 如果是已知的代币合约，添加到筛选结果中
                        const contractInfo = bscService.getTokenContractInfo(tx.to);
                        if (contractInfo) {
                            filteredTransactionContracts[tx.to.toLowerCase()] = contractInfo;
                        }
                    } else if (isTokenTxContract || hasContractIndicators) {
                        // 如果是代币交易中的合约地址或有合约调用指标，添加为未知合约
                        //console.log(`将地址 ${tx.to} 识别为可能的合约（接收方）`);

                        filteredTransactionContracts[tx.to.toLowerCase()] = {
                            address: tx.to,
                            name: 'Unknown Contract',
                            symbol: 'UNKNOWN',
                            creator: 'Unknown',
                            createdByCurrentAddress: false,
                            relatedTransactions: [{
                                hash: tx.hash,
                                from: tx.from,
                                to: tx.to,
                                value: tx.value,
                                timeStamp: tx.timeStamp
                            }]
                        };

                        // 添加到代币合约列表，以便后续查询
                        bscService.tokenContracts[tx.to.toLowerCase()] = filteredTransactionContracts[tx.to.toLowerCase()];
                    }
                }

                // 如果是代币交易，也添加代币合约
                if (tx.type === 'Token' && tx.contractAddress) {
                    if (!bscService.isTokenContract(tx.contractAddress)) {
                        // 如果不是已知的代币合约，添加为未知合约
                        // 使用交易中的代币名称和符号（如果有）
                        let tokenName = tx.tokenName || '';
                        let tokenSymbol = tx.tokenSymbol || '';

                        // 如果仍然没有有效的名称和符号，使用标准的未知值
                        if (!tokenName) {
                            tokenName = 'Unknown Token';
                        }

                        if (!tokenSymbol) {
                            tokenSymbol = 'UNKNOWN';
                        }

                        //console.log(`添加代币合约: ${tx.contractAddress}, 名称: ${tokenName}, 符号: ${tokenSymbol}`);

                        filteredTransactionContracts[tx.contractAddress.toLowerCase()] = {
                            address: tx.contractAddress,
                            name: tokenName,
                            symbol: tokenSymbol,
                            creator: 'Unknown',
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

                        // 添加到代币合约列表，以便后续查询
                        bscService.tokenContracts[tx.contractAddress.toLowerCase()] = filteredTransactionContracts[tx.contractAddress.toLowerCase()];
                    } else {
                        // 如果是已知的代币合约，添加到筛选结果中
                        const contractInfo = bscService.getTokenContractInfo(tx.contractAddress);
                        if (contractInfo) {
                            filteredTransactionContracts[tx.contractAddress.toLowerCase()] = contractInfo;
                        }
                    }
                }
            });

            // 打印当前的代币合约列表，用于调试
            //console.log(`当前有 ${Object.keys(bscService.tokenContracts).length} 个代币合约`);
            //console.log(`当前筛选的交易中包含 ${Object.keys(filteredTransactionContracts).length} 个合约`);

            // 更新所有代币合约的名称和符号
            if (typeof bscService.updateAllTokenContractNames === 'function') {
                bscService.updateAllTokenContractNames();
            }

            // 如果没有交易记录
            if (!filteredTransactions || filteredTransactions.length === 0) {
                txTableBody.innerHTML = `<tr><td colspan="7">没有找到${currentTxType === 'in' ? '转入' : currentTxType === 'out' ? '转出' : ''}交易记录</td></tr>`;
                txPagination.style.display = 'none';

                // 保存空数组到全局变量，确保分页功能能正确处理
                window.currentTransactions = [];

                // 使用分页功能显示交易记录（会处理空数据情况）
                if (typeof window.displayPaginatedTransactions === 'function') {
                    window.displayPaginatedTransactions();
                }

                return;
            }

            // 不再直接显示交易记录，而是通过分页功能显示
            // 所有交易记录已保存到 window.currentTransactions 中
            // displayPaginatedTransactions 函数将负责显示当前页的交易记录

            // 不再直接更新分页信息，而是通过 displayPaginatedTransactions 函数更新
            // 所有分页信息的更新都由 displayPaginatedTransactions 函数负责

            // 确保分页功能正常工作
            console.log(`交易记录总数: ${filteredTransactions.length}, 每页显示: ${window.currentPageSize}, 当前页: ${window.currentPageNum}`);

            // 显示币种筛选提示
            updateFilterIndicator();

            // 如果当前在"交易相关合约"标签页，更新合约列表
            if (currentContractType === 'filtered') {
                updateTokenListPage();
            }
        }

        // 加载特定页面的交易记录
        async function loadTransactionsPage(address, page) {
            try {
                // 显示加载中
                txLoading.style.display = 'block';
                txResults.style.display = 'none';
                txPagination.style.display = 'none';

                let result;

                // 尝试从缓存获取
                if (page > 1) {
                    result = bscService.getCachedTransactions(address, page, pageSize);
                }

                // 如果缓存中没有，则重新获取
                if (!result) {
                    result = await bscService.getTransactions(address, page, pageSize);

                    // 输出返回信息，检查是否包含代币名称和合约信息
                    console.log('===== 交易记录返回信息 =====');
                    if (result && result.transactions && result.transactions.length > 0) {
                        // 只输出前5条记录，避免日志过多
                        const sampleTransactions = result.transactions.slice(0, 5);
                        console.log(`共获取到 ${result.transactions.length} 条交易记录，显示前 5 条：`);

                        sampleTransactions.forEach((tx, index) => {
                            console.log(`--- 交易 ${index + 1} ---`);
                            // 输出交易的所有属性和值
                            console.log('交易完整信息:');
                            for (const [key, value] of Object.entries(tx)) {
                                console.log(`${key}: ${value}`);
                            }
                            console.log('-------------------');
                        });
                    } else {
                        console.log('未获取到交易记录或返回数据格式不正确');
                    }
                    console.log('===========================');
                }

                // 隐藏加载中
                txLoading.style.display = 'none';

                // 如果没有交易记录
                if (result.transactions.length === 0 && page === 1) {
                    txTableBody.innerHTML = '<tr><td colspan="6">没有找到交易记录</td></tr>';

                    // 检查是否是因为没有API Key
                    if (bscService.useAlternativeMethod) {
                        // 添加API Key提示
                        const noApiKeyMsg = document.createElement('div');
                        noApiKeyMsg.className = 'notice';
                        noApiKeyMsg.style.marginTop = '15px';
                        noApiKeyMsg.style.padding = '10px';
                        noApiKeyMsg.style.backgroundColor = '#fff3cd';
                        noApiKeyMsg.style.border = '1px solid #ffeeba';
                        noApiKeyMsg.style.borderRadius = '4px';
                        noApiKeyMsg.style.color = '#856404';

                        noApiKeyMsg.innerHTML = `
                            <p><strong>提示:</strong> 当前使用的是替代方案，只能查询最近的交易记录。</p>
                            <p>要获取完整的交易历史，请在BSCScan申请API Key并添加到应用中。</p>
                            <p>申请步骤:</p>
                            <ol>
                                <li>访问 <a href="https://bscscan.com/register" target="_blank">BSCScan注册页面</a></li>
                                <li>创建账户并登录</li>
                                <li>进入 "API-KEYs" 页面</li>
                                <li>点击 "Create New API Key"</li>
                                <li>获取API Key后，将其添加到bscService.js文件中</li>
                            </ol>
                        `;

                        txResults.appendChild(noApiKeyMsg);
                    }

                    txResults.style.display = 'block';
                    return;
                }

                // 显示交易记录
                displayTransactions(result);
                txResults.style.display = 'block';

                // 显示代币合约提示（如果有代币合约）
                showContractHint();

                // 显示合约创建者查询提示
                showContractCreatorsQueryHint();

                // 更新合约列表页面，但不自动查询合约创建者信息
                updateTokenListPage(null, false);

                // 注释掉自动开始查询合约创建者信息的功能
                // startContractCreatorsQuery();

                // 添加合约查看按钮事件
                document.querySelectorAll('.view-contract-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        const contractAddress = btn.getAttribute('data-address');
                        if (contractAddress) {
                            // 切换到合约信息标签页
                            tabBtns.forEach(tabBtn => {
                                if (tabBtn.getAttribute('data-tab') === 'contracts') {
                                    tabBtn.click();
                                }
                            });

                            // 填充合约地址并触发查询
                            contractAddressInput.value = contractAddress;
                            searchContractBtn.click();
                        }
                    });
                });

                // 添加代币合约列表中的查看按钮事件
                document.querySelectorAll('.view-token-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const contractAddress = btn.getAttribute('data-address');
                        if (contractAddress) {
                            // 切换到合约信息标签页
                            tabBtns.forEach(tabBtn => {
                                if (tabBtn.getAttribute('data-tab') === 'contracts') {
                                    tabBtn.click();
                                }
                            });

                            // 填充合约地址并触发查询
                            contractAddressInput.value = contractAddress;
                            searchContractBtn.click();
                        }
                    });
                });
            } catch (error) {
                txLoading.style.display = 'none';
                alert('获取交易记录失败: ' + error.message);
            }
        }

        // 更新代币筛选下拉菜单
        function updateTokenFilterDropdown() {
            try {
                // 清空下拉菜单
                tokenFilterDropdown.innerHTML = '';

            // 排除已有的按钮（BNB和全部）
            const excludedTokens = ['BNB', 'all'];

            // 将代币符号转换为数组并排序
            const sortedTokens = Array.from(tokenSymbols)
                .filter(token => !excludedTokens.includes(token))
                .sort();

            // 如果没有其他代币，添加提示
            if (sortedTokens.length === 0) {
                const emptyItem = document.createElement('div');
                emptyItem.className = 'token-filter-item';
                emptyItem.textContent = '暂无其他币种';
                emptyItem.style.color = '#999';
                emptyItem.style.fontStyle = 'italic';
                emptyItem.style.cursor = 'default';
                tokenFilterDropdown.appendChild(emptyItem);
                return;
            }

            // 添加代币到下拉菜单
            sortedTokens.forEach(token => {
                const item = document.createElement('div');
                item.className = 'token-filter-item';
                item.textContent = token;
                item.setAttribute('data-token', token);

                // 使用click事件，确保事件能够正确触发
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    console.log('点击了币种:', token); // 调试日志

                    // 关闭下拉菜单
                    tokenFilterDropdown.classList.remove('show');

                    // 应用筛选
                    applyTokenFilter(token);
                });

                tokenFilterDropdown.appendChild(item);
            });

            // 添加"全部币种"选项
            const allItem = document.createElement('div');
            allItem.className = 'token-filter-item';
            allItem.textContent = '显示全部币种';
            allItem.style.borderTop = '1px solid #dee2e6';
            allItem.style.fontWeight = 'bold';

            // 使用click事件，确保事件能够正确触发
            allItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                console.log('点击了显示全部币种'); // 调试日志

                // 关闭下拉菜单
                tokenFilterDropdown.classList.remove('show');

                // 应用筛选
                applyTokenFilter('all');
            });

            tokenFilterDropdown.appendChild(allItem);
            } catch (error) {
                console.error('更新代币筛选下拉菜单失败:', error);
                // 确保下拉菜单被隐藏
                tokenFilterDropdown.classList.remove('show');
            }
        }

        // 更新筛选提示
        function updateFilterIndicator() {
            // 移除现有的筛选提示
            const tokenFilterActive = document.querySelector('.token-filter-active');
            if (tokenFilterActive) {
                tokenFilterActive.remove();
            }

            // 如果有筛选条件，显示筛选提示
            if (selectedTokens.length > 0) {
                const filterInfo = document.createElement('div');
                filterInfo.className = 'token-filter-active';

                // 显示多个选中的币种
                let filterText = '';
                if (selectedTokens.length === 1) {
                    filterText = `当前筛选: ${selectedTokens[0]}`;
                } else {
                    filterText = `当前筛选: ${selectedTokens.join(', ')}`;
                }

                filterInfo.innerHTML = `
                    <div class="filter-text">${filterText}</div>
                    <button class="clear-filter-btn">清除筛选</button>
                `;

                // 添加清除筛选按钮事件
                const clearBtn = filterInfo.querySelector('.clear-filter-btn');
                clearBtn.addEventListener('click', () => {
                    clearAllTokenFilters();
                });

                // 插入到交易记录表格之前（首部）
                const txTable = document.querySelector('table');
                if (txTable) {
                    txTable.parentNode.insertBefore(filterInfo, txTable);
                }
            }
        }

        // 清除所有币种筛选
        function clearAllTokenFilters() {
            // 清空选中的币种
            selectedTokens = [];

            // 移除所有按钮的活动状态
            document.querySelectorAll('.token-filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            // 更新"全部"按钮的状态
            const allBtn = Array.from(document.querySelectorAll('.token-filter-btn')).find(btn =>
                btn.getAttribute('data-token') === 'all'
            );
            if (allBtn) {
                allBtn.classList.add('active');
            }

            // 更新筛选提示
            updateFilterIndicator();

            // 重新显示交易记录
            const cachedResult = bscService.getCachedTransactions(currentAddress, window.currentPageNum || 1, pageSize);
            if (cachedResult) {
                console.log('清除所有筛选');

                // 强制重新渲染交易记录，确保筛选生效
                displayTransactions({
                    transactions: cachedResult.transactions,
                    pagination: cachedResult.pagination
                });
            }
        }



        // 应用代币筛选（支持多选）
        function applyTokenFilter(token) {
            try {
                // 如果点击"全部"按钮，清除所有筛选
                if (token === 'all') {
                    clearAllTokenFilters();
                    return;
                }

                // 检查是否点击了已选中的按钮（取消选中）
                const tokenIndex = selectedTokens.indexOf(token);
                if (tokenIndex !== -1) {
                    // 取消选中
                    selectedTokens.splice(tokenIndex, 1);
                } else {
                    // 添加选中
                    selectedTokens.push(token);
                }

                console.log('当前选中的币种:', selectedTokens);

                // 更新活动按钮
                document.querySelectorAll('.token-filter-btn').forEach(btn => {
                    const btnToken = btn.getAttribute('data-token');

                    if (btnToken === 'all') {
                        // "全部"按钮只有在没有选中任何币种时才激活
                        btn.classList.toggle('active', selectedTokens.length === 0);
                    } else {
                        // 其他按钮根据是否在选中列表中决定是否激活
                        btn.classList.toggle('active', selectedTokens.includes(btnToken));
                    }
                });

                // 如果是自定义币种，需要添加一个新按钮（如果不存在）
                if (token !== 'all' && token !== 'BNB') {
                    // 检查是否已经存在该币种的按钮
                    const existingBtn = Array.from(document.querySelectorAll('.token-filter-btn')).find(btn =>
                        btn.getAttribute('data-token') === token
                    );

                    console.log('检查按钮是否存在:', token, existingBtn ? '已存在' : '不存在');

                    if (!existingBtn) {
                        // 创建新按钮
                        const newBtn = document.createElement('button');
                        newBtn.className = 'token-filter-btn';
                        if (selectedTokens.includes(token)) {
                            newBtn.classList.add('active');
                        }
                        newBtn.setAttribute('data-token', token);
                        newBtn.textContent = token;

                        // 添加点击事件，支持多选
                        newBtn.addEventListener('click', () => {
                            applyTokenFilter(token);
                        });

                        // 插入到"更多币种"按钮之前
                        const dropdownContainer = document.querySelector('.token-filter-dropdown');
                        dropdownContainer.parentNode.insertBefore(newBtn, dropdownContainer);

                        // 更新按钮集合
                        tokenFilterBtns = document.querySelectorAll('.token-filter-btn');
                    }
                }

            // 立即显示筛选提示
            updateFilterIndicator();

            // 重新显示交易记录
            const cachedResult = bscService.getCachedTransactions(currentAddress, window.currentPageNum || 1, pageSize);
            if (cachedResult) {
                console.log('应用筛选:', selectedTokens, '当前页:', window.currentPageNum || 1);

                // 强制重新渲染交易记录，确保筛选生效
                displayTransactions({
                    transactions: cachedResult.transactions,
                    pagination: cachedResult.pagination
                });

                // 如果当前在"交易相关合约"标签页，更新合约列表，不自动查询
                if (currentContractType === 'filtered') {
                    updateTokenListPage('', false);
                }
            } else {
                console.error('无法获取缓存的交易记录');
            }
            } catch (error) {
                console.error('应用代币筛选失败:', error);
                // 确保下拉菜单被隐藏
                tokenFilterDropdown.classList.remove('show');
            }
        }

        // 显示代币合约提示
        function showContractHint() {
            // 确保有当前查询的地址
            if (!currentAddress) {
                contractHint.style.display = 'none';
                return;
            }

            // 获取代币合约列表
            const tokenContracts = bscService.getTokenContracts();
            const contractsArray = Object.values(tokenContracts);

            // 如果没有代币合约，隐藏提示
            if (contractsArray.length === 0) {
                contractHint.style.display = 'none';
                return;
            }

            // 显示提示
            contractHint.style.display = 'block';

            // 添加"前往合约列表"链接的点击事件
            const gotoContractListLink = contractHint.querySelector('.goto-contract-list');
            if (gotoContractListLink) {
                gotoContractListLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    // 切换到合约列表标签页
                    tabBtns.forEach(tabBtn => {
                        if (tabBtn.getAttribute('data-tab') === 'token-list') {
                            tabBtn.click();
                        }
                    });
                });
            }

            // 同时更新合约列表页面，不自动查询
            updateTokenListPage('', false);
        }

        // 显示合约创建者查询提示
        function showContractCreatorsQueryHint() {
            // 获取当前查询进度
            const progress = bscService.getContractCreatorsQueryProgress();

            // 如果正在查询，显示提示
            if (progress.isQuerying) {
                // 创建提示元素
                const hintElement = document.createElement('div');
                hintElement.className = 'creator-query-hint';
                hintElement.innerHTML = `
                    <p>系统正在后台查询合约创建者信息，您可以在"我创建的合约"标签页查看进度。</p>
                    <button class="view-created-contracts-btn">查看我创建的合约</button>
                `;

                // 添加样式
                hintElement.style.backgroundColor = '#e8f4f8';
                hintElement.style.border = '1px solid #b8e0ed';
                hintElement.style.borderRadius = '4px';
                hintElement.style.padding = '10px';
                hintElement.style.margin = '10px 0';

                // 添加到交易记录表格之前
                const txTable = document.querySelector('table');
                if (txTable && !document.querySelector('.creator-query-hint')) {
                    // 如果已有合约提示，添加到其后
                    const contractHint = document.querySelector('.contract-hint');
                    if (contractHint) {
                        contractHint.parentNode.insertBefore(hintElement, contractHint.nextSibling);
                    } else {
                        txTable.parentNode.insertBefore(hintElement, txTable);
                    }

                    // 添加按钮点击事件
                    const viewCreatedContractsBtn = hintElement.querySelector('.view-created-contracts-btn');
                    viewCreatedContractsBtn.addEventListener('click', () => {
                        // 切换到合约列表标签页
                        tabBtns.forEach(tabBtn => {
                            if (tabBtn.getAttribute('data-tab') === 'token-list') {
                                tabBtn.click();

                                // 切换到"我创建的合约"标签
                                contractTypeBtns.forEach(btn => {
                                    if (btn.getAttribute('data-type') === 'created') {
                                        btn.click();
                                    }
                                });
                            }
                        });
                    });
                }
            }
        }

        // 获取合约关联的交易 HTML
        function getRelatedTransactionsHTML(contractAddress) {
            // 获取合约关联的交易
            const transactions = bscService.getContractTransactions(contractAddress);

            if (!transactions || transactions.length === 0) {
                return '<div class="no-related-tx">无关联交易</div>';
            }

            // 最多显示3条交易
            const displayTxs = transactions.slice(0, 3);

            let html = '';
            displayTxs.forEach(tx => {
                const txTime = bscService.formatTimestamp(tx.timeStamp);
                html += `
                    <div class="related-tx-item">
                        <a href="https://bscscan.com/tx/${tx.hash}" class="related-tx-hash" target="_blank" title="${tx.hash}">
                            ${tx.hash.substring(0, 8)}...${tx.hash.substring(tx.hash.length - 6)}
                        </a>
                        <span class="related-tx-time">${txTime}</span>
                    </div>
                `;
            });

            // 如果有更多交易，显示"查看更多"
            if (transactions.length > 3) {
                html += `<div class="more-tx">还有 ${transactions.length - 3} 条交易</div>`;
            }

            return html;
        }

        // 更新合约列表页面
        // searchTerm: 搜索关键词
        // autoQueryCreators: 是否自动查询合约创建者信息，默认为 true
        async function updateTokenListPage(searchTerm = '', autoQueryCreators = true) {

            // 检查是否正在查询合约创建者信息
            const progress = bscService.getContractCreatorsQueryProgress();

            // 如果是"我创建的合约"标签页，并且正在查询中，显示进度
            if (currentContractType === 'created' && progress.isQuerying) {
                showContractCreatorsQueryProgress();
                return; // 不继续更新列表，等待查询完成
            }

            // 显示加载中状态
            tokenListEmpty.style.display = 'block';
            tokenListEmpty.innerHTML = '<p>加载中，请稍候...</p>';
            tokenListGrid.style.display = 'none';

            try {
                // 获取代币合约列表，包含所有合约（包括UNKNOWN合约）
                const tokenContracts = bscService.getTokenContracts(true);
                let contractsArray = [];

                // 根据当前选择的类型过滤合约
                if (currentContractType === 'created') {
                    // 获取由当前地址创建的合约（使用异步方法）
                    // 对于"我创建的合约"标签页，不筛选关联交易，显示所有由当前地址创建的合约
                    try {
                        // 显示加载中状态
                        tokenListEmpty.style.display = 'block';
                        tokenListEmpty.innerHTML = '<p>正在查询合约创建者信息，请稍候...</p>';
                        tokenListGrid.style.display = 'none';

                        // 获取当前查询进度
                        const progress = bscService.getContractCreatorsQueryProgress();

                        // 如果已经在查询中，显示进度
                        if (progress.isQuerying) {
                            console.log('合约创建者信息查询已在进行中，显示进度');
                            showContractCreatorsQueryProgress();
                            return; // 不继续更新列表，等待查询完成
                        }

                        // 检查当前查询地址是否已设置
                        if (!currentAddress) {
                            console.log('当前查询地址未设置，无法获取创建的合约');
                            tokenListEmpty.innerHTML = '<p>请先在"转账记录"标签页查询钱包地址，然后再查看"我创建的合约"。</p>';
                            tokenListGrid.style.display = 'none';
                            tokenListEmpty.style.display = 'block';
                            return;
                        }

                        // 确保 bscService 中的当前查询地址已设置
                        bscService.setCurrentQueryAddress(currentAddress);

                        // 获取由当前地址创建的合约
                        const createdContracts = await bscService.getCreatedContracts();
                        contractsArray = Object.values(createdContracts);
                        console.log(`找到 ${contractsArray.length} 个由当前地址创建的合约`);

                        // 如果没有找到合约，但有代币合约，并且允许自动查询，尝试查询
                        if (contractsArray.length === 0 && Object.keys(bscService.getTokenContracts() || {}).length > 0 && autoQueryCreators) {
                            console.log(`未找到由当前地址创建的合约，但有代币合约，尝试查询`);

                            // 检查是否正在查询中
                            const progress = bscService.getContractCreatorsQueryProgress();
                            if (!progress.isQuerying) {
                                console.log('开始查询所有合约创建者信息...');

                                // 启动进度更新定时器
                                startProgressUpdateTimer();

                                // 使用 setTimeout 来确保 UI 更新后再开始查询
                                setTimeout(async () => {
                                    try {
                                        await bscService.queryAllContractCreators(true);

                                        // 停止进度更新定时器
                                        stopProgressUpdateTimer();

                                        console.log('所有合约创建者信息查询完成');

                                        // 再次获取由当前地址创建的合约
                                        const updatedCreatedContracts = await bscService.getCreatedContracts();
                                        const updatedCreatedContractsCount = Object.keys(updatedCreatedContracts || {}).length;
                                        console.log(`查询后找到 ${updatedCreatedContractsCount} 个由当前地址创建的合约`);

                                        // 更新合约列表，但不再自动查询
                                        updateTokenListPage('', false).catch(error => {
                                            console.error('更新合约列表失败:', error);
                                        });
                                    } catch (error) {
                                        console.error('查询合约创建者信息失败:', error);
                                        // 停止进度更新定时器
                                        stopProgressUpdateTimer();
                                        // 显示错误信息
                                        tokenListEmpty.innerHTML = `<p>查询合约创建者信息失败: ${error.message}</p>`;
                                    }
                                }, 100);

                                // 显示加载中状态
                                tokenListEmpty.innerHTML = '<p>正在查询合约创建者信息，请稍候...</p>';
                                return; // 不继续更新列表，等待查询完成
                            }
                        } else if (contractsArray.length === 0 && Object.keys(bscService.getTokenContracts() || {}).length > 0 && !autoQueryCreators) {
                            console.log(`未找到由当前地址创建的合约，但有代币合约，不自动查询`);
                        }

                        // 如果没有找到合约，但有代币合约，显示提示信息
                        if (contractsArray.length === 0 && Object.keys(bscService.getTokenContracts(true)).length > 0) {
                            console.log('未找到由当前地址创建的合约，但有代币合约');

                            // 检查是否正在查询中
                            const progress = bscService.getContractCreatorsQueryProgress();
                            if (progress.isQuerying) {
                                // 如果正在查询中，显示进度
                                console.log('合约创建者信息查询已在进行中，显示进度');
                                showContractCreatorsQueryProgress();
                            } else {
                                // 显示提示信息
                                tokenListEmpty.innerHTML = '<p>未找到由当前地址创建的合约，但系统已完成查询。</p>' +
                                    '<p>如果您确信该地址创建过合约，请尝试在"合约信息"标签页中查询具体的合约地址。</p>';
                            }
                        }

                        // 如果仍然没有找到合约，显示提示信息
                        if (contractsArray.length === 0) {
                            tokenListEmpty.innerHTML = `<p>未发现由当前地址创建的合约。</p>
                            <p>如果您确信该地址创建过合约，请尝试在"合约信息"标签页中查询具体的合约地址。</p>`;
                            tokenListGrid.style.display = 'none';
                            return;
                        }
                    } catch (error) {
                        console.error('获取创建的合约失败:', error);
                        tokenListEmpty.innerHTML = `<p>获取创建的合约失败: ${error.message}</p>`;
                        tokenListGrid.style.display = 'none';
                        return;
                    }
                } else if (currentContractType === 'filtered') {
                    // 获取当前筛选交易中包含的合约
                    const allFilteredContracts = Object.values(filteredTransactionContracts);

                    // 过滤掉名称为"Unknown Token"且符号为"UNKNOWN"的合约
                    contractsArray = allFilteredContracts.filter(contract =>
                        !(contract.name === 'Unknown Token' && contract.symbol === 'UNKNOWN')
                    );

                    console.log(`当前筛选的交易中包含 ${contractsArray.length} 个合约（过滤前: ${allFilteredContracts.length}）`);
                } else {
                    // 对于"所有合约"标签页，显示所有合约，不进行过滤
                    contractsArray = Object.values(tokenContracts);
                    console.log(`"所有合约"标签页显示 ${contractsArray.length} 个合约`);
                }


                // 过滤合约
                let filteredContracts = contractsArray;

                // 过滤掉符号为"UNKNOWN"的合约
                // 在所有标签页中都过滤
                filteredContracts = contractsArray.filter(contract => {
                    // 过滤掉符号为"UNKNOWN"的合约
                    return contract.symbol !== 'UNKNOWN';
                });

                console.log(`过滤掉 UNKNOWN 合约后，剩余 ${filteredContracts.length} 个合约（过滤前: ${contractsArray.length}）`);

                // 打印所有合约，用于调试
                console.log('过滤后的合约:');
                filteredContracts.forEach(contract => {
                    console.log(`- ${contract.address}: ${contract.name} (${contract.symbol}), 创建者: ${contract.creator || '未知'}, 由当前地址创建: ${contract.createdByCurrentAddress || false}`);
                });



                // 如果有搜索词，进一步过滤
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    filteredContracts = filteredContracts.filter(contract =>
                        contract.symbol.toLowerCase().includes(term) ||
                        contract.name.toLowerCase().includes(term) ||
                        contract.address.toLowerCase().includes(term)
                    );
                }

                // 如果没有代币合约，显示空状态
                if (filteredContracts.length === 0) {
                    tokenListEmpty.style.display = 'block';
                    tokenListGrid.style.display = 'none';

                    // 根据不同情况显示不同的消息
                    if (searchTerm) {
                        tokenListEmpty.innerHTML = `<p>没有找到匹配"${searchTerm}"的代币合约。</p>`;
                    } else if (currentContractType === 'created') {
                        if (contractsArray.length === 0) {
                            tokenListEmpty.innerHTML = `<p>未发现由当前地址创建的合约。</p>
                            <p>如果您确信该地址创建过合约，请尝试在"合约信息"标签页中查询具体的合约地址。</p>`;
                        } else {
                            tokenListEmpty.innerHTML = `<p>没有找到符合条件的合约。</p>`;
                        }
                    } else if (currentContractType === 'filtered') {
                        if (contractsArray.length === 0) {
                            if (selectedTokens.length > 0) {
                                tokenListEmpty.innerHTML = `<p>当前筛选的交易中未包含任何合约。</p>
                                <p>当前筛选: ${selectedTokens.join(', ')}</p>`;
                            } else {
                                tokenListEmpty.innerHTML = `<p>请先在"转账记录"标签页筛选交易，然后查看相关的合约。</p>`;
                            }
                        } else {
                            tokenListEmpty.innerHTML = `<p>没有找到符合条件的合约。</p>`;
                        }
                    } else if (contractsArray.length === 0) {
                        tokenListEmpty.innerHTML = `<p>暂无代币合约。请先在"转账记录"标签页查询钱包地址，系统会自动识别相关的代币合约。</p>`;
                    }
                    return;
                }

                // 有合约，隐藏空状态
                tokenListEmpty.style.display = 'none';
                tokenListGrid.style.display = 'grid';

                // 清空列表，但如果是"我创建的合约"标签页且正在查询中，不清空
                if (!(currentContractType === 'created' && bscService.getContractCreatorsQueryProgress().isQuerying)) {
                    tokenListGrid.innerHTML = '';
                }

                // 显示代币合约
                filteredContracts.forEach(contract => {
                    const contractItem = document.createElement('div');
                    contractItem.className = 'token-list-item';

                    // 检查是否由当前地址创建
                    const isCreatedByCurrentAddress = contract.createdByCurrentAddress ||
                        (contract.creator && currentAddress &&
                         contract.creator.toLowerCase() === currentAddress.toLowerCase());

                    // 检查是否在当前筛选的交易中
                    const isInFilteredTransactions = currentContractType === 'filtered';

                    contractItem.innerHTML = `
                        <div class="token-list-symbol">${contract.symbol}</div>
                        <div class="token-list-name">${contract.name}</div>
                        <div class="token-list-address-container">
                            <div class="token-list-address-label">合约地址:</div>
                            <div class="token-list-address">${contract.address}</div>
                            <button class="token-action-btn copy-address-btn" data-address="${contract.address}" title="复制合约地址">复制</button>
                        </div>
                        <div class="token-list-creator-container">
                            <div class="token-list-address-label">创建者:</div>
                            ${isCreatedByCurrentAddress ?
                                `<div class="token-list-creator">
                                    <span class="creator-badge">当前地址</span>
                                    <span class="creator-address">${contract.creator}</span>
                                </div>` :
                                contract.creator ?
                                `<div class="token-list-creator">
                                    <span class="creator-address">${contract.creator}</span>
                                    <button class="token-action-btn copy-creator-btn" data-address="${contract.creator}" title="复制创建者地址">复制</button>
                                </div>` :
                                `<div class="token-list-creator">
                                    <span class="creator-unknown">查询详情后可显示</span>
                                    <button class="token-action-btn query-details-btn" data-address="${contract.address}" title="查询合约详情">查询</button>
                                </div>`
                            }
                        </div>
                        ${isInFilteredTransactions ?
                            `<div class="token-list-related-tx">
                                <div class="related-tx-label">关联交易:</div>
                                <div class="related-tx-list">
                                    ${getRelatedTransactionsHTML(contract.address)}
                                </div>
                            </div>` : ''
                        }
                        <div class="token-list-actions">
                            <button class="token-action-btn view-details-btn" data-address="${contract.address}">查看合约详情</button>
                            ${!isCreatedByCurrentAddress ?
                                `<button class="token-action-btn mark-as-created-btn" data-address="${contract.address}">标记为我创建的</button>` :
                                ''}
                        </div>
                    `;

                    tokenListGrid.appendChild(contractItem);
                });

                // 添加查看详情按钮事件
                document.querySelectorAll('.view-details-btn, .query-details-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const contractAddress = btn.getAttribute('data-address');
                        if (contractAddress) {
                            // 切换到合约信息标签页
                            tabBtns.forEach(tabBtn => {
                                if (tabBtn.getAttribute('data-tab') === 'contracts') {
                                    tabBtn.click();
                                }
                            });

                            // 填充合约地址并触发查询
                            contractAddressInput.value = contractAddress;
                            searchContractBtn.click();
                        }
                    });
                });

                // 添加"查询详情后可显示"文本点击事件
                document.querySelectorAll('.creator-unknown').forEach(span => {
                    span.addEventListener('click', () => {
                        // 找到最近的合约项
                        const contractItem = span.closest('.token-list-item');
                        if (contractItem) {
                            // 找到查询按钮并触发点击
                            const queryBtn = contractItem.querySelector('.query-details-btn');
                            if (queryBtn) {
                                queryBtn.click();
                            }
                        }
                    });
                });

                // 添加"标记为我创建的"按钮事件
                document.querySelectorAll('.mark-as-created-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const contractAddress = btn.getAttribute('data-address');
                        if (contractAddress) {
                            try {
                                // 调用 markContractAsCreatedByCurrentAddress 方法
                                const result = bscService.markContractAsCreatedByCurrentAddress(contractAddress);

                                if (result) {
                                    // 临时改变按钮文字
                                    btn.textContent = '已标记!';
                                    btn.style.backgroundColor = '#d4edda';
                                    btn.style.color = '#155724';

                                    // 2秒后刷新合约列表
                                    setTimeout(() => {
                                        // 刷新合约列表
                                        updateTokenListPage().catch(error => {
                                            console.error('更新合约列表失败:', error);
                                        });
                                    }, 2000);
                                } else {
                                    alert('标记失败，请确保已查询钱包地址');
                                }
                            } catch (error) {
                                console.error('标记合约失败:', error);
                                alert('标记合约失败: ' + error.message);
                            }
                        }
                    });
                });

                // 添加复制地址按钮事件（合约地址和创建者地址）
                document.querySelectorAll('.copy-address-btn, .copy-creator-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const address = btn.getAttribute('data-address');
                        if (address) {
                            // 复制到剪贴板
                            navigator.clipboard.writeText(address)
                                .then(() => {
                                    // 临时改变按钮文字
                                    const originalText = btn.textContent;
                                    btn.textContent = '已复制!';
                                    btn.style.backgroundColor = '#d4edda';
                                    btn.style.color = '#155724';

                                    // 2秒后恢复
                                    setTimeout(() => {
                                        btn.textContent = originalText;
                                        btn.style.backgroundColor = '';
                                        btn.style.color = '';
                                    }, 2000);
                                })
                                .catch(err => {
                                    console.error('复制失败:', err);
                                    alert('复制地址失败，请手动复制');
                                });
                        }
                    });
                });

            } catch (error) {
                console.error('更新合约列表失败:', error);
                tokenListEmpty.style.display = 'block';
                tokenListEmpty.innerHTML = `<p>加载合约列表失败: ${error.message}</p>`;
                tokenListGrid.style.display = 'none';
            }
        }

        // 交易类型选项卡事件
        const txTypeBtns = document.querySelectorAll('.tx-type-btn');
        txTypeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const txType = btn.getAttribute('data-type');

                // 更新活动按钮
                txTypeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 更新当前交易类型
                currentTxType = txType;

                // 如果已经有交易记录，重新显示
                if (currentAddress) {
                    // 获取缓存的交易记录
                    const cachedResult = bscService.getCachedTransactions(currentAddress, 1, pageSize);
                    if (cachedResult) {
                        displayTransactions(cachedResult);
                    }
                }
            });
        });

        // 查询转账记录
        searchTxBtn.addEventListener('click', async () => {
            const address = addressInput.value.trim();

            if (!address) {
                alert('请输入有效的BSC地址');
                return;
            }

            // 检查是否通过了代币销毁验证
            if (!burnVerificationPassed) {
                alert('请先验证代币销毁交易，验证通过后才能查询转账记录');
                // 滚动到验证部分
                document.querySelector('.burn-verification').scrollIntoView({ behavior: 'smooth' });
                return;
            }

            // 保存当前地址
            currentAddress = address;

            // 添加验证通过标记
            const verificationLabel = document.createElement('span');
            verificationLabel.className = 'verification-passed';
            verificationLabel.textContent = '✓ 已验证';
            verificationLabel.title = `已验证销毁交易: ${verifiedBurnTxHash}`;

            // 检查是否已经有标记
            const existingLabel = document.querySelector('.verification-passed');
            if (!existingLabel) {
                const txQueryHeading = document.querySelector('#txQuerySection h3');
                if (txQueryHeading) {
                    txQueryHeading.appendChild(verificationLabel);
                }
            }

            // 重置交易类型为"全部"
            currentTxType = 'all';
            txTypeBtns.forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-type') === 'all') {
                    btn.classList.add('active');
                }
            });

            // 清空选中的币种
            selectedTokens = [];

            // 移除自定义币种按钮
            document.querySelectorAll('.token-filter-btn').forEach(btn => {
                const token = btn.getAttribute('data-token');
                if (token !== 'all' && token !== 'BNB') {
                    btn.remove();
                }
            });

            // 重新获取默认按钮并设置活动状态
            document.querySelectorAll('.token-filter-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-token') === 'all') {
                    btn.classList.add('active');
                }
            });

            // 清空自定义币种输入框
            customTokenInput.value = '';

            // 清空代币符号集合
            tokenSymbols.clear();

            // 清除筛选提示
            updateFilterIndicator();

            // 清除之前的缓存，包括代币合约缓存
            bscService.clearTransactionsCache(null, true);

            // 隐藏代币合约提示
            contractHint.style.display = 'none';

            // 加载第一页
            await loadTransactionsPage(address, 1);
        });

        // 分页按钮事件已经在 pagination-new.js 中处理，这里不再需要

        // 查询合约信息
        searchContractBtn.addEventListener('click', async () => {
            const contractAddress = contractAddressInput.value.trim();

            if (!contractAddress) {
                alert('请输入有效的BSC合约地址');
                return;
            }

            try {
                // 显示加载中
                contractLoading.style.display = 'block';
                contractResults.style.display = 'none';
                contractInfo.innerHTML = '';

                console.log(`开始查询合约信息: ${contractAddress}`);

                // 获取合约信息（传递当前查询的钱包地址，用于标记由该地址创建的合约）
                const contractResponse = await bscService.getContractInfo(contractAddress, currentAddress);

                console.log('合约信息查询结果:', contractResponse);

                // 检查是否需要特殊处理（合约源代码未验证的情况）
                let contract = {};
                let needSpecialHandling = false;

                if (contractResponse && contractResponse.success && contractResponse.result) {
                    // 检查是否有ABI字段且值为"Contract source code not verified"
                    if (contractResponse.result.abi === 'Contract source code not verified') {
                        console.log('检测到合约源代码未验证，使用特殊处理...');
                        needSpecialHandling = true;
                    }

                    if (needSpecialHandling) {
                        // 特殊处理合约源代码未验证的情况
                        // 提取合约信息
                        contract = {
                            address: contractAddress,
                            balance: contractResponse.result.balance || '0 BNB',
                            bytecodeSize: contractResponse.result.bytecodeSize || 0,
                            hasVerifiedSource: false,
                            abiMessage: '合约源代码未验证'
                        };

                        // 处理创建者信息
                        if (contractResponse.result.creator && Array.isArray(contractResponse.result.creator) && contractResponse.result.creator.length > 0) {
                            const creatorInfo = contractResponse.result.creator[0];
                            contract.creator = creatorInfo.contractCreator;
                            contract.creationTx = creatorInfo.txHash;

                            // 检查是否由当前地址创建
                            if (currentAddress && contract.creator &&
                                contract.creator.toLowerCase() === currentAddress.toLowerCase()) {
                                contract.createdByCurrentAddress = true;
                            } else {
                                contract.createdByCurrentAddress = false;
                            }
                        } else {
                            contract.creator = '未知';
                            contract.creationTx = '未知';
                            contract.createdByCurrentAddress = false;
                        }

                        // 处理代币信息
                        if (contractResponse.result.totalSupply && contractResponse.result.totalSupply !== '0' && contractResponse.result.totalSupply !== 'Unknown') {
                            contract.isToken = true;

                            // 从源代码中提取代币信息
                            let tokenName = 'Unknown Token';
                            let tokenSymbol = 'UNKNOWN';

                            if (contractResponse.result.sourceCode && Array.isArray(contractResponse.result.sourceCode) && contractResponse.result.sourceCode.length > 0) {
                                const sourceInfo = contractResponse.result.sourceCode[0];
                                if (sourceInfo.ContractName) {
                                    tokenName = sourceInfo.ContractName;
                                }
                            }

                            contract.tokenInfo = {
                                name: tokenName,
                                symbol: tokenSymbol,
                                decimals: 18,
                                totalSupply: contractResponse.result.totalSupply
                            };
                        } else {
                            contract.isToken = false;
                            contract.tokenInfo = null;
                        }
                    } else {
                        // 正常处理（合约源代码已验证或其他情况）
                        // 提取基本信息
                        contract = {
                            address: contractAddress,
                            balance: contractResponse.result.balance || '0 BNB',
                            bytecodeSize: contractResponse.result.bytecodeSize || 0,
                            hasVerifiedSource: true,
                            abiMessage: '',
                            isToken: contractResponse.result.isToken || false
                        };

                        // 处理ABI信息
                        if (contractResponse.result.abi) {
                            if (typeof contractResponse.result.abi === 'string') {
                                try {
                                    contract.abi = JSON.parse(contractResponse.result.abi);
                                } catch (e) {
                                    console.log('解析ABI失败:', e);
                                    contract.abi = contractResponse.result.abi;
                                }
                            } else {
                                contract.abi = contractResponse.result.abi;
                            }
                        }

                        // 处理创建者信息
                        if (contractResponse.result.creator && Array.isArray(contractResponse.result.creator) && contractResponse.result.creator.length > 0) {
                            const creatorInfo = contractResponse.result.creator[0];
                            contract.creator = creatorInfo.contractCreator;
                            contract.creationTx = creatorInfo.txHash;

                            console.log(`从creator数组中提取创建者信息: ${contract.creator}`);

                            // 检查是否由当前地址创建
                            if (currentAddress && contract.creator &&
                                contract.creator.toLowerCase() === currentAddress.toLowerCase()) {
                                contract.createdByCurrentAddress = true;
                            } else {
                                contract.createdByCurrentAddress = false;
                            }

                            // 更新代币合约的创建者信息
                            if (contractAddress && contract.creator) {
                                const lowerAddr = contractAddress.toLowerCase();
                                if (bscService.tokenContracts && bscService.tokenContracts[lowerAddr]) {
                                    console.log(`更新合约 ${contractAddress} 的创建者信息: ${contract.creator}`);
                                    bscService.tokenContracts[lowerAddr].creator = contract.creator;

                                    // 检查是否由当前地址创建
                                    if (currentAddress && contract.creator.toLowerCase() === currentAddress.toLowerCase()) {
                                        console.log(`确认合约 ${contractAddress} 由当前地址 ${currentAddress} 创建`);
                                        bscService.tokenContracts[lowerAddr].createdByCurrentAddress = true;

                                        // 添加到创建的合约集合中
                                        if (!bscService.createdContracts) {
                                            bscService.createdContracts = {};
                                        }
                                        bscService.createdContracts[lowerAddr] = bscService.tokenContracts[lowerAddr];

                                        // 触发发现创建的合约事件
                                        bscService.triggerCreatedContractFound(contractAddress, bscService.tokenContracts[lowerAddr]);
                                    }
                                }
                            }
                        } else {
                            contract.creator = '未知';
                            contract.creationTx = '未知';
                            contract.createdByCurrentAddress = false;
                        }

                        // 处理代币信息
                        if (contractResponse.result.isToken && contractResponse.result.totalSupply &&
                            contractResponse.result.totalSupply !== '0' && contractResponse.result.totalSupply !== 'Unknown') {
                            // 从源代码中提取代币信息
                            let tokenName = 'Unknown Token';
                            let tokenSymbol = 'UNKNOWN';
                            let decimals = 18;

                            if (contractResponse.result.sourceCode && Array.isArray(contractResponse.result.sourceCode) &&
                                contractResponse.result.sourceCode.length > 0) {
                                const sourceInfo = contractResponse.result.sourceCode[0];
                                if (sourceInfo.ContractName) {
                                    tokenName = sourceInfo.ContractName;
                                }
                            }

                            contract.tokenInfo = {
                                name: tokenName,
                                symbol: tokenSymbol,
                                decimals: decimals,
                                totalSupply: contractResponse.result.totalSupply
                            };
                        } else {
                            contract.isToken = false;
                            contract.tokenInfo = null;
                        }
                    }
                } else if (contractResponse && typeof contractResponse === 'object') {
                    // 检查是否是直接返回的合约信息对象（没有success字段）
                    if (contractResponse.address && contractResponse.creator) {
                        console.log('检测到直接返回的合约信息对象，使用该对象');
                        contract = contractResponse;

                        // 更新代币合约的创建者信息
                        if (contractAddress && contract.creator) {
                            const lowerAddr = contractAddress.toLowerCase();
                            if (bscService.tokenContracts && bscService.tokenContracts[lowerAddr]) {
                                console.log(`更新合约 ${contractAddress} 的创建者信息: ${contract.creator}`);
                                bscService.tokenContracts[lowerAddr].creator = contract.creator;

                                // 检查是否由当前地址创建
                                if (currentAddress && contract.creator.toLowerCase() === currentAddress.toLowerCase()) {
                                    console.log(`确认合约 ${contractAddress} 由当前地址 ${currentAddress} 创建`);
                                    bscService.tokenContracts[lowerAddr].createdByCurrentAddress = true;

                                    // 添加到创建的合约集合中
                                    if (!bscService.createdContracts) {
                                        bscService.createdContracts = {};
                                    }
                                    bscService.createdContracts[lowerAddr] = bscService.tokenContracts[lowerAddr];

                                    // 触发发现创建的合约事件
                                    bscService.triggerCreatedContractFound(contractAddress, bscService.tokenContracts[lowerAddr]);
                                }
                            }
                        }
                    } else if (contractResponse.success === false) {
                        // 处理错误
                        contract = {
                            error: contractResponse.error || '获取合约信息失败'
                        };
                    } else {
                        // 未知格式，尝试使用整个对象
                        console.log('未知的响应格式，尝试使用整个对象');
                        contract = contractResponse;
                    }
                } else {
                    contract = {
                        error: '获取合约信息失败: 无效的响应格式'
                    };
                }

                console.log('处理后的合约信息:', contract);

                // 查询完成后，更新合约列表（如果存在）
                // 保存当前选中的合约类型
                const savedContractType = currentContractType;

                // 检查合约是否由当前地址创建
                if (contract.creator && currentAddress &&
                    contract.creator.toLowerCase() === currentAddress.toLowerCase()) {
                    console.log(`合约 ${contractAddress} 由当前地址创建，将更新"我创建的合约"标签页`);

                    // 强制清除创建的合约缓存，确保下次查询时会重新获取
                    bscService.createdContracts = {};
                }

                // 更新合约列表
                await updateTokenListPage();

                // 恢复之前选中的合约类型
                if (savedContractType) {
                    // 找到对应的标签按钮并点击
                    document.querySelectorAll('.contract-type-btn').forEach(btn => {
                        if (btn.getAttribute('data-type') === savedContractType) {
                            btn.click();
                        }
                    });
                }

                // 隐藏加载中
                contractLoading.style.display = 'none';

                // 如果有错误信息，显示错误
                if (contract.error) {
                    contractInfo.innerHTML = `
                        <div class="error-message" style="padding: 15px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; color: #721c24; margin-top: 15px;">
                            <h4>❌ 查询失败</h4>
                            <p><strong>错误信息:</strong> ${contract.error}</p>
                            <p>请检查合约地址是否正确，或者稍后再试。</p>
                        </div>
                    `;
                    contractResults.style.display = 'block';
                    return;
                }

                // 显示合约信息
                let infoHtml = `
                    <div class="contract-info-grid">
                        <div class="contract-info-row">
                            <div class="contract-info-label">合约地址:</div>
                            <div class="contract-info-value">
                                <a href="https://bscscan.com/address/${contract.address}" target="_blank" title="${contract.address}">${contract.address.substring(0, 10)}...${contract.address.substring(contract.address.length - 8)}</a>
                            </div>
                        </div>

                        <div class="contract-info-row">
                            <div class="contract-info-label">BNB余额:</div>
                            <div class="contract-info-value">${contract.balance}</div>
                        </div>

                        <div class="contract-info-row">
                            <div class="contract-info-label">字节码大小:</div>
                            <div class="contract-info-value">${contract.bytecodeSize} 字节</div>
                        </div>

                        <div class="contract-info-row">
                            <div class="contract-info-label">创建者:</div>
                            <div class="contract-info-value">
                                <a href="https://bscscan.com/address/${contract.creator}" target="_blank" title="${contract.creator}">${contract.creator.substring(0, 10)}...${contract.creator.substring(contract.creator.length - 8)}</a>
                            </div>
                        </div>

                        <div class="contract-info-row">
                            <div class="contract-info-label">创建交易:</div>
                            <div class="contract-info-value">
                                <a href="https://bscscan.com/tx/${contract.creationTx}" target="_blank" title="${contract.creationTx}">${contract.creationTx.substring(0, 10)}...${contract.creationTx.substring(contract.creationTx.length - 8)}</a>
                            </div>
                        </div>

                        <div class="contract-info-row">
                            <div class="contract-info-label">已验证源代码:</div>
                            <div class="contract-info-value">${contract.hasVerifiedSource ? '是' : '否'}</div>
                        </div>
                    </div>
                `;

                // 如果有ABI消息，显示它
                if (contract.abiMessage) {
                    infoHtml += `
                        <div class="contract-info-grid">
                            <div class="contract-info-row">
                                <div class="contract-info-label">ABI信息:</div>
                                <div class="contract-info-value">${contract.abiMessage}</div>
                            </div>
                        </div>
                    `;
                }

                // 如果没有API Key，显示提示信息
                if (contract.creator === '需要API Key才能查询') {
                    infoHtml += `
                        <div class="notice" style="margin-top: 15px; padding: 10px; background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; color: #856404;">
                            <p><strong>提示:</strong> 要获取完整的合约信息，请在BSCScan申请API Key并添加到应用中。</p>
                            <p>申请步骤:</p>
                            <ol>
                                <li>访问 <a href="https://bscscan.com/register" target="_blank">BSCScan注册页面</a></li>
                                <li>创建账户并登录</li>
                                <li>进入 "API-KEYs" 页面</li>
                                <li>点击 "Create New API Key"</li>
                                <li>获取API Key后，将其添加到bscService.js文件中</li>
                            </ol>
                        </div>
                    `;
                }

                // 如果是代币合约，显示代币信息
                if (contract.isToken && contract.tokenInfo) {
                    infoHtml += `
                        <h4>代币信息</h4>
                        <div class="contract-info-grid">
                            <div class="contract-info-row">
                                <div class="contract-info-label">名称:</div>
                                <div class="contract-info-value">${contract.tokenInfo.name}</div>
                            </div>

                            <div class="contract-info-row">
                                <div class="contract-info-label">符号:</div>
                                <div class="contract-info-value">${contract.tokenInfo.symbol}</div>
                            </div>

                            <div class="contract-info-row">
                                <div class="contract-info-label">小数位:</div>
                                <div class="contract-info-value">${contract.tokenInfo.decimals}</div>
                            </div>

                            <div class="contract-info-row">
                                <div class="contract-info-label">总供应量:</div>
                                <div class="contract-info-value">${contract.tokenInfo.totalSupply} ${contract.tokenInfo.symbol}</div>
                            </div>
                        </div>
                    `;
                }

                // 添加调试信息（仅在开发环境中显示）
                infoHtml += `
                    <div class="debug-info" style="margin-top: 20px; padding: 10px; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; color: #6c757d;">
                        <h4>调试信息</h4>
                        <div class="contract-info-grid">
                            <div class="contract-info-row">
                                <div class="contract-info-label">会话状态:</div>
                                <div class="contract-info-value">${burnVerificationPassed ? '已验证' : '未验证'}</div>
                            </div>

                            <div class="contract-info-row">
                                <div class="contract-info-label">验证交易哈希:</div>
                                <div class="contract-info-value">${verifiedBurnTxHash ? `<a href="https://bscscan.com/tx/${verifiedBurnTxHash}" target="_blank" title="${verifiedBurnTxHash}">${verifiedBurnTxHash.substring(0, 10)}...${verifiedBurnTxHash.substring(verifiedBurnTxHash.length - 8)}</a>` : '无'}</div>
                            </div>

                            <div class="contract-info-row">
                                <div class="contract-info-label">当前查询地址:</div>
                                <div class="contract-info-value">${currentAddress ? `<a href="https://bscscan.com/address/${currentAddress}" target="_blank" title="${currentAddress}">${currentAddress.substring(0, 10)}...${currentAddress.substring(currentAddress.length - 8)}</a>` : '无'}</div>
                            </div>

                            <div class="contract-info-row">
                                <div class="contract-info-label">是否为代币合约:</div>
                                <div class="contract-info-value">${contract.isToken ? '是' : '否'}</div>
                            </div>

                            <div class="contract-info-row">
                                <div class="contract-info-label">ABI消息:</div>
                                <div class="contract-info-value">${contract.abiMessage || '无'}</div>
                            </div>
                        </div>
                    </div>
                `;

                contractInfo.innerHTML = infoHtml;
                contractResults.style.display = 'block';
            } catch (error) {
                console.error('获取合约信息失败:', error);
                contractLoading.style.display = 'none';

                contractInfo.innerHTML = `
                    <div class="burn-error">
                        <h4>❌ 查询失败</h4>
                        <div class="contract-info-grid">
                            <div class="contract-info-row">
                                <div class="contract-info-label">错误信息:</div>
                                <div class="contract-info-value">${error.message}</div>
                            </div>

                            <div class="contract-info-row">
                                <div class="contract-info-label">提示:</div>
                                <div class="contract-info-value">请检查合约地址是否正确，或者稍后再试。</div>
                            </div>
                        </div>

                        <h4 style="margin-top: 15px;">调试信息</h4>
                        <pre style="background-color: #f8f9fa; padding: 10px; border-radius: 4px; overflow: auto; font-size: 12px; max-height: 200px;">${error.stack || '无堆栈信息'}</pre>
                    </div>
                `;
                contractResults.style.display = 'block';
            }
        });

        // 币种筛选事件

        // 下拉菜单按钮点击事件
        const dropdownBtn = document.querySelector('.token-filter-dropdown-btn');
        if (dropdownBtn) {
            dropdownBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // 切换下拉菜单的显示状态
                if (tokenFilterDropdown.classList.contains('show')) {
                    tokenFilterDropdown.classList.remove('show');
                } else {
                    tokenFilterDropdown.classList.add('show');
                }
            });
        }

        // 点击页面其他地方关闭下拉菜单
        document.addEventListener('click', (e) => {
            // 如果点击的不是下拉菜单按钮、下拉菜单内容或下拉菜单项
            if (!e.target.closest('.token-filter-dropdown-btn') &&
                !e.target.closest('.token-filter-dropdown-content') &&
                !e.target.closest('.token-filter-item')) {

                // 关闭下拉菜单
                tokenFilterDropdown.classList.remove('show');
            }
        });

        // 币种筛选按钮事件
        tokenFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const token = btn.getAttribute('data-token');
                applyTokenFilter(token);
            });
        });

        // 自定义币种筛选
        applyCustomTokenBtn.addEventListener('click', () => {
            const customToken = customTokenInput.value.trim();
            if (customToken) {
                // 如果输入了多个币种（用逗号或空格分隔），分别添加
                const tokens = customToken.split(/[,\s]+/).filter(t => t.trim());
                tokens.forEach(token => {
                    if (token) {
                        applyTokenFilter(token.trim());
                    }
                });

                // 清空输入框
                customTokenInput.value = '';
            }
        });

        // 回车键触发自定义币种筛选
        customTokenInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const customToken = customTokenInput.value.trim();
                if (customToken) {
                    // 如果输入了多个币种（用逗号或空格分隔），分别添加
                    const tokens = customToken.split(/[,\s]+/).filter(t => t.trim());
                    tokens.forEach(token => {
                        if (token) {
                            applyTokenFilter(token.trim());
                        }
                    });

                    // 清空输入框
                    customTokenInput.value = '';
                }
            }
        });

        // 合约列表页面事件

        // 合约类型选项卡事件
        contractTypeBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const contractType = btn.getAttribute('data-type');

                // 更新活动按钮
                contractTypeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 更新当前合约类型
                currentContractType = contractType;

                // 如果选择了"交易相关合约"，但没有筛选交易，提示用户
                if (contractType === 'filtered' && selectedTokens.length === 0 && Object.keys(filteredTransactionContracts).length === 0) {
                    // 切换到转账记录标签页
                    tabBtns.forEach(tabBtn => {
                        if (tabBtn.getAttribute('data-tab') === 'transactions') {
                            tabBtn.click();

                            // 显示提示
                            alert('请先在转账记录页面筛选交易，然后再查看相关合约。');
                        }
                    });
                    return;
                }

                // 如果选择了"我创建的合约"，先查询所有合约创建者信息
                if (contractType === 'created') {
                    try {
                        // 显示加载中状态
                        tokenListEmpty.style.display = 'block';
                        tokenListEmpty.innerHTML = '<p>正在查询合约创建者信息，请稍候...</p>';
                        tokenListGrid.style.display = 'none';

                        // 获取当前查询进度
                        const progress = bscService.getContractCreatorsQueryProgress();

                        // 如果已经在查询中，显示进度
                        if (progress.isQuerying) {
                            console.log('合约创建者信息查询已在进行中，显示进度');
                            showContractCreatorsQueryProgress();

                            // 启动进度更新定时器
                            startProgressUpdateTimer();
                        } else {
                            // 检查是否已经有创建的合约缓存
                            const createdContracts = await bscService.getCreatedContracts();
                            const createdContractsCount = Object.keys(createdContracts || {}).length;

                            // 检查是否正在查询中
                            const isQuerying = bscService.getContractCreatorsQueryProgress().isQuerying;

                            if (createdContractsCount > 0) {
                                console.log(`已有 ${createdContractsCount} 个创建的合约缓存，无需重新查询`);
                                // 更新合约列表，允许自动查询
                                updateTokenListPage('', true).catch(error => {
                                    console.error('更新合约列表失败:', error);
                                });
                            } else if (isQuerying) {
                                // 如果正在查询中，显示进度
                                console.log('合约创建者信息查询已在进行中，显示进度');
                                showContractCreatorsQueryProgress();
                            } else {
                                // 检查是否有代币合约
                                const tokenContractsCount = Object.keys(bscService.getTokenContracts() || {}).length;

                                if (tokenContractsCount > 0) {
                                    // 如果有代币合约，但没有创建的合约，自动开始查询
                                    console.log('开始查询所有合约创建者信息...');

                                    // 启动进度更新定时器
                                    startProgressUpdateTimer();

                                    // 查询所有合约的创建者信息，强制重新查询以确保获取所有创建的合约
                                    // 使用 setTimeout 来确保 UI 更新后再开始查询
                                    setTimeout(async () => {
                                        try {
                                            await bscService.queryAllContractCreators(true);

                                            // 停止进度更新定时器
                                            stopProgressUpdateTimer();

                                            console.log('所有合约创建者信息查询完成');

                                            // 再次获取由当前地址创建的合约
                                            const updatedCreatedContracts = await bscService.getCreatedContracts();
                                            const updatedCreatedContractsCount = Object.keys(updatedCreatedContracts || {}).length;
                                            console.log(`查询后找到 ${updatedCreatedContractsCount} 个由当前地址创建的合约`);

                                            // 更新合约列表，但不自动查询
                                            updateTokenListPage('', false).catch(error => {
                                                console.error('更新合约列表失败:', error);
                                            });
                                        } catch (error) {
                                            console.error('查询合约创建者信息失败:', error);
                                            // 停止进度更新定时器
                                            stopProgressUpdateTimer();
                                            // 显示错误信息
                                            tokenListEmpty.innerHTML = `<p>查询合约创建者信息失败: ${error.message}</p>`;
                                        }
                                    }, 100);
                                } else {
                                    console.log('没有代币合约需要查询');
                                    tokenListEmpty.innerHTML = '<p>没有代币合约需要查询</p>';
                                }
                            }
                        }
                    } catch (error) {
                        console.error('查询合约创建者信息失败:', error);
                        // 停止进度更新定时器
                        stopProgressUpdateTimer();
                        // 显示错误信息
                        tokenListEmpty.innerHTML = `<p>查询合约创建者信息失败: ${error.message}</p>`;
                    }
                }

                // 更新合约列表（异步调用）
                // 如果是"我创建的合约"标签页，且正在查询中，不更新列表
                if (!(contractType === 'created' && bscService.getContractCreatorsQueryProgress().isQuerying)) {
                    // 如果是"我创建的合约"标签页，允许自动查询，否则不自动查询
                    const allowAutoQuery = contractType === 'created';
                    updateTokenListPage(tokenSearchInput.value.trim(), allowAutoQuery).catch(error => {
                        console.error('更新合约列表失败:', error);
                    });
                }
            });
        });

        // 清空列表按钮
        clearTokenListBtn.addEventListener('click', () => {
            // 清除代币合约缓存
            bscService.clearTransactionsCache(null, true);

            // 重置合约类型为"所有合约"
            currentContractType = 'all';
            contractTypeBtns.forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-type') === 'all') {
                    btn.classList.add('active');
                }
            });

            // 清空搜索框
            tokenSearchInput.value = '';

            // 更新合约列表页面（异步调用），不自动查询
            updateTokenListPage('', false).catch(error => {
                console.error('更新合约列表失败:', error);
            });
        });

        // 搜索按钮
        tokenSearchBtn.addEventListener('click', () => {
            const searchTerm = tokenSearchInput.value.trim();
            updateTokenListPage(searchTerm, false).catch(error => {
                console.error('更新合约列表失败:', error);
            });
        });

        // 搜索输入框回车事件
        tokenSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const searchTerm = tokenSearchInput.value.trim();
                updateTokenListPage(searchTerm, false).catch(error => {
                    console.error('更新合约列表失败:', error);
                });
            }
        });

        // 初始化合约列表页面（异步调用），不自动查询
        updateTokenListPage('', false).catch(error => {
            console.error('初始化合约列表失败:', error);
        });

        // 添加发现创建的合约事件监听器
        window.addEventListener('createdContractFound', async (event) => {
            const { contractAddress, contractInfo } = event.detail;
            console.log(`收到发现创建的合约事件: ${contractAddress}`);

            // 如果当前是"我创建的合约"标签页，实时更新列表
            if (currentContractType === 'created') {
                console.log(`当前是"我创建的合约"标签页，实时更新列表`);

                // 检查合约是否已经在列表中
                const existingItem = document.querySelector(`.token-list-item[data-address="${contractAddress.toLowerCase()}"]`);
                if (!existingItem) {
                    console.log(`合约 ${contractAddress} 不在列表中，添加到列表`);

                    // 如果是UNKNOWN合约，不添加到列表
                    if (contractInfo.symbol === 'UNKNOWN') {
                        console.log(`合约 ${contractAddress} 是UNKNOWN合约，不添加到列表`);
                        return;
                    }

                    // 如果列表为空，先清空"空列表"提示
                    if (tokenListEmpty.style.display !== 'none') {
                        tokenListEmpty.style.display = 'none';
                        tokenListGrid.style.display = 'grid';
                        tokenListGrid.innerHTML = '';
                    }

                    // 添加合约到列表
                    addContractToList(contractInfo);

                    console.log(`合约 ${contractAddress} 已添加到"我创建的合约"列表`);
                } else {
                    console.log(`合约 ${contractAddress} 已在列表中，无需添加`);
                }
            }
        });

        // 添加合约创建者更新事件监听器
        window.addEventListener('contractCreatorUpdated', async (event) => {
            const { contractAddress, creator, isCreatedByCurrentAddress } = event.detail;
            console.log(`收到合约创建者更新事件: ${contractAddress}, 创建者: ${creator}, 是否由当前地址创建: ${isCreatedByCurrentAddress}`);

            // 查找当前页面中的合约项
            const contractItems = document.querySelectorAll('.token-list-item');
            let found = false;

            // 遍历所有合约项，查找匹配的合约地址
            contractItems.forEach(item => {
                // 获取合约地址
                const addressElement = item.querySelector('.token-list-address');
                if (addressElement && addressElement.textContent.toLowerCase() === contractAddress.toLowerCase()) {
                    found = true;
                    console.log(`找到合约项: ${contractAddress}`);

                    // 更新创建者信息
                    const creatorContainer = item.querySelector('.token-list-creator-container');
                    if (creatorContainer) {
                        // 更新创建者信息
                        if (isCreatedByCurrentAddress) {
                            creatorContainer.innerHTML = `
                                <div class="token-list-address-label">创建者:</div>
                                <div class="token-list-creator">
                                    <span class="creator-badge">当前地址</span>
                                    <span class="creator-address">${creator}</span>
                                </div>
                            `;
                        } else {
                            creatorContainer.innerHTML = `
                                <div class="token-list-address-label">创建者:</div>
                                <div class="token-list-creator">
                                    <span class="creator-address">${creator}</span>
                                    <button class="token-action-btn copy-creator-btn" data-address="${creator}" title="复制创建者地址">复制</button>
                                </div>
                            `;

                            // 添加复制按钮事件
                            const copyBtn = creatorContainer.querySelector('.copy-creator-btn');
                            if (copyBtn) {
                                copyBtn.addEventListener('click', () => {
                                    const address = copyBtn.getAttribute('data-address');
                                    if (address) {
                                        // 复制到剪贴板
                                        navigator.clipboard.writeText(address)
                                            .then(() => {
                                                // 临时改变按钮文字
                                                const originalText = copyBtn.textContent;
                                                copyBtn.textContent = '已复制!';
                                                copyBtn.style.backgroundColor = '#d4edda';
                                                copyBtn.style.color = '#155724';

                                                // 2秒后恢复
                                                setTimeout(() => {
                                                    copyBtn.textContent = originalText;
                                                    copyBtn.style.backgroundColor = '';
                                                    copyBtn.style.color = '';
                                                }, 2000);
                                            })
                                            .catch(err => {
                                                console.error('复制失败:', err);
                                                alert('复制地址失败，请手动复制');
                                            });
                                    }
                                });
                            }
                        }
                    }

                    // 更新"标记为我创建的"按钮
                    const actionsContainer = item.querySelector('.token-list-actions');
                    if (actionsContainer) {
                        // 获取查看详情按钮
                        const viewDetailsBtn = actionsContainer.querySelector('.view-details-btn');
                        const viewDetailsBtnHtml = viewDetailsBtn ? viewDetailsBtn.outerHTML : '';

                        // 如果是由当前地址创建的，移除"标记为我创建的"按钮
                        if (isCreatedByCurrentAddress) {
                            actionsContainer.innerHTML = viewDetailsBtnHtml;
                        } else {
                            // 否则，添加"标记为我创建的"按钮
                            actionsContainer.innerHTML = `
                                ${viewDetailsBtnHtml}
                                <button class="token-action-btn mark-as-created-btn" data-address="${contractAddress}">标记为我创建的</button>
                            `;

                            // 添加"标记为我创建的"按钮事件
                            const markBtn = actionsContainer.querySelector('.mark-as-created-btn');
                            if (markBtn) {
                                markBtn.addEventListener('click', async () => {
                                    const addr = markBtn.getAttribute('data-address');
                                    if (addr) {
                                        try {
                                            // 调用 markContractAsCreatedByCurrentAddress 方法
                                            const result = bscService.markContractAsCreatedByCurrentAddress(addr);

                                            if (result) {
                                                // 临时改变按钮文字
                                                markBtn.textContent = '已标记!';
                                                markBtn.style.backgroundColor = '#d4edda';
                                                markBtn.style.color = '#155724';

                                                // 2秒后刷新合约列表
                                                setTimeout(() => {
                                                    // 刷新合约列表
                                                    updateTokenListPage().catch(error => {
                                                        console.error('更新合约列表失败:', error);
                                                    });
                                                }, 2000);
                                            } else {
                                                alert('标记失败，请确保已查询钱包地址');
                                            }
                                        } catch (error) {
                                            console.error('标记合约失败:', error);
                                            alert('标记合约失败: ' + error.message);
                                        }
                                    }
                                });
                            }
                        }
                    }
                }
            });

            // 如果没有找到合约项，可能需要刷新列表
            if (!found && currentContractType === 'all') {
                console.log(`未找到合约项: ${contractAddress}，尝试刷新列表`);
                // 如果当前是"所有合约"标签页，刷新列表
                updateTokenListPage('', false).catch(error => {
                    console.error('更新合约列表失败:', error);
                });
            }
        });

        // 添加发现创建的合约事件监听器（用于实时更新"我创建的合约"列表）
        window.addEventListener('createdContractFound', async (event) => {
            const { contractAddress, contractInfo } = event.detail;
            console.log(`收到发现创建的合约事件: ${contractAddress}`);

            // 只有在"我创建的合约"标签页时才处理
            if (currentContractType !== 'created') {
                console.log(`当前不在"我创建的合约"标签页，忽略事件`);
                return;
            }

            // 检查合约是否已经在列表中
            const existingContract = document.querySelector(`.token-list-item[data-address="${contractAddress.toLowerCase()}"]`);
            if (existingContract) {
                console.log(`合约 ${contractAddress} 已经在列表中，忽略事件`);
                return;
            }

            console.log(`将合约 ${contractAddress} 添加到"我创建的合约"列表中`);

            // 过滤掉名称为"Unknown Token"且符号为"UNKNOWN"的合约
            if (contractInfo.name === 'Unknown Token' && contractInfo.symbol === 'UNKNOWN') {
                console.log(`合约 ${contractAddress} 是 UNKNOWN 合约，不添加到列表中`);
                return;
            }

            // 创建合约项
            const contractItem = document.createElement('div');
            contractItem.className = 'token-list-item';
            contractItem.setAttribute('data-address', contractAddress.toLowerCase());

            contractItem.innerHTML = `
                <div class="token-list-symbol">${contractInfo.symbol}</div>
                <div class="token-list-name">${contractInfo.name}</div>
                <div class="token-list-address-container">
                    <div class="token-list-address-label">合约地址:</div>
                    <div class="token-list-address">${contractAddress}</div>
                    <button class="token-action-btn copy-address-btn" data-address="${contractAddress}" title="复制合约地址">复制</button>
                </div>
                <div class="token-list-creator-container">
                    <div class="token-list-address-label">创建者:</div>
                    <div class="token-list-creator">
                        <span class="creator-badge">当前地址</span>
                        <span class="creator-address">${contractInfo.creator}</span>
                    </div>
                </div>
                <div class="token-list-actions">
                    <button class="token-action-btn view-details-btn" data-address="${contractAddress}">查看合约详情</button>
                </div>
            `;

            // 添加到列表中
            const tokenListGrid = document.getElementById('tokenListGrid');
            if (tokenListGrid) {
                // 如果列表为空，先清除"暂无数据"提示
                const tokenListEmpty = document.getElementById('tokenListEmpty');
                if (tokenListEmpty) {
                    tokenListEmpty.style.display = 'none';
                }

                // 显示列表
                tokenListGrid.style.display = 'grid';

                // 添加到列表中
                tokenListGrid.appendChild(contractItem);

                // 添加事件监听器
                const viewDetailsBtn = contractItem.querySelector('.view-details-btn');
                if (viewDetailsBtn) {
                    viewDetailsBtn.addEventListener('click', () => {
                        const addr = viewDetailsBtn.getAttribute('data-address');
                        if (addr) {
                            // 切换到合约信息标签页
                            tabBtns.forEach(tabBtn => {
                                if (tabBtn.getAttribute('data-tab') === 'contracts') {
                                    tabBtn.click();
                                }
                            });

                            // 填充合约地址并触发查询
                            document.getElementById('contractAddress').value = addr;
                            document.getElementById('searchContractBtn').click();
                        }
                    });
                }

                // 添加复制按钮事件
                const copyBtn = contractItem.querySelector('.copy-address-btn');
                if (copyBtn) {
                    copyBtn.addEventListener('click', () => {
                        const addr = copyBtn.getAttribute('data-address');
                        if (addr) {
                            // 复制到剪贴板
                            navigator.clipboard.writeText(addr)
                                .then(() => {
                                    // 临时改变按钮文字
                                    const originalText = copyBtn.textContent;
                                    copyBtn.textContent = '已复制!';
                                    copyBtn.style.backgroundColor = '#d4edda';
                                    copyBtn.style.color = '#155724';

                                    // 2秒后恢复
                                    setTimeout(() => {
                                        copyBtn.textContent = originalText;
                                        copyBtn.style.backgroundColor = '';
                                        copyBtn.style.color = '';
                                    }, 2000);
                                })
                                .catch(err => {
                                    console.error('复制失败:', err);
                                    alert('复制地址失败，请手动复制');
                                });
                        }
                    });
                }
            }
        });

        // 代币销毁验证功能
        const burnTxHashInput = document.getElementById('burnTxHash');
        const checkBurnTxBtn = document.getElementById('checkBurnTx');
        const burnLoading = document.getElementById('burnLoading');
        const burnResults = document.getElementById('burnResults');
        const burnInfo = document.getElementById('burnInfo');
        const txQuerySection = document.getElementById('txQuerySection');

        // 隐藏加载中和结果
        burnLoading.style.display = 'none';
        burnResults.style.display = 'none';

        // 存储验证状态
        let burnVerificationPassed = false;
        let verifiedBurnTxHash = '';

        // 页面加载时检查验证状态
        async function checkVerificationStatus() {
            try {
                const status = await bscService.getVerificationStatus();
                if (status.verified) {
                    burnVerificationPassed = true;
                    verifiedBurnTxHash = status.txHash;

                    // 显示查询部分
                    txQuerySection.style.display = 'block';

                    // 显示验证结果容器
                    const verificationResultsContainer = document.getElementById('verificationResultsContainer');
                    if (verificationResultsContainer) {
                        verificationResultsContainer.style.display = 'block';

                        // 如果有交易哈希，显示简单的验证通过信息
                        if (status.txHash) {
                            burnInfo.innerHTML = `
                                <div class="burn-success">
                                    <h4>✅ 验证通过</h4>
                                    <div class="burn-info-grid">
                                        <div class="burn-info-row">
                                            <div class="burn-info-label">交易哈希:</div>
                                            <div class="burn-info-value">
                                                <a href="https://bscscan.com/tx/${status.txHash}" target="_blank" title="${status.txHash}">${status.txHash.substring(0, 20)}...${status.txHash.substring(status.txHash.length - 8)}</a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                            burnResults.style.display = 'block';
                        }
                    }

                    console.log('验证状态已恢复:', status);
                }
            } catch (error) {
                console.error('检查验证状态失败:', error);
            }
        }

        // 加载配置并根据配置决定是否显示代币销毁验证UI
        async function loadConfig() {
            try {
                console.log('加载配置...');
                const response = await fetch('/api/config');
                if (!response.ok) {
                    throw new Error(`HTTP错误: ${response.status}`);
                }

                const config = await response.json();
                console.log('配置加载成功:', config);

                // 根据配置决定是否显示代币销毁验证UI
                if (config.burnVerification && config.burnVerification.enabled === false) {
                    console.log('代币销毁验证功能已禁用，隐藏相关UI元素');

                    // 隐藏代币销毁验证部分
                    const burnVerification = document.querySelector('.burn-verification');
                    if (burnVerification) {
                        burnVerification.style.display = 'none';
                    }

                    // 直接显示查询部分
                    txQuerySection.style.display = 'block';

                    // 设置验证状态为已通过
                    burnVerificationPassed = true;
                } else {
                    console.log('代币销毁验证功能已启用，显示相关UI元素');

                    // 显示代币销毁验证部分
                    const burnVerification = document.querySelector('.burn-verification');
                    if (burnVerification) {
                        burnVerification.style.display = 'block';
                    }

                    // 页面加载时检查验证状态
                    checkVerificationStatus();
                }
            } catch (error) {
                console.error('加载配置失败:', error);
                console.log('使用默认配置，显示代币销毁验证UI');

                // 默认显示代币销毁验证部分
                const burnVerification = document.querySelector('.burn-verification');
                if (burnVerification) {
                    burnVerification.style.display = 'block';
                }

                // 页面加载时检查验证状态
                checkVerificationStatus();
            }
        }

        // 验证代币销毁按钮点击事件
        checkBurnTxBtn.addEventListener('click', async () => {
            const txHash = burnTxHashInput.value.trim();

            if (!txHash) {
                alert('请输入交易哈希');
                return;
            }

            try {
                // 重置验证状态
                burnVerificationPassed = false;
                txQuerySection.style.display = 'none';

                // 显示加载中
                burnLoading.style.display = 'block';
                burnResults.style.display = 'none';
                burnInfo.innerHTML = '';

                // 查询代币销毁信息
                const burnResult = await bscService.checkTokenBurn(txHash);

                // 隐藏加载中
                burnLoading.style.display = 'none';

                // 显示结果
                if (burnResult.found) {
                    // 检查是否是特定的代币合约和数量
                    if (burnResult.isValidBurn) {
                        // 验证通过
                        burnVerificationPassed = true;
                        verifiedBurnTxHash = txHash;

                        // 隐藏原始验证结果区域
                        burnResults.style.display = 'none';

                        // 显示单独的验证结果容器
                        const verificationResultsContainer = document.getElementById('verificationResultsContainer');
                        verificationResultsContainer.style.display = 'block';

                        burnInfo.innerHTML = `
                            <div class="burn-success">
                                <h4>✅ 验证通过</h4>
                                <div class="burn-info-grid">
                                    <div class="burn-info-row">
                                        <div class="burn-info-label">交易哈希:</div>
                                        <div class="burn-info-value">
                                            <a href="https://bscscan.com/tx/${txHash}" target="_blank" title="${txHash}">${txHash.substring(0, 20)}...${txHash.substring(txHash.length - 8)}</a>
                                        </div>
                                    </div>

                                    <div class="burn-info-row">
                                        <div class="burn-info-label">销毁数量:</div>
                                        <div class="burn-info-value">
                                            ${burnResult.amount} ${burnResult.symbol} <span class="verification-check">✓ 符合要求</span>
                                        </div>
                                    </div>

                                    <div class="burn-info-row">
                                        <div class="burn-info-label">代币名称:</div>
                                        <div class="burn-info-value">${burnResult.token.name}</div>
                                    </div>

                                    <div class="burn-info-row">
                                        <div class="burn-info-label">代币符号:</div>
                                        <div class="burn-info-value">${burnResult.symbol}</div>
                                    </div>

                                    <div class="burn-info-row">
                                        <div class="burn-info-label">代币合约:</div>
                                        <div class="burn-info-value">
                                            <a href="https://bscscan.com/token/${burnResult.token.address}" target="_blank" title="${burnResult.token.address}">${burnResult.token.address.substring(0, 10)}...${burnResult.token.address.substring(burnResult.token.address.length - 8)}</a>
                                            <span class="verification-check">✓ 符合要求</span>
                                        </div>
                                    </div>

                                    <div class="burn-info-row">
                                        <div class="burn-info-label">销毁者地址:</div>
                                        <div class="burn-info-value">
                                            <a href="https://bscscan.com/address/${burnResult.from}" target="_blank" title="${burnResult.from}">${burnResult.from.substring(0, 10)}...${burnResult.from.substring(burnResult.from.length - 8)}</a>
                                            <button id="useFromAddress" class="btn-sm">使用此地址</button>
                                        </div>
                                    </div>

                                    <div class="burn-info-row">
                                        <div class="burn-info-label">销毁地址:</div>
                                        <div class="burn-info-value">
                                            <a href="https://bscscan.com/address/${burnResult.burnAddress}" target="_blank" title="${burnResult.burnAddress}">${burnResult.burnAddress.substring(0, 10)}...${burnResult.burnAddress.substring(burnResult.burnAddress.length - 8)}</a>
                                            ${burnResult.burnAddress.toLowerCase() === '0x000000000000000000000000000000000000dead' ? ' (Dead 地址)' : ''}
                                        </div>
                                    </div>

                                    <div class="burn-info-row">
                                        <div class="burn-info-label">销毁方式:</div>
                                        <div class="burn-info-value">转账到 Dead 地址</div>
                                    </div>
                                </div>

                                <div class="verification-actions">
                                    <button id="proceedToQuery" class="btn">继续查询转账记录</button>
                                </div>
                            </div>
                        `;
                    } else {
                        // 找到销毁操作，但不是特定的代币或数量
                        burnVerificationPassed = false;

                        // 显示单独的验证结果容器
                        const verificationResultsContainer = document.getElementById('verificationResultsContainer');
                        verificationResultsContainer.style.display = 'block';

                        let errorMessage = '';
                        if (!burnResult.isTargetContract) {
                            errorMessage += `<p>销毁的代币合约地址不符合要求。要求地址为: 0xA49fA5E8106E2d6d6a69E78df9B6A20AaB9c4444</p>`;
                        }
                        if (!burnResult.isTargetAmount) {
                            errorMessage += `<p>销毁的代币数量不符合要求。要求数量必须精确为: 100（当前数量: ${burnResult.amount}）</p>`;
                        }

                        burnInfo.innerHTML = `
                            <div class="burn-warning">
                                <h4>⚠️ 验证未通过</h4>
                                <p>发现销毁操作，但不符合特定要求：</p>
                                ${errorMessage}
                                <div class="burn-info-grid">
                                    <div class="burn-info-row">
                                        <div class="burn-info-label">交易哈希:</div>
                                        <div class="burn-info-value">
                                            <a href="https://bscscan.com/tx/${txHash}" target="_blank" title="${txHash}">${txHash.substring(0, 20)}...${txHash.substring(txHash.length - 8)}</a>
                                        </div>
                                    </div>

                                    <div class="burn-info-row">
                                        <div class="burn-info-label">销毁数量:</div>
                                        <div class="burn-info-value">
                                            ${burnResult.amount} ${burnResult.symbol} ${burnResult.isTargetAmount ? '<span class="verification-check">✓</span>' : '<span class="verification-error">✗</span>'}
                                        </div>
                                    </div>

                                    <div class="burn-info-row">
                                        <div class="burn-info-label">代币合约:</div>
                                        <div class="burn-info-value">
                                            <a href="https://bscscan.com/token/${burnResult.token.address}" target="_blank" title="${burnResult.token.address}">${burnResult.token.address.substring(0, 10)}...${burnResult.token.address.substring(burnResult.token.address.length - 8)}</a>
                                            ${burnResult.isTargetContract ? '<span class="verification-check">✓</span>' : '<span class="verification-error">✗</span>'}
                                        </div>
                                    </div>
                                </div>
                                <p>请提供一个销毁了 0xA49fA5E8106E2d6d6a69E78df9B6A20AaB9c4444 代币，数量为 100 的交易哈希。</p>
                            </div>
                        `;
                    }

                    // 如果验证通过，添加按钮事件
                    if (burnVerificationPassed) {
                        // 添加"使用此地址"按钮事件
                        document.getElementById('useFromAddress').addEventListener('click', () => {
                            document.getElementById('address').value = burnResult.from;
                        });

                        // 添加"继续查询转账记录"按钮事件
                        document.getElementById('proceedToQuery').addEventListener('click', () => {
                            // 显示查询部分
                            txQuerySection.style.display = 'block';

                            // 自动填充销毁者地址
                            document.getElementById('address').value = burnResult.from;

                            // 滚动到查询部分
                            txQuerySection.scrollIntoView({ behavior: 'smooth' });
                        });
                    }
                } else {
                    // 显示单独的验证结果容器
                    const verificationResultsContainer = document.getElementById('verificationResultsContainer');
                    verificationResultsContainer.style.display = 'block';

                    burnInfo.innerHTML = `
                        <div class="burn-not-found">
                            <h4>❌ 验证失败</h4>
                            <div class="burn-info-grid">
                                <div class="burn-info-row">
                                    <div class="burn-info-label">交易哈希:</div>
                                    <div class="burn-info-value">
                                        <a href="https://bscscan.com/tx/${txHash}" target="_blank" title="${txHash}">${txHash.substring(0, 20)}...${txHash.substring(txHash.length - 8)}</a>
                                    </div>
                                </div>

                                <div class="burn-info-row">
                                    <div class="burn-info-label">问题:</div>
                                    <div class="burn-info-value">未找到代币销毁操作</div>
                                </div>
                            </div>

                            <p>可能的原因:</p>
                            <ul>
                                <li>这不是一个代币销毁交易</li>
                                <li>销毁方式不是转账到 Dead 地址 (0x000000000000000000000000000000000000dEaD)</li>
                                <li>交易失败或未确认</li>
                                <li>交易哈希不正确</li>
                            </ul>
                            <p>请提供一个销毁了 0xA49fA5E8106E2d6d6a69E78df9B6A20AaB9c4444 代币，数量必须精确为 100 的交易哈希。</p>
                        </div>
                    `;
                }

                // 显示结果
                burnResults.style.display = 'block';

            } catch (error) {
                // 隐藏加载中
                burnLoading.style.display = 'none';

                // 显示单独的验证结果容器
                const verificationResultsContainer = document.getElementById('verificationResultsContainer');
                verificationResultsContainer.style.display = 'block';

                // 显示错误信息
                burnInfo.innerHTML = `
                    <div class="burn-error">
                        <h4>❌ 验证失败</h4>
                        <div class="burn-info-grid">
                            <div class="burn-info-row">
                                <div class="burn-info-label">错误信息:</div>
                                <div class="burn-info-value">${error.message}</div>
                            </div>
                        </div>
                        <p>请确认交易哈希是否正确，并重试。</p>
                    </div>
                `;

                // 显示结果
                burnResults.style.display = 'block';
            }
        });

        // 进度更新定时器
        let progressUpdateTimer = null;

        // 启动进度更新定时器
        function startProgressUpdateTimer() {
            // 如果已经有定时器，先停止
            stopProgressUpdateTimer();

            // 启动新的定时器，每秒更新一次进度
            progressUpdateTimer = setInterval(() => {
                showContractCreatorsQueryProgress();
            }, 1000);
        }

        // 停止进度更新定时器
        function stopProgressUpdateTimer() {
            if (progressUpdateTimer) {
                clearInterval(progressUpdateTimer);
                progressUpdateTimer = null;
            }
        }

        // 这个函数已被移除，因为我们现在直接在点击"我创建的合约"标签时自动查询

        // 显示合约创建者查询进度
        function showContractCreatorsQueryProgress() {
            const progress = bscService.getContractCreatorsQueryProgress();

            if (progress.isQuerying) {
                // 计算进度百分比
                const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

                // 显示进度信息
                tokenListEmpty.innerHTML = `
                    <p>正在查询合约创建者信息，请稍候...</p>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${percent}%"></div>
                    </div>
                    <p>进度: ${progress.completed} / ${progress.total} (${percent}%)</p>
                    <p>已知创建者: ${progress.withCreator}</p>
                    <p class="progress-note">您可以切换到其他标签页，查询会在后台继续进行</p>
                `;

                // 添加样式
                if (!document.getElementById('progress-style')) {
                    const style = document.createElement('style');
                    style.id = 'progress-style';
                    style.textContent = `
                        .progress-container {
                            width: 100%;
                            height: 20px;
                            background-color: #f0f0f0;
                            border-radius: 10px;
                            margin: 10px 0;
                            overflow: hidden;
                        }
                        .progress-bar {
                            height: 100%;
                            background-color: #4CAF50;
                            width: 0%;
                            transition: width 0.3s ease;
                        }
                        .progress-note {
                            font-size: 0.9em;
                            color: #666;
                            margin-top: 15px;
                        }
                    `;
                    document.head.appendChild(style);
                }

                // 同时显示已找到的由当前地址创建的合约
                const createdContracts = bscService.createdContracts || {};
                const createdContractsArray = Object.values(createdContracts);

                // 过滤掉符号为"UNKNOWN"的合约
                const filteredCreatedContracts = createdContractsArray.filter(contract =>
                    contract.symbol !== 'UNKNOWN'
                );

                if (filteredCreatedContracts.length > 0) {
                    console.log(`在查询过程中显示已找到的 ${filteredCreatedContracts.length} 个由当前地址创建的合约`);

                    // 显示已找到的合约
                    tokenListEmpty.style.display = 'none';
                    tokenListGrid.style.display = 'grid';

                    // 清空列表
                    tokenListGrid.innerHTML = '';

                    // 显示已找到的合约
                    filteredCreatedContracts.forEach(contract => {
                        // 添加合约到列表
                        addContractToList(contract);
                    });

                    // 在列表底部添加进度信息
                    const progressItem = document.createElement('div');
                    progressItem.className = 'token-list-progress';
                    progressItem.style.gridColumn = '1 / -1';
                    progressItem.style.padding = '15px';
                    progressItem.style.backgroundColor = '#f8f9fa';
                    progressItem.style.borderRadius = '5px';
                    progressItem.style.margin = '10px 0';

                    progressItem.innerHTML = `
                        <p>正在继续查询更多合约创建者信息...</p>
                        <div class="progress-container">
                            <div class="progress-bar" style="width: ${percent}%"></div>
                        </div>
                        <p>进度: ${progress.completed} / ${progress.total} (${percent}%)</p>
                    `;

                    tokenListGrid.appendChild(progressItem);
                }
            } else {
                // 如果查询已完成，显示结果
                updateTokenListPage().catch(error => {
                    console.error('更新合约列表失败:', error);
                });
            }
        }

        // 辅助函数：添加合约到列表
        function addContractToList(contract) {
            const contractItem = document.createElement('div');
            contractItem.className = 'token-list-item';
            contractItem.setAttribute('data-address', contract.address.toLowerCase());

            // 检查是否由当前地址创建
            const isCreatedByCurrentAddress = contract.createdByCurrentAddress ||
                (contract.creator && currentAddress &&
                 contract.creator.toLowerCase() === currentAddress.toLowerCase());

            contractItem.innerHTML = `
                <div class="token-list-symbol">${contract.symbol}</div>
                <div class="token-list-name">${contract.name}</div>
                <div class="token-list-address-container">
                    <div class="token-list-address-label">合约地址:</div>
                    <div class="token-list-address">${contract.address}</div>
                    <button class="token-action-btn copy-address-btn" data-address="${contract.address}" title="复制合约地址">复制</button>
                </div>
                <div class="token-list-creator-container">
                    <div class="token-list-address-label">创建者:</div>
                    ${isCreatedByCurrentAddress ?
                        `<div class="token-list-creator">
                            <span class="creator-badge">当前地址</span>
                            <span class="creator-address">${contract.creator}</span>
                        </div>` :
                        contract.creator ?
                        `<div class="token-list-creator">
                            <span class="creator-address">${contract.creator}</span>
                            <button class="token-action-btn copy-creator-btn" data-address="${contract.creator}" title="复制创建者地址">复制</button>
                        </div>` :
                        `<div class="token-list-creator">
                            <span class="creator-unknown">查询详情后可显示</span>
                            <button class="token-action-btn query-details-btn" data-address="${contract.address}" title="查询合约详情">查询</button>
                        </div>`
                    }
                </div>
                <div class="token-list-actions">
                    <button class="token-action-btn view-details-btn" data-address="${contract.address}">查看合约详情</button>
                    ${!isCreatedByCurrentAddress ?
                        `<button class="token-action-btn mark-as-created-btn" data-address="${contract.address}">标记为我创建的</button>` :
                        ''}
                </div>
            `;

            tokenListGrid.appendChild(contractItem);

            // 添加事件监听器
            addContractItemEventListeners(contractItem);
        }

        // 辅助函数：为合约项添加事件监听器
        function addContractItemEventListeners(contractItem) {
            // 添加查看详情按钮事件
            const viewDetailsBtn = contractItem.querySelector('.view-details-btn');
            if (viewDetailsBtn) {
                viewDetailsBtn.addEventListener('click', () => {
                    const contractAddress = viewDetailsBtn.getAttribute('data-address');
                    if (contractAddress) {
                        // 切换到合约信息标签页
                        tabBtns.forEach(tabBtn => {
                            if (tabBtn.getAttribute('data-tab') === 'contracts') {
                                tabBtn.click();
                            }
                        });

                        // 填充合约地址并触发查询
                        contractAddressInput.value = contractAddress;
                        searchContractBtn.click();
                    }
                });
            }

            // 添加查询详情按钮事件
            const queryDetailsBtn = contractItem.querySelector('.query-details-btn');
            if (queryDetailsBtn) {
                queryDetailsBtn.addEventListener('click', () => {
                    const contractAddress = queryDetailsBtn.getAttribute('data-address');
                    if (contractAddress) {
                        // 切换到合约信息标签页
                        tabBtns.forEach(tabBtn => {
                            if (tabBtn.getAttribute('data-tab') === 'contracts') {
                                tabBtn.click();
                            }
                        });

                        // 填充合约地址并触发查询
                        contractAddressInput.value = contractAddress;
                        searchContractBtn.click();
                    }
                });
            }

            // 添加"查询详情后可显示"文本点击事件
            const creatorUnknown = contractItem.querySelector('.creator-unknown');
            if (creatorUnknown) {
                creatorUnknown.addEventListener('click', () => {
                    // 找到查询按钮并触发点击
                    const queryBtn = contractItem.querySelector('.query-details-btn');
                    if (queryBtn) {
                        queryBtn.click();
                    }
                });
            }

            // 添加"标记为我创建的"按钮事件
            const markAsCreatedBtn = contractItem.querySelector('.mark-as-created-btn');
            if (markAsCreatedBtn) {
                markAsCreatedBtn.addEventListener('click', async () => {
                    const contractAddress = markAsCreatedBtn.getAttribute('data-address');
                    if (contractAddress) {
                        try {
                            // 调用 markContractAsCreatedByCurrentAddress 方法
                            const result = bscService.markContractAsCreatedByCurrentAddress(contractAddress);

                            if (result) {
                                // 临时改变按钮文字
                                markAsCreatedBtn.textContent = '已标记!';
                                markAsCreatedBtn.style.backgroundColor = '#d4edda';
                                markAsCreatedBtn.style.color = '#155724';

                                // 2秒后刷新合约列表
                                setTimeout(() => {
                                    // 刷新合约列表，不自动查询
                                    updateTokenListPage('', false).catch(error => {
                                        console.error('更新合约列表失败:', error);
                                    });
                                }, 2000);
                            } else {
                                alert('标记失败，请确保已查询钱包地址');
                            }
                        } catch (error) {
                            console.error('标记合约失败:', error);
                            alert('标记合约失败: ' + error.message);
                        }
                    }
                });
            }

            // 添加复制地址按钮事件
            const copyAddressBtn = contractItem.querySelector('.copy-address-btn');
            if (copyAddressBtn) {
                copyAddressBtn.addEventListener('click', () => {
                    const address = copyAddressBtn.getAttribute('data-address');
                    if (address) {
                        // 复制到剪贴板
                        navigator.clipboard.writeText(address)
                            .then(() => {
                                // 临时改变按钮文字
                                const originalText = copyAddressBtn.textContent;
                                copyAddressBtn.textContent = '已复制!';
                                copyAddressBtn.style.backgroundColor = '#d4edda';
                                copyAddressBtn.style.color = '#155724';

                                // 2秒后恢复
                                setTimeout(() => {
                                    copyAddressBtn.textContent = originalText;
                                    copyAddressBtn.style.backgroundColor = '';
                                    copyAddressBtn.style.color = '';
                                }, 2000);
                            })
                            .catch(err => {
                                console.error('复制失败:', err);
                                alert('复制地址失败，请手动复制');
                            });
                    }
                });
            }

            // 添加复制创建者地址按钮事件
            const copyCreatorBtn = contractItem.querySelector('.copy-creator-btn');
            if (copyCreatorBtn) {
                copyCreatorBtn.addEventListener('click', () => {
                    const address = copyCreatorBtn.getAttribute('data-address');
                    if (address) {
                        // 复制到剪贴板
                        navigator.clipboard.writeText(address)
                            .then(() => {
                                // 临时改变按钮文字
                                const originalText = copyCreatorBtn.textContent;
                                copyCreatorBtn.textContent = '已复制!';
                                copyCreatorBtn.style.backgroundColor = '#d4edda';
                                copyCreatorBtn.style.color = '#155724';

                                // 2秒后恢复
                                setTimeout(() => {
                                    copyCreatorBtn.textContent = originalText;
                                    copyCreatorBtn.style.backgroundColor = '';
                                    copyCreatorBtn.style.color = '';
                                }, 2000);
                            })
                            .catch(err => {
                                console.error('复制失败:', err);
                                alert('复制地址失败，请手动复制');
                            });
                    }
                });
            }
        }

        console.log('应用初始化完成');

    } catch (error) {
        console.error('应用初始化失败:', error);
        alert('应用初始化失败: ' + error.message);
    }
}
