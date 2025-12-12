/**
 * drag-drop.js - 拖拽交互模块
 * 使用统一的Pointer Events API处理所有拖拽逻辑
 * 保留iOS特定的hack用于阻止长按菜单
 */

class DragDropManager {
    constructor(app) {
        this.app = app;

        // 拖拽状态
        this.isDragging = false;
        this.isMultiDragging = false;
        this.dragData = null;
        this.dragElement = null;

        // 触摸/指针状态
        this.pointerStartX = 0;
        this.pointerStartY = 0;
        this.pointerStartTime = 0;

        // 框选状态
        this.isSelecting = false;
        this.selectionStart = null;
        this.selectionBox = null;

        // 设备检测
        this.deviceInfo = SeatingUtils.detectDeviceType();

        // 拖拽阈值（像素）
        this.DRAG_THRESHOLD = 5;
    }

    /**
     * 初始化拖拽系统
     */
    init() {
        this.setupClassroomDragDrop();
        this.setupStudentListDragDrop();
        this.setupKeyboardShortcuts();
        this.setupResizeHandler();
    }

    /**
     * 设置教室座位区域的拖拽
     */
    setupClassroomDragDrop() {
        const classroomGrid = document.getElementById('classroomGrid');
        if (!classroomGrid) return;

        // 使用事件委托处理所有座位的交互
        // Pointer Events统一处理鼠标和触摸
        classroomGrid.addEventListener('pointerdown', this.handleClassroomPointerDown.bind(this), { passive: false });
        classroomGrid.addEventListener('pointermove', this.handleClassroomPointerMove.bind(this), { passive: false });
        classroomGrid.addEventListener('pointerup', this.handleClassroomPointerUp.bind(this), { passive: false });
        classroomGrid.addEventListener('pointercancel', this.handleClassroomPointerCancel.bind(this), { passive: false });

        // iOS Safari长按菜单hack - 必须保留
        classroomGrid.addEventListener('contextmenu', this.handleContextMenu.bind(this), { passive: false });

        // 标准HTML5拖拽事件（用于桌面端优化体验）
        classroomGrid.addEventListener('dragstart', this.handleSeatDragStart.bind(this));
        classroomGrid.addEventListener('dragend', this.handleSeatDragEnd.bind(this));
        classroomGrid.addEventListener('dragover', this.handleDragOver.bind(this), { passive: false });
        classroomGrid.addEventListener('drop', this.handleDrop.bind(this), { passive: false });
        classroomGrid.addEventListener('dragleave', this.handleDragLeave.bind(this));
    }

    /**
     * 设置学生列表的拖拽
     */
    setupStudentListDragDrop() {
        const studentList = document.getElementById('studentList');
        if (!studentList) return;

        // 使用事件委托
        studentList.addEventListener('pointerdown', this.handleStudentListPointerDown.bind(this), { passive: false });
        studentList.addEventListener('pointermove', this.handleStudentListPointerMove.bind(this), { passive: false });
        studentList.addEventListener('pointerup', this.handleStudentListPointerUp.bind(this), { passive: false });
        studentList.addEventListener('pointercancel', this.handleStudentListPointerCancel.bind(this), { passive: false });

        // iOS Safari hack
        studentList.addEventListener('contextmenu', this.handleContextMenu.bind(this), { passive: false });

        // 标准HTML5拖拽
        studentList.addEventListener('dragstart', this.handleStudentDragStart.bind(this));
        studentList.addEventListener('dragend', this.handleStudentDragEnd.bind(this));
    }

    // ==================== 教室座位区域事件处理 ====================

    handleClassroomPointerDown(e) {
        const seatElement = e.target.closest('.seat');

        // iOS特定hack：在最开始就阻止默认行为
        if (this.deviceInfo.isMobile || this.deviceInfo.isTablet) {
            if (seatElement && e.cancelable) {
                e.preventDefault();
            }
        }

        // 点击座位
        if (seatElement) {
            this.handleSeatPointerDown(e, seatElement);
            return;
        }

        // 桌面端：点击空白区域启动框选
        if (!this.deviceInfo.isMobileDevice) {
            this.startBoxSelection(e);
        }
    }

