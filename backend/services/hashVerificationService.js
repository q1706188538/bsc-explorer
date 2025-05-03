const fs = require('fs');
const path = require('path');

class HashVerificationService {
  constructor() {
    this.dataFilePath = path.join(__dirname, '../data/verified-hashes.json');
    this.verifiedHashes = this.loadVerifiedHashes();
    this.isWriting = false;
    this.pendingWrites = false;
    this.lastSaveTime = 0;
    this.saveInterval = 1000; // 最小保存间隔（毫秒）

    // 用于跟踪API请求状态的映射
    this.apiRequestStatus = new Map();
  }

  // 加载已验证的哈希数据
  loadVerifiedHashes() {
    try {
      // 检查文件是否存在，如果不存在则创建
      if (!fs.existsSync(this.dataFilePath)) {
        fs.writeFileSync(this.dataFilePath, JSON.stringify({ verifiedHashes: {} }), 'utf8');
        return {};
      }

      const data = fs.readFileSync(this.dataFilePath, 'utf8');
      const parsedData = JSON.parse(data);
      return parsedData.verifiedHashes || {};
    } catch (error) {
      console.error('加载已验证哈希数据失败:', error);
      return {};
    }
  }

  // 保存已验证的哈希数据（带防抖和互斥锁）
  saveVerifiedHashes() {
    const now = Date.now();

    // 如果距离上次保存时间不足指定间隔，标记为待保存并返回
    if (now - this.lastSaveTime < this.saveInterval) {
      this.pendingWrites = true;

      // 设置定时器，在间隔结束后执行保存
      if (!this.saveTimer) {
        this.saveTimer = setTimeout(() => {
          this.executeSave();
          this.saveTimer = null;
        }, this.saveInterval - (now - this.lastSaveTime));
      }

      return;
    }

    this.executeSave();
  }

  // 执行实际的保存操作
  executeSave() {
    // 如果正在写入，标记为待保存并返回
    if (this.isWriting) {
      this.pendingWrites = true;
      return;
    }

    this.isWriting = true;
    this.pendingWrites = false;
    this.lastSaveTime = Date.now();

    try {
      const data = JSON.stringify({ verifiedHashes: this.verifiedHashes }, null, 2);
      fs.writeFileSync(this.dataFilePath, data, 'utf8');
      console.log(`已保存 ${Object.keys(this.verifiedHashes).length} 个哈希记录到文件`);
    } catch (error) {
      console.error('保存已验证哈希数据失败:', error);
    } finally {
      this.isWriting = false;

      // 如果有待保存的更改，再次执行保存
      if (this.pendingWrites) {
        setTimeout(() => this.executeSave(), 10);
      }
    }
  }

  // 获取规范化的哈希值（公开方法，可以从外部访问）
  normalizeHash(txHash) {
    return txHash ? txHash.toLowerCase() : '';
  }

  // 内部使用的规范化哈希方法
  _normalizeHash(txHash) {
    return this.normalizeHash(txHash);
  }

  // 获取哈希数据（带缓存）
  _getHashData(txHash) {
    const normalizedHash = this._normalizeHash(txHash);
    return normalizedHash ? this.verifiedHashes[normalizedHash] : null;
  }

  // 原子更新哈希数据
  _updateHashData(txHash, updateFn) {
    if (!txHash) return false;

    const normalizedHash = this._normalizeHash(txHash);
    const hashData = this.verifiedHashes[normalizedHash];

    if (!hashData) return false;

    // 执行更新函数
    const updated = updateFn(hashData);

    // 如果更新成功，保存数据
    if (updated) {
      this.saveVerifiedHashes();
    }

    return updated;
  }

  // 添加已验证的哈希
  addVerifiedHash(txHash, from) {
    if (!txHash) return false;

    const normalizedHash = this._normalizeHash(txHash);

    // 检查哈希是否已存在
    if (this.verifiedHashes[normalizedHash]) {
      // 如果哈希已存在但已被使用，返回失败
      if (this.verifiedHashes[normalizedHash].used) {
        return false;
      }

      // 如果哈希已存在但未被使用，更新信息
      this.verifiedHashes[normalizedHash].from = from;
      this.verifiedHashes[normalizedHash].verifiedAt = new Date().toISOString();
      this.verifiedHashes[normalizedHash].used = false;
      this.verifiedHashes[normalizedHash].locked = false;
    } else {
      // 如果哈希不存在，创建新记录
      this.verifiedHashes[normalizedHash] = {
        hash: normalizedHash,
        from: from,
        verifiedAt: new Date().toISOString(),
        used: false,
        locked: false
      };
    }

    this.saveVerifiedHashes();
    return true;
  }

  // 检查哈希是否已验证
  isHashVerified(txHash) {
    const hashData = this._getHashData(txHash);
    return !!hashData;
  }

  // 检查哈希状态
  getHashStatus(txHash) {
    if (!txHash) return 'invalid';

    const hashData = this._getHashData(txHash);

    if (!hashData) return 'not_verified';
    if (hashData.used) return 'used';
    if (hashData.locked) return 'locked';
    return 'verified';
  }

  // 检查哈希是否已使用
  isHashUsed(txHash) {
    const hashData = this._getHashData(txHash);
    return hashData ? hashData.used : false;
  }

  // 检查哈希是否已锁定
  isHashLocked(txHash) {
    const hashData = this._getHashData(txHash);
    return hashData ? hashData.locked : false;
  }

