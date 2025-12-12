/**
 * main.js - 主应用模块
 * 负责初始化、UI渲染和事件协调
 * 使用事件委托减少事件监听器数量
 */

class SeatingApp {
    constructor() {
        // 数据管理
        this.data = new SeatingData();

        // 多选状态
        this.selectedSeats = new Set();

        // 设备检测
        const deviceInfo = SeatingUtils.detectDeviceType();
        this.isMobile = deviceInfo.isMobile;
        this.isTablet = deviceInfo.isTablet;
        this.isDesktop = deviceInfo.isDesktop;
        this.hasTouchSupport = deviceInfo.hasTouchSupport;
        this.isMobileDevice = deviceInfo.isMobileDevice;

        // 防抖计时器
        this.searchDebounceTimer = null;

        // 屏幕方向
        this.lastOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';

        // 初始化
        this.init();
    }

    init() {
        // 加载数据
        this.data.loadFromStorage();

        // 确保座位数组已初始化（无论是否成功加载）
        if (!this.data.seats || this.data.seats.length === 0) {
            this.data.initializeSeats();
        }

        // 如果没有历史记录，添加初始状态
        if (this.data.history.length === 0) {
            this.data.addToHistory('seatArrangement', { seats: this.data.seats });
            this.data.historyIndex = -1;
        }

        // 初始化子模块
        this.dragDropManager = new DragDropManager(this);
        this.excelHandler = new ExcelHandler(this);
        this.aiHandler = new AIHandler(this); // 初始化 AI 处理器

        // 设置事件监听器（使用事件委托）
        this.setupEventDelegation();
        this.setupOrientationHandling();

        // 初始化子模块
        this.dragDropManager.init();
        this.excelHandler.init();

        // 渲染UI
        this.renderClassroom();
        this.renderStudentList();
        this.updateStats();
        this.applyCurrentFilter();
        this.updateHistoryButtons();
        this.initializeLayoutSettings();
    }

    // ==================== 事件委托 ====================

