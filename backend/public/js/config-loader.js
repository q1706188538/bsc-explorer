// 配置加载器
document.addEventListener('DOMContentLoaded', function() {
    // 获取元素
    const loadBtn = document.getElementById('loadBtn');
    const resultElement = document.getElementById('result');
    const loadingElement = document.getElementById('loading');
    
    if (loadBtn) {
        // 添加点击事件
        loadBtn.addEventListener('click', function() {
            if (loadingElement) {
                loadingElement.style.display = 'block';
            }
            
            if (resultElement) {
                resultElement.textContent = '正在加载...';
                resultElement.style.display = 'none';
            }
            
            // 发送请求
            fetch('/api/config', {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            })
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('HTTP错误: ' + response.status);
                }
                return response.text();
            })
            .then(function(text) {
                try {
                    const config = JSON.parse(text);
                    if (resultElement) {
                        resultElement.textContent = JSON.stringify(config, null, 2);
                        resultElement.style.display = 'block';
                    }
                } catch (e) {
                    if (resultElement) {
                        resultElement.textContent = '解析JSON失败: ' + e.message + '\n\n原始响应:\n' + text;
                        resultElement.style.display = 'block';
                    }
                }
            })
            .catch(function(error) {
                if (resultElement) {
                    resultElement.textContent = '加载失败: ' + error.message;
                    resultElement.style.display = 'block';
                }
            })
            .finally(function() {
                if (loadingElement) {
                    loadingElement.style.display = 'none';
                }
            });
        });
    }
    
    // 自动加载配置
    if (loadBtn) {
        loadBtn.click();
    }
});
