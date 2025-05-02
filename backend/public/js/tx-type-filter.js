// 交易类型切换功能

// 当文档加载完成后初始化交易类型切换功能
document.addEventListener('DOMContentLoaded', () => {
    // 获取交易类型按钮
    const txTypeBtns = document.querySelectorAll('.tx-type-btn');

    // 如果找到交易类型按钮，添加事件监听器
    if (txTypeBtns.length > 0) {
        txTypeBtns.forEach(btn => {
            btn.addEventListener('click', handleTxTypeChange);
        });
    }
});

// 处理交易类型变化
function handleTxTypeChange(event) {
    const txType = event.target.getAttribute('data-type');

    // 更新活动按钮
    const txTypeBtns = document.querySelectorAll('.tx-type-btn');
    txTypeBtns.forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    // 更新当前交易类型
    window.currentTxType = txType;

    // 重置当前页码为1
    window.currentPageNum = 1;

    // 重新显示交易记录
    // 使用 bscService 或 apiService，取决于哪个可用
    const service = window.bscService || window.apiService;

    if (service) {
        const currentAddress = document.getElementById('address').value;
        const cachedResult = service.getCachedTransactions(currentAddress, 1, window.currentPageSize || 50);
        if (cachedResult) {
            // 使用分页功能显示交易记录
            if (typeof window.displayTransactions === 'function') {
                window.displayTransactions(cachedResult);
            } else if (typeof displayPaginatedTransactions === 'function') {
                // 保存当前交易记录到全局变量，供分页功能使用
                window.currentTransactions = filterTransactionsByType(cachedResult.transactions, txType);
                displayPaginatedTransactions();
            }
        }
    }
}

// 根据交易类型过滤交易记录
function filterTransactionsByType(transactions, txType) {
    if (!transactions || !Array.isArray(transactions)) return [];

    // 如果是"全部"类型，返回所有交易
    if (txType === 'all') return transactions;

    // 否则，根据交易类型过滤
    return transactions.filter(tx => tx.direction === txType);
}
