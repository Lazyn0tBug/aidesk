# AIDesk MVP 实施设计文档

版本：`0.1.0`  
范围：桌面端轻量 LLM 浏览器封装  
技术基线：Tauri v2 + Web 前端 Shell + 多 WebView

---

## 1. 范围

### 1.1 本版本实现内容

1. 单窗口桌面应用。
2. 顶部 Provider Tab。
3. 每个 Provider 一个独立 WebView。
4. Tab 切换时显示 / 隐藏 WebView。
5. Provider 懒加载。
6. 统一提示词草稿框。
7. 草稿复制到系统剪贴板。
8. 域名白名单。
9. 加载状态。
10. 错误提示与重试。
11. 配置文件驱动。
12. 本地状态记录最近激活 Provider。

### 1.2 本版本不实现内容

1. API 聚合。
2. 统一聊天消息模型。
3. 历史记录聚合。
4. 网页回答内容读取。
5. 自动提交网页表单。
6. 用户账号系统。
7. 云同步。
8. 自定义 Provider 编辑界面。
9. 插件系统。
10. 提示词模板系统。

---

## 2. 系统组成

```text
AIDesk
├── Config Layer
│   ├── app.config.default.json
│   ├── app.config.json
│   └── app.state.json
├── Frontend Shell
│   ├── TabBar
│   ├── DraftBox
│   ├── StatusOverlay
│   ├── Toast
│   └── WebViewAreaController
├── Rust Core
│   ├── ConfigManager
│   ├── ProviderRegistry
│   ├── WebviewManager
│   ├── NavigationPolicy
│   ├── ClipboardService
│   └── StateStore
└── Remote WebViews
    ├── Provider WebView A
    ├── Provider WebView B
    └── Provider WebView C
```

---

## 3. 总体架构规范

### 3.1 应用窗口

1. 应用启动后只创建一个主窗口。
2. 主窗口包含前端 Shell。
3. Provider 页面运行在独立 WebView 中。
4. Provider WebView 挂载在主窗口内。
5. Provider WebView 不得覆盖顶部 Shell 区域。
6. 应用不展示浏览器地址栏。
7. 应用不展示浏览器前进 / 后退导航栏。
8. 应用不展示书签栏。

### 3.2 前端 Shell

前端 Shell 负责：

1. 渲染顶部区域。
2. 渲染 Tab 栏。
3. 渲染草稿框。
4. 渲染加载状态。
5. 渲染 Toast。
6. 计算 WebView 区域。
7. 调用 IPC 命令。
8. 维护当前激活 Provider。

### 3.3 Rust Core

Rust Core 负责：

1. 读取配置文件。
2. 校验配置文件。
3. 合并默认配置与用户配置。
4. 提供运行时配置。
5. 创建 Provider WebView。
6. 显示 / 隐藏 Provider WebView。
7. 设置 Provider WebView bounds。
8. 控制导航白名单。
9. 调用系统剪贴板。
10. 读写本地状态。

### 3.4 Provider WebView

Provider WebView 负责：

1. 加载 Provider 配置的远程地址。
2. 保持页面登录态。
3. 保持页面滚动位置。
4. 保持页面内部路由状态。

---

## 4. 功能规范

### 4.1 Provider 管理

1. Provider 列表必须来自配置文件。
2. 只有 `enabled: true` 的 Provider 可展示。
3. Provider `id` 必须唯一。
4. Provider `url` 必须为合法 `https` 地址。
5. Provider `iconKey` 必须对应本地内置图标资源。
6. Provider 顺序必须与配置文件中 `providers` 数组顺序一致。

### 4.2 Tab 栏

1. Tab 栏固定在主窗口顶部。
2. 每个可见 Provider 渲染一个 Tab。
3. Tab 可展示图标、名称，或二者组合。
4. 当前激活 Tab 必须有视觉高亮。
5. 点击 Tab 必须切换到对应 Provider。
6. Tab 不得允许拖拽排序。
7. Tab 不得允许关闭。
8. Tab 不得允许右键菜单，MVP 不实现。

### 4.3 WebView 生命周期

1. 应用启动时不创建未激活 Provider 的 WebView。
2. 首次点击 Provider 时创建对应 WebView。
3. WebView 创建后不销毁。
4. Tab 切换必须通过显示 / 隐藏 WebView 实现。
5. Tab 切换不得重新加载页面。
6. 当前可见 WebView 最多一个。
7. 已创建但不可见的 WebView 保持运行。
8. 若配置 `webview.lazyLoad = false`，应用启动时创建所有启用 Provider 的 WebView。
9. 若配置 `webview.keepAlive = false`，切换离开超过 `maxActiveWebviews` 限制时可销毁最久未使用 WebView。

### 4.4 草稿框

