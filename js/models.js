/**
 * models.js - 数据模型模块
 * 定义Student和Seat类，管理数据逻辑
 */

// ==================== Student 类 ====================

class Student {
    /**
     * 创建学生实例
     * @param {Object} data - 学生数据
     */
    constructor(data = {}) {
        this.uuid = data.uuid || SeatingUtils.generateUUID();
        this.name = data.name || '';
        this.id = data.id || '';  // 学号
        this.gender = data.gender || '';  // 'male' | 'female' | ''
        this.height = data.height || null;
        this.notes = data.notes || '';
        this.seatId = data.seatId || null;  // 当前分配的座位ID
    }

    /**
     * 转换为普通对象
     * @returns {Object}
     */
    toJSON() {
        return {
            uuid: this.uuid,
            name: this.name,
            id: this.id,
            gender: this.gender,
            height: this.height,
            notes: this.notes,
            seatId: this.seatId
        };
    }

    /**
     * 从普通对象创建Student实例
     * @param {Object} obj
     * @returns {Student}
     */
    static fromJSON(obj) {
        return new Student(obj);
    }

    /**
     * 获取性别显示文本
     * @returns {string}
     */
    getGenderText() {
        if (this.gender === 'male') return '男';
        if (this.gender === 'female') return '女';
        return '';
    }
}

// ==================== Seat 类 ====================

class Seat {
    /**
     * 创建座位实例
     * @param {Object} data - 座位数据
     */
    constructor(data = {}) {
        this.id = data.id || `${data.row}-${data.col}`;
        this.row = data.row !== undefined ? data.row : 0;  // 内部行索引(0-based)
        this.col = data.col !== undefined ? data.col : 0;  // 内部列索引(0-based)
        this.student = data.student || null;
        this.position = data.position || (this.row * 8 + this.col + 1);  // 线性位置
        this.isDeleted = data.isDeleted || false;
    }

    /**
     * 获取显示坐标
     * @param {number} totalRows - 总行数
     * @returns {Object} {displayRow, displayCol}
     */
    getDisplayCoord(totalRows) {
        return {
            displayRow: totalRows - this.row,
            displayCol: this.col + 1
        };
    }

    /**
     * 获取显示坐标字符串
     * @param {number} totalRows - 总行数
     * @returns {string}
     */
    getDisplayCoordString(totalRows) {
        const coord = this.getDisplayCoord(totalRows);
        return `${coord.displayRow}-${coord.displayCol}`;
    }

    /**
     * 检查座位是否为空
     * @returns {boolean}
     */
    isEmpty() {
        return !this.student && !this.isDeleted;
    }

    /**
     * 检查座位是否可用（未删除且无学生）
     * @returns {boolean}
     */
    isAvailable() {
        return !this.isDeleted && !this.student;
    }

    /**
     * 检查座位是否被占用（有学生）
     * @returns {boolean}
     */
    isOccupied() {
        return !this.isDeleted && this.student !== null;
    }

    /**
     * 转换为普通对象
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            row: this.row,
            col: this.col,
            student: this.student,
            position: this.position,
            isDeleted: this.isDeleted
        };
    }

    /**
     * 从普通对象创建Seat实例
     * @param {Object} obj
     * @returns {Seat}
     */
    static fromJSON(obj) {
        return new Seat(obj);
    }
}

// ==================== SeatingData 数据管理类 ====================

class SeatingData {
    constructor() {
        this.students = [];
        this.seats = [];
        this.rows = 6;
        this.cols = 8;
        this.constraints = [];
        this.showCoordinates = false;
        this.selectedFont = 'song';
        this.maleColor = '#2563eb';
        this.femaleColor = '#ec4899';
        this.history = [];
        this.historyIndex = -1;
        this.MAX_HISTORY_SIZE = 5;
    }

    /**
     * 重新链接座位上的学生对象到 students 数组
     * 用于修复 JSON.parse 或 deepClone 后对象引用分离的问题
     */
    relinkStudentReferences() {
        this.seats.forEach(seat => {
            if (seat.student && seat.student.uuid) {
                const studentInArray = this.students.find(s => s.uuid === seat.student.uuid);
                if (studentInArray) {
                    seat.student = studentInArray;
                } else {
                    console.warn('[relinkStudentReferences] 座位', seat.id, '上的学生', seat.student.name, '不在 students 数组中');
                }
            }
        });
    }

