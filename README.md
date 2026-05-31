# AI Chat — 多模型智能对话客户端

一个支持多模型切换、图片识别、流式输出、Markdown 渲染的 AI 对话客户端，兼容 OpenAI 格式 API，支持多运营商管理与参数预设。

## 功能特性

- **多模型切换** — 支持配置多个 API 运营商，快速切换不同模型
- **流式输出** — 支持 SSE 流式响应，实时查看生成内容
- **图片识别** — 上传图片进行多模态对话
- **Markdown 渲染** — AI 回复自动渲染 Markdown（代码块、表格、列表等）
- **参数预设** — 自定义 System Prompt、Temperature、Top-P 等参数，右键标签可编辑
- **会话管理** — 创建、重命名、删除、置顶会话，数据持久化到 localStorage
- **导入/导出** — 一键导出或导入全部配置（运营商、预设、会话）

## 快速开始

1. 直接在浏览器中打开 `index.html` 即可使用
2. 点击右上角 **配置 API** 按钮，填入 API URL 和 API Key
3. 在模型列表中添加所需模型名称
4. 开始对话

## 默认配置

| 项目 | 值 |
|------|-----|
| 运营商 | 默认 |
| API URL | `https://token-plan-cn.xiaomimimo.com/v1` |
| 默认模型 | `mimo-v2.5-pro` |

## 操作说明

| 操作 | 说明 |
|------|------|
| `Enter` | 发送消息 |
| `Shift + Enter` | 换行 |
| 左键点击预设标签 | 切换参数预设 |
| 右键点击预设标签 | 编辑该预设 |
| 点击 AI 消息的模型标签 | 切换模型并重新生成 |
| 点击上传按钮 | 选择图片进行多模态对话 |

## 技术栈

- 纯前端单文件应用（HTML + CSS + JavaScript）
- 使用 [marked.js](https://github.com/markedjs/marked) 进行 Markdown 渲染
- 兼容 OpenAI Chat Completions API 格式
- 数据存储于浏览器 localStorage

## 项目地址

[https://cnb.cool/IIIStudio/Code/HTML/AIChat](https://cnb.cool/IIIStudio/Code/HTML/AIChat)