1. 草稿框是否展示由配置控制。
2. 草稿框输入内容只保存在前端内存中。
3. 草稿框不写入配置文件。
4. 草稿框不提供历史补全。
5. 草稿框不提供模板选择。
6. 当 `ui.draftBox.copyOnSwitch = true` 且草稿内容非空时，切换 Provider 必须复制草稿内容到剪贴板。
7. 复制成功后必须展示 Toast。
8. `clearAfterCopy = true` 时，复制成功后清空草稿框。
9. `clearAfterCopy = false` 时，复制成功后保留草稿框内容。
10. 草稿框回车行为等同于切换到当前激活 Provider，并触发复制。

### 4.5 剪贴板

1. 剪贴板写入必须通过 Rust Core。
2. 应用只写入，不读取剪贴板。
3. 写入内容为草稿框当前文本。
4. 写入失败必须展示错误 Toast。
5. 剪贴板内容不持久化。

### 4.6 导航控制

1. 每个 Provider WebView 只能访问白名单域名。
2. 白名单由全局白名单与 Provider 白名单合并生成。
3. 若 Provider 未配置 `allowedHosts`，自动包含 `provider.url` 的 host。
4. 非白名单导航必须阻断。
5. 若 `security.openExternalInSystemBrowser = true`，非白名单链接可交给系统浏览器打开。
6. 若 `security.openExternalInSystemBrowser = false`，非白名单链接直接阻断。

### 4.7 本地状态

1. 应用可记录最近激活 Provider。
2. 最近激活 Provider 存储在本地状态文件。
3. 本地状态文件不存储用户对话。
4. 本地状态文件不存储草稿内容。
5. 本地状态文件不存储 Cookie。
6. 若配置 `app.window.rememberLastProvider = true`，启动时恢复上次激活 Provider。
7. 若上次 Provider 不存在或未启用，回退到默认 Provider。

---

## 5. UI 规范

### 5.1 布局结构

```text
+----------------------------------------------------------+
| TabBar                                                    |
+----------------------------------------------------------+
| DraftBox                                                  |
+----------------------------------------------------------+
|                                                          |
|                                                          |
|                   Active Provider WebView                |
|                                                          |
|                                                          |
+----------------------------------------------------------+
```

### 5.2 区域定义

| 区域 | 名称 | 高度 | 说明 |
|---|---|---:|---|
| A | TabBar | 固定 | 展示 Provider Tab |
| B | DraftBox | 固定或可配置 | 提示词草稿输入 |
| C | WebViewArea | 自适应 | 当前 Provider WebView |

### 5.3 WebView 区域计算

```text
x = 0
y = TabBarHeight + DraftBoxHeight
width = WindowWidth
height = WindowHeight - y
```

窗口尺寸变化时必须重新计算并同步给当前可见 WebView。

### 5.4 Tab 状态

| 状态 | 视觉 | 行为 |
|---|---|---|
| idle | 普通样式 | 可点击 |
| active | 高亮样式 | 当前可见 |
| loading | 加载指示 | 可点击 |
| error | 错误指示 | 可点击重试 |

### 5.5 加载态

首次创建 Provider WebView 时，WebViewArea 显示：

```text
正在打开 {provider}...
```

文案来自 `messages.loading`。

### 5.6 错误态

Provider WebView 创建或加载失败时，WebViewArea 显示：

```text
{loadFailed}

[ {reload} ]
```

文案来自：

```text
messages.loadFailed
messages.reload
```

### 5.7 Toast

Toast 用于显示：

1. 复制成功。
2. 复制失败。
3. 配置错误提示，可选。

显示时长按 `ui.toast.durationMs` 控制。

---

## 6. 配置文件规范

### 6.1 文件位置

| 文件 | 位置 | 用途 |
|---|---|---|
| `app.config.default.json` | 应用内置资源 | 默认配置 |
| `app.config.json` | 用户配置目录 | 用户覆盖配置 |
| `app.state.json` | 用户数据目录 | 本地运行状态 |

### 6.2 配置加载顺序

```text
app.config.default.json
  ↓ deep merge
app.config.json
  ↓ validate
Runtime AppConfig
```

### 6.3 配置合并规则

1. 顶层对象执行深度合并。
2. `providers` 数组执行整体替换。
3. 若用户配置包含 `providers`，必须提供完整 Provider 列表。
4. 不支持按 `id` 局部合并 Provider。
5. 未提供的可选字段使用默认值。
6. 校验失败的字段回退默认值。
7. 校验失败的 `providers` 数组回退默认 `providers`。

### 6.4 配置文件格式

配置文件必须为 UTF-8 JSON。

---

## 7. 配置字段规范

### 7.1 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `app` | object | 是 | 应用基础配置 |
| `providers` | array | 是 | Provider 列表 |
| `defaultProvider` | object | 是 | 默认 Provider 配置 |
| `webview` | object | 是 | WebView 行为配置 |
| `ui` | object | 是 | 界面配置 |
| `security` | object | 是 | 安全配置 |
| `messages` | object | 否 | 文案配置 |
| `shortcuts` | object | 否 | 快捷键配置 |
| `future` | object | 否 | 未来功能开关 |

