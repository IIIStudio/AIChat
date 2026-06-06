# AI Chat — 多模型对话 & 生图网页

纯前端单文件，打开即用。支持 OpenAI 格式 Chat Completions API 和 Images Generations API。

![](image/3.jpg)

![](image/4.jpg)

## 快速开始

1. 在浏览器中打开 `index.html`
2. 点击右上角 **配置 API**，填入 API URL 和 API Key
3. 开始对话或生图

## 默认配置

| 项目 | 值 |
|------|-----|
| API URL (对话) | `https://token-plan-cn.xiaomimimo.com/v1` |
| 默认模型 (对话) | `mimo-v2.5-pro` |
| API URL (生图) | `https://ai.gitee.com/v1` |
| 默认模型 (生图) | `z-image-turbo` |
| 免费生图 z-image API 100次/日 | [https://ai.gitee.com/serverless-api?model=z-image-turbo](https://ai.gitee.com/serverless-api?model=z-image-turbo) |

## 对话模式

| 操作 | 说明 |
|------|------|
| `Enter` | 发送消息 |
| `Shift + Enter` | 换行 |
| 左键点击预设标签 | 切换参数预设 |
| 右键点击预设标签 | 编辑该预设 |
| 点击上传按钮 | 上传图片进行多模态对话 |
| 刷新按钮 | 重新生成回复，旧回复存入版本历史 ◂ ▸ |

## 生图模式

| 操作 | 说明 |
|------|------|
| `Enter` | 发送提示词生成图片 |
| 点击图片 | 全屏灯箱预览 |
| 下载按钮 | 下载生成图片 |
| 刷新按钮 | 重新生成，旧图片存入版本历史 ◂ ▸ |
| 修改按钮 | 编辑提示词后重新生成 |
| 折叠面板 | 点击 ⚙ 生图参数 收起/展开参数 |

### 生图参数

| 参数 | 说明 |
|------|------|
| 反向词 | 排除描述 |
| 步数 | 推理步数 1-50 |
| 种子 | 留空=随机，填值=固定（相同种子产相同图） |
| 引导强度 | 文本引导权重 0-20 |
| 图尺度 | 图像放大强度 0-1 |
| 尺寸 | 1:1 / 4:3 / 3:4 / 16:9 / 9:16 / 自定义 |
| 控制模式 | HED / Canny / Depth / Pose + 参考图上传 |

## 模型隔离

对话模式仅显示对话模型，生图模式仅显示生图模型，互不干扰。两种模式拥有独立的会话列表和会话 ID。

## 搜索

搜索覆盖全部会话（含对话和生图），点击结果自动切换到对应模式。

## 技术栈

- HTML + CSS + JavaScript（单文件）
- [marked.js](https://github.com/markedjs/marked) Markdown 渲染
- IndexedDB 持久化存储
