// 分页功能处理

// 初始化全局事件处理函数
window.firstPageHandler = () => {};
window.prevPageHandler = () => {};
window.nextPageHandler = () => {};
window.lastPageHandler = () => {};

// 格式化时间戳为可读的日期时间
function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';
    
    // 将时间戳转换为毫秒
    const date = new Date(timestamp * 1000);
    
    // 格式化日期和时间
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

// 当文档加载完成后初始化分页功能
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM内容已加载，初始化分页功能...');
    
    // 确保分页控件存在
    ensurePaginationElementsExist();
    
    // 获取分页相关元素
    const pageSizeSelector = document.getElementById('pageSizeSelector');
    const applyPageSizeBtn = document.getElementById('applyPageSize');
    
    console.log('分页元素:', {
        pageSizeSelector,
        applyPageSizeBtn
    });
    
    // 如果找到页面大小选择器，添加事件监听器
    if (pageSizeSelector) {
        // 当选择器值变化时，不立即应用，等待用户点击"应用"按钮
        pageSizeSelector.addEventListener('change', function() {
            // 高亮"应用"按钮，提示用户需要点击
            if (applyPageSizeBtn) {
                applyPageSizeBtn.style.backgroundColor = '#4CAF50';
                applyPageSizeBtn.style.color = 'white';
                applyPageSizeBtn.style.fontWeight = 'bold';
            }
        });
    } else {
        console.warn('找不到页面大小选择器');
    }
    
    // 如果找到"应用"按钮，添加事件监听器
    if (applyPageSizeBtn) {
        applyPageSizeBtn.addEventListener('click', function() {
            handlePageSizeChange();
            // 恢复按钮样式
            this.style.backgroundColor = '';
            this.style.color = '';
            this.style.fontWeight = '';
        });
    } else {
        console.warn('找不到应用按钮');
    }
    
    // 初始化分页按钮事件
    initPaginationButtonHandlers();
});

// 初始化分页按钮事件处理函数
function initPaginationButtonHandlers() {
    const firstPageBtn = document.getElementById('firstPage');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const lastPageBtn = document.getElementById('lastPage');
    
    if (firstPageBtn && prevPageBtn && nextPageBtn && lastPageBtn) {
        console.log('初始化分页按钮事件');
        
        // 创建事件处理函数
        window.firstPageHandler = () => window.navigateToPage(1);
        window.prevPageHandler = () => window.navigateToPage(Math.max(1, (window.currentPageNum || 1) - 1));
        window.nextPageHandler = () => {
            const currentPage = window.currentPageNum || 1;
            const totalPages = Math.ceil((window.currentTransactions || []).length / (window.currentPageSize || 10));
            window.navigateToPage(Math.min(totalPages, currentPage + 1));
        };
        window.lastPageHandler = () => {
            const totalPages = Math.ceil((window.currentTransactions || []).length / (window.currentPageSize || 10));
            window.navigateToPage(totalPages);
        };
        
        // 添加事件监听器
        firstPageBtn.addEventListener('click', window.firstPageHandler);
        prevPageBtn.addEventListener('click', window.prevPageHandler);
        nextPageBtn.addEventListener('click', window.nextPageHandler);
        lastPageBtn.addEventListener('click', window.lastPageHandler);
    } else {
        console.warn('找不到部分或全部分页按钮');
    }
}