---

### 7.2 `app`

| 字段 | 类型 | 必填 | 默认值 |
|---|---|---:|---|
| `app.name` | string | 否 | `AIDesk` |
| `app.version` | string | 否 | `0.1.0` |
| `app.window.title` | string | 否 | `AIDesk` |
| `app.window.width` | number | 否 | `1280` |
| `app.window.height` | number | 否 | `800` |
| `app.window.minWidth` | number | 否 | `900` |
| `app.window.minHeight` | number | 否 | `600` |
| `app.window.rememberLastProvider` | boolean | 否 | `true` |

---

### 7.3 `providers[]`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `id` | string | 是 | Provider 唯一 ID |
| `name` | string | 是 | Tab 显示名称 |
| `iconKey` | string | 是 | 本地图标资源 key |
| `url` | string | 是 | 初始加载地址 |
| `enabled` | boolean | 是 | 是否启用 |
| `shortcut` | string | 否 | 快捷键 |
| `allowedHosts` | array<string> | 否 | 当前 Provider 额外白名单域名 |

约束：

1. `id` 必须匹配 `^[a-z0-9][a-z0-9-_]{1,63}$`。
2. `iconKey` 必须匹配 `^[a-z0-9][a-z0-9-_]{1,63}$`。
3. `url` 必须为 `https://`。
4. `allowedHosts` 中只能填写域名，不能填写完整 URL。
5. `shortcut` 必须唯一。

---

### 7.4 `defaultProvider`

| 字段 | 类型 | 必填 | 默认值 |
|---|---|---:|---|
| `active` | string | 否 | 第一个启用 Provider 的 ID |
| `fallbackToFirstEnabled` | boolean | 否 | `true` |

规则：

1. `active` 必须引用已存在且启用的 Provider。
2. 若不满足且 `fallbackToFirstEnabled = true`，选择第一个启用 Provider。
3. 若不满足且 `fallbackToFirstEnabled = false`，显示空状态。

---

### 7.5 `webview`

| 字段 | 类型 | 必填 | 默认值 |
|---|---|---:|---|
| `lazyLoad` | boolean | 否 | `true` |
| `keepAlive` | boolean | 否 | `true` |
| `maxActiveWebviews` | number | 否 | `5` |
| `reloadOnFail` | boolean | 否 | `true` |

约束：

1. `maxActiveWebviews >= 1`。
2. `maxActiveWebviews <= 10`。
3. 超出范围时修正为边界值。

---

### 7.6 `ui.tabBar`

| 字段 | 类型 | 默认值 |
|---|---|---:|
| `position` | `"top"` | `"top"` |
| `showIcon` | boolean | `true` |
| `showName` | boolean | `true` |
| `iconOnly` | boolean | `false` |

规则：

1. MVP 只支持 `position = "top"`。
2. 若 `iconOnly = true`，忽略 `showName`。
3. 若 `showIcon = false` 且 `showName = false`，强制 `showName = true`。

---

### 7.7 `ui.draftBox`

| 字段 | 类型 | 默认值 |
|---|---|---:|
| `enabled` | boolean | `true` |
| `placeholder` | string | `输入你想问的问题` |
| `copyOnSwitch` | boolean | `true` |
| `clearAfterCopy` | boolean | `false` |
| `maxLines` | number | `6` |

约束：

1. `maxLines >= 1`。
2. `maxLines <= 12`。

---

### 7.8 `ui.toast`

| 字段 | 类型 | 默认值 |
|---|---|---:|
| `durationMs` | number | `2500` |

约束：

```text
1000 <= durationMs <= 10000
```

---

### 7.9 `ui.toolbar`

| 字段 | 类型 | 默认值 |
|---|---|---:|
| `enabled` | boolean | `false` |
| `position` | `"right" | "left"` | `"right"` |

MVP 不渲染工具栏内容。

---

### 7.10 `security`

| 字段 | 类型 | 默认值 |
|---|---|---:|
| `allowUnknownNavigation` | boolean | `false` |
| `openExternalInSystemBrowser` | boolean | `true` |
| `globalAllowedHosts` | array<string> | `[]` |

规则：

1. `globalAllowedHosts` 只能包含域名。
2. 不允许包含协议。
3. 不允许包含路径。
4. 不允许包含端口，除非显式需要。

---

### 7.11 `messages`

| 字段 | 类型 | 默认值 |
|---|---|---|
| `loading` | string | `正在打开 {provider}...` |
| `loadFailed` | string | `页面加载失败` |
| `copied` | string | `已复制，粘贴即可发送` |
| `copyFailed` | string | `复制失败，请手动复制` |
| `reload` | string | `重新加载` |

模板变量：

| 模板 | 支持变量 |
|---|---|
| `loading` | `{provider}` |

---

### 7.12 `shortcuts`

