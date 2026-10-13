const config = {
	//网页元数据
	metaData: {
		title: 'xcyyan的小家',
		description: '欢迎来到xcyyan世界！',
		keywords: 'xcyyan,个人主页,个人网站,微服务学习路线',
		icon: '/favicon.ico'   //网页图标，支持外链
	},

	avatar: "/img/avatar.jpg", // 头像
	welcometitle: "Hi, I'm Chunyanyan", // 标题

	// 颜色配置
	color: {
		themecolor: "#FFFFFF", // 主题颜色，推荐趋于亮白可带有轻微色调，例： #D1FFEC
		welcometitlecolor: "#FFFFFF", // 标题颜色 例： #7BFFC9
		turntablecolor1: "#FFFF00",  // 转盘渐变色一
		turntablecolor2: "#00FFFF"   // 转盘渐变色二
	},

	brightness: 85, // 背景亮度 --%
	blur: 5, // 毛玻璃模糊效果

	// 我的标签
	tags: ['微服务架构', 'Canvas 动效', '高保真原型', 'Vue 3', 'Cloudflare 部署', '爱做梦的人'],

	// 默认背景壁纸
	background: {
		"pc": {   //pc端
			"type": "pic",   //"pic":静态壁纸;"video":动态壁纸
			"datainfo": {
				"title": "海洋女孩",
				"preview": "/img/wallpaper/static/海洋女孩/image-pre.webp",
				"url": "/img/wallpaper/static/海洋女孩/image.png",     //当然，也可填写网络地址或壁纸api，如随机PC壁纸api："url":"https://t.mwm.moe/pc"
			},
		},
		"mobile": {   //移动端
			"type": "pic",
			"datainfo": {
				"title": "0001",
				"preview": "/img/wallpaper/static-mobile/0001/image-pre.webp",
				"url": "/img/wallpaper/static-mobile/0001/image.png"  //同理，随机移动端壁纸："url":"https://t.mwm.moe/mp"
			}
		}

	},

	//社交按钮
	socialPlatformIcons: [
		{ icon: "mdi-github", link: "https://github.com/xcyyan520" },
		{ icon: "mdi-email", link: "mailto:xcyyan@foxmail.com" },
		{ icon: "mdi-qqchat", link: "https://im.qq.com/" },
		{ icon: "mdi-wechat", link: "https://wx.qq.com/" }
	],

	//打字机
	typeWriterStrings: [
		"心简单，世界就简单，幸福才会生长；心自由，生活就自由，到哪都有快乐。",
		"生命太短，没有时间留给遗憾，若不是终点，请微笑一直向前。",
		"如果你将要离去，那就让往事随风。",
		"卦不可算尽，畏（谓）天道无常"
		
	],

	//音乐播放配置，采用MetingJS Api(https://github.com/metowolf/MetingJS)
	musicPlayer: {
		server: 'netease',  //服务提供商 --网易云音乐
		type: 'playlist',   //歌单类型
		id: '2028178887'  //歌单id ---> music.163.com/#/playlist?id=2028178887
	},

	//壁纸数据 -----可以将壁纸文件上传到图床获取网络直链。若想调用api，请前往脚本自行修改逻辑
	wallpaper: {
		pic: [
			{ "title": "海洋女孩", "preview": "/img/wallpaper/static/海洋女孩/image-pre.webp", "url": "/img/wallpaper/static/海洋女孩/image.png" },
			{ "title": "书房夜晚", "preview": "/img/wallpaper/static/书房夜晚/image-pre.webp", "url": "/img/wallpaper/static/书房夜晚/image.png" },
			{ "title": "安逸舒适", "preview": "/img/wallpaper/static/安逸舒适/image-pre.webp", "url": "/img/wallpaper/static/安逸舒适/image.png" },
			{ "title": "jswcMaMj", "preview": "https://s21.ax1x.com/2025/07/23/pVGli59.md.jpg", "url": "https://s21.ax1x.com/2025/07/23/pVGli59.jpg" },
			{ "title": "pgtTqoqq", "preview": "https://s21.ax1x.com/2025/07/23/pVGlmDO.md.jpg", "url": "https://s21.ax1x.com/2025/07/23/pVGlmDO.jpg" },
			{ "title": "cvKMKhue", "preview": "https://s21.ax1x.com/2025/07/23/pVGlNqS.md.jpg", "url": "https://s21.ax1x.com/2025/07/23/pVGlNqS.jpg" },
			{ "title": "XpxvQVoP", "preview": "https://s21.ax1x.com/2025/07/23/pVGlfIJ.md.jpg", "url": "https://s21.ax1x.com/2025/07/23/pVGlfIJ.jpg" },
			{ "title": "fVEEjEOA", "preview": "https://s21.ax1x.com/2025/07/23/pVGlEgx.md.webp", "url": "https://s21.ax1x.com/2025/07/23/pVGlEgx.webp" },
			{ "title": "jgnIKMpd", "preview": "https://s21.ax1x.com/2025/07/23/pVGldaQ.md.jpg", "url": "https://s21.ax1x.com/2025/07/23/pVGldaQ.jpg" },
			{ "title": "mgqyySeh", "preview": "https://s21.ax1x.com/2025/07/23/pVGl82t.md.jpg", "url": "https://s21.ax1x.com/2025/07/23/pVGl82t.jpg" },
			{ "title": "dSXZfZp", "preview": "https://s21.ax1x.com/2025/07/23/pVGlaVg.md.jpg", "url": "https://s21.ax1x.com/2025/07/23/pVGlaVg.jpg" },
		],
		picMobile: [
			{ "title": "0001", "preview": "/img/wallpaper/static-mobile/0001/image-pre.webp", "url": "/img/wallpaper/static-mobile/0001/image.png" },
			{ "title": "0002", "preview": "/img/wallpaper/static-mobile/0002/image-pre.webp", "url": "/img/wallpaper/static-mobile/0002/image.png" },
			{ "title": "0003", "preview": "/img/wallpaper/static-mobile/0003/image-pre.webp", "url": "/img/wallpaper/static-mobile/0003/image.png" },
			{ "title": "0004", "preview": "/img/wallpaper/static-mobile/0004/image-pre.webp", "url": "/img/wallpaper/static-mobile/0004/image.png" },
			{ "title": "DfNHPPcc", "preview": "https://s21.ax1x.com/2025/07/23/pVG1uQ0.md.jpg", "url": "https://s21.ax1x.com/2025/07/23/pVG1uQ0.jpg" },
			{ "title": "cZZwzhis", "preview": "https://s21.ax1x.com/2025/07/23/pVG1Vij.md.jpg", "url": "https://s21.ax1x.com/2025/07/23/pVG1Vij.jpg" },
			{ "title": "aANKZHPX", "preview": "https://s21.ax1x.com/2025/07/23/pVGlIR1.md.jpg", "url": "https://s21.ax1x.com/2025/07/23/pVGlIR1.jpg" },
		],
		video: [
			{
				"title": "尼尔：机械纪元 团队",
				"preview": "/img/wallpaper/dynamic/尼尔：机械纪元 团队/Nier-Automata-Team-pre.webm",
				"url": "/img/wallpaper/dynamic/尼尔：机械纪元 团队/Nier-Automata-Team.webm"
			},
			{
				"title": "向往航天的女孩",
				"preview": "/img/wallpaper/dynamic/向往航天的女孩/Toy-Aeroplane-pre.webm",
				"url": "/img/wallpaper/dynamic/向往航天的女孩/Toy-Aeroplane.webm"
			},
			{
				"title": "世界很温柔《龙族》上杉绘梨衣",
				"preview": "https://www.leleo.top/img/wallpaper/dynamic/%E4%B8%96%E7%95%8C%E5%BE%88%E6%B8%A9%E6%9F%94%E3%80%8A%E9%BE%99%E6%97%8F%E3%80%8B%E4%B8%8A%E6%9D%89%E7%BB%98%E6%A2%A8%E8%A1%A3/A2EF5E85-pre.webm",
				"url": "https://www.leleo.top/img/wallpaper/dynamic/%E4%B8%96%E7%95%8C%E5%BE%88%E6%B8%A9%E6%9F%94%E3%80%8A%E9%BE%99%E6%97%8F%E3%80%8B%E4%B8%8A%E6%9D%89%E7%BB%98%E6%A2%A8%E8%A1%A3/A2EF5E85.webm"
			},
		],
		videoMobile: [
			{
				"title": "幻觉镇-gaako_illust",
				"preview": "/img/wallpaper/dynamic-mobile/幻觉镇-gaako_illust/Hallucination_town-pre.mp4",
				"url": "/img/wallpaper/dynamic-mobile/幻觉镇-gaako_illust/Hallucination_town.mp4"
			},
			{
				"title": "chuva",
				"preview": "/img/wallpaper/dynamic-mobile/chuva/chuva-pre.mp4",
				"url": "/img/wallpaper/dynamic-mobile/chuva/chuva.mp4"
			},
			{
				"title": "Doodle-小猫女仆降临",
				"preview": "/img/wallpaper/dynamic-mobile/Doodle-小猫女仆降临/d12-pre.mp4",
				"url": "/img/wallpaper/dynamic-mobile/Doodle-小猫女仆降临/d12.mp4"
			},
		],
	},

	//项目卡片 其中 字段"show"控制初始卡片的text是否展开
	projectcards: [
		{ go: "📚 前往", img: "/img/projects/micro.svg", title: "微服务学习路线", subtitle: "架构 · 动画 · 原型", text: "一条能从头跑到尾的微服务入门路线：架构总览动态图、4 场景动画、6 个高保真交互原型。", url: "/project02/", show: true },
		{ go: "🧭 前往", img: "/img/projects/gem.svg", title: "架构总览 · Canvas 动态图", subtitle: "服务拓扑与调用链路", text: "用 Canvas 实时绘制的微服务拓扑：网关、注册中心、各服务与数据流向一目了然。", url: "/project02/架构/1-架构总览（Canvas动态图）.html", show: true },
		{ go: "📝 前往", img: "/img/projects/note.svg", title: "架构课件 · 10 章速记", subtitle: "零基础也能看懂", text: "把微服务拆成 10 个章节的速记课件，每个概念配一张图，适合面试前快速过一遍。", url: "/project02/架构/2-架构课件（10章速记）.html", show: true },
		{ go: "🎬 前往", img: "/img/projects/palette.svg", title: "微服务动画 · 4 场景", subtitle: "动起来才看得懂", text: "服务注册、负载均衡、熔断降级、链路追踪——四段动画把抽象流程演一遍。", url: "/project02/动画/1-微服务动画（4场景）.html", show: true },
		{ go: "🖥️ 前往", img: "/img/projects/thumb.svg", title: "高保真交互原型", subtitle: "坐席工作台 · 工单 · 看板", text: "可直接点击操作的客服系统原型：坐席工作台、工单流转、知识库与服务质量看板。", url: "/project02/原型/0-原型总入口.html", show: true },
		{ go: "🗣️ 前往", img: "/img/projects/chat.svg", title: "面试题精讲 · 五题", subtitle: "云联客服工单平台", text: "父子块切分、文档解析四环节、Agent 评估、知识来源、离职口径——每题都是「30 秒版 → 展开 → 追问预案」。", url: "/project02/面试/1-面试题精讲.html", show: true },
		{ go: "🎓 前往", img: "/img/projects/qa.svg", title: "老师模拟面 · 六问", subtitle: "追问预案 + 表达纪律", text: "项目亮点、LangGraph 意图识别、Tool Calling、AI 边界、会话记忆算量与明文密文，附老师那条建议的接法。", url: "/project02/面试/2-老师模拟面.html", show: true },
		{ go: "🚀 前往", img: "/img/projects/campus.svg", title: "科大智慧校园", subtitle: "学校一站式服务大厅", text: "广西科技大学网上服务大厅，成绩、课表、缴费等常用入口。", url: "https://ehall.gxust.edu.cn/", show: false },
	],

	statement: ["备案号：桂ICP备2025012345号", "Copyright © 2026 xcyyan"],
}

export default config