    handleSeatPointerDown(e, seatElement) {
        const seatId = seatElement.dataset.seatId;
        const seat = this.app.data.findSeatById(seatId);

        // 点击移除按钮
        if (e.target.classList.contains('seat-remove-btn')) {
            return; // 让点击事件处理
        }

        // 点击删除座位按钮
        if (e.target.classList.contains('seat-delete-btn')) {
            return;
        }

        // 桌面端：Ctrl/Cmd + 点击切换座位选中状态（多选功能）
        if (!this.deviceInfo.isMobileDevice && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.app.toggleSeatSelection(seatId, false);  // false = 不清除其他选中
            return;
        }

        // 记录指针起始位置
        this.pointerStartX = e.clientX;
        this.pointerStartY = e.clientY;
        this.pointerStartTime = Date.now();
        this.dragSourceElement = seatElement; // 保存源元素引用
        this.dragPointerId = e.pointerId; // 保存pointerId用于释放捕获

        // 空座位或已删除座位不能拖拽
        if (!seat || !seat.student || seat.isDeleted) {
            return;
        }

        // 检查是否是多选拖拽
        if (this.app.selectedSeats.has(seatId)) {
            this.prepareMultiSeatDrag(seatId);
        } else {
            this.prepareSingleSeatDrag(seatId, seat);
        }

        // 设置指针捕获以跟踪移动
        seatElement.setPointerCapture(e.pointerId);
    }

    handleClassroomPointerMove(e) {
        // 框选模式
        if (this.isSelecting) {
            this.updateBoxSelection(e);
            return;
        }

        // 拖拽模式
        if (!this.dragData) return;

        const deltaX = Math.abs(e.clientX - this.pointerStartX);
        const deltaY = Math.abs(e.clientY - this.pointerStartY);

        // 检查是否超过拖拽阈值
        if (!this.isDragging && (deltaX > this.DRAG_THRESHOLD || deltaY > this.DRAG_THRESHOLD)) {
            this.startDrag(e);
        }

        if (this.isDragging) {
            e.preventDefault();
            this.updateDrag(e);
        }
    }

    handleClassroomPointerUp(e) {
        // 框选结束
        if (this.isSelecting) {
            this.endBoxSelection(e);
            return;
        }

        // 拖拽结束
        if (this.isDragging) {
            this.endDrag(e);
            return;  // endDrag已经调用cleanupDragState
        }

        this.cleanup();
    }

    handleClassroomPointerCancel(e) {
        this.cleanup();
    }

    // ==================== 学生列表事件处理 ====================

    handleStudentListPointerDown(e) {
        const studentItem = e.target.closest('.student-item');
        if (!studentItem) return;

        // 点击按钮不处理
        if (e.target.closest('.btn')) return;

        // 【修改点1】删除 e.preventDefault()
        // 不要在这里阻止默认行为，否则列表无法滚动！
        // 只有在 pointermove 确认是拖拽意图后才阻止。

        const studentUuid = studentItem.dataset.studentUuid;
        if (!studentUuid) return;

        // 记录起点
        this.pointerStartX = e.clientX;
        this.pointerStartY = e.clientY;
        this.pointerStartTime = Date.now();

        // 准备数据，包含名字用于显示
        const nameElement = studentItem.querySelector('.student-name');
        this.dragData = {
            type: 'studentList',
            studentUuid: studentUuid,
            sourceElement: studentItem,
            dragName: nameElement ? nameElement.textContent : '学生' // 保存名字
        };

        // 标记接触，但不立即捕获
        studentItem.classList.add('touch-active');
    }

    handleStudentListPointerMove(e) {
        if (!this.dragData || this.dragData.type !== 'studentList') return;

        const deltaX = Math.abs(e.clientX - this.pointerStartX);
        const deltaY = Math.abs(e.clientY - this.pointerStartY);

        // 如果还没开始拖拽
        if (!this.isDragging) {
            // 【关键逻辑】判断用户意图

            // 情况A：垂直移动幅度大 -> 认为是滚动列表
            if (deltaY > deltaX && deltaY > 5) {
                // 不做任何事，让浏览器处理滚动
                this.dragData = null; // 取消拖拽准备
                e.target.closest('.student-item')?.classList.remove('touch-active');
                return;
            }

            // 情况B：水平移动幅度大 -> 认为是想拖拽学生
            if (deltaX > 5 && deltaX > deltaY) {
                // 触发拖拽
                this.startStudentDrag(e);
            }
        }

        // 如果已经开始拖拽
        if (this.isDragging) {
            e.preventDefault(); // 阻止浏览器默认行为（如页面滚动）
            this.updateStudentDrag(e);
        }
    }