| 字段 | 类型 | 默认值 |
|---|---|---|
| `focusDraftBox` | string | `CmdOrCtrl+K` |
| `switchProviderPrefix` | string | `CmdOrCtrl` |

快捷键格式：

```text
CmdOrCtrl+Key
```

示例：

```text
CmdOrCtrl+1
CmdOrCtrl+2
CmdOrCtrl+K
```

---

### 7.13 `future`

| 字段 | 类型 | 默认值 |
|---|---|---:|
| `autoFocusInput` | boolean | `false` |
| `autoFillInput` | boolean | `false` |
| `autoSubmit` | boolean | `false` |
| `sidebar` | boolean | `false` |
| `promptTemplates` | boolean | `false` |
| `answerRelay` | boolean | `false` |

MVP 中这些字段不参与核心流程。

---

## 8. 标准配置示例

```json
{
  "app": {
    "name": "AIDesk",
    "version": "0.1.0",
    "window": {
      "title": "AIDesk",
      "width": 1280,
      "height": 800,
      "minWidth": 900,
      "minHeight": 600,
      "rememberLastProvider": true
    }
  },
  "providers": [
    {
      "id": "qwen",
      "name": "Qwen",
      "iconKey": "qwen",
      "url": "https://chat.qwen.ai/",
      "enabled": true,
      "shortcut": "CmdOrCtrl+1",
      "allowedHosts": [
        "chat.qwen.ai"
      ]
    },
    {
      "id": "chatgpt",
      "name": "ChatGPT",
      "iconKey": "chatgpt",
      "url": "https://chatgpt.com/",
      "enabled": true,
      "shortcut": "CmdOrCtrl+2",
      "allowedHosts": [
        "chatgpt.com"
      ]
    },
    {
      "id": "claude",
      "name": "Claude",
      "iconKey": "claude",
      "url": "https://claude.ai/",
      "enabled": true,
      "shortcut": "CmdOrCtrl+3",
      "allowedHosts": [
        "claude.ai"
      ]
    }
  ],
  "defaultProvider": {
    "active": "qwen",
    "fallbackToFirstEnabled": true
  },
  "webview": {
    "lazyLoad": true,
    "keepAlive": true,
    "maxActiveWebviews": 5,
    "reloadOnFail": true
  },
  "ui": {
    "tabBar": {
      "position": "top",
      "showIcon": true,
      "showName": true,
      "iconOnly": false
    },
    "draftBox": {
      "enabled": true,
      "placeholder": "输入你想问的问题，点击 AI 后粘贴即可",
      "copyOnSwitch": true,
      "clearAfterCopy": false,
      "maxLines": 6
    },
    "toast": {
      "durationMs": 2500
    },
    "toolbar": {
      "enabled": false,
      "position": "right"
    }
  },
  "security": {
    "allowUnknownNavigation": false,
    "openExternalInSystemBrowser": true,
    "globalAllowedHosts": [
      "chat.qwen.ai",
      "chatgpt.com",
      "claude.ai"
    ]
  },
  "messages": {
    "loading": "正在打开 {provider}...",
    "loadFailed": "页面加载失败",
    "copied": "已复制，粘贴即可发送",
    "copyFailed": "复制失败，请手动复制",
    "reload": "重新加载"
  },
  "shortcuts": {
    "focusDraftBox": "CmdOrCtrl+K",
    "switchProviderPrefix": "CmdOrCtrl"
  },
  "future": {
    "autoFocusInput": false,
    "autoFillInput": false,
    "autoSubmit": false,
    "sidebar": false,
    "promptTemplates": false,
    "answerRelay": false
  }
}
```

---

## 9. 本地状态文件规范

文件：

```text
app.state.json
```

结构：