// 确保分页控件存在
function ensurePaginationElementsExist() {
    console.log('检查分页控件是否存在...');
    
    // 检查分页容器是否存在
    let txPagination = document.getElementById('txPagination');
    if (!txPagination) {
        console.warn('分页容器不存在，创建分页容器');
        
        // 创建分页容器
        txPagination = document.createElement('div');
        txPagination.id = 'txPagination';
        txPagination.className = 'pagination';
        
        // 添加到表格后面
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.appendChild(txPagination);
        } else {
            console.error('找不到表格容器，无法创建分页控件');
            return;
        }
    }
    
    // 检查分页信息是否存在
    if (!document.getElementById('pageStart') || !document.getElementById('pageEnd') || !document.getElementById('totalRecords')) {
        console.warn('分页信息不存在，创建分页信息');
        
        // 创建分页信息
        const paginationInfo = document.createElement('div');
        paginationInfo.className = 'pagination-info';
        paginationInfo.innerHTML = `
            显示 <span id="pageStart">0</span> - <span id="pageEnd">0</span> 条，共 <span id="totalRecords">0</span> 条记录
        `;
        
        // 添加到分页容器
        txPagination.appendChild(paginationInfo);
    }
    
    // 检查分页控件是否存在
    if (!document.getElementById('firstPage') || !document.getElementById('prevPage') || 
        !document.getElementById('nextPage') || !document.getElementById('lastPage') || 
        !document.getElementById('currentPage') || !document.getElementById('totalPages')) {
        console.warn('分页控件不存在，创建分页控件');
        
        // 创建分页控件
        const paginationControls = document.createElement('div');
        paginationControls.className = 'pagination-controls';
        paginationControls.innerHTML = `
            <button id="firstPage" class="pagination-btn" title="跳转到第一页">&laquo; 首页</button>
            <button id="prevPage" class="pagination-btn" title="跳转到上一页">&lsaquo; 上一页</button>
            <span class="page-indicator">第 <span id="currentPage">0</span> / <span id="totalPages">0</span> 页</span>
            <button id="nextPage" class="pagination-btn" title="跳转到下一页">下一页 &rsaquo;</button>
            <button id="lastPage" class="pagination-btn" title="跳转到最后一页">末页 &raquo;</button>
        `;
        
        // 添加到分页容器
        txPagination.appendChild(paginationControls);
    }
    
    // 检查页面大小选择器是否存在
    if (!document.getElementById('pageSizeSelector') || !document.getElementById('applyPageSize')) {
        console.warn('页面大小选择器不存在，创建页面大小选择器');
        
        // 创建页面大小选择器
        const pageSizeSelector = document.createElement('div');
        pageSizeSelector.className = 'page-size-selector';
        pageSizeSelector.innerHTML = `
            每页显示:
            <select id="pageSizeSelector">
                <option value="10" selected>10条</option>
                <option value="20">20条</option>
                <option value="50">50条</option>
                <option value="100">100条</option>
                <option value="200">200条</option>
                <option value="500">500条</option>
                <option value="1000">1000条</option>
                <option value="5000">全部</option>
            </select>
            <button id="applyPageSize" class="btn btn-small" title="应用选择的页面大小">应用</button>
        `;
        
        // 添加到分页容器
        txPagination.appendChild(pageSizeSelector);
    }
    
    console.log('分页控件检查完成');
}

// 处理页面大小变化
function handlePageSizeChange() {
    const pageSizeSelector = document.getElementById('pageSizeSelector');
    const selectedPageSize = parseInt(pageSizeSelector.value);
    
    console.log(`页面大小变化: ${selectedPageSize}`);
    
    // 获取当前显示的所有交易记录
    const allTransactions = window.currentTransactions || [];
    
    // 即使没有交易记录，也更新页面大小设置
    if (!allTransactions || !allTransactions.length) {
        console.log('没有交易记录，但仍然更新页面大小设置');
        // 更新当前页面大小
        window.currentPageSize = selectedPageSize;
        return;
    }
    
    // 更新当前页面大小
    window.currentPageSize = selectedPageSize;
    
    // 重置当前页码为1
    window.currentPageNum = 1;
    
    console.log(`更新页面大小为 ${selectedPageSize}，重置页码为 1，总记录数: ${allTransactions.length}`);
    
    // 重新显示交易记录
    if (typeof window.displayPaginatedTransactions === 'function') {
        window.displayPaginatedTransactions();
    } else {
        console.error('displayPaginatedTransactions 函数不可用');
    }
}