    handleStudentListPointerUp(e) {
        if (this.isDragging && this.dragData && this.dragData.type === 'studentList') {
            this.endStudentDrag(e);
            return;  // endStudentDrag已经调用cleanupDragState
        }

        if (this.dragData && this.dragData.sourceElement) {
            this.dragData.sourceElement.classList.remove('touch-active', 'dragging');
        }

        this.cleanup();
    }

    handleStudentListPointerCancel(e) {
        if (this.dragData && this.dragData.sourceElement) {
            this.dragData.sourceElement.classList.remove('touch-active', 'dragging');
        }
        this.cleanup();
    }

    // ==================== 拖拽逻辑 ====================

    prepareSingleSeatDrag(seatId, seat) {
        this.dragData = {
            type: 'singleSeat',
            studentUuid: seat.student.uuid,
            sourceSeatId: seatId
        };
    }

    prepareMultiSeatDrag(seatId) {
        const selectedStudents = [];
        const sourceSeats = [];

        // 收集所有选中座位的完整数据
        this.app.selectedSeats.forEach(sid => {
            const s = this.app.data.findSeatById(sid);
            if (s) {
                sourceSeats.push({
                    seatId: sid,
                    row: s.row,
                    col: s.col,
                    student: s.student
                });
                if (s.student) {
                    selectedStudents.push({
                        seatId: sid,
                        student: s.student
                    });
                }
            }
        });

        this.dragData = {
            type: 'multipleSeats',
            sourceSeats: sourceSeats,
            students: selectedStudents,
            // 保存拖拽起点座位，用于计算偏移
            anchorSeatId: seatId
        };
    }

    startDrag(e) {
        // 在拖拽真正开始时记录历史状态
        // 移除此处重复的历史记录添加，统一由 main.js 中的 assignStudentToSeat 等方法处理
        // if (!this.isDragging) {
        //     this.app.data.addToHistory('seatArrangement', { seats: this.app.data.seats });
        // }

        this.isDragging = true;

        // 触觉反馈
        SeatingUtils.vibrate(50);

        // 创建拖拽视觉元素
        this.createDragVisual(e);

        // 标记源座位
        if (this.dragData.type === 'multipleSeats') {
            this.app.selectedSeats.forEach(seatId => {
                const elem = document.querySelector(`[data-seat-id="${seatId}"]`);
                if (elem) elem.classList.add('seat-dragging-multi');
            });
        } else {
            const elem = document.querySelector(`[data-seat-id="${this.dragData.sourceSeatId}"]`);
            if (elem) elem.classList.add('seat-dragging');
        }

        // 禁用滚动
        const classroomGrid = document.getElementById('classroomGrid');
        if (classroomGrid) {
            classroomGrid.classList.add('is-dragging');
        }
    }

    updateDrag(e) {
        // 更新拖拽视觉元素位置
        if (this.dragElement) {
            this.dragElement.style.left = (e.clientX + 15) + 'px';
            this.dragElement.style.top = (e.clientY - 40) + 'px';
        }

        // 高亮目标座位
        this.highlightDropTarget(e.clientX, e.clientY);
    }

    endDrag(e) {
        // 【关键修复】先释放指针捕获，否则elementFromPoint可能返回错误元素
        if (this.dragSourceElement && this.dragPointerId !== undefined) {
            try {
                this.dragSourceElement.releasePointerCapture(this.dragPointerId);
            } catch (err) {
                // 忽略释放失败
            }
        }

        // 【关键修复】先隐藏拖拽指示器，确保elementFromPoint能正确获取目标
        if (this.dragElement) {
            this.dragElement.style.display = 'none';
        }

        // 获取释放位置的座位
        const targetElement = document.elementFromPoint(e.clientX, e.clientY);

        let targetSeat = targetElement ? targetElement.closest('.seat') : null;
        if (!targetSeat || !targetSeat.dataset.seatId) {
            let found = null;
            const seats = document.querySelectorAll('.seat');
            seats.forEach(el => {
                const r = el.getBoundingClientRect();
                if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
                    found = el;
                }
            });
            targetSeat = found;
        }