```json
{
  "lastActiveProviderId": "qwen",
  "updatedAt": "2026-09-09T00:00:00Z"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `lastActiveProviderId` | string | 最近激活 Provider ID |
| `updatedAt` | string | ISO 8601 时间 |

约束：

1. 不存储草稿。
2. 不存储对话。
3. 不存储 Cookie。
4. 文件损坏时重置为空状态。

---

## 10. JSON Schema

以下为本项目配置文件的 JSON Schema。

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "AIDesk AppConfig",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "providers",
    "defaultProvider",
    "webview",
    "ui",
    "security"
  ],
  "properties": {
    "app": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1
        },
        "version": {
          "type": "string"
        },
        "window": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "title": {
              "type": "string"
            },
            "width": {
              "type": "number",
              "minimum": 600
            },
            "height": {
              "type": "number",
              "minimum": 400
            },
            "minWidth": {
              "type": "number",
              "minimum": 600
            },
            "minHeight": {
              "type": "number",
              "minimum": 400
            },
            "rememberLastProvider": {
              "type": "boolean"
            }
          }
        }
      }
    },
    "providers": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "id",
          "name",
          "iconKey",
          "url",
          "enabled"
        ],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9-_]{1,63}$"
          },
          "name": {
            "type": "string",
            "minLength": 1
          },
          "iconKey": {
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9-_]{1,63}$"
          },
          "url": {
            "type": "string",
            "pattern": "^https://"
          },
          "enabled": {
            "type": "boolean"
          },
          "shortcut": {
            "type": "string"
          },
          "allowedHosts": {
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^[a-z0-9.-]+(:[0-9]+)?$"
            }
          }
        }
      }
    },
    "defaultProvider": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "active": {
          "type": "string"
        },
        "fallbackToFirstEnabled": {
          "type": "boolean"
        }
      }
    },
    "webview": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "lazyLoad",
        "keepAlive"
      ],
      "properties": {
        "lazyLoad": {
          "type": "boolean"
        },
        "keepAlive": {
          "type": "boolean"
        },
        "maxActiveWebviews": {
          "type": "number",
          "minimum": 1,
          "maximum": 10
        },
        "reloadOnFail": {
          "type": "boolean"
        }
      }
    },
    "ui": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "tabBar",
        "draftBox"
      ],
      "properties": {
        "tabBar": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "position": {
              "type": "string",
              "enum": [
                "top"
              ]
            },
            "showIcon": {
              "type": "boolean"
            },
            "showName": {
              "type": "boolean"
            },
            "iconOnly": {
              "type": "boolean"
            }
          }
        },
        "draftBox": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "enabled": {
              "type": "boolean"
            },
            "placeholder": {
              "type": "string"
            },
            "copyOnSwitch": {
              "type": "boolean"
            },
            "clearAfterCopy": {
              "type": "boolean"
            },
            "maxLines": {
              "type": "number",
              "minimum": 1,
              "maximum": 12
            }
          }
        },
        "toast": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "durationMs": {
              "type": "number",
              "minimum": 1000,
              "maximum": 10000
            }
          }
        },
        "toolbar": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "enabled": {
              "type": "boolean"
            },
            "position": {
              "type": "string",
              "enum": [
                "left",
                "right"
              ]
            }
          }
        }
      }
    },
    "security": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "allowUnknownNavigation",
        "openExternalInSystemBrowser",
        "globalAllowedHosts"
      ],
      "properties": {
        "allowUnknownNavigation": {
          "type": "boolean"
        },
        "openExternalInSystemBrowser": {
          "type": "boolean"
        },
        "globalAllowedHosts": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z0-9.-]+(:[0-9]+)?$"
          }
        }
      }
    },
    "messages": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "loading": {
          "type": "string"
        },
        "loadFailed": {
          "type": "string"
        },
        "copied": {
          "type": "string"
        },
        "copyFailed": {
          "type": "string"
        },
        "reload": {
          "type": "string"
        }
      }
    },
    "shortcuts": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "focusDraftBox": {
          "type": "string"
        },
        "switchProviderPrefix": {
          "type": "string"
        }
      }
    },
    "future": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "autoFocusInput": {
          "type": "boolean"
        },
        "autoFillInput": {
          "type": "boolean"
        },
        "autoSubmit": {
          "type": "boolean"
        },
        "sidebar": {
          "type": "boolean"
        },
        "promptTemplates": {
          "type": "boolean"
        },
        "answerRelay": {
          "type": "boolean"
        }
      }
    }
  }
}
```

---

## 11. 运行时数据模型

### 11.1 TypeScript 类型

```ts
type ProviderId = string;

type ProviderConfig = {
  id: ProviderId;
  name: string;
  iconKey: string;
  url: string;
  enabled: boolean;
  shortcut?: string;
  allowedHosts?: string[];
};

type AppConfig = {
  app: {
    name: string;
    version: string;
    window: {
      title: string;
      width: number;
      height: number;
      minWidth: number;
      minHeight: number;
      rememberLastProvider: boolean;
    };
  };
  providers: ProviderConfig[];
  defaultProvider: {
    active?: ProviderId;
    fallbackToFirstEnabled: boolean;
  };
  webview: {
    lazyLoad: boolean;
    keepAlive: boolean;
    maxActiveWebviews: number;
    reloadOnFail: boolean;
  };
  ui: {
    tabBar: {
      position: "top";
      showIcon: boolean;
      showName: boolean;
      iconOnly: boolean;
    };
    draftBox: {
      enabled: boolean;
      placeholder: string;
      copyOnSwitch: boolean;
      clearAfterCopy: boolean;
      maxLines: number;
    };
    toast: {
      durationMs: number;
    };
    toolbar: {
      enabled: boolean;
      position: "left" | "right";
    };
  };
  security: {
    allowUnknownNavigation: boolean;
    openExternalInSystemBrowser: boolean;
    globalAllowedHosts: string[];
  };
  messages: {
    loading: string;
    loadFailed: string;
    copied: string;
    copyFailed: string;
    reload: string;
  };
  shortcuts: {
    focusDraftBox?: string;
    switchProviderPrefix?: string;
  };
  future: {
    autoFocusInput: boolean;
    autoFillInput: boolean;
    autoSubmit: boolean;
    sidebar: boolean;
    promptTemplates: boolean;
    answerRelay: boolean;
  };
};

type WebViewRuntimeState = {
  providerId: ProviderId;
  created: boolean;
  visible: boolean;
  loading: boolean;
  error: boolean;
};

type AppState = {
  config: AppConfig;
  enabledProviders: ProviderConfig[];
  activeProviderId: ProviderId;
  draft: string;
  webviews: Record<ProviderId, WebViewRuntimeState>;
};
```

