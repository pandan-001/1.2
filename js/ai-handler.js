/**
 * ai-handler.js - AI智能排座处理模块
 */

class AIHandler {
    constructor(app) {
        this.app = app;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 绑定按钮事件（在HTML中添加对应ID后生效）
        const copyBtn = document.getElementById('copyAiPromptBtn');
        const applyBtn = document.getElementById('applyAiResultBtn');

        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.generateAndCopyPrompt());
        }

        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.importAIResult());
        }
    }

    /**
     * 生成并复制 Prompt 到剪贴板
     */
    async generateAndCopyPrompt() {
        const userRules = document.getElementById('aiUserRules')?.value || '';
        const promptData = this.buildPromptData(userRules);
        const promptText = this.formatPrompt(promptData);

        try {
            await navigator.clipboard.writeText(promptText);
            alert('✅ AI 指令已复制！\n请去 AI 聊天界面（如 ChatGPT/DeepSeek）粘贴并发送。');
        } catch (err) {
            console.error('复制失败:', err);
            alert('❌ 复制失败，请手动复制下方生成的指令。');
            // 可以在这里显示一个备用文本框供手动复制
        }
    }

    /**
     * 构建 Prompt 数据对象
     */
    buildPromptData(userRules) {
        const data = this.app.data;

        // 1. 教室布局信息
        // 使用显示坐标（1-based，行号反转：第1行是最靠近讲台的前排）
        const layout = {
            rows: data.rows,
            cols: data.cols,
            activeSeatsCount: data.getActiveSeats().length,
            // 发送显示坐标：displayRow = totalRows - internalRow, displayCol = internalCol + 1
            seats: data.getActiveSeats().map(s => ({
                row: data.rows - s.row,  // 显示行号：内部row 0(前排) -> 显示row N(最大值)，需要反转为row 1是前排
                col: s.col + 1,
                id: s.id
            }))
        };

        // 注意：不再发送学生名单 JSON，改为提示用户上传 Excel

        return {
            layout,
            userRules
        };
    }

    /**
     * 格式化最终的 Prompt 文本
     */
    formatPrompt(data) {
        return `你是一个专业的班主任排座助手。请根据我上传的 Excel 文件和以下信息为一个班级安排座位。

【任务目标】
我将上传一个包含学生名单的 Excel 文件。请读取该文件，在满足所有约束的前提下，优化座位安排，并严格按指定 JSON 格式输出结果。

【Excel 文件说明】
1. 文件包含了学生的基本信息（姓名、身高、性别等）。
2. **最后一列通常命名为“要求”**（或类似名称），其中包含了对该学生的具体排座要求（例如：“必须第一排”、“不能和张三同桌”、“视力不好”等）。
3. 请务必仔细分析每一行的“要求”列，这是最高优先级的排座依据。

【教室信息】
- 布局：${data.layout.rows}行 x ${data.layout.cols}列
- 可用座位数：${data.layout.activeSeatsCount}
- 坐标说明：第 1 行是最靠近讲台的前排，第 ${data.layout.rows} 行是最远离讲台的后排；第 1 列是最左边
- 同桌规则：同一行中，列号满足 Math.ceil(colA/2) === Math.ceil(colB/2) 的两个座位互为同桌（即 1-2 同桌、3-4 同桌、5-6 同桌，依此类推）

【排座规则】
1. **最高优先级**：Excel 表格中“要求”列的特定指令。
2. 用户自定义总体规则：${data.userRules || '无（请随机或按身高合理安排）'}
3. 通用原则：如果没有特殊规则，请尽量保持男女比例在各区域均衡，身高大致呈"前矮后高"分布。

【可用座位列表 (行,列)】
${JSON.stringify(data.layout.seats.map(s => `[${s.row},${s.col}]`), null, 0)}

【输出要求】
请**仅**返回一个 JSON 对象，严禁包含任何解释性文字、Markdown 标记或代码块符号（如 \`\`\`json）。
JSON 格式必须严格如下：
{
  "assignments": [
    { "row": 1, "col": 1, "studentName": "学生姓名", "studentId": "学号(选填)" },
    ...
  ],
  "unseatedStudents": ["无法安排的学生姓名"]
}

注意：
1. row 和 col 必须与【可用座位列表】中的坐标一致。
2. 确保每位学生只出现一次。
3. 优先安排有特殊需求（Excel“要求”列或视力问题）的学生。`;
    }

    /**
     * 导入并应用 AI 结果
     */
    importAIResult() {
        const input = document.getElementById('aiResultInput');
        if (!input || !input.value.trim()) {
            alert('请先粘贴 AI 返回的 JSON 内容！');
            return;
        }

        let result;
        try {
            // 尝试清理可能存在的 markdown 标记
            let jsonStr = input.value.trim();
            if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
            if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
            if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
            
            result = JSON.parse(jsonStr);
        } catch (e) {
            console.error('JSON 解析失败:', e);
            alert('❌ 解析失败！请检查内容是否为标准的 JSON 格式。\n提示：请让 AI "仅返回 JSON"。');
            return;
        }

        if (!result.assignments || !Array.isArray(result.assignments)) {
            alert('❌ 数据格式错误：缺少 assignments 数组。');
            return;
        }

        this.applySeating(result.assignments);
    }

    /**
     * 应用排座结果到数据模型
     */
    applySeating(assignments) {
        const data = this.app.data;
        
        // 记录历史以便撤销
        data.addToHistory('aiArrangement', { seats: data.seats });

        // 1. 先清空当前座位
        data.seats.forEach(s => s.student = null);

        let successCount = 0;
        let failCount = 0;
        const errors = [];

        // 2. 遍历分配结果
        assignments.forEach(assign => {
            // 查找学生
            let student = null;
            // 优先通过 ID 查找（如果 AI 返回了 ID）
            if (assign.studentId) {
                student = data.students.find(s => s.id == assign.studentId); // 弱类型比较，防 string/number 差异
            }
            // 降级通过名字查找
            if (!student && assign.studentName) {
                student = data.students.find(s => s.name === assign.studentName);
            }

            if (!student) {
                failCount++;
                errors.push(`找不到学生: ${assign.studentName}`);
                return;
            }

            // 查找座位：将显示坐标转换为内部坐标
            // 显示坐标：row 1 = 前排（靠近讲台），col 1 = 最左列
            // 内部坐标：row 0 = 前排，col 0 = 最左列
            // 转换公式：internalRow = totalRows - displayRow, internalCol = displayCol - 1
            const targetRow = data.rows - assign.row;
            const targetCol = assign.col - 1;

            const seat = data.seats.find(s => s.row === targetRow && s.col === targetCol);

            if (seat && !seat.isDeleted) {
                seat.student = student;
                successCount++;
            } else {
                failCount++;
                errors.push(`无效座位: [${assign.row}, ${assign.col}] 为 ${student.name}`);
            }
        });

        // 3. 更新视图
        this.app.syncStudentSeatIds();
        data.saveToStorage();
        this.app.renderClassroom(false);
        this.app.renderStudentList();
        this.app.updateStats();
        this.app.applyCurrentFilter();
        this.app.hideSeatingSettingsModal();

        // 4. 结果反馈
        let msg = `✅ 排座完成！\n成功安排: ${successCount} 人`;
        if (failCount > 0) {
            msg += `\n⚠️ 未能安排: ${failCount} 人\n(详情见控制台)`;
            console.warn('排座未完全成功:', errors);
        }
        alert(msg);
    }
}

// 挂载到 window 以便 main.js 调用
window.AIHandler = AIHandler;
