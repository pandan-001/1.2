/**
 * excel-handler.js - Excel导入导出模块
 * 处理Excel文件的导入、解析、预览和导出
 */

class ExcelHandler {
    constructor(app) {
        this.app = app;
        this.pendingImportData = null;
    }

    /**
     * 初始化Excel相关事件
     */
    init() {
        this.setupEventListeners();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 使用事件委托
        document.addEventListener('click', (e) => {
            if (e.target.id === 'importExcel' || e.target.closest('#importExcel')) {
                this.importExcelFile();
            }
            if (e.target.id === 'cancelImport') {
                this.hideExcelPreviewModal();
            }
            if (e.target.id === 'confirmImport') {
                this.confirmExcelImport();
            }
        });

        // 文件选择
        const fileInput = document.getElementById('excelFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleExcelFileSelect(e));
        }

        // 预览Tab切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // 模态框背景点击关闭
        const previewModal = document.getElementById('excelPreviewModal');
        if (previewModal) {
            previewModal.addEventListener('click', (e) => {
                if (e.target.id === 'excelPreviewModal') {
                    this.hideExcelPreviewModal();
                }
            });
        }
    }

    /**
     * 触发文件选择
     */
    importExcelFile() {
        const fileInput = document.getElementById('excelFileInput');
        if (fileInput) {
            fileInput.click();
        }
    }

