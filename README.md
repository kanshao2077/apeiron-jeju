# 无岸 / APEIRON

> 一片可以拨动波光的海。

[在线体验](https://apeiron-jeju.kanshao2077.chatgpt.site/) · [GitHub](https://github.com/kanshao2077/apeiron-jeju)

以济州岛海色为参照的交互海面：远海深蓝，近海透青。移动鼠标拨光，按住聚光，松开后逐渐衰减。主渲染使用实时体积云：三维噪声构成云团，随风漂移、变化，远处融入海雾。兼容渲染保留轻量摄影天空。

## 运行

需要 Node.js 18+，无需安装依赖。

```sh
git clone https://github.com/kanshao2077/apeiron-jeju.git
cd apeiron-jeju
npm run dev
```

打开 http://127.0.0.1:4317/ 。新版 Chrome / Edge / Safari 优先使用 WebGPU；不支持时自动切换 Three.js WebGL2 水面。追加 `?renderer=webgl` 可以手动测试兼容路径。

## 操作

- 移动鼠标或在触屏拖动：拨动波光。
- 按住：在触点附近逐渐加强波光。松开：衰减与扩散涟漪。
- 底部中央的菜单：展开风力、光强、配色、暂停、保存画面和来源。
- 空格暂停海浪与云；H 隐藏/显示界面；Esc 返回。
- 保存的 PNG 只包含海天，不带界面。

## 复用的开源架构与资产

1. **Noniv / web-ocean** — https://github.com/Noniv/web-ocean ，MIT，Copyright (c) 2026 Maksymilian Dendura。复用 FFT 波谱、六级海浪、CDLOD 网格、泡沫、反射、HDR 泛光与 AgX 后期架构。代码在 `dist/js/`。本项目新增定向波光、触点聚光、释放涟漪、济州调色与按设备限制渲染分辨率。
2. **Three.js r180 / Water / Sky** — https://github.com/mrdoob/three.js ，MIT，代码在 `dist/vendor/`。沿用官方水面反射、动态法线与兼容渲染结构，增加对应交互。依赖固定为 r180，全部本地提供。
3. **Dan Greenheck / Tidewater** — https://github.com/dgreenheck/tidewater ，MIT，Copyright (c) 2026 DRG Software Solutions LLC。改编 `src/sky/SkyProClouds.js` 中的天气分布、三维噪声密度与侵蚀、光线步进、多重散射及大气透视，集成到现有 WebGPU 管线。将仓库公开的 `baseShape64.bin` 保留 32³ 及以下 mip，压缩为约 113 KB 的本地资源。代码在 `dist/clouds.js`，许可在 `dist/licenses/tidewater-MIT.txt`。上方近云保留纹理，远云通过密度采样 LOD 与空气透视逐渐柔化。
4. **WebTide** — https://github.com/BarthPaleologue/WebTide ，MIT，Copyright (c) 2024 Barthélemy Paléologue。参考并适配其高指数窄高光（720 / 210），控制碎光锐度并降低过曝；保留 `dist/licenses/WebTide-MIT.txt`。
5. **Popov72 / OceanDemo** — https://github.com/Popov72/OceanDemo ，MIT。已阅读其多尺度海浪、距离粗糙度、次表面散射和泡沫材质，作为对照；当前未直接引入 Babylon 引擎或该项目模型、贴图。
6. **Poly Haven / Kloofendal 48d Partly Cloudy (Pure Sky)** — https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky ，CC0。摄影 Greg Zaal，天空编辑 Jarod Guest。仅兼容渲染使用 `dist/assets/sky.jpg`（缩小后的天空图）；主渲染使用实时体积云。摄影天空并非济州岛实拍。

相关 MIT 原文保存在 `dist/licenses/`，分发时请保留。云方案另对照过 pmndrs/drei Cloud 的粒子云方案；未引入 React 和额外粒子资产。

项目名 APEIRON 借用“无界、未定”的意象，中文“无岸”为本项目命名，不是哲学术语的严格翻译。概念参考：https://plato.stanford.edu/entries/presocratics/ 。

## 体积与验证

完整静态文件约 1.28 MB；WebGPU 主路径相关代码与资源约 247 KB，兼容渲染的 Three.js 与天空、法线资源按需加载。云噪声约 113 KB，包含在主路径统计内；天气分布在 GPU 本地生成。实际传输压缩量由服务器配置决定。

已验证 WebGPU、WebGL 兼容路径、聚光与衰减、暂停、PNG 导出及桌面/手机布局。

## 文件

- `dist/`：可直接部署的完整静态网页。
- `dist/app.js` / `interaction.js`：界面、输入与交互状态。
- `dist/js/main.js` / `js/wgsl/`：WebGPU 主渲染。
- `dist/fallback.js`：WebGL 兼容渲染。
- `server.mjs`：本地静态服务器。

所有资产本地提供。网页运行时不调用外部 API，不上传交互数据。

## 许可

本项目新增代码按 [MIT License](LICENSE) 发布。改编代码与第三方资产保留各自版权及许可，详见上方来源列表和 `dist/licenses/`。摄影天空为 CC0。
