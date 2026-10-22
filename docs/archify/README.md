# 架构图册（project02 · c14）

这 8 张图是用 [Archify](https://www.npmjs.com/package/@tt-a1i/archify-dsh) 生成的**自包含 HTML 查看器**：
每张 750 KB 左右（内含字体、基础 CSS 和查看器脚本），不依赖网络，可以单独打开、放大、切换深浅色、导出图片。

| # | 文件 | 类型 | 讲的什么 |
|---|------|------|----------|
| 1 | `1-核心业务流程.json` | workflow | c2 的八步主链，含修正后的人工介入判定顺序 |
| 2 | `2-RAG全链路.json` | dataflow | 离线构建 → 双库入库 → 在线召回 → 生成与拦截 |
| 3 | `3-文档入库双写.json` | sequence | 先拿幂等键，再双写，状态机才是真事务 |
| 4 | `4-意图识别分流.json` | workflow | 规则先挡 → 模型兜底 → RAG / Tool 两条出口 |
| 5 | `5-一次请求调用链.json` | sequence | Nginx → 网关 → conversation → ai-agent → 模型 |
| 6 | `6-工具调用与MCP.json` | sequence | 跨语言发生在工具函数内部，不在调用这一层 |
| 7 | `7-微服务拓扑.json` | architecture | Java 5 个管业务，Python 2 个管大脑 |
| 8 | `8-StateGraph环.json` | architecture | 调完工具回到 LLM 再判一次 |

渲染产物在 `public/project02/图/`，由 c14 章节（架构图册）链接。**不要**把 `.archify/` 下的构建目录提交进仓库 —— 它已在 `.gitignore` 里。

## 重新生成

```powershell
$skill = "$env:USERPROFILE\.dsh\profiles\web\node_modules\@tt-a1i\archify-dsh\skills\archify"
node "$skill\bin\archify.mjs" finalize workflow docs/archify/1-核心业务流程.json out/1-核心业务流程.html --quality showcase --json
```

`finalize` 依次跑 `validate` → `deliver` → `check` → `browser-check` 四道闸门，任何一道不过都会非零退出 —— 退出码非零就不是成功。

## 三条硬约束（改图时最容易踩）

1. **`meta.viewBox` 必须 ≤ 1085 宽、≤ 696 高。** 查看器按 1440×900 视口、126px 固定 chrome 渲染，超了会被判 `composition/viewport-height`；太宽则字体投影低于 6px，判 `composition/desktop-readability`。
2. **`workflow` 的 `col` 最大是 5，`node.stage` 必须落在 `stages` 数组的下标范围内**（`dataflow` 的 `stages` 最多 5 项）。越界不会报错，只会画出跑到 viewBox 外面的节点。
3. **能自动排的别手动指定。** `route` 预设、`fromSide`/`toSide` 与求解器算出的几何冲突时，报错信息会直接给出可用坐标（如 `Suggested fix: set labelAt [208, 201]`）—— 照着填，别猜。

另外：`lifecycle` 类型强制"阶段轨"模型（lane id 必须是 `main`/`terminal`），**有环的图（如 LangGraph StateGraph）用 `architecture` 画**，否则会反复报 `clean-flow/edge-through-node`。