---

## 12. IPC 规范

### 12.1 命令命名规范

所有命令使用 `snake_case`。

---

### 12.2 配置命令

#### `get_app_config`

请求：

```json
{}
```

返回：

```ts
AppConfig
```

---

#### `get_enabled_providers`

请求：

```json
{}
```

返回：

```ts
ProviderConfig[]
```

---

### 12.3 WebView 命令

#### `create_provider_webview`

请求：

```ts
{
  providerId: string;
  bounds: Bounds;
}
```

返回：

```ts
void
```

---

#### `show_provider_webview`

请求：

```ts
{
  providerId: string;
  bounds: Bounds;
}
```

返回：

```ts
void
```

---

#### `hide_provider_webview`

请求：

```ts
{
  providerId: string;
}
```

返回：

```ts
void
```

---

#### `hide_all_provider_webviews`

请求：

```json
{}
```

返回：

```ts
void
```

---

#### `set_provider_webview_bounds`

请求：

```ts
{
  providerId: string;
  bounds: Bounds;
}
```

返回：

```ts
void
```

---

#### `reload_provider_webview`

请求：

```ts
{
  providerId: string;
}
```

返回：

```ts
void
```

---

### 12.4 剪贴板命令

#### `copy_text`

请求：

```ts
{
  text: string;
}
```

返回：

```ts
void
```

---

### 12.5 本地状态命令

#### `get_last_active_provider`

请求：

```json
{}
```

返回：

```ts
{
  providerId: string | null;
}
```

---

#### `set_last_active_provider`

请求：

```ts
{
  providerId: string;
}
```

返回：

```ts
void
```

---

### 12.6 Bounds 类型

```ts
type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
```

---

## 13. Rust 模块设计

### 13.1 模块列表

```text
src-tauri/src/
├── main.rs
├── lib.rs
├── config.rs
├── state.rs
├── providers.rs
├── webview_manager.rs
├── navigation.rs
├── clipboard.rs
└── commands.rs
```

### 13.2 `config.rs`

职责：

1. 读取默认配置。
2. 读取用户配置。
3. 合并配置。
4. 执行校验。
5. 生成 `RuntimeConfig`。
6. 暴露 `get_app_config`。

### 13.3 `state.rs`

职责：

1. 读取 `app.state.json`。
2. 写入 `app.state.json`。
3. 维护 `lastActiveProviderId`。

### 13.4 `providers.rs`

职责：

1. 提供启用 Provider 列表。
2. 根据 `id` 查找 Provider。
3. 计算 Provider 最终白名单。
4. 校验 Provider 配置。

### 13.5 `webview_manager.rs`

职责：

1. 维护 `providerId -> WebView` 映射。
2. 创建 WebView。
3. 显示 WebView。
4. 隐藏 WebView。
5. 设置 bounds。
6. 重新加载。
7. 管理可见 WebView。

### 13.6 `navigation.rs`

职责：

1. 校验导航 URL。
2. 判断是否命中白名单。
3. 决定是否阻断。
4. 决定是否交给系统浏览器。

### 13.7 `clipboard.rs`

职责：

1. 写入系统剪贴板。
2. 返回成功或失败。

### 13.8 `commands.rs`

职责：

1. 暴露 Tauri command。
2. 参数校验。
3. 调用内部服务。
4. 返回统一错误格式。

---

## 14. 前端模块设计

### 14.1 目录结构

```text
src/
├── main.ts
├── App.tsx
├── components/
│   ├── TabBar.tsx
│   ├── DraftBox.tsx
│   ├── StatusOverlay.tsx
│   ├── Toast.tsx
│   └── WebViewArea.tsx
├── stores/
│   └── appStore.ts
├── ipc/
│   ├── config.ts
│   ├── webview.ts
│   ├── clipboard.ts
│   └── state.ts
├── config/
│   └── normalize.ts
├── utils/
│   ├── bounds.ts
│   ├── icons.ts
│   └── toast.ts
└── styles/
    └── global.css
```

### 14.2 `appStore.ts`

维护：

```ts
{
  config: AppConfig;
  enabledProviders: ProviderConfig[];
  activeProviderId: ProviderId;
  draft: string;
  webviews: Record<ProviderId, WebViewRuntimeState>;
}
```

### 14.3 `bounds.ts`

提供：

```ts
calculateWebViewBounds(): Bounds
```

输入：

