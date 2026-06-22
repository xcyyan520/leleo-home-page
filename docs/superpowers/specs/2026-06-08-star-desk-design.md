# 星空桌面 — 设计文档

## 概述

将个人主页（index.html）从传统左右分栏布局改造为"星空桌面"——深邃星空画布上漂浮独立玻璃卡片，风格与思绪页面（Memory Nebula）统一。

同时新增「星空日记」功能：每日记录心情/台词 + 可选图片，支持日历回溯和照片墙浏览。

---

## 一、视觉设计

### 1.1 整体风格
- **主题**：暗色二次元「星空之夜」，与 `/thoughts.html` 风格统一
- **背景**：深蓝紫色星空画布（`#0a0a1a` → `#0d0d2b`），微弱的星点闪烁 + 柔和的星云光晕层
- **卡片**：半透明毛玻璃（`rgba(20,18,40,0.6)`），`backdrop-filter: blur(12px)`，圆角 `14px`
- **边框**：微光边框 `rgba(255,255,255,0.06)`，hover 时提亮至 `0.12`
- **配色**：低饱和度暗色调 — 柔紫 `#8b7aaa`、淡金 `#c4a970`、文字 `rgba(220,215,210,0.85)`
- **无霓虹**：不使用高饱和发光色，保持柔和暗雅

### 1.2 动画
- 卡片呼吸浮动：`translateY(-2px ~ 2px)`，周期 4-6s
- hover 时卡片轻微放大 + 边框增亮
- 星空背景粒子：基于现有思绪页面的 Canvas 粒子系统，但粒子密度降低 60%

---

## 二、布局结构

### 2.1 桌面端（≥768px）
全屏星空画布上，以下卡片自由定位：

| 位置 | 卡片 | 内容 |
|---|---|---|
| 左上方 | 个人卡片 | 头像 + "Hi, I'm Leleo" + 打字机文字 |
| 左中方 | 星空日记卡片 | 今日记录（文字 + 图片预览）+ [编辑] [日历] [照片墙] 按钮 |
| 左下方 | 标签卡片 | 个人标签 chip + 社交图标 |
| 右侧 | 项目卡片 | 3-4 个精选项目的紧凑横排列表，左侧彩色边条 |
| 右下角 | 迷你音乐播放器 | 始终可见，歌名 + 艺人 + 播放/暂停/切歌按钮 |
| 右上角 | 控制栏 | 设置齿轮 + 思绪入口 + 壁纸切换 |

### 2.2 移动端（<768px）
- 卡片堆叠为单列纵向滚动
- 星空日记卡片置顶（最重要的个人内容）
- 音乐播放器吸附在底部
- 控制栏简化，收起到汉堡菜单或浮动小按钮
- 粒子动画关闭以省电

---

## 三、功能模块

### 3.1 星空日记（核心新功能）

