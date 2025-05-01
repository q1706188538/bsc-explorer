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

        // 尝试手动加载ethers
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js';
        script.type = 'text/javascript';
        script.onload = function() {
            console.log('手动加载ethers成功，版本:', window.ethers ? window.ethers.version : '未知');
            initApp();
        };
        script.onerror = function() {
            console.error('手动加载ethers失败');
            alert('ethers库加载失败，请检查网络连接并刷新页面');
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
        // 初始化BSC服务
        console.log('初始化BscService...');
        const bscService = new BscService();

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
        const pageStart = document.getElementById('pageStart');
        const pageEnd = document.getElementById('pageEnd');
        const totalRecords = document.getElementById('totalRecords');
        const currentPage = document.getElementById('currentPage');
        const totalPages = document.getElementById('totalPages');
        const firstPageBtn = document.getElementById('firstPage');
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');
        const lastPageBtn = document.getElementById('lastPage');

        // 当前查询的地址、页码、交易类型和币种
        let currentAddress = '';
        let currentPageNum = 1;
        let currentTxType = 'all'; // 'all', 'in', 'out'
        let selectedTokens = []; // 存储多个选中的币种
        const pageSize = 50;

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

            const { transactions, pagination } = result;

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

            // 清空当前筛选交易中包含的合约
            filteredTransactionContracts = {};

            // 收集筛选后的交易中包含的合约
            filteredTransactions.forEach(tx => {
                // 检查发送方和接收方是否是代币合约
                if (bscService.isTokenContract(tx.from)) {
                    const contractInfo = bscService.getTokenContractInfo(tx.from);
                    if (contractInfo) {
                        filteredTransactionContracts[tx.from.toLowerCase()] = contractInfo;
                    }
                }

                if (bscService.isTokenContract(tx.to)) {
                    const contractInfo = bscService.getTokenContractInfo(tx.to);
                    if (contractInfo) {
                        filteredTransactionContracts[tx.to.toLowerCase()] = contractInfo;
                    }
                }

                // 如果是代币交易，也添加代币合约
                if (tx.type === 'Token' && tx.contractAddress) {
                    const contractInfo = bscService.getTokenContractInfo(tx.contractAddress);
                    if (contractInfo) {
                        filteredTransactionContracts[tx.contractAddress.toLowerCase()] = contractInfo;
                    }
                }
            });

            // 如果没有交易记录
            if (filteredTransactions.length === 0) {
                txTableBody.innerHTML = `<tr><td colspan="7">没有找到${currentTxType === 'in' ? '转入' : currentTxType === 'out' ? '转出' : ''}交易记录</td></tr>`;
                txPagination.style.display = 'none';
                return;
            }

            // 显示交易记录
            filteredTransactions.forEach(tx => {
                const row = document.createElement('tr');

                // 根据交易方向设置样式
                const directionLabel = tx.direction === 'in' ?
                    '<span class="tx-type-label tx-type-in">转入</span>' :
                    '<span class="tx-type-label tx-type-out">转出</span>';

                // 检查发送方和接收方是否是代币合约
                const isFromContract = bscService.isTokenContract(tx.from);
                const isToContract = bscService.isTokenContract(tx.to);

                // 为代币合约地址添加标识
                const fromLabel = isFromContract ?
                    `<span class="contract-badge" title="${tx.tokenName || '代币合约'}">${tx.from.substring(0, 8)}...</span>` :
                    `${tx.from.substring(0, 8)}...`;

                const toLabel = isToContract ?
                    `<span class="contract-badge" title="${tx.tokenName || '代币合约'}">${tx.to.substring(0, 8)}...</span>` :
                    `${tx.to.substring(0, 8)}...`;

                // 如果是代币交易，添加代币信息
                let valueDisplay = tx.value;
                let tokenSymbol = 'BNB'; // 默认为BNB

                // 从交易值中提取代币符号
                const valueMatch = tx.value.match(/([0-9.]+)\s+([A-Za-z0-9]+)$/);
                if (valueMatch && valueMatch[2]) {
                    tokenSymbol = valueMatch[2];
                }

                if (tx.type === 'Token' && tx.contractAddress) {
                    const tokenInfo = bscService.getTokenContractInfo(tx.contractAddress);
                    if (tokenInfo) {
                        valueDisplay = `${tx.value} <span class="token-info" title="${tokenInfo.name}">(${tokenInfo.symbol})</span>`;
                    }
                }

                // 创建代币标签
                const tokenLabel = `<span class="token-symbol-label" data-token="${tokenSymbol}">${tokenSymbol}</span>`;

                // 检查是否是当前筛选的币种（支持多选）
                const isHighlighted = selectedTokens.length > 0 && selectedTokens.includes(tokenSymbol);

                row.innerHTML = `
                    <td>
                        <a href="https://bscscan.com/tx/${tx.hash}" class="tx-link" target="_blank">
                            ${tx.hash.substring(0, 10)}...
                        </a>
                    </td>
                    <td>${tx.blockNumber}</td>
                    <td>${bscService.formatTimestamp(tx.timeStamp)}</td>
                    <td>
                        <a href="https://bscscan.com/address/${tx.from}" class="address-link" target="_blank">
                            ${fromLabel}
                        </a>
                        ${isFromContract ?
                            `<button class="view-contract-btn" data-address="${tx.from}" title="查看合约详情">📄</button>` : ''}
                    </td>
                    <td>
                        <a href="https://bscscan.com/address/${tx.to}" class="address-link" target="_blank">
                            ${toLabel}
                        </a>
                        ${isToContract ?
                            `<button class="view-contract-btn" data-address="${tx.to}" title="查看合约详情">📄</button>` : ''}
                    </td>
                    <td>
                        ${valueDisplay}
                        <span class="token-symbol-label ${isHighlighted ? 'highlighted' : ''}" data-token="${tokenSymbol}">${tokenSymbol}</span>
                    </td>
                    <td>${directionLabel}</td>
                `;

                // 如果是当前筛选的币种，添加高亮样式
                if (isHighlighted) {
                    row.classList.add('highlighted-row');
                }

                txTableBody.appendChild(row);
            });

            // 更新分页信息
            currentPageNum = pagination.currentPage;

            // 计算过滤后的总记录数
            const totalFilteredRecords = currentTxType === 'all' ?
                pagination.totalRecords :
                result.transactions.filter(tx => tx.direction === currentTxType).length;

            const startRecord = filteredTransactions.length > 0 ?
                (pagination.currentPage - 1) * pagination.pageSize + 1 : 0;
            const endRecord = Math.min(startRecord + filteredTransactions.length - 1, totalFilteredRecords);

            pageStart.textContent = startRecord;
            pageEnd.textContent = endRecord;
            totalRecords.textContent = totalFilteredRecords;

            // 计算过滤后的总页数
            const totalFilteredPages = Math.ceil(totalFilteredRecords / pagination.pageSize);

            currentPage.textContent = pagination.currentPage;
            totalPages.textContent = totalFilteredPages;

            // 更新按钮状态
            firstPageBtn.disabled = !pagination.hasPreviousPage;
            prevPageBtn.disabled = !pagination.hasPreviousPage;
            nextPageBtn.disabled = !pagination.hasNextPage;
            lastPageBtn.disabled = !pagination.hasNextPage;

            // 显示分页控件
            txPagination.style.display = filteredTransactions.length > 0 ? 'flex' : 'none';

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

                // 更新合约列表页面
                updateTokenListPage();

                // 自动开始查询合约创建者信息（在后台进行，不阻塞界面）
                startContractCreatorsQuery();

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
            const cachedResult = bscService.getCachedTransactions(currentAddress, currentPageNum, pageSize);
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
            const cachedResult = bscService.getCachedTransactions(currentAddress, currentPageNum, pageSize);
            if (cachedResult) {
                console.log('应用筛选:', selectedTokens, '当前页:', currentPageNum);

                // 强制重新渲染交易记录，确保筛选生效
                displayTransactions({
                    transactions: cachedResult.transactions,
                    pagination: cachedResult.pagination
                });

                // 如果当前在"交易相关合约"标签页，更新合约列表
                if (currentContractType === 'filtered') {
                    updateTokenListPage();
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

            // 同时更新合约列表页面
            updateTokenListPage();
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
        async function updateTokenListPage(searchTerm = '') {
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
                // 获取代币合约列表
                const tokenContracts = bscService.getTokenContracts();
                let contractsArray = Object.values(tokenContracts);

                // 根据当前选择的类型过滤合约
                if (currentContractType === 'created') {
                    // 获取由当前地址创建的合约（使用异步方法）
                    const createdContracts = await bscService.getCreatedContracts();
                    contractsArray = Object.values(createdContracts);
                } else if (currentContractType === 'filtered') {
                    // 获取当前筛选交易中包含的合约
                    contractsArray = Object.values(filteredTransactionContracts);
                }


                // 如果有搜索词，过滤合约
                let filteredContracts = contractsArray;
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    filteredContracts = contractsArray.filter(contract =>
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

                // 清空列表
                tokenListGrid.innerHTML = '';

                // 显示代币合约
                filteredContracts.forEach(contract => {
                    const contractItem = document.createElement('div');
                    contractItem.className = 'token-list-item';

                    // 检查是否由当前地址创建
                    const isCreatedByCurrentAddress = contract.createdByCurrentAddress;

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

            // 保存当前地址
            currentAddress = address;

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

        // 分页按钮事件
        firstPageBtn.addEventListener('click', () => {
            if (currentAddress) {
                loadTransactionsPage(currentAddress, 1);
            }
        });

        prevPageBtn.addEventListener('click', () => {
            if (currentAddress && currentPageNum > 1) {
                loadTransactionsPage(currentAddress, currentPageNum - 1);
            }
        });

        nextPageBtn.addEventListener('click', () => {
            if (currentAddress) {
                loadTransactionsPage(currentAddress, currentPageNum + 1);
            }
        });

        lastPageBtn.addEventListener('click', () => {
            if (currentAddress) {
                const lastPage = parseInt(totalPages.textContent);
                if (lastPage > 0) {
                    loadTransactionsPage(currentAddress, lastPage);
                }
            }
        });

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

                // 获取合约信息（传递当前查询的钱包地址，用于标记由该地址创建的合约）
                const contract = await bscService.getContractInfo(contractAddress, currentAddress);

                // 查询完成后，更新合约列表（如果存在）
                updateTokenListPage();

                // 隐藏加载中
                contractLoading.style.display = 'none';

                // 显示合约信息
                let infoHtml = `
                    <p><strong>合约地址:</strong>
                        <a href="https://bscscan.com/address/${contract.address}" target="_blank">${contract.address}</a>
                    </p>
                    <p><strong>BNB余额:</strong> ${contract.balance}</p>
                    <p><strong>字节码大小:</strong> ${contract.bytecodeSize} 字节</p>
                    <p><strong>创建者:</strong>
                        <a href="https://bscscan.com/address/${contract.creator}" target="_blank">${contract.creator}</a>
                    </p>
                    <p><strong>创建交易:</strong>
                        <a href="https://bscscan.com/tx/${contract.creationTx}" target="_blank">${contract.creationTx}</a>
                    </p>
                    <p><strong>已验证源代码:</strong> ${contract.hasVerifiedSource ? '是' : '否'}</p>
                `;

                // 如果有ABI消息，显示它
                if (contract.abiMessage) {
                    infoHtml += `<p><strong>ABI信息:</strong> ${contract.abiMessage}</p>`;
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
                        <p><strong>名称:</strong> ${contract.tokenInfo.name}</p>
                        <p><strong>符号:</strong> ${contract.tokenInfo.symbol}</p>
                        <p><strong>小数位:</strong> ${contract.tokenInfo.decimals}</p>
                        <p><strong>总供应量:</strong> ${contract.tokenInfo.totalSupply} ${contract.tokenInfo.symbol}</p>
                    `;
                }

                contractInfo.innerHTML = infoHtml;
                contractResults.style.display = 'block';
            } catch (error) {
                contractLoading.style.display = 'none';
                alert('获取合约信息失败: ' + error.message);
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
                            // 否则，开始新的查询
                            console.log('开始查询所有合约创建者信息...');

                            // 启动进度更新定时器
                            startProgressUpdateTimer();

                            // 查询所有合约创建者信息
                            await bscService.queryAllContractCreators();

                            // 停止进度更新定时器
                            stopProgressUpdateTimer();

                            console.log('所有合约创建者信息查询完成');
                        }
                    } catch (error) {
                        console.error('查询合约创建者信息失败:', error);
                        // 停止进度更新定时器
                        stopProgressUpdateTimer();
                    }
                }

                // 更新合约列表（异步调用）
                updateTokenListPage(tokenSearchInput.value.trim()).catch(error => {
                    console.error('更新合约列表失败:', error);
                });
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

            // 更新合约列表页面（异步调用）
            updateTokenListPage().catch(error => {
                console.error('更新合约列表失败:', error);
            });
        });

        // 搜索按钮
        tokenSearchBtn.addEventListener('click', () => {
            const searchTerm = tokenSearchInput.value.trim();
            updateTokenListPage(searchTerm).catch(error => {
                console.error('更新合约列表失败:', error);
            });
        });

        // 搜索输入框回车事件
        tokenSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const searchTerm = tokenSearchInput.value.trim();
                updateTokenListPage(searchTerm).catch(error => {
                    console.error('更新合约列表失败:', error);
                });
            }
        });

        // 初始化合约列表页面（异步调用）
        updateTokenListPage().catch(error => {
            console.error('初始化合约列表失败:', error);
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

        // 开始查询合约创建者信息
        function startContractCreatorsQuery() {
            // 获取当前查询进度
            const progress = bscService.getContractCreatorsQueryProgress();

            // 如果已经在查询中，不重复查询
            if (progress.isQuerying) {
                console.log('合约创建者信息查询已在进行中，不重复查询');
                return;
            }

            console.log('自动开始查询合约创建者信息...');

            // 查询所有合约创建者信息（不等待结果，在后台进行）
            bscService.queryAllContractCreators().then(() => {
                console.log('所有合约创建者信息查询完成');

                // 如果当前在"我创建的合约"标签页，更新列表
                if (currentContractType === 'created') {
                    updateTokenListPage().catch(error => {
                        console.error('更新合约列表失败:', error);
                    });
                }
            }).catch(error => {
                console.error('查询合约创建者信息失败:', error);
            });
        }

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
            } else {
                // 如果查询已完成，显示结果
                updateTokenListPage().catch(error => {
                    console.error('更新合约列表失败:', error);
                });
            }
        }

        console.log('应用初始化完成');

    } catch (error) {
        console.error('应用初始化失败:', error);
        alert('应用初始化失败: ' + error.message);
    }
}