```text
window.innerWidth
window.innerHeight
tabBarHeight
draftBoxHeight
```

输出：

```ts
Bounds
```

### 14.4 `icons.ts`

提供：

```ts
resolveIcon(iconKey: string): string
```

图标路径规范：

```text
/icons/{iconKey}.png
```

支持格式：

```text
png
svg
```

MVP 优先使用 `png`。

---

## 15. 核心流程

### 15.1 启动流程

```text
1. 启动 Tauri 主进程
2. 创建主窗口
3. 加载前端 Shell
4. 前端调用 get_app_config
5. Rust 返回运行时配置
6. 前端过滤 enabled providers
7. 前端调用 get_last_active_provider
8. 若 rememberLastProvider = true 且 lastActiveProviderId 有效：
   active = lastActiveProviderId
9. 否则：
   active = defaultProvider.active 或第一个启用 provider
10. 渲染 TabBar
11. 渲染 DraftBox
12. 计算 WebView bounds
13. 创建并显示 active provider WebView
14. 写入 lastActiveProviderId
```

---

### 15.2 Tab 切换流程

```text
1. 用户点击 Tab
2. 前端设置 activeProviderId
3. 前端调用 hide_all_provider_webviews
4. 判断目标 WebView 是否已创建
5. 若未创建：
   5.1 设置目标 Tab 状态为 loading
   5.2 显示加载态
   5.3 调用 create_provider_webview
   5.4 创建成功后设置状态为 created
6. 若已创建：
   6.1 调用 show_provider_webview
7. 设置目标 WebView bounds
8. 更新 Tab active 状态
9. 写入 lastActiveProviderId
10. 若 draft 非空且 copyOnSwitch = true：
   10.1 调用 copy_text
   10.2 显示 copied Toast
   10.3 若 clearAfterCopy = true，清空 draft
```

---

### 15.3 草稿框回车流程

```text
1. 用户聚焦 DraftBox
2. 用户输入文本
3. 用户按回车
4. 若 draft 为空：
   不执行复制
5. 若 draft 非空：
   5.1 调用 copy_text
   5.2 切换到当前 activeProviderId
   5.3 显示 copied Toast
   5.4 根据 clearAfterCopy 决定是否清空
```

---

### 15.4 窗口尺寸变化流程

```text
1. 窗口 resize
2. 前端重新计算 WebView bounds
3. 调用 set_provider_webview_bounds
4. 仅更新当前可见 WebView
```

---

### 15.5 WebView 加载失败流程

```text
1. WebView 创建失败或导航失败
2. 设置目标 WebView 状态为 error
3. Tab 显示错误状态
4. WebViewArea 显示错误态
5. 用户点击重新加载
6. 调用 reload_provider_webview
7. 状态切换为 loading
```

---

## 16. 导航白名单计算

### 16.1 单个 Provider 白名单

```text
providerAllowedHosts =
  security.globalAllowedHosts
  + provider.allowedHosts
  + host(provider.url)
```

### 16.2 去重

所有域名去重后作为最终白名单。

### 16.3 匹配规则

1. 精确匹配域名。
2. 支持子域名匹配。
3. 匹配时忽略协议。
4. 匹配时忽略路径。
5. 匹配时忽略 query。
6. 匹配时忽略 hash。

示例：

```text
白名单：
chat.qwen.ai

允许：
https://chat.qwen.ai/
https://chat.qwen.ai/chat/xxx

不允许：
https://qwen.ai/
https://evil.com/
```

---

## 17. 错误规范

### 17.1 错误码

| 错误码 | 含义 |
|---|---|
| `CONFIG_LOAD_FAILED` | 配置读取失败 |
| `CONFIG_VALIDATION_FAILED` | 配置校验失败 |
| `PROVIDER_NOT_FOUND` | Provider 不存在 |
| `PROVIDER_DISABLED` | Provider 未启用 |
| `WEBVIEW_CREATE_FAILED` | WebView 创建失败 |
| `WEBVIEW_SHOW_FAILED` | WebView 显示失败 |
| `WEBVIEW_BOUNDS_FAILED` | WebView bounds 设置失败 |
| `NAVIGATION_BLOCKED` | 导航被白名单阻断 |
| `CLIPBOARD_WRITE_FAILED` | 剪贴板写入失败 |
| `STATE_READ_FAILED` | 本地状态读取失败 |
| `STATE_WRITE_FAILED` | 本地状态写入失败 |

### 17.2 错误返回格式

```ts
type IpcError = {
  code: string;
  message: string;
};
```

---

## 18. 目录结构