    /**
     * 处理文件选择
     */
    handleExcelFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.match(/\.(xlsx|xls)$/)) {
            alert('请选择Excel文件 (.xlsx 或 .xls)');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.parseExcelData(e.target.result, file.name);
            } catch (error) {
                console.error('Excel文件读取失败:', error);
                alert('Excel文件读取失败，请检查文件格式是否正确');
            }
        };
        reader.readAsArrayBuffer(file);

        // 重置input，允许重新选择同一文件
        event.target.value = '';
    }

    /**
     * 解析Excel数据
     */
    parseExcelData(data, filename) {
        try {
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length < 2) {
                alert('Excel文件中没有足够的数据');
                return;
            }

            const headers = jsonData[0];
            const rows = jsonData.slice(1);

            console.log('Excel原始数据:', jsonData);
            console.log('表头数据:', headers);

            const columnMap = this.mapExcelColumns(headers);

            if (columnMap.name === undefined) {
                const headersDisplay = headers.map(h => h || '(空)').join(', ');
                alert(`Excel文件必须包含"姓名"列。\n\n当前检测到的表头: ${headersDisplay}\n\n请确保第一行包含"姓名"、"名字"或"name"列。`);
                return;
            }

            const { validData, errorData } = this.validateExcelData(rows, columnMap);
            this.showExcelPreviewModal(validData, errorData, filename);

        } catch (error) {
            console.error('Excel解析失败:', error);
            alert('Excel文件解析失败，请检查文件格式');
        }
    }

    /**
     * 映射Excel列
     */
    mapExcelColumns(headers) {
        const columnMap = {};

        if (!headers || !Array.isArray(headers)) {
            return columnMap;
        }

        headers.forEach((header, index) => {
            if (!header && header !== 0) return;

            const headerStr = header.toString()
                .trim()
                .replace(/[\u200B-\u200D\uFEFF]/g, '')
                .replace(/\s+/g, '')
                .toLowerCase();

            // 座位坐标
            if (headerStr.includes('座位') || headerStr.includes('坐标') || headerStr.includes('位置') ||
                headerStr.includes('seat') || headerStr.includes('position')) {
                columnMap.seatCoord = index;
            }
            // 姓名
            if (headerStr.includes('姓名') || headerStr.includes('名字') || headerStr.includes('name') ||
                headerStr === '姓名' || headerStr === '名字') {
                columnMap.name = index;
            }
            // 学号
            if (headerStr.includes('学号') || headerStr.includes('编号') || headerStr.includes('id') ||
                headerStr.includes('number')) {
                columnMap.id = index;
            }
            // 性别
            if (headerStr.includes('性别') || headerStr.includes('gender')) {
                columnMap.gender = index;
            }
            // 身高
            if (headerStr.includes('身高') || headerStr.includes('height') || headerStr.includes('高度')) {
                columnMap.height = index;
            }
            // 备注 / 职务
            if (headerStr.includes('备注') || headerStr.includes('说明') || headerStr.includes('note') ||
                headerStr.includes('remark') || headerStr.includes('职务') || headerStr.includes('position')) {
                columnMap.notes = index;
            }
        });

        console.log('列映射结果:', columnMap);
        return columnMap;
    }

    /**
     * 验证Excel数据
     */
    validateExcelData(rows, columnMap) {
        const validData = [];
        const errorData = [];

        rows.forEach((row, rowIndex) => {
            const actualRow = rowIndex + 2;
            const errors = [];

            if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
                return; // 跳过空行
            }

            const studentData = {
                name: row[columnMap.name] ? row[columnMap.name].toString().trim() : '',
                id: row[columnMap.id] ? row[columnMap.id].toString().trim() : '',
                gender: row[columnMap.gender] ? row[columnMap.gender].toString().trim() : '',
                height: row[columnMap.height] ? row[columnMap.height].toString().trim() : '',
                vision: row[columnMap.vision] ? row[columnMap.vision].toString().trim() : '',
                notes: row[columnMap.notes] ? row[columnMap.notes].toString().trim() : '',
                seatCoord: row[columnMap.seatCoord] ? row[columnMap.seatCoord].toString().trim() : ''
            };

            // 验证必填字段
            if (!studentData.name) {
                errors.push('姓名不能为空');
            }

            // 验证并标准化性别
            if (studentData.gender) {
                const genderLower = studentData.gender.toLowerCase();
                if (genderLower.includes('男') || genderLower.includes('male') || genderLower === 'm') {
                    studentData.gender = 'male';
                } else if (genderLower.includes('女') || genderLower.includes('female') || genderLower === 'f') {
                    studentData.gender = 'female';
                } else {
                    studentData.gender = '';
                }
            }

            // 验证身高
            if (studentData.height) {
                const heightNum = parseInt(studentData.height);
                if (isNaN(heightNum) || heightNum < 100 || heightNum > 250) {
                    errors.push('身高应在100-250cm之间');
                    studentData.height = '';
                } else {
                    studentData.height = heightNum;
                }
            }

            if (errors.length > 0) {
                errorData.push({
                    row: actualRow,
                    data: studentData,
                    errors: errors
                });
            } else {
                validData.push(studentData);
            }
        });

        return { validData, errorData };
    }

    /**
     * 显示预览模态框
     */
    showExcelPreviewModal(validData, errorData, filename) {
        this.pendingImportData = { validData, errorData };

        // 更新统计
        document.getElementById('totalImportCount').textContent = validData.length + errorData.length;
        document.getElementById('validImportCount').textContent = validData.length;
        document.getElementById('errorImportCount').textContent = errorData.length;

        // 填充有效数据表格
        const validDataBody = document.getElementById('validDataBody');
        validDataBody.innerHTML = '';

        validData.forEach(student => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${student.name}</td>
                <td>${student.id || '-'}</td>
                <td>${student.gender === 'male' ? '男' : student.gender === 'female' ? '女' : '-'}</td>
                <td>${student.height || '-'}</td>
                <td>${student.notes || '-'}</td>
            `;
            validDataBody.appendChild(row);
        });

        // 填充错误数据
        const errorsList = document.getElementById('errorsList');
        errorsList.innerHTML = '';

        if (errorData.length > 0) {
            errorData.forEach(item => {
                const errorItem = document.createElement('div');
                errorItem.className = 'error-item';
                errorItem.innerHTML = `
                    <div class="error-row">第 ${item.row} 行</div>
                    <div class="error-name">${item.data.name || '(空)'}</div>
                    <div class="error-messages">${item.errors.join(', ')}</div>
                `;
                errorsList.appendChild(errorItem);
            });
        } else {
            errorsList.innerHTML = '<div class="no-errors">没有错误数据</div>';
        }

        // 显示模态框
        document.getElementById('excelPreviewModal').style.display = 'flex';

        // 切换到有效数据Tab
        this.switchTab('valid');
    }

    /**
     * 隐藏预览模态框
     */
    hideExcelPreviewModal() {
        document.getElementById('excelPreviewModal').style.display = 'none';
        this.pendingImportData = null;
    }

    /**
     * 切换Tab
     */
    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName + 'DataPreview');
        });
    }

    /**
     * 确认导入
     */
    confirmExcelImport() {
        if (!this.pendingImportData) return;

        const { validData } = this.pendingImportData;
        const overwriteExisting = document.getElementById('overwriteExisting').checked;

        let importedCount = 0;
        let skippedCount = 0;
        let seatedCount = 0;

        // 第一步：处理学生信息和座位分配
        validData.forEach(studentData => {
            const existingIndex = this.app.data.students.findIndex(s => s.name === studentData.name);
            let student = null;

            if (existingIndex !== -1) {
                if (overwriteExisting) {
                    // 覆盖现有学生
                    const existingStudent = this.app.data.students[existingIndex];
                    this.app.data.students[existingIndex] = {
                        ...existingStudent,
                        id: studentData.id || existingStudent.id,
                        gender: studentData.gender || existingStudent.gender,
                        height: studentData.height || existingStudent.height,
                        notes: studentData.notes || existingStudent.notes
                    };
                    student = this.app.data.students[existingIndex];
                    importedCount++;
                } else {
                    skippedCount++;
                    return;
                }
            } else {
                // 添加新学生
                student = {
                    uuid: SeatingUtils.generateUUID(),
                    name: studentData.name,
                    id: studentData.id || '',
                    gender: studentData.gender || '',
                    height: studentData.height || null,
                    notes: studentData.notes || '',
                    seatId: null
                };
                this.app.data.students.push(student);
                importedCount++;
            }

            // 第二步：处理座位坐标分配
            if (studentData.seatCoord && student) {
                const parsedCoord = SeatingUtils.parseDisplayCoordinate(
                    studentData.seatCoord,
                    this.app.data.rows,
                    this.app.data.cols
                );

                if (parsedCoord) {
                    // 查找目标座位
                    const targetSeat = this.app.data.seats.find(
                        s => s.row === parsedCoord.row && s.col === parsedCoord.col && !s.isDeleted
                    );

                    if (targetSeat) {
                        // 如果座位已被占用，移除旧学生的座位分配
                        if (targetSeat.student && targetSeat.student.uuid !== student.uuid) {
                            targetSeat.student.seatId = null;
                        }

                        // 如果学生原来有座位，清除旧座位
                        if (student.seatId) {
                            const oldSeat = this.app.data.seats.find(s => s.id === student.seatId);
                            if (oldSeat) {
                                oldSeat.student = null;
                            }
                        }

                        // 分配到新座位
                        targetSeat.student = student;
                        student.seatId = targetSeat.id;
                        seatedCount++;
                    }
                }
            }
        });

        this.app.data.saveToStorage();
        this.app.renderStudentList();
        this.app.renderClassroom(false);
        this.app.updateStats();
        this.app.applyCurrentFilter();

        this.hideExcelPreviewModal();

        let message = `成功导入 ${importedCount} 名学生`;
        if (seatedCount > 0) {
            message += `\n其中 ${seatedCount} 名学生已分配座位`;
        }
        if (skippedCount > 0) {
            message += `\n跳过 ${skippedCount} 名重复学生`;
        }
        alert(message);
    }

    /**
     * 导出当前布局到Excel
     */
    exportToExcel() {
        try {
            const excelData = [
                ['座位坐标', '学生姓名', '学号', '性别', '身高(cm)', '职务']
            ];

            const data = this.app.data;

            // 按列优先顺序遍历
            for (let displayCol = 1; displayCol <= data.cols; displayCol++) {
                for (let displayRow = data.rows; displayRow >= 1; displayRow--) {
                    const internalRow = data.rows - displayRow;
                    const internalCol = displayCol - 1;

                    const seat = data.seats.find(s => s.row === internalRow && s.col === internalCol);
                    if (seat && !seat.isDeleted) {
                        const displayCoord = `${displayRow}-${displayCol}`;

                        if (seat.student) {
                            const student = seat.student;
                            const genderText = student.gender === 'male' ? '男' :
                                             student.gender === 'female' ? '女' : '';

                            excelData.push([
                                displayCoord,
                                student.name || '',
                                student.id || '',
                                genderText,
                                student.height ? student.height.toString() : '',
                                student.notes || ''
                            ]);
                        } else {
                            excelData.push([displayCoord, '', '', '', '', '']);
                        }
                    }
                }

                // 列之间添加空行
                if (displayCol < data.cols) {
                    excelData.push(['', '', '', '', '', '']);
                }
            }

            // 创建工作簿
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(excelData);

            // 设置列宽
            ws['!cols'] = [
                { width: 12 },
                { width: 12 },
                { width: 10 },
                { width: 8 },
                { width: 10 },
                { width: 20 }
            ];

            XLSX.utils.book_append_sheet(wb, ws, '排座宝');

            // 生成文件名
            const date = new Date().toLocaleDateString().replace(/\//g, '-');
            const filename = `排座宝_完整版_${date}.xlsx`;

            // 下载文件
            XLSX.writeFile(wb, filename, {
                bookType: 'xlsx',
                bookSST: false,
                type: 'binary'
            });

            alert('排座宝已导出为Excel文件！\n包含完整学生信息，方便下次导入。');

        } catch (error) {
            console.error('Excel导出失败:', error);
            alert('导出失败，请重试');
        }
    }
}

// 导出
window.ExcelHandler = ExcelHandler;