    setupEventDelegation() {
        // 全局点击事件委托
        document.addEventListener('click', this.handleGlobalClick.bind(this));

        // 全局变化事件委托
        document.addEventListener('change', this.handleGlobalChange.bind(this));

        // 输入事件委托
        document.addEventListener('input', this.handleGlobalInput.bind(this));

        // 键盘事件
        document.addEventListener('keypress', this.handleGlobalKeypress.bind(this));

        // 点击外部关闭下拉菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.layout-settings-container')) {
                this.hideLayoutSettingsDropdown();
            }
        });
    }

    handleGlobalClick(e) {
        // 1. 尝试向上查找点击目标是否被包含在一个 <button> 标签里
        const targetBtn = e.target.closest('button');
        const target = e.target;

        // 2. 如果找到了父级按钮，就用按钮的 ID；否则用当前点击目标的 ID
        // 这样无论点到按钮内的图标还是文字，都能正确识别出按钮功能
        const id = targetBtn ? targetBtn.id : target.id;
        const classList = target.classList;

        // 按钮点击处理
        switch (id) {
            case 'addStudent':
                this.showStudentModal();
                return;
            case 'randomSeat':
                this.randomSeatArrangement();
                return;
            case 'clearSeats':
                this.clearAllSeats();
                return;
            case 'exportPdfDirect':
                // 新按钮：直接导出PDF（所有设备通用）
                this.exportPdfDirectly();
                return;
            case 'saveLayout':
                // 修改为直接导出Excel
                this.excelHandler.exportToExcel();
                return;
            case 'printLayout':
                // 专门用于桌面端打印
                this.printLayout();
                return;
            case 'undoBtn':
                this.undo();
                return;
            case 'saveStudent':
                this.saveStudent();
                return;
            case 'cancelStudent':
                this.hideStudentModal();
                return;
            case 'clearAllStudents':
                this.clearAllStudents();
                return;
            case 'seatingSettingsBtn':
                this.showSeatingSettingsModal();
                return;
            case 'closeSeatingSettings':
                this.hideSeatingSettingsModal();
                return;
            case 'applySeatingRules':
                this.ruleBasedSeatArrangement();
                return;
            case 'layoutSettingsBtn':
                e.stopPropagation();
                this.toggleLayoutSettingsDropdown();
                return;
            case 'applyLayout':
            case 'applyLayoutDropdown':
                this.applyNewLayoutFromDropdown();
                return;
            case 'addConstraint':
                this.addConstraint();
                return;
            case 'exportExcel':
                this.hideExportFormatModal();
                this.excelHandler.exportToExcel();
                return;
            case 'exportPDF':
                this.hideExportFormatModal();
                this.printLayout();
                return;
            case 'selectAllSeats':
                this.selectAllSeats();
                return;
            case 'clearSelection':
                this.clearSelection();
                return;
            case 'clearSelectedSeats':
                this.clearSelectedSeats();
                return;

            case 'replaceSelectedStudents':
                this.replaceSelectedStudents();
                return;

            case 'clearSelection':
                this.clearSelection();
                return;

            // 座位轮换
            case 'rotateRowLeft':
                this.rotateSeats('rowLeft');
                return;
            case 'rotateRowRight':
                this.rotateSeats('rowRight');
                return;
            case 'rotateColForward':
                this.rotateSeats('colForward');
                return;
            case 'rotateColBackward':
                this.rotateSeats('colBackward');
                return;
        }

        // 模态框关闭按钮
        if (classList.contains('modal-close')) {
            const modal = target.closest('.modal');
            if (modal) modal.style.display = 'none';
            return;
        }

        // 模态框背景点击关闭
        if (classList.contains('modal')) {
            target.style.display = 'none';
            return;
        }

        // 颜色选择
        if (classList.contains('color-swatch')) {
            this.selectColor(target);
            return;
        }

        // Tab按钮
        if (classList.contains('tab-btn')) {
            this.excelHandler.switchTab(target.dataset.tab);
            return;
        }

        // 座位移除按钮（事件委托）
        if (classList.contains('seat-remove-btn')) {
            e.stopPropagation();
            this.removeStudentFromSeat(target.dataset.seatId);
            return;
        }

        // 座位删除按钮（事件委托）
        if (classList.contains('seat-delete-btn')) {
            e.stopPropagation();
            const seatId = target.dataset.seatId;
            if (confirm('确定要删除这个座位吗？删除后需重置才可恢复。')) {
                this.deleteSeat(seatId);
            }
            return;
        }

        // 约束删除按钮
        if (target.closest('.constraint-item .btn-secondary')) {
            const constraintId = target.closest('.constraint-item')?.dataset?.constraintId;
            if (constraintId) {
                this.removeConstraint(constraintId);
            }
            return;
        }
    }

    handleGlobalChange(e) {
        const target = e.target;
        const id = target.id;

        switch (id) {
            case 'filterStudents':
                this.filterStudentsByStatus(target.value);
                break;
            case 'showCoordinatesToggle':
                this.toggleCoordinatesDisplay(target.checked);
                break;
            case 'fontSelectDropdown':
                this.changeFontFamily(target.value);
                break;
        }
    }

    handleGlobalInput(e) {
        const target = e.target;

        if (target.id === 'searchStudent') {
            if (this.searchDebounceTimer) {
                clearTimeout(this.searchDebounceTimer);
            }
            const searchValue = target.value;
            this.searchDebounceTimer = setTimeout(() => {
                this.filterStudents(searchValue);
            }, 300);
        }
    }

    handleGlobalKeypress(e) {
        if (e.target.id === 'constraintInput' && e.key === 'Enter') {
            this.addConstraint();
        }
    }

    // ==================== 渲染方法 ====================

    renderClassroom(fullRebuild = true) {
        const container = document.getElementById('classroomGrid');
        if (!container) return;

        // iOS hack
        container.setAttribute('oncontextmenu', 'return false;');

        // 增量更新
        if (!fullRebuild && container.children.length > 0) {
            this.updateClassroomContent();
            return;
        }

        // 完全重建
        container.innerHTML = '';
        container.style.gridTemplateColumns = `repeat(${this.data.cols}, 1fr)`;
        // 移除 gridTemplateRows 的硬性规定，让 CSS Grid 自动处理行高
        // 移除 minHeight 的内联样式，由 CSS 控制
        container.style.removeProperty('min-height');
        container.style.height = '100%'; // 让其填满父容器

        const fragment = document.createDocumentFragment();

        this.data.seats.forEach(seat => {
            if (seat.isDeleted) return;

            const seatElement = this.createSeatElement(seat);
            fragment.appendChild(seatElement);
        });

        // 讲台
        const podiumElement = document.createElement('div');
        podiumElement.className = 'podium-in-grid';
        podiumElement.style.gridColumn = '1 / -1';
        podiumElement.style.gridRow = `${this.data.rows + 1}`;
        podiumElement.innerHTML = `
            <div class="podium-shape">
                <span class="podium-text">讲台</span>
            </div>
        `;
        fragment.appendChild(podiumElement);

        container.appendChild(fragment);

        this.updateClassroomInfo();

        // 应用坐标显示设置
        container.classList.remove('hide-coordinates');
        if (!this.data.showCoordinates) {
            container.classList.add('hide-coordinates');
        }
    }

    renderSeatContent(seat) {
        const displayCoord = `${this.data.rows - seat.row}-${seat.col + 1}`;

        if (seat.student) {
            const nameLengthClass = SeatingUtils.getNameLengthClass(seat.student.name.length);
            const fontClass = ` font-${this.data.selectedFont}`;
            // 职务水印：最多显示5个字
            const notesWatermark = seat.student.notes ? seat.student.notes.slice(0, 5) : '';
            const notesHtml = notesWatermark ? notesWatermark.split('').map(char => `<span>${char}</span>`).join('') : '';

            return `
                ${notesHtml ? `<div class="seat-notes-watermark">${notesHtml}</div>` : ''}
                <div class="seat-number">${displayCoord}</div>
                <div class="student-name-display${nameLengthClass}${fontClass}" data-student-uuid="${seat.student.uuid}" data-source-seat-id="${seat.id}">${seat.student.name}</div>
                <div class="seat-remove-btn" data-seat-id="${seat.id}" title="移除学生">×</div>
            `;
        } else {
            return `
                <div class="seat-number">${displayCoord}</div>
                <div class="seat-delete-btn" data-seat-id="${seat.id}" title="删除座位">⌫</div>
            `;
        }
    }

    createSeatElement(seat) {
        const seatElement = document.createElement('div');
        seatElement.className = 'seat';
        seatElement.dataset.seatId = seat.id;
        seatElement.setAttribute('oncontextmenu', 'return false;');
        seatElement.style.gridRow = seat.row + 1;
        seatElement.style.gridColumn = seat.col + 1;

        if (seat.student) {
            seatElement.classList.add('seat-occupied');
            if (seat.student.gender === 'male') {
                seatElement.classList.add('male');
            } else if (seat.student.gender === 'female') {
                seatElement.classList.add('female');
            }

            seatElement.innerHTML = this.renderSeatContent(seat);

            // 桌面端启用HTML5拖拽
            if (!this.hasTouchSupport) {
                seatElement.draggable = true;
                seatElement.style.cursor = 'grab';
            }
        } else {
            seatElement.classList.add('seat-empty');
            seatElement.innerHTML = this.renderSeatContent(seat);
        }

        // 点击选择逻辑改由 DragDropManager 统一处理，避免与 pointer 事件冲突

        return seatElement;
    }

    updateClassroomContent() {
        const container = document.getElementById('classroomGrid');

        this.data.seats.forEach(seat => {
            if (seat.isDeleted) return;

            const seatElement = container.querySelector(`[data-seat-id="${seat.id}"]`);
            if (!seatElement) return;

            const displayCoord = `${this.data.rows - seat.row}-${seat.col + 1}`;

            if (seat.student) {
                seatElement.classList.remove('seat-empty');
                seatElement.classList.add('seat-occupied');
                seatElement.classList.remove('male', 'female');

                if (seat.student.gender === 'male') {
                    seatElement.classList.add('male');
                } else if (seat.student.gender === 'female') {
                    seatElement.classList.add('female');
                }

                const nameLengthClass = SeatingUtils.getNameLengthClass(seat.student.name.length);
                const fontClass = ` font-${this.data.selectedFont}`;
                // 职务水印：最多显示5个字
                const notesWatermark = seat.student.notes ? seat.student.notes.slice(0, 5) : '';
                const notesHtml = notesWatermark ? notesWatermark.split('').map(char => `<span>${char}</span>`).join('') : '';

                seatElement.innerHTML = `
                    ${notesHtml ? `<div class="seat-notes-watermark">${notesHtml}</div>` : ''}
                    <div class="seat-number">${displayCoord}</div>
                    <div class="student-name-display${nameLengthClass}${fontClass}" data-student-uuid="${seat.student.uuid}" data-source-seat-id="${seat.id}">${seat.student.name}</div>
                    <div class="seat-remove-btn" data-seat-id="${seat.id}" title="移除学生">×</div>
                `;
            } else {
                seatElement.classList.remove('seat-occupied', 'male', 'female');
                seatElement.classList.add('seat-empty');
                seatElement.innerHTML = `
                    <div class="seat-number">${displayCoord}</div>
                    <div class="seat-delete-btn" data-seat-id="${seat.id}" title="删除座位">⌫</div>
                `;
            }
        });
    }

    renderStudentList() {
        const container = document.getElementById('studentList');
        if (!container) return;

        const existingItems = new Map();
        Array.from(container.children).forEach(item => {
            const uuid = item.dataset.studentUuid;
            if (uuid) existingItems.set(uuid, item);
        });

        const fragment = document.createDocumentFragment();

        this.data.students.forEach(student => {
            const isSeated = this.data.seats.some(seat => seat.student && seat.student.uuid === student.uuid);
            let item = existingItems.get(student.uuid);

            if (item) {
                item.classList.toggle('seated', isSeated);
                this.updateStudentItemContent(item, student, isSeated);
                existingItems.delete(student.uuid);
            } else {
                item = this.createStudentItem(student, isSeated);
                fragment.appendChild(item);
            }
        });

        existingItems.forEach(item => container.removeChild(item));

        if (fragment.children.length > 0) {
            container.appendChild(fragment);
        }
    }

    createStudentItem(student, isSeated) {
        const item = document.createElement('div');
        item.className = 'student-item';
        item.dataset.studentUuid = student.uuid;
        item.setAttribute('oncontextmenu', 'return false;');

        if (isSeated) {
            item.classList.add('seated');
        }

        // 桌面端启用HTML5拖拽
        if (!this.hasTouchSupport) {
            item.draggable = true;
        }

        this.updateStudentItemContent(item, student, isSeated);

        return item;
    }

    updateStudentItemContent(item, student, isSeated) {
        let details = [];
        if (student.gender) {
            const genderText = student.gender === 'male' ? '男' : student.gender === 'female' ? '女' : student.gender;
            details.push(`性别: ${genderText}`);
        }

        item.innerHTML = `
            <div class="student-info">
                <div class="student-name">${student.name}</div>
                <div class="student-details">${details.join(' | ')}</div>
                ${student.notes ? `<div class="student-notes">备注: ${student.notes}</div>` : ''}
            </div>
            <div class="student-actions">
                <button class="btn btn-small btn-edit" onclick="app.showStudentModal(app.data.students.find(s => s.uuid === '${student.uuid}'))">编辑</button>
                <button class="btn btn-small btn-secondary" onclick="app.deleteStudent('${student.uuid}')">删除</button>
            </div>
        `;
    }

    // ==================== 学生管理 ====================

    showStudentModal(student = null) {
        const modal = document.getElementById('studentModal');
        const form = document.getElementById('studentForm');
        const title = document.getElementById('modalTitle');

        if (student) {
            title.textContent = '编辑学生';
            document.getElementById('studentName').value = student.name;
            document.getElementById('studentId').value = student.id || '';
            document.getElementById('studentHeight').value = student.height || '';
            document.getElementById('studentGender').value = student.gender || '';
            document.getElementById('studentNotes').value = student.notes || '';
            form.dataset.editId = student.uuid;
        } else {
            title.textContent = '添加学生';
            form.reset();
            delete form.dataset.editId;
        }

        modal.style.display = 'flex';
    }

    hideStudentModal() {
        document.getElementById('studentModal').style.display = 'none';
    }

    saveStudent() {
        const form = document.getElementById('studentForm');
        const name = document.getElementById('studentName').value.trim();

        if (!name) {
            alert('请输入学生姓名');
            return;
        }

        const student = {
            uuid: form.dataset.editId || SeatingUtils.generateUUID(),
            name: name,
            id: document.getElementById('studentId').value.trim(),
            height: parseInt(document.getElementById('studentHeight').value) || null,
            gender: document.getElementById('studentGender').value,
            notes: document.getElementById('studentNotes').value.trim(),
            seatId: null
        };

        if (form.dataset.editId) {
            const index = this.data.students.findIndex(s => s.uuid === form.dataset.editId);
            if (index !== -1) {
                this.data.students[index] = student;
            }
        } else {
            this.data.students.push(student);
        }

        this.data.saveToStorage();
        this.renderStudentList();
        this.updateStats();
        this.applyCurrentFilter();
        this.hideStudentModal();
    }

    deleteStudent(uuid) {
        if (confirm('确定要删除这个学生吗？')) {
            const seat = this.data.seats.find(s => s.student && s.student.uuid === uuid);
            if (seat) {
                seat.student = null;
            }

            this.data.students = this.data.students.filter(s => s.uuid !== uuid);
            this.syncStudentSeatIds();
            this.data.saveToStorage();
            this.renderStudentList();
            this.renderClassroom();
            this.updateStats();
            this.applyCurrentFilter();
        }
    }

    clearAllStudents() {
        if (confirm('确定要清空所有学生吗？')) {
            this.data.addToHistory('seatArrangement', { seats: this.data.seats });

            this.data.students = [];
            this.data.seats.forEach(seat => seat.student = null);

            this.syncStudentSeatIds();

            this.data.saveToStorage();
            this.renderStudentList();
            this.renderClassroom();
            this.updateStats();
            this.applyCurrentFilter();
        }
    }

    // ==================== 座位操作 ====================

    assignStudentToSeat(studentUuid, seatId, sourceSeatId = null) {
        const student = this.data.findStudentByUuid(studentUuid);
        const targetSeat = this.data.findSeatById(seatId);

        if (!student || !targetSeat || targetSeat.isDeleted) return;

        const currentSeat = this.data.seats.find(s => s.student && s.student.uuid === studentUuid);
        if (currentSeat && currentSeat.id === seatId) return;

        this.data.addToHistory('seatArrangement', { seats: this.data.seats });

        const displacedStudent = targetSeat.student;
        targetSeat.student = student;

        if (currentSeat) {
            if (displacedStudent) {
                currentSeat.student = displacedStudent;
            } else {
                currentSeat.student = null;
            }
        }

        this.syncStudentSeatIds();

        this.data.saveToStorage();
        this.renderClassroom(false);
        this.renderStudentList();
        this.updateStats();
        this.applyCurrentFilter();
        this.updateHistoryButtons();
    }

    removeStudentFromSeat(seatId) {
        const seat = this.data.findSeatById(seatId);
        if (seat && seat.student) {
            this.data.addToHistory('seatArrangement', { seats: this.data.seats });
            seat.student = null;
            this.syncStudentSeatIds();

            this.data.saveToStorage();
            this.renderClassroom(false);
            this.renderStudentList();
            this.updateStats();
            this.applyCurrentFilter();
            this.updateHistoryButtons();
        }
    }

    deleteSeat(seatId) {
        const seat = this.data.findSeatById(seatId);
        if (!seat) return;

        if (seat.student) {
            alert('请先移除学生，然后才能删除座位');
            return;
        }

        this.data.addToHistory('seatArrangement', { seats: this.data.seats });
        seat.isDeleted = true;

        this.data.saveToStorage();
        this.renderClassroom();
        this.updateStats();
        this.updateHistoryButtons();
    }

    // ==================== 多选操作 ====================

    toggleSeatSelection(seatId, clearOthers = false) {
        if (clearOthers && !this.selectedSeats.has(seatId)) {
            this.clearSelection();
        }

        if (this.selectedSeats.has(seatId)) {
            this.selectedSeats.delete(seatId);
        } else {
            this.selectedSeats.add(seatId);
        }

        this.updateSelectionUI();
    }

    selectAllSeats() {
        this.selectedSeats.clear();
        this.data.seats.forEach(seat => {
            if (!seat.isDeleted) {
                this.selectedSeats.add(seat.id);
            }
        });
        this.updateSelectionUI();
    }

    clearSelection() {
        this.selectedSeats.clear();
        this.updateSelectionUI();
    }

    clearSelectedSeats() {
        if (this.selectedSeats.size === 0) {
            alert('请先选择要清空的座位');
            return;
        }

        if (confirm(`确定要清空选中的 ${this.selectedSeats.size} 个座位吗？`)) {
            this.data.addToHistory('seatArrangement', { seats: this.data.seats });

            this.selectedSeats.forEach(seatId => {
                const seat = this.data.findSeatById(seatId);
                if (seat && !seat.isDeleted) {
                    seat.student = null;
                }
            });

            this.clearSelection();
            this.data.saveToStorage();
            this.renderClassroom(false);
            this.renderStudentList();
            this.updateStats();
            this.applyCurrentFilter();
            this.updateHistoryButtons();
        }
    }

    updateSelectionUI() {
        const toolbar = document.getElementById('multiSelectToolbar');
        const countElement = document.getElementById('selectionCount');

        document.querySelectorAll('.seat').forEach(seatElement => {
            const seatId = seatElement.dataset.seatId;
            seatElement.classList.remove('seat-multi-selected', 'seat-multi-selecting');

            if (this.selectedSeats.has(seatId)) {
                seatElement.classList.add('seat-multi-selected');
            }
        });

        if (toolbar) {
            // 用户要求移除“已选择...”栏的显示
            toolbar.classList.remove('show');
        }
    }

    syncStudentSeatIds() {
        this.data.students.forEach(s => { s.seatId = null; });
        this.data.seats.forEach(seat => {
            if (seat.student) {
                seat.student.seatId = seat.id;
            }
        });
    }


    // 批量替换座位上的学生
    replaceSelectedStudents() {
        if (this.selectedSeats.size === 0) {
            alert('请先选择要替换的座位');
            return;
        }

        // 只在桌面端显示
        if (this.isMobileDevice) {
            alert('此功能仅支持桌面端使用');
            return;
        }

        const selectedCount = this.selectedSeats.size;
        
        // 获取已坐座位的学生
        const seatedStudents = new Set();
        this.data.seats.forEach(seat => {
            if (seat.student) {
                seatedStudents.add(seat.student.uuid);
            }
        });

        // 获取未分配的学生列表
        const unseatedStudents = this.data.students.filter(s => !seatedStudents.has(s.uuid));

        if (unseatedStudents.length === 0) {
            alert('没有未分配的学生可以替换');
            return;
        }

        if (unseatedStudents.length < selectedCount) {
            alert(`只有 ${unseatedStudents.length} 个未分配的学生，无法为 ${selectedCount} 个座位全部替换`);
            return;
        }

        this.showReplaceStudentDialog(unseatedStudents);
    }

    // 显示替换学生对话框（带位置预览和交换功能）
    showReplaceStudentDialog(availableStudents) {
        const selectedSeatIds = Array.from(this.selectedSeats);
        const selectedCount = selectedSeatIds.length;
        
        // 获取选中座位的信息（包括当前学生和位置）
        const seatInfos = selectedSeatIds.map(seatId => {
            const seat = this.data.findSeatById(seatId);
            const displayCoord = SeatingUtils.toDisplayCoord(seat.row, seat.col, this.data.rows);
            return {
                seatId,
                seat,
                displayRow: displayCoord.row,
                displayCol: displayCoord.col,
                currentStudent: seat.student
            };
        });

        // 构建交换预览HTML - 显示每个座位将如何变化
        let previewHtml = '<div style="max-height: 350px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">';
        
        seatInfos.forEach((info, index) => {
            const availableStudent = availableStudents[index];
            if (!availableStudent) return;
            
            const currentName = info.currentStudent ? info.currentStudent.name : '(空座位)';
            const newName = availableStudent.name;
            const positionText = `第${info.displayRow}排第${info.displayCol}列`;
            
            // 新学生的性别标识
            const genderColor = availableStudent.gender === 'male' ? '#3b82f6' : 
                               (availableStudent.gender === 'female' ? '#ec4899' : '#666');
            const genderText = availableStudent.gender === 'male' ? '♂' : 
                              (availableStudent.gender === 'female' ? '♀' : '');
            
            previewHtml += `
                <div style="display: flex; align-items: center; padding: 12px 15px; border-bottom: 1px solid #e2e8f0; background: white;">
                    <div style="flex: 1; display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" class="replace-student-checkbox"
                               value="${availableStudent.uuid}"
                               data-seat-id="${info.seatId}"
                               data-index="${index}"
                               checked
                               style="width: 16px; height: 16px; cursor: pointer;">
                        <span style="color: ${genderColor}; font-weight: 600;">${newName}</span>
                        <span style="color: #999; font-size: 12px;">${genderText}</span>
                    </div>
                    <div style="color: #22c55e; font-size: 18px; margin: 0 10px;">→</div>
                    <div style="flex: 1; text-align: right;">
                        <div style="font-weight: 500; color: #333;">${positionText}</div>
                        <div style="font-size: 12px; color: #999;">${info.currentStudent ? '替换: ' + currentName : '空座位'}</div>
                    </div>
                </div>
            `;
        });
        
        previewHtml += '</div>';

        // 如果有学生会被替换，显示交换提示
        const studentsToBeReplaced = seatInfos.filter(info => info.currentStudent).map(info => info.currentStudent);
        let swapNotice = '';
        if (studentsToBeReplaced.length > 0) {
            swapNotice = `
                <div style="margin-top: 12px; padding: 10px; background: #fef3c7; border-radius: 6px; border-left: 3px solid #f59e0b;">
                    <div style="font-size: 13px; color: #92400e;">
                        <strong>💡 交换模式：</strong>被替换的 ${studentsToBeReplaced.length} 名学生将自动移至未分配状态
                    </div>
                </div>
            `;
        }

        // 创建对话框
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.2);
            z-index: 10000;
            min-width: 450px;
            max-width: 550px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        `;

        dialog.innerHTML = `
            <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #1e293b; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 22px;">↻</span> 批量替换学生
            </h3>
            <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px;">
                选择要移入的学生，预览替换效果：
            </p>
            ${previewHtml}
            ${swapNotice}
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancelReplaceBtn" style="padding: 10px 20px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; font-size: 14px; color: #64748b; transition: all 0.2s;">
                    取消
                </button>
                <button id="confirmReplaceBtn" style="padding: 10px 20px; border: none; background: #3b82f6; color: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s;">
                    确认替换
                </button>
            </div>
        `;

        // 背景遮罩
        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 9999;
        `;
        
        document.body.appendChild(backdrop);
        document.body.appendChild(dialog);

        // 按钮悬停效果
        const cancelBtn = document.getElementById('cancelReplaceBtn');
        const confirmBtn = document.getElementById('confirmReplaceBtn');
        
        cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.background = '#f1f5f9');
        cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.background = 'white');
        confirmBtn.addEventListener('mouseenter', () => confirmBtn.style.background = '#2563eb');
        confirmBtn.addEventListener('mouseleave', () => confirmBtn.style.background = '#3b82f6');

        // 取消按钮
        cancelBtn.addEventListener('click', () => {
            backdrop.remove();
            dialog.remove();
        });

        // 确认按钮
        confirmBtn.addEventListener('click', () => {
            const checkboxes = dialog.querySelectorAll('.replace-student-checkbox:checked');
            const replacements = Array.from(checkboxes).map(cb => ({
                studentUuid: cb.value,
                seatId: cb.dataset.seatId
            }));

            if (replacements.length === 0) {
                alert('请至少选择一个学生');
                return;
            }

            backdrop.remove();
            dialog.remove();

            this.executeReplaceSelectedSeats(replacements);
        });

        // 点击背景关闭
        backdrop.addEventListener('click', () => {
            backdrop.remove();
            dialog.remove();
        });
    }

    // 执行替换操作（支持交换：被替换学生移至未分配）
    executeReplaceSelectedSeats(replacements) {
        this.data.addToHistory('seatArrangement', { seats: this.data.seats });

        // 收集被替换的学生（将变为未分配状态）
        const replacedStudents = [];
        
        // 执行替换
        replacements.forEach(({ studentUuid, seatId }) => {
            const targetSeat = this.data.findSeatById(seatId);
            const newStudent = this.data.students.find(s => s.uuid === studentUuid);
            
            if (targetSeat && newStudent && !targetSeat.isDeleted) {
                // 保存被替换的学生
                if (targetSeat.student) {
                    replacedStudents.push(targetSeat.student);
                }
                // 设置新学生
                targetSeat.student = newStudent;
            }
        });

        // 被替换的学生现在变为未分配状态（它们的seat引用会在syncStudentSeatIds中清除）
        
        this.clearSelection();
        this.syncStudentSeatIds();
        this.data.saveToStorage();
        this.renderClassroom(false);
        this.renderStudentList();
        this.updateStats();
        this.applyCurrentFilter();
        this.updateHistoryButtons();

        // 显示替换结果提示
        if (replacedStudents.length > 0) {
            const names = replacedStudents.map(s => s.name).join('、');
            console.log(`已将 ${names} 移至未分配状态`);
        }
    }

    // ==================== 排座算法 ====================

    randomSeatArrangement() {
        if (this.data.students.length === 0) {
            alert('请先添加学生');
            return;
        }

        this.data.addToHistory('seatArrangement', { seats: this.data.seats });

        this.data.seats.forEach(seat => {
            if (!seat.isDeleted) seat.student = null;
        });

        const availableSeats = this.data.getActiveSeats();
        const studentsToSeat = [...this.data.students];

        while (studentsToSeat.length > 0 && availableSeats.length > 0) {
            const randomStudentIndex = Math.floor(Math.random() * studentsToSeat.length);
            const randomSeatIndex = Math.floor(Math.random() * availableSeats.length);

            const student = studentsToSeat.splice(randomStudentIndex, 1)[0];
            const seat = availableSeats.splice(randomSeatIndex, 1)[0];

            seat.student = student;
        }

        this.syncStudentSeatIds();

        this.data.saveToStorage();
        this.renderClassroom(false);
        this.renderStudentList();
        this.updateStats();
        this.applyCurrentFilter();
        this.updateHistoryButtons();
    }

    ruleBasedSeatArrangement() {
        if (this.data.students.length === 0) {
            alert('请先添加学生');
            return;
        }

        this.data.addToHistory('seatArrangement', { seats: this.data.seats });

        this.data.seats.forEach(seat => {
            if (!seat.isDeleted) seat.student = null;
        });

        const arrangeByRow = document.getElementById('arrangeByRow')?.checked || false;
        const arrangeByColumn = document.getElementById('arrangeByColumn')?.checked || false;
        const heightRule = document.getElementById('heightRule')?.checked || false;

        let studentsToSeat = [...this.data.students];

        if (arrangeByRow || arrangeByColumn) {
            studentsToSeat.sort((a, b) => {
                const idA = a.id || '';
                const idB = b.id || '';
                return idA.localeCompare(idB, undefined, { numeric: true });
            });
        }

        if (heightRule) {
            studentsToSeat.sort((a, b) => {
                const heightA = parseInt(a.height) || 0;
                const heightB = parseInt(b.height) || 0;
                return heightA - heightB;
            });
        }

        if (!(arrangeByRow || arrangeByColumn || heightRule)) {
            this.randomSeatArrangement();
            this.hideSeatingSettingsModal();
            return;
        } else {
            const arrangementType = arrangeByColumn ? 'column' : 'row';
            this.arrangeStudentsInOrder(studentsToSeat, arrangementType);
        }

        this.syncStudentSeatIds();

        this.data.saveToStorage();
        this.renderClassroom(false);
        this.renderStudentList();
        this.updateStats();
        this.applyCurrentFilter();
        this.hideSeatingSettingsModal();
        this.updateHistoryButtons();
    }

    arrangeStudentsInOrder(students, arrangementType = 'row') {
        let availableSeats;

        if (arrangementType === 'column') {
            availableSeats = this.data.getActiveSeats().sort((a, b) => {
                if (a.col !== b.col) return a.col - b.col;
                return b.row - a.row;
            });
        } else {
            availableSeats = this.data.getActiveSeats().sort((a, b) => {
                if (a.row !== b.row) return b.row - a.row;
                return a.col - b.col;
            });
        }

        students.forEach((student, index) => {
            if (index < availableSeats.length) {
                availableSeats[index].student = student;
            }
        });
    }

    arrangeSameGenderSeating(students) {
        const maleStudents = students.filter(s => s.gender === 'male');
        const femaleStudents = students.filter(s => s.gender === 'female');
        const unknownGenderStudents = students.filter(s => !s.gender || (s.gender !== 'male' && s.gender !== 'female'));

        const availableSeats = this.data.getActiveSeats().sort((a, b) => {
            if (a.row !== b.row) return a.row - b.row;
            return a.col - b.col;
        });

        let seatIndex = 0;

        // 安排男生
        for (let i = 0; i < maleStudents.length && seatIndex < availableSeats.length; i += 2) {
            if (i + 1 < maleStudents.length && seatIndex + 1 < availableSeats.length) {
                availableSeats[seatIndex].student = maleStudents[i];
                availableSeats[seatIndex + 1].student = maleStudents[i + 1];
                seatIndex += 2;
            } else {
                availableSeats[seatIndex].student = maleStudents[i];
                seatIndex += 1;
            }
        }

        // 安排女生
        for (let i = 0; i < femaleStudents.length && seatIndex < availableSeats.length; i += 2) {
            if (i + 1 < femaleStudents.length && seatIndex + 1 < availableSeats.length) {
                availableSeats[seatIndex].student = femaleStudents[i];
                availableSeats[seatIndex + 1].student = femaleStudents[i + 1];
                seatIndex += 2;
            } else {
                availableSeats[seatIndex].student = femaleStudents[i];
                seatIndex += 1;
            }
        }

        // 安排未知性别
        unknownGenderStudents.forEach(student => {
            if (seatIndex < availableSeats.length) {
                availableSeats[seatIndex].student = student;
                seatIndex++;
            }
        });
    }

    clearAllSeats() {
        if (confirm('确定要重置所有座位吗？这将清空座位上的学生并恢复所有已删除的座位。')) {
            this.data.addToHistory('seatArrangement', { seats: this.data.seats });

            this.data.seats.forEach(seat => {
                seat.student = null;
                seat.isDeleted = false;
            });

            this.data.saveToStorage();
            this.renderClassroom();
            this.renderStudentList();
            this.updateStats();
            this.applyCurrentFilter();
            this.updateHistoryButtons();
        }
    }

    // ==================== 座位轮换 ====================

    rotateSeats(direction) {
        this.data.addToHistory('seatArrangement', { seats: this.data.seats });

        const activeSeats = this.data.getActiveSeats();

        switch (direction) {
            case 'rowLeft':
                this.rotateRows(activeSeats, -1);
                break;
            case 'rowRight':
                this.rotateRows(activeSeats, 1);
                break;
            case 'colForward':
                this.rotateCols(activeSeats, -1);
                break;
            case 'colBackward':
                this.rotateCols(activeSeats, 1);
                break;
        }

        this.syncStudentSeatIds();

        this.data.saveToStorage();
        this.renderClassroom(false);
        this.renderStudentList();
        this.updateStats();
        this.updateHistoryButtons();
    }

    rotateRows(seats, direction) {
        const rows = {};
        seats.forEach(seat => {
            if (!rows[seat.row]) rows[seat.row] = [];
            rows[seat.row].push(seat);
        });

        Object.values(rows).forEach(rowSeats => {
            rowSeats.sort((a, b) => a.col - b.col);
            const students = rowSeats.map(s => s.student);

            if (direction > 0) {
                students.unshift(students.pop());
            } else {
                students.push(students.shift());
            }

            rowSeats.forEach((seat, i) => {
                seat.student = students[i];
            });
        });
    }

    rotateCols(seats, direction) {
        const cols = {};
        seats.forEach(seat => {
            if (!cols[seat.col]) cols[seat.col] = [];
            cols[seat.col].push(seat);
        });

        Object.values(cols).forEach(colSeats => {
            colSeats.sort((a, b) => a.row - b.row);
            const students = colSeats.map(s => s.student);

            if (direction > 0) {
                students.unshift(students.pop());
            } else {
                students.push(students.shift());
            }

            colSeats.forEach((seat, i) => {
                seat.student = students[i];
            });
        });
    }

    // ==================== 多选拖拽支持方法 ====================

    checkMultiDropTarget(targetSeatId, selectedSeatIds) {
        const targetSeat = this.data.findSeatById(targetSeatId);
        if (!targetSeat || targetSeat.isDeleted) return null;

        // 计算相对位置
        const positions = [];
        const displacedStudents = [];

        // 找到参考点（第一个选中座位）
        const firstSelectedId = selectedSeatIds[0];
        const firstSelectedSeat = this.data.findSeatById(firstSelectedId);
        if (!firstSelectedSeat) return null;

        const rowOffset = targetSeat.row - firstSelectedSeat.row;
        const colOffset = targetSeat.col - firstSelectedSeat.col;

        for (const seatId of selectedSeatIds) {
            const sourceSeat = this.data.findSeatById(seatId);
            if (!sourceSeat) continue;

            const newRow = sourceSeat.row + rowOffset;
            const newCol = sourceSeat.col + colOffset;

            // 检查边界
            if (newRow < 0 || newRow >= this.data.rows || newCol < 0 || newCol >= this.data.cols) {
                return null;
            }

            const targetSeatForThis = this.data.seats.find(s => s.row === newRow && s.col === newCol);
            if (!targetSeatForThis || targetSeatForThis.isDeleted) {
                return null;
            }

            positions.push({
                originalSeatId: seatId,
                targetSeatId: targetSeatForThis.id,
                student: sourceSeat.student
            });

            // 检查是否会替换其他学生
            if (targetSeatForThis.student && !selectedSeatIds.includes(targetSeatForThis.id)) {
                displacedStudents.push(targetSeatForThis.student);
            }
        }

        return { positions, displacedStudents };
    }

    showMultiDragPreview(targetSeatId, selectedSeatIds) {
        this.clearMultiDragPreview();

        const dropResult = this.checkMultiDropTarget(targetSeatId, selectedSeatIds);
        if (!dropResult) return;

        dropResult.positions.forEach(pos => {
            const targetSeatElement = document.querySelector(`[data-seat-id="${pos.targetSeatId}"]`);
            if (targetSeatElement && pos.student) {
                targetSeatElement.classList.add('seat-drag-preview');

                // 创建预览名字元素
                const previewName = document.createElement('div');
                previewName.className = 'seat-preview-name';
                previewName.textContent = pos.student.name;
                previewName.dataset.previewElement = 'true';

                // 清除目标座位内容，只保留预览名字
                targetSeatElement.innerHTML = '';
                targetSeatElement.appendChild(previewName);
            }
        });
    }

    clearMultiDragPreview() {
        document.querySelectorAll('.seat-drag-preview').forEach(el => {
            el.classList.remove('seat-drag-preview');

            // 移除预览名字元素并恢复原始座位内容
            const previewName = el.querySelector('[data-preview-element="true"]');
            if (previewName) {
                previewName.remove();
            }

            // 重新渲染座位内容
            const seatId = el.dataset.seatId;
            const seat = this.data.findSeatById(seatId);
            if (seat) {
                const seatContent = this.renderSeatContent(seat);
                el.innerHTML = seatContent;
            }
        });
    }

    executeMultiDropWithAllSeats(targetSeatId, dragData) {
        console.log('[executeMultiDropWithAllSeats] 开始执行，targetSeatId:', targetSeatId);

        if (!dragData.sourceSeats || !Array.isArray(dragData.sourceSeats)) {
            console.error('[executeMultiDropWithAllSeats] dragData.sourceSeats无效');
            return;
        }

        const seatIds = dragData.sourceSeats.map(s => s.seatId);
        const dropResult = this.checkMultiDropTarget(targetSeatId, seatIds);

        if (!dropResult) {
            console.log('[executeMultiDropWithAllSeats] dropResult为空，放置失败');
            return;
        }

        this.data.addToHistory('seatArrangement', { seats: this.data.seats });

        // 1. 识别真正空出来的源座位（净空位）
        // 只有那些不作为目标座位的源座位，才是真正空出来的，可用于安置被替换的学生
        const targetSeatIdsSet = new Set(dropResult.positions.map(p => p.targetSeatId));
        const availableSourceSeats = dragData.sourceSeats
            .filter(s => !targetSeatIdsSet.has(s.seatId))
            .map(s => this.data.findSeatById(s.seatId))
            .filter(s => s && !s.isDeleted)
            .sort((a, b) => (a.row - b.row) || (a.col - b.col)); // 按位置排序

        // 2. 收集被替换的学生
        const displacedStudents = [];
        const studentsToMove = [];

        dropResult.positions.forEach(pos => {
            const sourceSeat = this.data.findSeatById(pos.originalSeatId);
            const targetSeat = this.data.findSeatById(pos.targetSeatId);

            if (sourceSeat && sourceSeat.student) {
                studentsToMove.push({
                    student: sourceSeat.student,
                    targetSeatId: pos.targetSeatId
                });
                // 先清空源座位
                sourceSeat.student = null;
            }

            // 如果目标座位有学生，且该学生不是本次移动的一员（即不在源座位列表中），则视为被替换
            if (targetSeat && targetSeat.student && !seatIds.includes(pos.targetSeatId)) {
                displacedStudents.push({
                    student: targetSeat.student,
                    currentSeat: targetSeat // 保存当前位置用于排序
                });
            }
        });

        // 3. 对被替换学生按当前位置排序，以保持相对顺序
        displacedStudents.sort((a, b) => {
            return (a.currentSeat.row - b.currentSeat.row) || (a.currentSeat.col - b.currentSeat.col);
        });

        console.log('[executeMultiDropWithAllSeats] 准备移动的学生:', studentsToMove.length);
        console.log('[executeMultiDropWithAllSeats] 被替换的学生(交换):', displacedStudents.length);
        console.log('[executeMultiDropWithAllSeats] 可用回填座位:', availableSourceSeats.length);

        // 4. 放置移动的学生
        studentsToMove.forEach(item => {
            const targetSeat = this.data.findSeatById(item.targetSeatId);
            if (targetSeat) {
                targetSeat.student = item.student;
            }
        });

        // 5. 将被替换的学生填入可用的源座位（交换逻辑）
        displacedStudents.forEach((item, index) => {
            if (index < availableSourceSeats.length) {
                const seat = availableSourceSeats[index];
                seat.student = item.student;
                console.log(`[Swap] ${item.student.name} 交换至座位 ${seat.id}`);
            } else {
                // 如果没有位置（理论上不应发生，除非源座位被删除了），则移至未分配
                item.student.seatId = null;
                console.log(`[Swap] 无处安放 ${item.student.name}, 移至未分配`);
            }
        });

        this.clearSelection();
        this.syncStudentSeatIds();
        this.data.saveToStorage();
        this.renderClassroom(false);
        this.renderStudentList();
        this.updateStats();
        this.applyCurrentFilter();
        this.updateHistoryButtons();

        console.log('[executeMultiDropWithAllSeats] 完成');
    }

    // ==================== 历史记录 ====================

    undo() {
        const historyItem = this.data.undo();
        if (historyItem) {
            this.restoreFromHistory(historyItem);
        }
    }

    restoreFromHistory(historyItem) {
        if (historyItem.action === 'seatArrangement') {
            this.data.seats = SeatingUtils.deepClone(historyItem.data.seats);

            // 【关键修复】重新链接座位上的学生对象到 students 数组
            // deepClone 会创建新对象，需要重新链接引用
            this.data.relinkStudentReferences();

            this.renderClassroom();
            this.renderStudentList();
            this.updateStats();
        }
        this.updateHistoryButtons();
    }

    updateHistoryButtons() {
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            const canUndo = this.data.canUndo();
            // 明确设置disabled属性，并移除任何disabled属性的限制
            if (canUndo) {
                undoBtn.disabled = false;
                // 移除disabled属性以确保没有CSS覆盖
                undoBtn.removeAttribute('disabled');
            } else {
                undoBtn.disabled = true;
                undoBtn.setAttribute('disabled', 'disabled');
            }
        }
    }

    // ==================== UI辅助方法 ====================

    updateStats() {
        const totalStudents = this.data.students.length;
        const seatedStudents = this.data.getSeatedStudentsCount();
        const unseatedStudents = totalStudents - seatedStudents;

        document.getElementById('totalStudents').textContent = totalStudents;
        document.getElementById('seatedStudents').textContent = seatedStudents;
        document.getElementById('unseatedStudents').textContent = unseatedStudents;
    }

    updateClassroomInfo() {
        document.getElementById('classroomSize').textContent = `${this.data.rows}行 × ${this.data.cols}列`;
    }

    filterStudents(searchTerm) {
        const items = document.querySelectorAll('.student-item');
        items.forEach(item => {
            const name = item.querySelector('.student-name')?.textContent.toLowerCase() || '';
            const details = item.querySelector('.student-details')?.textContent.toLowerCase() || '';

            if (name.includes(searchTerm.toLowerCase()) || details.includes(searchTerm.toLowerCase())) {
                item.classList.remove('search-hidden');
            } else {
                item.classList.add('search-hidden');
            }
        });
    }

    filterStudentsByStatus(status) {
        const items = document.querySelectorAll('.student-item');
        items.forEach(item => {
            const isSeated = item.classList.contains('seated');

            switch (status) {
                case 'all':
                    item.classList.remove('status-hidden');
                    break;
                case 'seated':
                    item.classList.toggle('status-hidden', !isSeated);
                    break;
                case 'unseated':
                    item.classList.toggle('status-hidden', isSeated);
                    break;
            }
        });
    }

    applyCurrentFilter() {
        const filterSelect = document.getElementById('filterStudents');
        const searchInput = document.getElementById('searchStudent');

        if (filterSelect && searchInput) {
            const items = document.querySelectorAll('.student-item');
            items.forEach(item => {
                item.classList.remove('search-hidden', 'status-hidden');
            });

            this.filterStudentsByStatus(filterSelect.value);

            const searchValue = searchInput.value.trim();
            if (searchValue) {
                this.filterStudents(searchValue);
            }
        }
    }

    // ==================== 模态框方法 ====================

    showSeatingSettingsModal() {
        document.getElementById('seatingSettingsModal').style.display = 'flex';
        this.renderConstraintList();
    }

    hideSeatingSettingsModal() {
        document.getElementById('seatingSettingsModal').style.display = 'none';
    }

    showExportFormatModal() {
        document.getElementById('exportFormatModal').style.display = 'flex';
    }

    hideExportFormatModal() {
        document.getElementById('exportFormatModal').style.display = 'none';
    }

    toggleLayoutSettingsDropdown() {
        const dropdown = document.getElementById('layoutSettingsDropdown');
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }

    hideLayoutSettingsDropdown() {
        const dropdown = document.getElementById('layoutSettingsDropdown');
        if (dropdown) dropdown.style.display = 'none';
    }

    // ==================== 布局设置 ====================

    initializeLayoutSettings() {
        const rowInput = document.getElementById('rowCountDropdown');
        const colInput = document.getElementById('colCountDropdown');
        const coordToggle = document.getElementById('showCoordinatesToggle');
        const fontSelect = document.getElementById('fontSelectDropdown');

        if (rowInput) rowInput.value = this.data.rows;
        if (colInput) colInput.value = this.data.cols;
        if (coordToggle) coordToggle.checked = this.data.showCoordinates;
        if (fontSelect) fontSelect.value = this.data.selectedFont;

        // 初始化颜色选择
        this.initColorSwatches();
    }

    applyNewLayoutFromDropdown() {
        const newRows = parseInt(document.getElementById('rowCountDropdown').value);
        const newCols = parseInt(document.getElementById('colCountDropdown').value);

        if (newRows < 1 || newRows > 15 || newCols < 1 || newCols > 12) {
            alert('行数范围: 1-15，列数范围: 1-12');
            return;
        }

        if (confirm('改变布局将清空现有座位安排，确定继续吗？')) {
            this.data.addToHistory('seatArrangement', { seats: this.data.seats });

            this.data.rows = newRows;
            this.data.cols = newCols;
            this.data.initializeSeats();
            this.data.saveToStorage();
            this.renderClassroom();
            this.renderStudentList();
            this.updateStats();
            this.updateClassroomInfo();

            this.hideLayoutSettingsDropdown();
            this.updateHistoryButtons();
        }
    }

    toggleCoordinatesDisplay(show) {
        this.data.showCoordinates = show;
        const classroomGrid = document.getElementById('classroomGrid');
        if (classroomGrid) {
            classroomGrid.classList.toggle('hide-coordinates', !show);
        }
        this.data.saveToStorage();
    }

    changeFontFamily(fontValue) {
        this.data.selectedFont = fontValue;
        this.data.saveToStorage();
        this.renderClassroom();
    }

    initColorSwatches() {
        document.querySelectorAll('.color-swatches[data-gender="male"] .color-swatch').forEach(swatch => {
            swatch.classList.toggle('selected', swatch.dataset.color === this.data.maleColor);
        });
        document.querySelectorAll('.color-swatches[data-gender="female"] .color-swatch').forEach(swatch => {
            swatch.classList.toggle('selected', swatch.dataset.color === this.data.femaleColor);
        });
    }

    selectColor(swatch) {
        const gender = swatch.closest('.color-swatches').dataset.gender;
        const color = swatch.dataset.color;

        swatch.closest('.color-swatches').querySelectorAll('.color-swatch').forEach(s => {
            s.classList.remove('selected');
        });
        swatch.classList.add('selected');

        if (gender === 'male') {
            this.data.maleColor = color;
            document.documentElement.style.setProperty('--male-color', color);
        } else {
            this.data.femaleColor = color;
            document.documentElement.style.setProperty('--female-color', color);
        }

        this.data.saveToStorage();
        this.renderClassroom();
    }

    // ==================== 约束条件 ====================

    addConstraint() {
        const input = document.getElementById('constraintInput');
        const text = input.value.trim();

        if (!text) {
            alert('请输入约束条件');
            return;
        }

        this.data.constraints.push({
            id: SeatingUtils.generateUUID(),
            text: text
        });

        input.value = '';
        this.data.saveToStorage();
        this.renderConstraintList();
    }

    removeConstraint(constraintId) {
        if (confirm('确定要删除这个约束条件吗？')) {
            this.data.constraints = this.data.constraints.filter(c => c.id !== constraintId);
            this.data.saveToStorage();
            this.renderConstraintList();
        }
    }

    renderConstraintList() {
        const container = document.getElementById('constraintList');
        if (!container) return;

        container.innerHTML = '';

        if (this.data.constraints.length === 0) {
            container.innerHTML = '<div class="no-constraints">暂无约束条件</div>';
            return;
        }

        this.data.constraints.forEach(constraint => {
            const item = document.createElement('div');
            item.className = 'constraint-item';
            item.dataset.constraintId = constraint.id;
            item.innerHTML = `
                <span class="constraint-text">${constraint.text}</span>
                <button class="btn btn-small btn-secondary">删除</button>
            `;
            container.appendChild(item);
        });
    }

    // ==================== 打印 ====================

    /**
     * 检测当前浏览器的打印支持情况
     * @returns {Object} { canPrint, isWebView, browserInfo }
     */
    detectPrintSupport() {
        const ua = navigator.userAgent.toLowerCase();

        // 检测各种 WebView 和不支持打印的环境
        const isWechat = ua.includes('micromessenger');
        const isQQ = ua.includes('qq/') || ua.includes('mqqbrowser');
        const isWeibo = ua.includes('weibo');
        const isDingTalk = ua.includes('dingtalk');
        const isAlipay = ua.includes('alipayclient');

        // iOS WebView 检测 (非 Safari)
        const isIOS = /iphone|ipad|ipod/.test(ua);
        const isIOSChrome = isIOS && ua.includes('crios');
        const isIOSFirefox = isIOS && ua.includes('fxios');
        const isIOSWebView = isIOS && !ua.includes('safari') && !isIOSChrome && !isIOSFirefox;

        // Android WebView 检测
        const isAndroid = ua.includes('android');
        const isAndroidWebView = isAndroid && ua.includes('wv');

        const isWebView = isWechat || isQQ || isWeibo || isDingTalk || isAlipay ||
                          isIOSWebView || isAndroidWebView || isIOSChrome || isIOSFirefox;

        // window.print 存在但在某些环境下不工作
        const hasPrintFunction = typeof window.print === 'function';

        // 在 WebView 中，即使有 print 函数也可能不工作
        const canPrint = hasPrintFunction && !isWebView;

        let browserInfo = '';
        if (isWechat) browserInfo = '微信';
        else if (isQQ) browserInfo = 'QQ';
        else if (isWeibo) browserInfo = '微博';
        else if (isDingTalk) browserInfo = '钉钉';
        else if (isAlipay) browserInfo = '支付宝';
        else if (isIOSChrome) browserInfo = 'iOS Chrome';
        else if (isIOSFirefox) browserInfo = 'iOS Firefox';
        else if (isIOSWebView) browserInfo = 'iOS 应用内浏览器';
        else if (isAndroidWebView) browserInfo = 'Android 应用内浏览器';

        return { canPrint, isWebView, browserInfo, isIOS, isAndroid };
    }


    /**
     * 移动端导出PDF - 使用html2canvas + jsPDF直接生成PDF文件
     */
    async exportAsPdfMobile() {
        const classroomGrid = document.getElementById('classroomGrid');
        if (!classroomGrid) {
            alert('❌ 未找到座位表，请先添加学生。');
            return;
        }

        // 检查html2canvas和jsPDF是否加载
        if (typeof html2canvas === 'undefined') {
            alert('❌ 图片生成库未加载，请刷新页面后重试。');
            return;
        }

        if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
            alert('❌ PDF生成库未加载，请刷新页面后重试。');
            return;
        }

        try {
            // 显示加载提示
            const loadingMsg = document.createElement('div');
            loadingMsg.textContent = '正在生成PDF...';
            loadingMsg.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px 40px;
                border-radius: 8px;
                z-index: 999999;
                font-size: 16px;
            `;
            document.body.appendChild(loadingMsg);

            // 临时添加pdf-export-mode类以应用打印样式（包括放大的字体）
            document.body.classList.add('pdf-export-mode');

            // 根据列数自动添加缩放类
            const cols = this.data.cols;
            classroomGrid.classList.remove('cols-9-10', 'cols-11-12');
            if (cols >= 9 && cols <= 10) {
                classroomGrid.classList.add('cols-9-10');
            } else if (cols >= 11) {
                classroomGrid.classList.add('cols-11-12');
            }

            // 隐藏所有按钮和控制元素
            const elementsToHide = document.querySelectorAll('.seat-remove-btn, .seat-delete-btn, .btn, button');
            const originalDisplay = [];
            elementsToHide.forEach((el, index) => {
                originalDisplay[index] = el.style.display;
                el.style.display = 'none';
            });

            // 等待样式应用和DOM更新
            await new Promise(resolve => setTimeout(resolve, 300));

            // 获取教室容器（包含讲台和座位）
            const classroomContainer = document.querySelector('.classroom-container') || classroomGrid;

            // 1. 先隐藏页脚（避免包含在座位表截图中）
            const footer = document.querySelector('.print-footer');
            let footerOriginalDisplay = '';
            if (footer) {
                footerOriginalDisplay = footer.style.display;
                footer.style.display = 'none';
            }

            // 2. 截取座位表（不含页脚）
            const seatCanvas = await html2canvas(classroomContainer, {
                scale: 3, // 提高清晰度
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
                allowTaint: true,
                windowWidth: classroomContainer.scrollWidth,
                windowHeight: classroomContainer.scrollHeight,
                width: classroomContainer.scrollWidth,
                height: classroomContainer.scrollHeight,
                x: 0,
                y: 0
            });

            // 3. 恢复页脚并单独截取
            let footerCanvas = null;
            if (footer) {
                // 必须使用 setProperty 并加上 'important' 才能覆盖 CSS 中的 !important
                footer.style.setProperty('display', 'flex', 'important'); 
                
                // 使用透明背景截取页脚
                footerCanvas = await html2canvas(footer, {
                    scale: 3,
                    backgroundColor: null, // 透明背景
                    logging: false,
                    useCORS: true,
                    allowTaint: true
                });

                // 截图后如果需要可以恢复原状
                footer.style.display = footerOriginalDisplay; 
            }

            // 恢复显示
            elementsToHide.forEach((el, index) => {
                el.style.display = originalDisplay[index];
            });

            // 移除pdf-export-mode类
            document.body.classList.remove('pdf-export-mode');
            document.body.removeChild(loadingMsg);

            // 转换座位表canvas为图片数据
            const imgData = seatCanvas.toDataURL('image/png');

            // 计算PDF尺寸（A4横向：297mm × 210mm）
            const imgWidth = seatCanvas.width;
            const imgHeight = seatCanvas.height;
            const ratio = imgWidth / imgHeight;

            // A4横向尺寸（单位：mm）
            const pdfWidth = 297;
            const pdfHeight = 210;

            // 计算适应A4纸的图片尺寸
            let finalWidth = pdfWidth;
            let finalHeight = pdfWidth / ratio;

            // 如果高度超出，按高度适配
            if (finalHeight > pdfHeight) {
                finalHeight = pdfHeight;
                finalWidth = pdfHeight * ratio;
            }

            // 居中偏移量
            const offsetX = (pdfWidth - finalWidth) / 2;
            const offsetY = (pdfHeight - finalHeight) / 2;

            // 创建PDF（A4横向）
            const { jsPDF } = window.jspdf || window;
            const pdf = new jsPDF({
                orientation: 'landscape', // 横向
                unit: 'mm',
                format: 'a4'
            });

            // 添加座位表图片到PDF（居中）
            pdf.addImage(imgData, 'PNG', offsetX, offsetY, finalWidth, finalHeight);

            // 添加页脚图片到PDF（左下角）
            if (footerCanvas && footerCanvas.width > 0 && footerCanvas.height > 0) {
                const footerImgData = footerCanvas.toDataURL('image/png');
                const fWidth = footerCanvas.width;
                const fHeight = footerCanvas.height;
                const fRatio = fWidth / fHeight;
                
                // 设定页脚宽度（例如 35mm，根据需要调整）
                const pdfFooterWidth = 35; 
                const pdfFooterHeight = pdfFooterWidth / fRatio;
                
                // 校验计算结果是否有效
                if (isFinite(pdfFooterWidth) && isFinite(pdfFooterHeight)) {
                    // 位置：左下角 (x=10mm, y=210mm - 5mm - 高度)
                    const footerX = 10;
                    const footerY = pdfHeight - 5 - pdfFooterHeight; // 距离底部5mm
                    
                    if (isFinite(footerX) && isFinite(footerY)) {
                        pdf.addImage(footerImgData, 'PNG', footerX, footerY, pdfFooterWidth, pdfFooterHeight);
                    }
                }
            }

            // 生成文件名
            const timestamp = new Date().toISOString().slice(0, 10);
            const filename = `座位表_${timestamp}.pdf`;

            // 下载PDF
            pdf.save(filename);

            alert('✅ PDF已保存到下载文件夹');

        } catch (error) {
            console.error('PDF生成失败:', error);
            document.body.classList.remove('pdf-export-mode');
            const loadingMsg = document.querySelector('div[style*="正在生成PDF"]');
            if (loadingMsg && loadingMsg.parentNode) {
                loadingMsg.parentNode.removeChild(loadingMsg);
            }
            alert('❌ PDF生成失败，请稍后重试。错误: ' + error.message);
        }
    }

    /**
     * 直接导出PDF - 所有设备通用，使用html2canvas + jsPDF
     */
    async exportPdfDirectly() {
        this.clearSelection();
        this.hideExportFormatModal();
        this.hideStudentModal();

        // 所有设备都使用移动端PDF生成方法（html2canvas + jsPDF）
        await this.exportAsPdfMobile();
    }

    /**
     * 打印 - 桌面端专用，使用浏览器原生打印对话框
     */
    printLayout() {
        this.clearSelection();
        this.hideExportFormatModal();
        this.hideStudentModal();

        const classroomGrid = document.getElementById('classroomGrid');
        if (!classroomGrid) {
            alert('❌ 未找到座位表，请先添加学生。');
            return;
        }

        // 检测是否支持打印（修正方法名）
        const printSupport = this.detectPrintSupport();

        // 仅在WebView等明确不支持的环境下拦截
        if (printSupport && !printSupport.canPrint) {
            alert(`❌ 当前环境（${printSupport.browserInfo}）不支持打印功能，请使用"📄 导出PDF"按钮。`);
            return;
        }

        try {
            // 生成打印标题
            const timestamp = new Date().toLocaleDateString('zh-CN');
            document.title = `座位表 - ${timestamp}`;

            // 根据列数自动添加缩放类
            const cols = this.data.cols;
            classroomGrid.classList.remove('cols-9-10', 'cols-11-12');
            if (cols >= 9 && cols <= 10) {
                classroomGrid.classList.add('cols-9-10');
            } else if (cols >= 11) {
                classroomGrid.classList.add('cols-11-12');
            }

            // 触发浏览器打印对话框
            window.print();

            // 打印后移除类
            setTimeout(() => {
                classroomGrid.classList.remove('cols-9-10', 'cols-11-12');
            }, 1000);

        } catch (error) {
            console.error('打印失败:', error);
            alert('❌ 打印失败，请使用"📄 导出PDF"按钮代替。');
        }
    }

    // ==================== 屏幕方向处理 ====================

    setupOrientationHandling() {
        let orientationChangeTimer = null;

        const handleOrientationChange = () => {
            if (orientationChangeTimer) {
                clearTimeout(orientationChangeTimer);
            }

            orientationChangeTimer = setTimeout(() => {
                this.renderClassroom();
                this.clearSelection();

                const classroomGrid = document.getElementById('classroomGrid');
                if (classroomGrid && classroomGrid.parentElement) {
                    classroomGrid.parentElement.scrollTop = 0;
                }
            }, 300);
        };

        window.addEventListener('orientationchange', handleOrientationChange);

        let resizeTimer = null;
        window.addEventListener('resize', () => {
            if (resizeTimer) clearTimeout(resizeTimer);

            resizeTimer = setTimeout(() => {
                const isLandscape = window.innerWidth > window.innerHeight;
                const wasLandscape = this.lastOrientation === 'landscape';

                if (isLandscape !== wasLandscape) {
                    this.lastOrientation = isLandscape ? 'landscape' : 'portrait';
                    handleOrientationChange();
                }

                // 更新设备检测
                const deviceInfo = SeatingUtils.detectDeviceType();
                this.isMobile = deviceInfo.isMobile;
                this.isTablet = deviceInfo.isTablet;
                this.isDesktop = deviceInfo.isDesktop;
                this.isMobileDevice = deviceInfo.isMobileDevice;
            }, 200);
        });

        if (screen.orientation) {
            screen.orientation.addEventListener('change', handleOrientationChange);
        }
    }
}

// 全局实例
let app;

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    app = new SeatingApp();
});

// 导出
window.SeatingApp = SeatingApp;