        if (targetSeat && targetSeat.dataset.seatId) {
            const targetSeatId = targetSeat.dataset.seatId;

            if (this.dragData.type === 'multipleSeats') {
                this.app.executeMultiDropWithAllSeats(targetSeatId, this.dragData);
            } else if (this.dragData.type === 'singleSeat') {
                this.app.assignStudentToSeat(
                    this.dragData.studentUuid,
                    targetSeatId,
                    this.dragData.sourceSeatId
                );
            }
        } else {
            // 拖拽失败或取消时，也要确保按钮状态是正确的
            // 【新增】在拖拽完成后，强制更新历史按钮状态
            this.app.updateHistoryButtons();
        }

        // 清理拖拽状态（包括移除dragElement）
        this.cleanupDragState();
        // 清理其他指针/拖拽相关状态
        this.cleanup();
    }

    startStudentDrag(e) {
        this.isDragging = true;

        SeatingUtils.vibrate(50);

        if (this.dragData.sourceElement) {
            this.dragData.sourceElement.classList.remove('touch-active');
            this.dragData.sourceElement.classList.add('dragging');
        }
    }

    updateStudentDrag(e) {
        if (this.dragElement) {
            this.dragElement.style.left = (e.clientX + 15) + 'px';
            this.dragElement.style.top = (e.clientY - 40) + 'px';
        }

        this.highlightDropTarget(e.clientX, e.clientY);
    }

    endStudentDrag(e) {
        // 先隐藏拖拽指示器
        if (this.dragElement) {
            this.dragElement.style.display = 'none';
        }

        const targetElement = document.elementFromPoint(e.clientX, e.clientY);
        const targetSeat = targetElement ? targetElement.closest('.seat') : null;

        if (targetSeat && targetSeat.dataset.seatId) {
            this.app.assignStudentToSeat(
                this.dragData.studentUuid,
                targetSeat.dataset.seatId,
                null
            );
        } else {
            // 拖拽失败或取消时，也要确保按钮状态是正确的
            // 【新增】在拖拽完成后，强制更新历史按钮状态
            this.app.updateHistoryButtons();
        }

        // 清理拖拽状态（包括移除dragElement）
        this.cleanupDragState();
        // 清理其他指针/拖拽相关状态
        this.cleanup();
    }

    // ==================== 框选逻辑 ====================

    startBoxSelection(e) {
        // 清空之前的选择
        this.app.clearSelection();

        this.isSelecting = true;
        const classroomGrid = e.currentTarget;
        const rect = classroomGrid.getBoundingClientRect();

        this.selectionStart = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        // 创建选择框
        this.selectionBox = document.createElement('div');
        this.selectionBox.className = 'selection-box';
        this.selectionBox.style.left = this.selectionStart.x + 'px';
        this.selectionBox.style.top = this.selectionStart.y + 'px';
        this.selectionBox.style.width = '0px';
        this.selectionBox.style.height = '0px';
        classroomGrid.appendChild(this.selectionBox);

        classroomGrid.classList.add('is-selecting');
        e.preventDefault();
    }

    updateBoxSelection(e) {
        if (!this.isSelecting || !this.selectionBox) return;

        const classroomGrid = document.getElementById('classroomGrid');
        const rect = classroomGrid.getBoundingClientRect();

        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const left = Math.min(this.selectionStart.x, currentX);
        const top = Math.min(this.selectionStart.y, currentY);
        const width = Math.abs(currentX - this.selectionStart.x);
        const height = Math.abs(currentY - this.selectionStart.y);

        this.selectionBox.style.left = left + 'px';
        this.selectionBox.style.top = top + 'px';
        this.selectionBox.style.width = width + 'px';
        this.selectionBox.style.height = height + 'px';

        // 更新框选中的座位
        this.updateSeatsInSelectionBox(left, top, width, height);

        e.preventDefault();
    }

    endBoxSelection(e) {
        this.isSelecting = false;

        // 将框选中的座位加入正式选择
        document.querySelectorAll('.seat-multi-selecting').forEach(element => {
            const seatId = element.dataset.seatId;
            if (seatId) {
                this.app.selectedSeats.add(seatId);
            }
            element.classList.remove('seat-multi-selecting');
        });

        if (this.selectionBox) {
            this.selectionBox.remove();
            this.selectionBox = null;
        }

        this.selectionStart = null;
        this.app.updateSelectionUI();

        const classroomGrid = document.getElementById('classroomGrid');
        if (classroomGrid) {
            classroomGrid.classList.remove('is-selecting');
        }
    }

    updateSeatsInSelectionBox(left, top, width, height) {
        const classroomGrid = document.getElementById('classroomGrid');
        const gridRect = classroomGrid.getBoundingClientRect();
        const seatElements = document.querySelectorAll('.seat');
        const tempSelected = new Set();

        seatElements.forEach(seatElement => {
            const seatRect = seatElement.getBoundingClientRect();

            const seatLeft = seatRect.left - gridRect.left;
            const seatTop = seatRect.top - gridRect.top;
            const seatRight = seatLeft + seatRect.width;
            const seatBottom = seatTop + seatRect.height;

            const selectionRight = left + width;
            const selectionBottom = top + height;

            // 检测重叠
            const hasOverlap = (
                seatLeft < selectionRight &&
                seatRight > left &&
                seatTop < selectionBottom &&
                seatBottom > top
            );

            // 计算中心点
            const seatCenterX = seatLeft + seatRect.width / 2;
            const seatCenterY = seatTop + seatRect.height / 2;
            const centerInSelection = (
                seatCenterX >= left && seatCenterX <= selectionRight &&
                seatCenterY >= top && seatCenterY <= selectionBottom
            );

            // 计算重叠面积比例
            const overlapRatio = SeatingUtils.calculateOverlapRatio(
                { left: seatLeft, top: seatTop, width: seatRect.width, height: seatRect.height },
                { left, top, width, height }
            );

            if (hasOverlap && (centerInSelection || overlapRatio > 0.3)) {
                const seatId = seatElement.dataset.seatId;
                const seat = this.app.data.findSeatById(seatId);
                if (seat && !seat.isDeleted) {
                    tempSelected.add(seatId);
                }
            }
        });

        // 更新临时选中状态
        document.querySelectorAll('.seat-multi-selecting').forEach(el => {
            el.classList.remove('seat-multi-selecting');
        });

        tempSelected.forEach(seatId => {
            const el = document.querySelector(`[data-seat-id="${seatId}"]`);
            if (el) el.classList.add('seat-multi-selecting');
        });

        // 更新工具栏显示
        if (tempSelected.size > 0) {
            const toolbar = document.getElementById('multiSelectToolbar');
            if (toolbar) {
                // 用户要求移除“已选择...”栏的显示
                toolbar.classList.remove('show');
            }
        }
    }

    // ==================== 辅助方法 ====================

    createDragVisual(e) {
        // 如果是在桌面端，不创建自定义拖拽视觉元素
        // 让浏览器处理原生拖拽样式（或者完全不显示跟随的小框）
        if (this.deviceInfo.isDesktop) {
            return;
        }

        // 清理旧的
        if (this.dragElement) {
            this.dragElement.remove();
        }

        // 创建拖拽影子
        const div = document.createElement('div');
        div.className = 'drag-mirror';

        // 设置文字内容
        if (this.dragData.type === 'studentList') {
            div.textContent = this.dragData.dragName || '学生';
        } else if (this.dragData.type === 'singleSeat') {
            // 如果是从座位拖拽
            const seat = document.querySelector(`[data-seat-id="${this.dragData.sourceSeatId}"]`);
            const nameEl = seat ? seat.querySelector('.student-name-display') : null;
            div.textContent = nameEl ? nameEl.textContent : '学生';
        } else if (this.dragData.type === 'multipleSeats') {
            div.textContent = `已选 ${this.app.selectedSeats.size} 人`;
        }

        document.body.appendChild(div);
        this.dragElement = div;

        // 立即更新位置
        this.updateDrag(e);
    }

    highlightDropTarget(clientX, clientY) {
        // 清除之前的高亮
        document.querySelectorAll('.seat.drag-over').forEach(el => {
            el.classList.remove('drag-over', 'seat-drop-target', 'seat-drop-swap', 'seat-drop-invalid');
        });
        this.app.clearMultiDragPreview();

        const targetElement = document.elementFromPoint(clientX, clientY);
        if (!targetElement) return;

        const targetSeat = targetElement.closest('.seat');
        if (!targetSeat || !targetSeat.dataset.seatId) return;

        targetSeat.classList.add('drag-over');

        // 多选拖拽预览
        if (this.dragData.type === 'multipleSeats' && this.app.selectedSeats.size > 0) {
            const targetSeatId = targetSeat.dataset.seatId;
            const selectedSeatIds = Array.from(this.app.selectedSeats);
            const dropResult = this.app.checkMultiDropTarget(targetSeatId, selectedSeatIds);

            if (dropResult) {
                this.app.showMultiDragPreview(targetSeatId, selectedSeatIds);
                if (dropResult.displacedStudents && dropResult.displacedStudents.length > 0) {
                    targetSeat.classList.add('seat-drop-swap');
                } else {
                    targetSeat.classList.add('seat-drop-target');
                }
            } else {
                targetSeat.classList.add('seat-drop-invalid');
            }
        } else {
            targetSeat.classList.add('seat-drop-target');
        }
    }

    cleanupDragState() {
        // 确保释放指针捕获（关键修复：防止移动端触摸事件被锁定）
        if (this.dragSourceElement && this.dragPointerId !== undefined) {
            try {
                this.dragSourceElement.releasePointerCapture(this.dragPointerId);
            } catch (err) {
                // 忽略释放失败（可能是因为已经释放或指针失效）
            }
        }

        // 移除拖拽视觉元素
        if (this.dragElement) {
            this.dragElement.remove();
            this.dragElement = null;
        }

        // 清除座位拖拽样式
        document.querySelectorAll('.seat-dragging, .seat-dragging-multi, .drag-over, .seat-drop-target, .seat-drop-swap, .seat-drop-invalid').forEach(el => {
            el.classList.remove('seat-dragging', 'seat-dragging-multi', 'drag-over', 'seat-drop-target', 'seat-drop-swap', 'seat-drop-invalid');
        });

        this.app.clearMultiDragPreview();

        // 恢复滚动
        const classroomGrid = document.getElementById('classroomGrid');
        if (classroomGrid) {
            classroomGrid.classList.remove('is-dragging');
        }

        this.isDragging = false;
        this.isMultiDragging = false;
        this.dragSourceElement = null;
        this.dragPointerId = undefined;
    }

    cleanup() {
        // 确保清理可能存在的拖拽状态和指针捕获
        // 这对于处理 pointercancel 事件和防止移动端指针锁定至关重要
        if (this.dragSourceElement || this.isDragging || this.dragElement) {
            this.cleanupDragState();
        }

        this.dragData = null;
        this.isDragging = false;
        this.isMultiDragging = false;
        this.isSelecting = false;
        this.dragSourceElement = null;
        this.dragPointerId = undefined;
    }

    // ==================== 标准HTML5拖拽事件 ====================

    handleDragOver(e) {
        e.preventDefault();
        const seatElement = e.target.closest('.seat');
        if (!seatElement) return;

        // 清除之前的高亮和预览
        document.querySelectorAll('.seat.drag-over').forEach(el => {
            if (el !== seatElement) {
                el.classList.remove('drag-over', 'seat-drop-target', 'seat-drop-swap', 'seat-drop-invalid');
            }
        });
        this.app.clearMultiDragPreview();

        seatElement.classList.add('drag-over');

        // 获取拖拽数据以确定是否是多选拖拽
        const dragDataString = e.dataTransfer.getData('text/plain');
        if (!dragDataString) return;

        try {
            const dragData = JSON.parse(dragDataString);

            if (dragData.type === 'multipleSeats' && dragData.sourceSeats) {
                // 多选拖拽预览
                const selectedSeatIds = dragData.sourceSeats.map(s => s.seatId);
                const targetSeatId = seatElement.dataset.seatId;
                const dropResult = this.app.checkMultiDropTarget(targetSeatId, selectedSeatIds);

                if (dropResult) {
                    this.app.showMultiDragPreview(targetSeatId, selectedSeatIds);
                    if (dropResult.displacedStudents && dropResult.displacedStudents.length > 0) {
                        seatElement.classList.add('seat-drop-swap');
                    } else {
                        seatElement.classList.add('seat-drop-target');
                    }
                } else {
                    seatElement.classList.add('seat-drop-invalid');
                }
            } else {
                // 单个座位拖拽
                seatElement.classList.add('seat-drop-target');
            }
        } catch {
            // 如果不是有效的JSON，可能是从学生列表拖拽
            seatElement.classList.add('seat-drop-target');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        const seatElement = e.target.closest('.seat');
        if (!seatElement) return;

        seatElement.classList.remove('drag-over', 'seat-drop-target', 'seat-drop-swap', 'seat-drop-invalid');
        this.app.clearMultiDragPreview();

        const dragDataString = e.dataTransfer.getData('text/plain');
        const targetSeatId = seatElement.dataset.seatId;

        try {
            const dragData = JSON.parse(dragDataString);

            if (dragData.type === 'multipleSeats') {
                this.app.executeMultiDropWithAllSeats(targetSeatId, dragData);
            } else if (dragData.type === 'singleSeat') {
                this.app.assignStudentToSeat(dragData.studentUuid, targetSeatId, dragData.sourceSeatId);
            } else if (dragData.studentUuid && dragData.sourceSeatId) {
                this.app.assignStudentToSeat(dragData.studentUuid, targetSeatId, dragData.sourceSeatId);
            }
        } catch {
            // 从学生列表拖拽（旧格式）
            this.app.assignStudentToSeat(dragDataString, targetSeatId, null);
        }
    }

    handleDragLeave(e) {
        const seatElement = e.target.closest('.seat');
        if (seatElement) {
            seatElement.classList.remove('drag-over', 'seat-drop-target', 'seat-drop-swap', 'seat-drop-invalid');
        }
        this.app.clearMultiDragPreview();
    }

    handleSeatDragStart(e) {
        const seatElement = e.target.closest('.seat');
        if (!seatElement) return;

        const seatId = seatElement.dataset.seatId;
        const seat = this.app.data.findSeatById(seatId);

        // 只有有学生的座位才能拖拽
        if (!seat || !seat.student || seat.isDeleted) {
            e.preventDefault();
            return;
        }

        // 检查是否是多选拖拽
        if (this.app.selectedSeats.has(seatId)) {
            // 多选拖拽
            const dragData = {
                type: 'multipleSeats',
                sourceSeats: Array.from(this.app.selectedSeats).map(id => {
                    const s = this.app.data.findSeatById(id);
                    return {
                        seatId: id,
                        row: s.row,
                        col: s.col,
                        student: s.student
                    };
                })
            };
            e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
        } else {
            // 单个座位拖拽
            const dragData = {
                type: 'singleSeat',
                studentUuid: seat.student.uuid,
                sourceSeatId: seatId
            };
            e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
        }

        seatElement.classList.add('dragging');
    }

    handleSeatDragEnd(e) {
        const seatElement = e.target.closest('.seat');
        if (seatElement) {
            seatElement.classList.remove('dragging');
        }
    }

    handleStudentDragStart(e) {
        const studentItem = e.target.closest('.student-item');
        if (!studentItem) return;

        const studentUuid = studentItem.dataset.studentUuid;
        e.dataTransfer.setData('text/plain', studentUuid);
        studentItem.classList.add('dragging');
    }

    handleStudentDragEnd(e) {
        const studentItem = e.target.closest('.student-item');
        if (studentItem) {
            studentItem.classList.remove('dragging');
        }
    }

    // ==================== 其他事件 ====================

    handleContextMenu(e) {
        // iOS Safari长按菜单hack
        if (this.deviceInfo.isMobile || this.deviceInfo.isTablet) {
            const seatElement = e.target.closest('.seat');
            const studentItem = e.target.closest('.student-item');
            if (seatElement || studentItem) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.app.clearSelection();
                this.cleanup();
                this.cleanupDragState();
            }
            if (e.key === 'Delete' && this.app.selectedSeats.size > 0) {
                this.app.clearSelectedSeats();
            }
        });
    }

    setupResizeHandler() {
        window.addEventListener('resize', () => {
            const newDeviceInfo = SeatingUtils.detectDeviceType();
            if (newDeviceInfo.isMobileDevice !== this.deviceInfo.isMobileDevice) {
                this.deviceInfo = newDeviceInfo;
                this.app.clearSelection();
            }
        });
    }
}

// 导出
window.DragDropManager = DragDropManager;