```text
llm-desk/
├── package.json
├── index.html
├── config/
│   ├── app.config.default.json
│   └── app.config.json
├── public/
│   └── icons/
│       ├── qwen.png
│       ├── chatgpt.png
│       └── claude.png
├── src/
│   ├── main.ts
│   ├── App.tsx
│   ├── components/
│   │   ├── TabBar.tsx
│   │   ├── DraftBox.tsx
│   │   ├── StatusOverlay.tsx
│   │   ├── Toast.tsx
│   │   └── WebViewArea.tsx
│   ├── stores/
│   │   └── appStore.ts
│   ├── ipc/
│   │   ├── config.ts
│   │   ├── webview.ts
│   │   ├── clipboard.ts
│   │   └── state.ts
│   ├── config/
│   │   └── normalize.ts
│   ├── utils/
│   │   ├── bounds.ts
│   │   ├── icons.ts
│   │   └── toast.ts
│   └── styles/
│       └── global.css
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── config.rs
│       ├── state.rs
│       ├── providers.rs
│       ├── webview_manager.rs
│       ├── navigation.rs
│       ├── clipboard.rs
│       └── commands.rs
└── schemas/
    └── app.config.schema.json
```

---

## 19. 图标资源规范

### 19.1 命名

```text
{iconKey}.png
```

示例：

```text
qwen.png
chatgpt.png
claude.png
```

### 19.2 尺寸

```text
64x64 px
```

可额外提供：

```text
128x128 px
```

### 19.3 格式

MVP 使用：

```text
png
```

---

## 20. 快捷键规范

### 20.1 全局快捷键

| 功能 | 默认值 |
|---|---|
| 聚焦草稿框 | `CmdOrCtrl+K` |

### 20.2 Provider 快捷键

| 功能 | 规则 |
|---|---|
| 切换第 1 个启用 Provider | `CmdOrCtrl+1` |
| 切换第 2 个启用 Provider | `CmdOrCtrl+2` |
| 切换第 3 个启用 Provider | `CmdOrCtrl+3` |
| 切换第 N 个启用 Provider | `CmdOrCtrl+N` |

若 Provider 单独配置 `shortcut`，优先使用 Provider 配置。

---

## 21. 验收标准

### 21.1 配置验收

1. 修改 `providers` 后，重启应用，Tab 列表同步变化。
2. 设置 `enabled: false` 后，对应 Provider 不显示。
3. 修改 `name` 后，Tab 文案同步变化。
4. 修改 `iconKey` 后，Tab 图标同步变化。
5. 修改 `defaultProvider.active` 后，启动默认 Provider 同步变化。
6. 配置文件缺失时，应用使用默认配置启动。
7. 配置文件损坏时，应用使用默认配置启动。
8. `providers` 中存在重复 `id` 时，校验失败并回退默认配置。

### 21.2 UI 验收

1. 应用启动后显示 TabBar。
2. 当前激活 Tab 有高亮。
3. 点击 Tab 可切换 Provider。
4. DraftBox 显示配置中的 `placeholder`。
5. Toast 显示配置中的文案。
6. 加载状态显示配置中的 `loading` 文案。
7. 错误状态显示配置中的 `loadFailed` 文案。
8. 窗口尺寸变化时，WebView 区域正确适配。

### 21.3 WebView 验收

1. 首次点击 Tab 才创建对应 WebView。
2. 已创建 Provider 切换回来时不刷新页面。
3. 页面滚动位置保留。
4. 登录状态保留。
5. 同一时间只有一个 Provider WebView 可见。
6. 非白名单域名无法在应用内加载。

### 21.4 草稿框验收

1. 输入文本后切换 Tab，文本进入剪贴板。
2. 复制成功显示 `copied` 文案。
3. `clearAfterCopy = true` 时，复制后清空草稿。
4. `clearAfterCopy = false` 时，复制后保留草稿。
5. `copyOnSwitch = false` 时，不自动复制。
6. `enabled = false` 时，不显示草稿框。

### 21.5 安全验收

1. 应用不能加载未配置域名。
2. 应用不读取网页内容。
3. 应用不读取剪贴板。
4. 应用不存储对话内容。
5. 应用不存储草稿内容。
6. 应用不存储 Cookie。

---

## 22. 实施顺序

### Phase 1：配置系统

1. 定义 `app.config.default.json`。
2. 定义 `app.config.schema.json`。
3. 实现配置读取。
4. 实现配置校验。
5. 实现默认值回退。
6. 实现 `get_app_config`。

### Phase 2：Tab 与 WebView

1. 渲染 Provider Tab。
2. 创建 WebView 管理器。
3. 实现懒加载。
4. 实现显示 / 隐藏。
5. 实现 bounds 计算。
6. 实现窗口 resize 同步。

### Phase 3：草稿框

1. 渲染 DraftBox。
2. 实现草稿输入。
3. 实现剪贴板写入。
4. 实现复制提示。
5. 实现 `clearAfterCopy`。

### Phase 4：状态与错误

1. 实现 `app.state.json`。
2. 实现最近激活 Provider。
3. 实现加载态。
4. 实现错误态。
5. 实现重试。

### Phase 5：验收

1. 配置验收。
2. UI 验收。
3. WebView 验收。
4. 草稿框验收。
5. 安全验收。
