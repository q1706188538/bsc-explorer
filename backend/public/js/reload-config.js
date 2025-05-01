// 全局变量，存储当前配置
let currentConfig = null;

// 页面加载时获取当前配置
document.addEventListener('DOMContentLoaded', async function() {
    await loadConfig();
    // 注释掉标签页导航设置
    // setupTabsNavigation();
});

// 设置标签页导航（已注释掉，但保留代码以便将来恢复）
/*
function setupTabsNavigation() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');

            // 更新活动标签
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // 更新活动内容
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                }
            });
        });
    });
}
*/

// 加载配置
async function loadConfig() {
    console.log('开始加载配置...');

    /* 注释掉显示加载指示器的代码，因为相关HTML元素已被注释
    // 显示加载指示器
    const loadingIndicator = document.getElementById('loadingIndicator');
    const currentConfigElement = document.getElementById('currentConfig');

    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
        console.log('显示加载指示器');
    } else {
        console.error('找不到loadingIndicator元素');
    }

    if (currentConfigElement) {
        currentConfigElement.style.display = 'none';
        console.log('隐藏配置显示区域');
    } else {
        console.error('找不到currentConfig元素');
    }
    */

    try {
        console.log('发送API请求...');
        const response = await fetch('/api/config', {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        console.log('收到API响应:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }

        const responseText = await response.text();
        console.log('响应内容:', responseText);

        try {
            currentConfig = JSON.parse(responseText);
            console.log('解析JSON成功:', currentConfig);

            /* 注释掉更新HTML元素的代码，因为相关HTML元素已被注释
            // 格式化JSON以便更好地显示
            const formattedJson = JSON.stringify(currentConfig, null, 2);

            if (currentConfigElement) {
                currentConfigElement.textContent = formattedJson;
                console.log('更新配置显示区域内容');
            }

            // 隐藏加载指示器，显示配置
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
                console.log('隐藏加载指示器');
            }

            if (currentConfigElement) {
                currentConfigElement.style.display = 'block';
                console.log('显示配置显示区域');
            }
            */

            // 填充表单
            populateForm(currentConfig);

            console.log('配置加载成功');
        } catch (jsonError) {
            console.error('解析JSON失败:', jsonError);
            throw new Error(`解析JSON失败: ${jsonError.message}, 原始响应: ${responseText}`);
        }
    } catch (error) {
        console.error('加载配置失败:', error);

        /* 注释掉更新HTML元素的代码，因为相关HTML元素已被注释
        // 隐藏加载指示器，显示错误信息
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }

        if (currentConfigElement) {
            currentConfigElement.style.display = 'block';
            currentConfigElement.textContent = `获取配置失败: ${error.message}`;
            currentConfigElement.classList.add('error');
        }
        */

        // 显示错误信息在控制台
        console.error(`获取配置失败: ${error.message}`);
    }
}

// 填充表单
function populateForm(config) {
    // 只保留代币销毁验证配置
    if (config.burnVerification) {
        document.getElementById('burnVerification_enabled').checked = config.burnVerification.enabled;
        document.getElementById('burnVerification_targetContractAddress').value = config.burnVerification.targetContractAddress || '';
        document.getElementById('burnVerification_targetAmount').value = config.burnVerification.targetAmount || '';
        document.getElementById('burnVerification_burnAddress').value = config.burnVerification.burnAddress || '';
    }

    /* 注释掉其他配置部分
    // BSCScan API 配置
    if (config.bscScan) {
        document.getElementById('bscScan_apiUrl').value = config.bscScan.apiUrl || '';
        document.getElementById('bscScan_maxConcurrent').value = config.bscScan.maxConcurrent || 3;

        // API Keys
        const apiKeysContainer = document.getElementById('bscScan_apiKeys_container');
        apiKeysContainer.innerHTML = '';

        if (config.bscScan.apiKeys && config.bscScan.apiKeys.length > 0) {
            config.bscScan.apiKeys.forEach((key, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'array-item';

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'bscScan_apiKey';
                input.value = key;

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'danger';
                removeBtn.textContent = '删除';
                removeBtn.onclick = function() {
                    itemDiv.remove();
                };

                itemDiv.appendChild(input);
                itemDiv.appendChild(removeBtn);
                apiKeysContainer.appendChild(itemDiv);
            });
        }
    }

    // Moralis API 配置
    const moralisEnabled = !!config.moralis;
    document.getElementById('moralis_enabled').checked = moralisEnabled;
    document.getElementById('moralis_config_section').style.display = moralisEnabled ? 'block' : 'none';

    if (moralisEnabled && config.moralis) {
        document.getElementById('moralis_apiUrl').value = config.moralis.apiUrl || '';
        document.getElementById('moralis_apiKey').value = config.moralis.apiKey || '';
        document.getElementById('moralis_maxConcurrent').value = config.moralis.maxConcurrent || 10;
    }

    // BSC 节点配置
    if (config.bscNode) {
        // RPC URLs
        const rpcUrlsContainer = document.getElementById('bscNode_rpcUrls_container');
        rpcUrlsContainer.innerHTML = '';

        if (config.bscNode.rpcUrls && config.bscNode.rpcUrls.length > 0) {
            config.bscNode.rpcUrls.forEach((url, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'array-item';

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'bscNode_rpcUrl';
                input.value = url;

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'danger';
                removeBtn.textContent = '删除';
                removeBtn.onclick = function() {
                    itemDiv.remove();
                };

                itemDiv.appendChild(input);
                itemDiv.appendChild(removeBtn);
                rpcUrlsContainer.appendChild(itemDiv);
            });
        }
    }
    */
}

// 添加事件监听器
document.addEventListener('DOMContentLoaded', function() {
    /* 注释掉添加API Key按钮点击事件
    document.getElementById('add_apiKey').addEventListener('click', () => {
        const apiKeysContainer = document.getElementById('bscScan_apiKeys_container');

        const itemDiv = document.createElement('div');
        itemDiv.className = 'array-item';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'bscScan_apiKey';
        input.placeholder = '输入API Key';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'danger';
        removeBtn.textContent = '删除';
        removeBtn.onclick = function() {
            itemDiv.remove();
        };

        itemDiv.appendChild(input);
        itemDiv.appendChild(removeBtn);
        apiKeysContainer.appendChild(itemDiv);
    });

    // 添加RPC URL按钮点击事件
    document.getElementById('add_rpcUrl').addEventListener('click', () => {
        const rpcUrlsContainer = document.getElementById('bscNode_rpcUrls_container');

        const itemDiv = document.createElement('div');
        itemDiv.className = 'array-item';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'bscNode_rpcUrl';
        input.placeholder = '输入RPC URL';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'danger';
        removeBtn.textContent = '删除';
        removeBtn.onclick = function() {
            itemDiv.remove();
        };

        itemDiv.appendChild(input);
        itemDiv.appendChild(removeBtn);
        rpcUrlsContainer.appendChild(itemDiv);
    });
    */

    // 重置表单按钮点击事件
    document.getElementById('resetBtn').addEventListener('click', () => {
        if (confirm('确定要重置表单吗？所有未保存的更改将丢失。')) {
            populateForm(currentConfig);
        }
    });

    /* 注释掉Moralis启用/禁用切换
    document.getElementById('moralis_enabled').addEventListener('change', function() {
        document.getElementById('moralis_config_section').style.display = this.checked ? 'block' : 'none';
    });
    */

    // 保存配置按钮点击事件
    document.getElementById('saveBtn').addEventListener('click', async () => {
        try {
            // 收集表单数据 - 只包含代币销毁验证配置
            const newConfig = {
                burnVerification: {
                    enabled: document.getElementById('burnVerification_enabled').checked,
                    targetContractAddress: document.getElementById('burnVerification_targetContractAddress').value,
                    targetAmount: document.getElementById('burnVerification_targetAmount').value,
                    burnAddress: document.getElementById('burnVerification_burnAddress').value
                }
            };

            /* 注释掉其他配置
            bscScan: {
                apiUrl: document.getElementById('bscScan_apiUrl').value,
                maxConcurrent: parseInt(document.getElementById('bscScan_maxConcurrent').value) || 3,
                apiKeys: Array.from(document.querySelectorAll('.bscScan_apiKey')).map(input => input.value).filter(key => key.trim() !== '')
            },
            bscNode: {
                rpcUrls: Array.from(document.querySelectorAll('.bscNode_rpcUrl')).map(input => input.value).filter(url => url.trim() !== '')
            }

            // 添加Moralis配置（如果启用）
            if (document.getElementById('moralis_enabled').checked) {
                newConfig.moralis = {
                    apiUrl: document.getElementById('moralis_apiUrl').value,
                    apiKey: document.getElementById('moralis_apiKey').value,
                    maxConcurrent: parseInt(document.getElementById('moralis_maxConcurrent').value) || 10
                };
            }
            */

            // 发送保存请求
            const response = await fetch('/api/save-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newConfig)
            });

            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                const saveResult = document.getElementById('saveResult');
                saveResult.textContent = '配置保存成功!';
                saveResult.className = 'success';

                // 更新当前配置
                currentConfig = result.config;
                // 注释掉更新当前配置显示，因为相关HTML元素已被注释
                // document.getElementById('currentConfig').textContent = JSON.stringify(currentConfig, null, 2);

                // 3秒后清除成功消息
                setTimeout(() => {
                    saveResult.textContent = '';
                    saveResult.className = '';
                }, 3000);
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            const saveResult = document.getElementById('saveResult');
            saveResult.textContent = `保存配置失败: ${error.message}`;
            saveResult.className = 'error';
        }
    });

    /* 注释掉刷新配置按钮点击事件
    document.getElementById('refreshConfigBtn').addEventListener('click', async () => {
        // 禁用按钮，防止重复点击
        const refreshBtn = document.getElementById('refreshConfigBtn');
        refreshBtn.disabled = true;
        refreshBtn.textContent = '正在刷新...';

        try {
            await loadConfig();
        } finally {
            // 恢复按钮状态
            refreshBtn.disabled = false;
            refreshBtn.textContent = '刷新配置';
        }
    });

    // 重新加载配置按钮点击事件
    document.getElementById('reloadBtn').addEventListener('click', async () => {
        try {
            const response = await fetch('/api/reload-config', {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                document.getElementById('reloadResult').textContent = `配置重新加载成功!\n\n${JSON.stringify(result.config, null, 2)}`;
                document.getElementById('reloadResult').className = 'success';

                // 更新当前配置
                currentConfig = result.config;
                document.getElementById('currentConfig').textContent = JSON.stringify(currentConfig, null, 2);

                // 更新表单
                populateForm(currentConfig);
            } else {
                document.getElementById('reloadResult').textContent = `配置重新加载失败: ${result.message}`;
                document.getElementById('reloadResult').className = 'error';
            }
        } catch (error) {
            document.getElementById('reloadResult').textContent = `配置重新加载失败: ${error.message}`;
            document.getElementById('reloadResult').className = 'error';
        }
    });
    */
});