// 显示分页后的交易记录
window.displayPaginatedTransactions = function displayPaginatedTransactions() {
    try {
        console.log('开始执行 displayPaginatedTransactions 函数');

        // 获取必要的元素和数据
        let txTableBody = document.getElementById('txTableBody');
        console.log('txTableBody:', txTableBody);

        // 如果表格主体不存在，尝试等待一段时间后再次获取
        if (!txTableBody) {
            console.warn('txTableBody 不存在，无法显示交易记录');
            return; // 如果表格主体不存在，直接返回，不继续执行
        }

        // 获取分页信息元素
        let pageStart = document.getElementById('pageStart');
        console.log('pageStart:', pageStart);

        let pageEnd = document.getElementById('pageEnd');
        console.log('pageEnd:', pageEnd);

        let totalRecords = document.getElementById('totalRecords');
        console.log('totalRecords:', totalRecords);

        let currentPage = document.getElementById('currentPage');
        console.log('currentPage:', currentPage);

        let totalPages = document.getElementById('totalPages');
        console.log('totalPages:', totalPages);

        // 获取分页按钮元素
        let firstPageBtn = document.getElementById('firstPage');
        console.log('firstPageBtn:', firstPageBtn);

        let prevPageBtn = document.getElementById('prevPage');
        console.log('prevPageBtn:', prevPageBtn);

        let nextPageBtn = document.getElementById('nextPage');
        console.log('nextPageBtn:', nextPageBtn);

        let lastPageBtn = document.getElementById('lastPage');
        console.log('lastPageBtn:', lastPageBtn);

        // 检查是否所有分页元素都存在
        const allPaginationElementsExist = pageStart && pageEnd && totalRecords &&
                                          currentPage && totalPages &&
                                          firstPageBtn && prevPageBtn &&
                                          nextPageBtn && lastPageBtn;

        if (!allPaginationElementsExist) {
            console.warn('部分分页元素不存在，无法完全初始化分页功能');
            // 继续执行，但不使用不存在的元素
        }

        // 获取当前的交易记录、页码和页面大小
        const allTransactions = window.currentTransactions || [];
        const pageNum = window.currentPageNum || 1;
        const pageSize = window.currentPageSize || 10;

        console.log('当前交易记录:', allTransactions.length, '条');
        console.log('当前页码:', pageNum);
        console.log('每页显示:', pageSize, '条');

        // 如果没有交易记录，显示提示信息
        if (!allTransactions || !allTransactions.length) {
            txTableBody.innerHTML = '<tr><td colspan="7">没有找到交易记录</td></tr>';

            // 隐藏分页控件
            const txPagination = document.getElementById('txPagination');
            if (txPagination) {
                txPagination.style.display = 'none';
            }

            // 更新分页信息为0
            if (pageStart) pageStart.textContent = '0';
            if (pageEnd) pageEnd.textContent = '0';
            if (totalRecords) totalRecords.textContent = '0';
            if (currentPage) currentPage.textContent = '0';
            if (totalPages) totalPages.textContent = '0';

            // 禁用所有分页按钮
            if (firstPageBtn) firstPageBtn.disabled = true;
            if (prevPageBtn) prevPageBtn.disabled = true;
            if (nextPageBtn) nextPageBtn.disabled = true;
            if (lastPageBtn) lastPageBtn.disabled = true;

            return;
        }

        // 显示分页控件
        const txPagination = document.getElementById('txPagination');
        if (txPagination) {
            txPagination.style.display = 'flex';
        }

        // 计算总页数
        const totalFilteredRecords = allTransactions.length;
        const totalFilteredPages = Math.ceil(totalFilteredRecords / pageSize);

        // 计算当前页的起始和结束索引
        const startIndex = (pageNum - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, totalFilteredRecords);

        // 获取当前页的交易记录
        const currentPageTransactions = allTransactions.slice(startIndex, endIndex);

        // 输出调试信息
        console.log(`分页功能: 总记录数=${totalFilteredRecords}, 每页显示=${pageSize}, 当前页=${pageNum}, 总页数=${totalFilteredPages}`);
        console.log(`分页功能: 显示记录 ${startIndex+1} 到 ${endIndex}, 当前页记录数=${currentPageTransactions.length}`);

        // 清空表格
        txTableBody.innerHTML = '';

        // 显示当前页的交易记录
        currentPageTransactions.forEach(tx => {
            // 这里使用与原始代码相同的逻辑来创建表格行
            // 注意：这部分代码需要与原始的displayTransactions函数中的代码保持一致
            const row = document.createElement('tr');

            // 根据交易方向设置样式
            const directionLabel = tx.direction === 'in' ?
                '<span class="tx-type-label tx-type-in">转入</span>' :
                '<span class="tx-type-label tx-type-out">转出</span>';

            // 获取服务实例 (bscService 或 apiService)
            const service = window.bscService || window.apiService;

            // 检查发送方和接收方是否是代币合约
            let isFromContract = false;
            let isToContract = false;

            if (service && typeof service.isTokenContract === 'function') {
                isFromContract = service.isTokenContract(tx.from);
                isToContract = service.isTokenContract(tx.to);
            }

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
                // 获取服务实例 (bscService 或 apiService)
                const service = window.bscService || window.apiService;

                if (service && typeof service.getTokenContractInfo === 'function') {
                    const tokenInfo = service.getTokenContractInfo(tx.contractAddress);
                    if (tokenInfo) {
                        valueDisplay = `${tx.value} <span class="token-info" title="${tokenInfo.name}">(${tokenInfo.symbol})</span>`;
                    }
                }
            }

            // 检查是否是当前筛选的币种
            const isHighlighted = window.selectedTokens && window.selectedTokens.length > 0 &&
                                 window.selectedTokens.includes(tokenSymbol);

            row.innerHTML = `
                <td>
                    <a href="https://bscscan.com/tx/${tx.hash}" class="tx-link" target="_blank">
                        ${tx.hash.substring(0, 10)}...
                    </a>
                </td>
                <td>${tx.blockNumber}</td>
                <td>${formatTimestamp(tx.timeStamp)}</td>
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
        if (pageStart) pageStart.textContent = startIndex + 1;
        if (pageEnd) pageEnd.textContent = endIndex;
        if (totalRecords) totalRecords.textContent = totalFilteredRecords;
        if (currentPage) currentPage.textContent = pageNum;
        if (totalPages) totalPages.textContent = totalFilteredPages;

        // 更新按钮状态
        if (firstPageBtn && prevPageBtn && nextPageBtn && lastPageBtn) {
            if (totalFilteredRecords === 0) {
                // 如果没有记录，禁用所有按钮
                firstPageBtn.disabled = true;
                prevPageBtn.disabled = true;
                nextPageBtn.disabled = true;
                lastPageBtn.disabled = true;
            } else {
                // 正常情况下的按钮状态
                firstPageBtn.disabled = pageNum <= 1;
                prevPageBtn.disabled = pageNum <= 1;
                nextPageBtn.disabled = pageNum >= totalFilteredPages;
                lastPageBtn.disabled = pageNum >= totalFilteredPages;
            }
        }

        // 添加事件监听器到分页按钮 - 使用addEventListener而不是onclick
        if (firstPageBtn && prevPageBtn && nextPageBtn && lastPageBtn) {
            // 先移除现有的事件监听器
            if (window.firstPageHandler) firstPageBtn.removeEventListener('click', window.firstPageHandler);
            if (window.prevPageHandler) prevPageBtn.removeEventListener('click', window.prevPageHandler);
            if (window.nextPageHandler) nextPageBtn.removeEventListener('click', window.nextPageHandler);
            if (window.lastPageHandler) lastPageBtn.removeEventListener('click', window.lastPageHandler);

            // 创建新的事件处理函数
            window.firstPageHandler = () => window.navigateToPage(1);
            window.prevPageHandler = () => window.navigateToPage(Math.max(1, pageNum - 1));
            window.nextPageHandler = () => window.navigateToPage(Math.min(totalFilteredPages, pageNum + 1));
            window.lastPageHandler = () => window.navigateToPage(totalFilteredPages);

            // 添加新的事件监听器
            firstPageBtn.addEventListener('click', window.firstPageHandler);
            prevPageBtn.addEventListener('click', window.prevPageHandler);
            nextPageBtn.addEventListener('click', window.nextPageHandler);
            lastPageBtn.addEventListener('click', window.lastPageHandler);
        }

        // 重新绑定查看合约按钮的事件
        bindViewContractButtons();
    } catch (error) {
        console.error('displayPaginatedTransactions 函数执行失败:', error);
    }
};

// 导航到指定页面
window.navigateToPage = function navigateToPage(pageNum) {
    try {
        // 确保页码是有效的数字
        if (typeof pageNum !== 'number' || isNaN(pageNum) || pageNum < 1) {
            console.log('无效的页码:', pageNum, '，使用默认值 1');
            pageNum = 1;
        }

        // 获取总页数
        const allTransactions = window.currentTransactions || [];
        const pageSize = window.currentPageSize || 10;

        // 如果没有交易记录，总页数为1
        const totalPages = allTransactions.length > 0 ? Math.ceil(allTransactions.length / pageSize) : 1;

        // 确保页码不超过总页数，且不小于1
        if (pageNum > totalPages) {
            console.log(`页码 ${pageNum} 超过总页数 ${totalPages}，使用最大页码 ${totalPages}`);
            pageNum = Math.max(1, totalPages);
        }

        console.log(`导航到第 ${pageNum} 页，总页数: ${totalPages}, 总记录数: ${allTransactions.length}, 每页记录数: ${pageSize}`);

        // 更新当前页码
        window.currentPageNum = pageNum;

        // 显示分页后的交易记录
        if (typeof window.displayPaginatedTransactions === 'function') {
            window.displayPaginatedTransactions();
        } else {
            console.error('displayPaginatedTransactions 函数不可用');
        }

        // 滚动到表格顶部
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.scrollTop = 0;
        }
    } catch (error) {
        console.error('navigateToPage 函数执行失败:', error);
    }
};

// 绑定查看合约按钮的事件
function bindViewContractButtons() {
    try {
        const viewContractBtns = document.querySelectorAll('.view-contract-btn');
        if (viewContractBtns && viewContractBtns.length > 0) {
            viewContractBtns.forEach(btn => {
                if (btn) {
                    // 移除现有的事件监听器（如果有）
                    if (typeof handleViewContractClick === 'function') {
                        btn.removeEventListener('click', handleViewContractClick);
                        // 添加新的事件监听器
                        btn.addEventListener('click', handleViewContractClick);
                    }
                }
            });
        }
    } catch (error) {
        console.error('绑定查看合约按钮事件失败:', error);
    }
}

// 处理查看合约按钮点击事件
function handleViewContractClick() {
    try {
        if (!this) {
            console.error('handleViewContractClick: this 对象为空');
            return;
        }

        const contractAddress = this.getAttribute('data-address');
        if (!contractAddress) {
            console.error('handleViewContractClick: 合约地址为空');
            return;
        }

        console.log('查看合约详情:', contractAddress);

        // 切换到合约信息标签页
        const contractsTab = document.querySelector('.tab-btn[data-tab="contracts"]');
        if (contractsTab) {
            contractsTab.click();
        } else {
            console.error('handleViewContractClick: 找不到合约标签页');
        }

        // 填充合约地址并触发查询
        const contractAddressInput = document.getElementById('contractAddress');
        const searchContractBtn = document.getElementById('searchContract');
        if (contractAddressInput && searchContractBtn) {
            contractAddressInput.value = contractAddress;
            searchContractBtn.click();
        } else {
            console.error('handleViewContractClick: 找不到合约地址输入框或查询按钮');
        }
    } catch (error) {
        console.error('处理查看合约按钮点击事件失败:', error);
    }
}