#### 数据模型（D1 表 `diary_entries`）
```sql
CREATE TABLE diary_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,       -- YYYY-MM-DD
  text TEXT NOT NULL,              -- 文字内容
  image_url TEXT DEFAULT '',       -- 外链图片 URL（可选）
  image_data TEXT DEFAULT '',      -- 上传图片 base64（可选）
  image_mime TEXT DEFAULT '',      -- 图片 MIME 类型
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**图片存储规则**：
- `image_url` 和 `image_data` 两者至少一个为空
- 如果用户上传文件 → 前端压缩至宽 1200px / JPEG 80% → base64 写入 `image_data`，记录 `image_mime`
- 如果用户粘贴外链 → 写入 `image_url`
- 两者不互斥，但表单 UI 只提供一个有效输入（上传文件优先于外链）
- D1 base64 约 200-400KB/张，总容量 5GB，个人使用完全足够

#### API 端点
所有端点均在 `functions/api/diary.js` 实现：

1. `GET /api/diary` — 获取所有日期列表（用于日历标记有记录的日期）
   - 响应：`[{date, has_image}]`

2. `GET /api/diary?date=YYYY-MM-DD` — 获取指定日期的完整记录
   - 响应：`{id, date, text, image_url, image_data, image_mime, created_at, updated_at}`

3. `POST /api/diary` — 创建或更新当日记录
   - Body：`{date, text, image_url?, image_data?, image_mime?}`
   - 逻辑：date 存在则 UPDATE，否则 INSERT
   - 响应：`{ok, id}`

4. `DELETE /api/diary?date=YYYY-MM-DD` — 删除指定日期记录

5. `GET /api/diary/photos` — 获取所有带图片的记录（照片墙用）
   - 响应：`[{date, image_url, image_data, image_mime, text}]`

#### 前端组件

**DiaryCard.vue** — 今日记录卡片
- 显示在主页左中位置
- 若无今日记录 → 显示引导文案"今天想写点什么？" + 编辑按钮
- 若有今日记录 → 显示文字（截断 3 行）+ 图片小缩略图 + 日期小字
- hover 时显示操作按钮：[编辑] [日历] [照片墙]

**DiaryEditor.vue** — 编辑弹窗
- 大文本框（max 500 字）
- 图片区域：两个 tab —「上传图片」和「粘贴链接」
- 上传：拖拽/点击上传，前端 canvas 压缩后转 base64
- 链接：输入框粘贴 URL
- 日期默认今天，可修改（允许补记过去的日期）
- 保存按钮

**CalendarDialog.vue** — 日历浏览弹窗
- 月历组件，左右箭头切换月份
- 有记录的日期显示小圆点标记（紫色圆点）
- 带图片的日期显示金色圆点
- 点击日期 → 下方展示该日内容（文字 + 图片）
- 今天高亮

**PhotoWall.vue** — 照片墙弹窗
- 瀑布流 / 网格布局展示所有带图片的记录
- 每张图下方标注日期
- hover 显示当天文字片段
- 点击打开完整记录

#### 权限
- 日记功能同样受现有 `_middleware.js` 密码保护
- 需将 `/api/diary` 加入 `needsAuth` 列表

### 3.2 其他卡片

**ProfileCard.vue** — 个人卡片
- 保留现有头像 + 欢迎标题
- 整合打字机文字（从 `config.js` typeWriterStrings）
- 点击头像不再弹出音乐播放器（音乐独立了）

**TagsCard.vue** — 标签卡片
- 保留现有 tag chips
- 整合社交图标（原来在底部 settings 里）
- 简洁展示，不需要过多视觉重量

**ProjectsCard.vue** — 项目卡片
- 从 8 个项目精简到 3-4 个精选（config 里取前几条有内容的）
- 横向排列，每项左边彩色细条 + 图标/缩略图 + 标题 + 副标题
- hover 展开显示描述文字
- "查看更多" 链接可展开全部

**MiniMusicPlayer.vue** — 迷你播放器
- 固定右下角，玻璃圆角胶囊条
- 显示：专辑图（小圆形）+ 歌名 + 艺人 + ▶/⏸ 按钮 + ⏭ 按钮
- 点击展开回完整播放面板（现有 tab3 内容）
- 保留现有 MetingJS API 数据源

**ControlBar.vue** — 右上控制栏
- 一行小按钮：⚙ 设置 / 🧠 思绪入口 / 🖼 壁纸 / 🌙 清屏
- 设置 → 打开现有 dialog（样式/壁纸/音乐 tab）
- 思绪入口 → 跳转 `/thoughts.html`
- 壁纸 → 打开壁纸选择面板
- 清屏 → 隐藏所有卡片，只看背景（现有功能保留）

### 3.3 保留功能
- 壁纸切换（静态/动态，PC/移动端分离）
- 个性化设置 cookie（颜色、亮度、模糊）
- 音乐播放器（MetingJS API）
- 打字机文字
- 背景视频/图片加载动画

### 3.4 移除功能
- 技能极坐标图（`polarchart.vue`）
- `hoemright.vue` — 其内容分散到各独立卡片
- 头像 hover 弹出音乐播放器
- 旧的浮动开关和按钮布局

---

## 四、文件变更清单

### 新增文件
- `src/components/StarfieldBackground.vue` — 星空背景（轻量版，复用 ThoughtBubbles 粒子系统）
- `src/components/ProfileCard.vue` — 个人卡片
- `src/components/DiaryCard.vue` — 日记卡片
- `src/components/DiaryEditor.vue` — 日记编辑弹窗
- `src/components/CalendarDialog.vue` — 日历浏览弹窗
- `src/components/PhotoWall.vue` — 照片墙
- `src/components/TagsCard.vue` — 标签卡片
- `src/components/ProjectsCard.vue` — 项目卡片
- `src/components/ControlBar.vue` — 控制栏
- `src/functions/api/diary.js` — 日记 API

### 修改文件
- `src/App.vue` — 全新布局，引入所有新卡片组件
- `src/app.js` — 对应 App.vue 的新逻辑，移除非必要方法
- `src/config.js` — 移除 skills 配置，可能精简 tags
- `functions/_middleware.js` — needsAuth 添加 `/api/diary`

### 可选保留（不修改）
- `src/components/ThoughtBubbles.vue` — 思绪页面不动
- `src/components/turntable.vue` — 转盘组件不动
- `src/components/typewriter.vue` — 打字机组件不动
- `src/components/loader.vue` — 加载组件不动

### 可能删除
- `src/components/polarchart.vue` — 极坐标图，移除
- `src/components/hoemright.vue` — 已被各卡片替代

---

## 五、技术细节

### 5.1 图片压缩（前端）
```javascript
async function compressImage(file, maxWidth = 1200, quality = 0.8) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const img = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / img.width)
  canvas.width = img.width * scale
  canvas.height = img.height * scale
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality) // returns base64 data URL
}
```

### 5.2 日历组件
- 自己写一个月历组件（Vue 3），不引入外部依赖
- 计算当月天数 + 月初星期偏移
- 高亮有记录 / 有图片的日期
- 左右箭头切换月份

### 5.3 移动端适配
- `v-if="$vuetify.display.xs"` / `v-if="$vuetify.display.smAndDown"` 控制不同布局
- 移动端卡片全宽堆叠
- 粒子动画移动端关闭
- 音乐播放器底部吸附

### 5.4 星空背景
- 从 ThoughtBubbles.vue 抽取 Canvas 粒子系统 → 独立组件
- 降低粒子密度（桌面 40 个，移动端 0 个）
- 关闭 accretion ring（只在捕获模式用）
- 保留星点闪烁 CSS 层

---

## 六、验收标准

1. ✅ 页面加载后是星空背景 + 半透明玻璃卡片，视觉风格与思绪页面一致
2. ✅ 不再有左右分栏，所有内容是独立浮动卡片
3. ✅ 迷你音乐播放器始终可见在右下角
4. ✅ 控制按钮整合在右上角，不再有两处分散的浮动组件
5. ✅ 星空日记可以写文字 + 上传图片/贴链接，保存后立即显示
6. ✅ 日历弹窗可以浏览任意月份的记录，有记录的日期带标记
7. ✅ 照片墙展示所有带图记录
8. ✅ 项目卡片精简为 3-4 个，紧凑排列
9. ✅ 移动端布局正常，卡片纵向堆叠
10. ✅ 不修改思绪页面（thoughts.html / ThoughtBubbles.vue）