    /**
     * 从localStorage加载数据
     */
    loadFromStorage() {
        const savedData = localStorage.getItem('seatingData');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                this.students = data.students || [];
                this.rows = data.rows || 6;
                this.cols = data.cols || 8;
                this.constraints = data.constraints || [];
                this.showCoordinates = data.showCoordinates !== undefined ? data.showCoordinates : false;
                this.selectedFont = data.selectedFont || 'song';
                this.maleColor = data.maleColor || '#2563eb';
                this.femaleColor = data.femaleColor || '#ec4899';
                this.history = data.history || [];
                this.historyIndex = data.historyIndex !== undefined ? data.historyIndex : -1;

                if (data.seats && data.seats.length > 0) {
                    this.seats = data.seats;

                    // 【关键修复】重新链接座位上的学生对象到 students 数组
                    // JSON.parse 会创建新对象，导致 seat.student 和 students 数组中的对象不是同一个引用
                    this.relinkStudentReferences();

                    return true;
                } else {
                    // 如果 seats 不存在或为空数组，需要初始化座位
                    this.initializeSeats();
                    return true;
                }
            } catch (e) {
                console.error('Failed to load data from storage:', e);
            }
        }
        return false;
    }

    /**
     * 保存数据到localStorage
     */
    saveToStorage() {
        const data = {
            students: this.students,
            seats: this.seats,
            rows: this.rows,
            cols: this.cols,
            constraints: this.constraints,
            showCoordinates: this.showCoordinates,
            selectedFont: this.selectedFont,
            maleColor: this.maleColor,
            femaleColor: this.femaleColor,
            history: this.history,
            historyIndex: this.historyIndex
        };
        localStorage.setItem('seatingData', JSON.stringify(data));
    }

    /**
     * 初始化座位
     */
    initializeSeats() {
        const existingSeatData = {};
        if (this.seats) {
            this.seats.forEach(seat => {
                existingSeatData[seat.id] = {
                    student: seat.student,
                    isDeleted: seat.isDeleted || false
                };
            });
        }

        this.seats = [];
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const seatId = `${row}-${col}`;
                const existingData = existingSeatData[seatId];

                this.seats.push({
                    id: seatId,
                    row: row,
                    col: col,
                    student: existingData ? existingData.student : null,
                    position: row * this.cols + col + 1,
                    isDeleted: existingData ? existingData.isDeleted : false
                });
            }
        }
    }

    /**
     * 添加历史记录
     * @param {string} action - 动作类型
     * @param {Object} data - 数据快照
     */
    addToHistory(action, data) {
        this.history = this.history.slice(0, this.historyIndex + 1);

        this.history.push({
            action: action,
            data: SeatingUtils.deepClone(data),
            timestamp: Date.now()
        });

        if (this.history.length > this.MAX_HISTORY_SIZE) {
            const removeCount = this.history.length - this.MAX_HISTORY_SIZE;
            this.history = this.history.slice(removeCount);
            this.historyIndex = this.history.length - 1;
        } else {
            this.historyIndex++;
        }

        this.saveToStorage();
    }

    /**
     * 撤销操作
     * @returns {Object|null} 历史记录项
     */
    undo() {
        if (this.historyIndex >= 0) {
            const historyItem = this.history[this.historyIndex];
            this.historyIndex--;
            return historyItem;
        }
        return null;
    }

    /**
     * 重做操作
     * @returns {Object|null} 历史记录项
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            return this.history[this.historyIndex];
        }
        return null;
    }

    /**
     * 检查是否可以撤销
     * @returns {boolean}
     */
    canUndo() {
        return this.historyIndex >= 0;
    }

    /**
     * 检查是否可以重做
     * @returns {boolean}
     */
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    /**
     * 根据UUID查找学生
     * @param {string} uuid
     * @returns {Object|undefined}
     */
    findStudentByUuid(uuid) {
        return this.students.find(s => s.uuid === uuid);
    }

    /**
     * 根据ID查找座位
     * @param {string} seatId
     * @returns {Object|undefined}
     */
    findSeatById(seatId) {
        return this.seats.find(s => s.id === seatId);
    }

    /**
     * 获取可用座位（未删除且无学生）
     * @returns {Array}
     */
    getAvailableSeats() {
        return this.seats.filter(seat => !seat.isDeleted && !seat.student);
    }

    /**
     * 获取未删除的座位
     * @returns {Array}
     */
    getActiveSeats() {
        return this.seats.filter(seat => !seat.isDeleted);
    }

    /**
     * 获取已安排座位的学生数量
     * @returns {number}
     */
    getSeatedStudentsCount() {
        return this.seats.filter(seat => seat.student).length;
    }

    /**
     * 获取未安排座位的学生数量
     * @returns {number}
     */
    getUnseatedStudentsCount() {
        return this.students.length - this.getSeatedStudentsCount();
    }
}

// 导出类
window.Student = Student;
window.Seat = Seat;
window.SeatingData = SeatingData;
