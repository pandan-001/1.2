/**
 * utils.js - 工具函数模块
 * 包含UUID生成、防抖函数、几何计算等通用工具
 */

// ==================== UUID 生成 ====================

/**
 * 生成UUID v4
 * @returns {string} UUID字符串
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ==================== 防抖与节流 ====================

/**
 * 防抖函数
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间(毫秒)
 * @returns {Function} 防抖包装后的函数
 */
function debounce(func, wait) {
    let timeout = null;
    return function(...args) {
        const context = this;
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

/**
 * 节流函数
 * @param {Function} func - 要执行的函数
 * @param {number} limit - 时间限制(毫秒)
 * @returns {Function} 节流包装后的函数
 */
function throttle(func, limit) {
    let inThrottle = false;
    return function(...args) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ==================== 几何计算 ====================

/**
 * 检测两个矩形是否重叠
 * @param {Object} rect1 - 矩形1 {left, top, right, bottom}
 * @param {Object} rect2 - 矩形2 {left, top, right, bottom}
 * @returns {boolean} 是否重叠
 */
function rectsOverlap(rect1, rect2) {
    return !(rect1.right < rect2.left ||
             rect1.left > rect2.right ||
             rect1.bottom < rect2.top ||
             rect1.top > rect2.bottom);
}

/**
 * 检测点是否在矩形内
 * @param {number} x - 点的x坐标
 * @param {number} y - 点的y坐标
 * @param {Object} rect - 矩形 {left, top, right, bottom}
 * @returns {boolean} 是否在矩形内
 */
function pointInRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * 计算两个矩形的重叠面积比例
 * @param {Object} rect1 - 矩形1 {left, top, width, height}
 * @param {Object} rect2 - 矩形2 {left, top, width, height}
 * @returns {number} 重叠面积占rect1的比例
 */
function calculateOverlapRatio(rect1, rect2) {
    const overlapLeft = Math.max(rect1.left, rect2.left);
    const overlapTop = Math.max(rect1.top, rect2.top);
    const overlapRight = Math.min(rect1.left + rect1.width, rect2.left + rect2.width);
    const overlapBottom = Math.min(rect1.top + rect1.height, rect2.top + rect2.height);

    const overlapWidth = Math.max(0, overlapRight - overlapLeft);
    const overlapHeight = Math.max(0, overlapBottom - overlapTop);
    const overlapArea = overlapWidth * overlapHeight;

    const rect1Area = rect1.width * rect1.height;
    return rect1Area > 0 ? overlapArea / rect1Area : 0;
}

/**
 * 获取元素相对于参考元素的位置
 * @param {HTMLElement} element - 目标元素
 * @param {HTMLElement} referenceElement - 参考元素
 * @returns {Object} {left, top, right, bottom, width, height}
 */
function getRelativeRect(element, referenceElement) {
    const elemRect = element.getBoundingClientRect();
    const refRect = referenceElement.getBoundingClientRect();

    return {
        left: elemRect.left - refRect.left,
        top: elemRect.top - refRect.top,
        right: elemRect.right - refRect.left,
        bottom: elemRect.bottom - refRect.top,
        width: elemRect.width,
        height: elemRect.height
    };
}

// ==================== 设备检测 ====================

/**
 * 检测设备类型
 * @returns {Object} {isMobile, isTablet, isDesktop, hasTouchSupport}
 */
function detectDeviceType() {
    const width = window.innerWidth;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    return {
        isMobile: hasTouch && width < 768,
        isTablet: hasTouch && width >= 768 && width < 1024,
        isDesktop: !hasTouch || width >= 1024,
        hasTouchSupport: hasTouch,
        // 兼容旧代码
        isMobileDevice: hasTouch && width < 1024
    };
}

// ==================== 坐标转换 ====================

/**
 * 将内部坐标转换为显示坐标
 * @param {number} internalRow - 内部行号(0-based)
 * @param {number} internalCol - 内部列号(0-based)
 * @param {number} totalRows - 总行数
 * @returns {Object} {displayRow, displayCol}
 */
function toDisplayCoord(internalRow, internalCol, totalRows) {
    return {
        displayRow: totalRows - internalRow,
        displayCol: internalCol + 1
    };
}

/**
 * 将显示坐标转换为内部坐标
 * @param {number} displayRow - 显示行号(1-based)
 * @param {number} displayCol - 显示列号(1-based)
 * @param {number} totalRows - 总行数
 * @returns {Object} {internalRow, internalCol}
 */
function toInternalCoord(displayRow, displayCol, totalRows) {
    return {
        internalRow: totalRows - displayRow,
        internalCol: displayCol - 1
    };
}

/**
 * 解析显示坐标字符串
 * @param {string} coordString - 坐标字符串，格式 "行-列"
 * @param {number} totalRows - 总行数
 * @param {number} totalCols - 总列数
 * @returns {Object|null} 解析结果或null
 */
function parseDisplayCoordinate(coordString, totalRows, totalCols) {
    if (!coordString || typeof coordString !== 'string') {
        return null;
    }

    const trimmedCoord = coordString.trim();
    const match = trimmedCoord.match(/^(\d+)-(\d+)$/);

    if (!match) {
        console.warn('无效的座位坐标格式:', coordString);
        return null;
    }

    const displayRow = parseInt(match[1]);
    const displayCol = parseInt(match[2]);

    const internalRow = totalRows - displayRow;
    const internalCol = displayCol - 1;

    if (internalRow < 0 || internalRow >= totalRows || internalCol < 0 || internalCol >= totalCols) {
        console.warn('座位坐标超出范围:', coordString);
        return null;
    }

    return {
        row: internalRow,
        col: internalCol,
        displayRow: displayRow,
        displayCol: displayCol,
        seatId: `${internalRow}-${internalCol}`
    };
}

// ==================== 名字长度样式计算 ====================

/**
 * 根据姓名长度返回对应的CSS类名
 * @param {number} length - 姓名长度
 * @returns {string} CSS类名
 */
function getNameLengthClass(length) {
    if (length <= 2) return ' name-2';
    if (length === 3) return ' name-3';
    if (length === 4) return ' name-4';
    if (length === 5) return ' name-5';
    if (length === 6) return ' name-6';
    if (length === 7) return ' name-7';
    if (length >= 8) return ' name-8-plus';
    return '';
}

// ==================== 触觉反馈 ====================

/**
 * 触发触觉反馈（震动）
 * @param {number} duration - 震动时长(毫秒)
 */
function vibrate(duration = 50) {
    if (navigator.vibrate) {
        navigator.vibrate(duration);
    }
}

// ==================== 深拷贝 ====================

/**
 * 深拷贝对象
 * @param {*} obj - 要拷贝的对象
 * @returns {*} 拷贝后的对象
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// 导出所有工具函数
window.SeatingUtils = {
    generateUUID,
    debounce,
    throttle,
    rectsOverlap,
    pointInRect,
    calculateOverlapRatio,
    getRelativeRect,
    detectDeviceType,
    toDisplayCoord,
    toInternalCoord,
    parseDisplayCoordinate,
    getNameLengthClass,
    vibrate,
    deepClone
};
