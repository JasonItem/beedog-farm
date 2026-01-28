
# 🏡 蜜蜂狗农场 (BeeDogFarm)

**一个基于 React + Three.js + Supabase 构建的多人在线种田模拟游戏。**

> ⚠️ **重要提示**：本项目仅作为 Vibe Coding（AI 辅助编程）的学习实例与技术验证演示，**严禁用于任何商业用途**。

## 📖 项目简介

**蜜蜂狗农场** 是一个运行在浏览器中的“休闲种田”社区应用。用户可以拥有自己的农场，进行开垦、种植、浇水、收获等操作。游戏结合了 2.5D/3D 混合视觉风格，并利用 Supabase Realtime 实现了多人在线互访功能。

本项目旨在探索 **Vibe Coding** 模式——即通过与先进的大语言模型（如 Google Gemini）高频交互，快速构建全栈应用的可能性。

### 🌟 核心功能

*   **沉浸式农场**：基于 `React Three Fiber` 的 3D 瓦片地图，支持缩放、旋转视角。
*   **种植系统**：包含季节系统、多种作物（防风草、南瓜、蓝莓等），拥有完整的生长周期。
*   **经济系统**：在皮埃尔的商店买卖种子和作物，赚取金币，升级背包。
*   **多人社交**：通过 Supabase Realtime 实现的实时联机。输入好友 ID 即可“串门”，看到好友的农场布局。
*   **云端存档**：支持自动存档与防丢机制，并在多端设备间同步进度（包含互踢下线功能）。
*   **库存管理**：完整的背包与道具使用逻辑。

---

## ⚖️ 免责声明 (Disclaimer)

**请仔细阅读以下内容：**

1.  **美术资源版权**：
    *   本项目中使用的绝大多数美术素材（图片、图标、贴图）均来源于游戏 **《星露谷物语》 (Stardew Valley)**。
    *   这些资源的所有权归属于 **ConcernedApe** (Eric Barone)。
    *   本项目**仅引用**这些资源用于非盈利的学习、演示和技术研究目的。

2.  **非商业用途**：
    *   本项目是开源的教育/学习项目。
    *   **严禁**将本项目代码或部署的实例用于任何形式的商业盈利、广告投放或作为付费产品发布。

3.  **关于 Vibe Coding 实例**：
    *   本代码库主要用于展示 AI 辅助全栈开发的流程和能力，代码结构可能包含 AI 生成的特征，不代表最佳生产环境实践。

**If you are the copyright holder and wish for assets to be removed, please contact the repository owner, and we will comply immediately.**

---

## 🛠️ 技术栈

*   **前端框架**: [React 18](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
*   **构建工具**: [Vite](https://vitejs.dev/)
*   **样式库**: [Tailwind CSS](https://tailwindcss.com/)
*   **3D 渲染**: [Three.js](https://threejs.org/) + [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) + [Drei](https://github.com/pmndrs/drei)
*   **后端服务 (Baas)**: [Supabase](https://supabase.com/)
    *   Authentication (邮箱登录)
    *   Database (PostgreSQL)
    *   Realtime (WebSocket 广播)
    *   Storage (资源托管 - 可选)
*   **路由**: React Router v6
*   **图标**: Lucide React

---

## 🚀 部署与运行教程

如果你想在本地运行或部署这个项目，请按照以下步骤操作。

### 1. 环境准备

*   Node.js (推荐 v16 或更高版本)
*   npm 或 yarn
*   一个 [Supabase](https://supabase.com/) 账号

### 2. 克隆项目与安装依赖

```bash
git clone https://github.com/JasonItem/beedog-farm.git
cd beedog-farm
npm install
```

### 3. Supabase 配置 (关键步骤)

1.  登录 Supabase 控制台，创建一个新项目。
2.  进入 **SQL Editor**，复制本项目根目录下的 `SUPABASE_SETUP.sql` 文件内容并运行。这将创建所有必要的数据库表（profiles, inventory, plots, player_maps）和安全策略（RLS）。
3.  进入 **Project Settings -> API**，获取以下两个值：
    *   `Project URL`
    *   `anon` public key

### 4. 配置环境变量

在项目根目录下创建一个不存在的 `.env` 文件（或修改 `lib/supabase.ts`），填入你的 Supabase 配置。

> **注意**：本项目目前的架构直接在 `lib/supabase.ts` 中引用了配置。为了安全起见，建议改为使用 `.env` 并在代码中使用 `import.meta.env.VITE_SUPABASE_...`。

如果你直接运行现有代码，请打开 `src/lib/supabase.ts` 并修改：

```typescript
// src/lib/supabase.ts
export const SUPABASE_URL = '你的_Supabase_Project_URL';
export const SUPABASE_ANON_KEY = '你的_Supabase_Anon_Key';
```

### 5. 开启 Realtime 功能

为了让多人联机（互访）功能生效：
1.  在 Supabase 控制台，进入 **Database -> Replication**。
2.  确保 `supabase_realtime` 发布包含了以下表（或全部表）：
    *   `plots` (如果使用旧版同步)
    *   `player_maps` (新版同步)
    *   `profiles`

### 6. 本地启动

```bash
npm run dev
```

打开浏览器访问 `http://localhost:3000` 即可开始游戏。

### 7. 部署上线 (Vercel/Netlify)

本项目是纯静态 SPA 应用，非常容易部署。
1.  将代码推送到 GitHub。
2.  在 Vercel 或 Netlify 中导入项目。
3.  Build Command: `npm run build`
4.  Output Directory: `dist`
5.  **重要**：如果是生产环境，请务必在 Vercel/Netlify 的后台设置环境变量，不要将 Key 硬编码在代码中。

---

## 🤖 关于 Vibe Coding

本项目是 **Vibe Coding** 的一个实践案例。

**什么是 Vibe Coding?**
它不仅仅是“让 AI 写代码”，而是一种开发者与 AI 协同工作的心流状态。在这个项目中：
*   AI 负责生成大量的样板代码、复杂的 Three.js 逻辑、数学算法（如柏林噪声地图生成）以及数据库 Schema。
*   开发者负责架构设计、Prompt 调优、Code Review 以及将各个模块“缝合”在一起。

这种模式极大地降低了全栈开发的门槛，让开发者能够专注于创意和产品逻辑，而不是陷入繁琐的语法细节中。

---

**Enjoy Farming! 🌾**