  // 锁定哈希（标记为正在使用）
  lockHash(txHash) {
    return this._updateHashData(txHash, (hashData) => {
      // 只有未使用且未锁定的哈希才能被锁定
      if (!hashData.used && !hashData.locked) {
        hashData.locked = true;
        hashData.lockedAt = new Date().toISOString();
        return true;
      }
      return false;
    });
  }

  // 解锁哈希（取消正在使用的标记）
  unlockHash(txHash) {
    return this._updateHashData(txHash, (hashData) => {
      // 只有已锁定的哈希才能被解锁
      if (hashData.locked) {
        hashData.locked = false;
        delete hashData.lockedAt;
        return true;
      }
      return false;
    });
  }

  // 标记哈希为已使用
  markHashAsUsed(txHash) {
    return this._updateHashData(txHash, (hashData) => {
      // 只有未使用的哈希才能被标记为已使用
      if (!hashData.used) {
        // 如果哈希被锁定，先解锁
        if (hashData.locked) {
          delete hashData.locked;
          delete hashData.lockedAt;
        }

        hashData.used = true;
        hashData.usedAt = new Date().toISOString();
        return true;
      }
      return false;
    });
  }

  // 获取哈希的详细信息
  getHashDetails(txHash) {
    return this._getHashData(txHash);
  }

  // 初始化API请求状态跟踪
  initApiRequestStatus(txHash) {
    if (!txHash) return;

    const normalizedHash = this._normalizeHash(txHash);
    this.apiRequestStatus.set(normalizedHash, {
      normalTxCompleted: false,
      tokenTxCompleted: false
    });
    console.log(`初始化哈希 ${txHash} 的API请求状态跟踪`);
  }

  // 标记普通交易API请求完成
  markNormalTxCompleted(txHash) {
    if (!txHash) return false;

    const normalizedHash = this._normalizeHash(txHash);
    const status = this.apiRequestStatus.get(normalizedHash);

    if (!status) {
      console.log(`警告: 尝试标记普通交易API完成，但未找到哈希 ${txHash} 的状态跟踪`);
      return false;
    }

    status.normalTxCompleted = true;
    console.log(`哈希 ${txHash} 的普通交易API请求已完成`);

    // 检查是否两个API都已完成
    return this._checkAndMarkUsed(txHash, status);
  }

  // 标记代币交易API请求完成
  markTokenTxCompleted(txHash) {
    if (!txHash) return false;

    const normalizedHash = this._normalizeHash(txHash);
    const status = this.apiRequestStatus.get(normalizedHash);

    if (!status) {
      console.log(`警告: 尝试标记代币交易API完成，但未找到哈希 ${txHash} 的状态跟踪`);
      return false;
    }

    status.tokenTxCompleted = true;
    console.log(`哈希 ${txHash} 的代币交易API请求已完成`);

    // 检查是否两个API都已完成
    return this._checkAndMarkUsed(txHash, status);
  }

  // 检查是否两个API都已完成，如果是，则标记哈希为已使用
  _checkAndMarkUsed(txHash, status) {
    if (status.normalTxCompleted && status.tokenTxCompleted) {
      console.log(`哈希 ${txHash} 的两个API请求都已完成，标记为已使用`);

      // 清理状态跟踪
      const normalizedHash = this._normalizeHash(txHash);
      this.apiRequestStatus.delete(normalizedHash);

      // 标记哈希为已使用
      return this.markHashAsUsed(txHash);
    }

    return false;
  }

  // 清理API请求状态
  cleanupApiRequestStatus(txHash) {
    if (!txHash) return;

    const normalizedHash = this._normalizeHash(txHash);
    if (this.apiRequestStatus.has(normalizedHash)) {
      this.apiRequestStatus.delete(normalizedHash);
      console.log(`清理哈希 ${txHash} 的API请求状态跟踪`);
    }
  }

  // 清理过期的哈希记录（可以定期调用）
  cleanupExpiredHashes(maxAgeHours = 360) { // 默认15天（360小时）
    const now = new Date();
    let count = 0;
    const maxAgeDays = maxAgeHours / 24;

    console.log(`开始清理超过 ${maxAgeDays.toFixed(1)} 天的哈希记录...`);

    // 记录清理前的哈希数量
    const beforeCount = Object.keys(this.verifiedHashes).length;

    for (const hash in this.verifiedHashes) {
      const hashData = this.verifiedHashes[hash];

      // 计算记录的年龄（小时）
      const verifiedAt = new Date(hashData.verifiedAt);
      const ageHours = (now - verifiedAt) / (1000 * 60 * 60);
      const ageDays = ageHours / 24;

      // 如果记录超过最大年龄，删除它
      if (ageHours > maxAgeHours) {
        console.log(`清理哈希: ${hash.substring(0, 10)}...，创建于 ${verifiedAt.toISOString()}，年龄: ${ageDays.toFixed(1)} 天，状态: ${hashData.used ? '已使用' : '未使用'}`);
        delete this.verifiedHashes[hash];
        count++;
      }
    }

    // 记录清理后的哈希数量
    const afterCount = Object.keys(this.verifiedHashes).length;

    if (count > 0) {
      console.log(`已清理 ${count} 个过期的哈希记录，当前剩余 ${afterCount} 个记录`);
      this.saveVerifiedHashes();
    } else {
      console.log(`没有找到超过 ${maxAgeDays.toFixed(1)} 天的哈希记录，当前共有 ${beforeCount} 个记录`);
    }

    return count;
  }
}

module.exports = new HashVerificationService();
