[Français](README.md) | [English](README.en.md) | **中文**

# 🚄 TGV MAX Planner

一个帮助你**用 TGV MAX 通票规划旅程**的网站,基于
[SNCF 开放数据集「tgvmax」](https://ressources.data.sncf.com/explore/dataset/tgvmax/)构建。

原始数据集会列出未来约 30 天内每一趟列车是否仍有 **MAX 席位**(面向 MAX JEUNE /
MAX SENIOR 会员的 0 元车票),但它本身并不便于阅读。本站把它翻转到旅客视角——而
旅客最大的优势正是**灵活性**(不限次数出行)。

> ⏱️ 数据**并非实时**:SNCF 每天(清晨)**只导出一次**数据集。显示为「有票」的
> 席位在此期间可能已被预订;应用会显示最近一次导出的时间戳,并跳转到 SNCF Connect
> 以便确认。

## 功能

| 标签页               | 用途                                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 📅 **日历**          | 针对 A → B 某条线路,展示 30 天内 MAX 席位的热力图。点击某一天 → 查看当天列车。                                                          |
| 🧭 **去哪儿?**      | 从某个车站出发、在某个日期(今天 / 明天 / 周末 / 🎲)有 MAX 席位的所有目的地。显示各车站的**客流量**;可按「最繁忙」或「最冷门」排序。 |
| 🔀 **换乘**          | 直达列车满员时:提供 **2 到 4 趟列车**(最多 3 次换乘)的行程方案,换乘时间可调,并标记**夜间列车** 🌙(次日抵达)。                     |
| 🗺️ **地图**          | 把目的地标注在**按速度着色的真实 SNCF 铁路网**上:**高速线(LGV)**以粉色突出显示,普速线路则为蓝色。                                    |
| 🔁 **往返**          | 当日往返(在目的地的最短停留时间)或周末往返,两个方向均有 MAX 席位,支持时段筛选,并附有线路小地图。                                     |

键盘快捷搜索:**⌘K / Ctrl+K**(先选出发车站,再选可选的目的地)。

## 快速开始

前置要求:**Node ≥ 20**。然后:

```bash
npm install
npm run dev        # 开发服务器(Vite),地址 http://localhost:5173
npm run build      # 带类型检查的生产构建 -> dist/
npm run preview    # 预览生产构建
```

SNCF API 开放了 CORS:浏览器直接请求,无需后端。

### 脚本

| 脚本                                        | 作用                                    |
| ------------------------------------------- | --------------------------------------- |
| `npm run dev` / `build` / `preview`         | Vite:开发、生产构建、预览               |
| `npm test` / `test:watch` / `test:coverage` | Vitest                                  |
| `npm run typecheck`                         | `tsc --noEmit`(严格模式)              |
| `npm run lint` / `lint:fix`                 | ESLint(flat config + typescript-eslint)|
| `npm run format` / `format:check`           | Prettier                                |
| `npm run check`                             | 类型检查 + lint + 测试(即 CI 所执行)  |
| `npm run data:stations` / `data:railnet`    | 重新生成数据(见下文)                  |

## 架构

严格 TypeScript,**不使用框架**,采用分层结构。依赖方向**由外向内**:
`ui` → `services`/`data` → `domain`。`domain` 与 `lib` 层是纯粹的(不访问 DOM
或网络),因而极易测试;外部依赖(`fetch`、数据)由组合根**注入**。

```
src/
  main.ts                 组合根(装配依赖图)
  config.ts               常量(接口地址、链接)
  app/
    App.ts                外壳:布局、按标签页路由(hash)、数据新鲜度提示条
  domain/                 业务核心 —— 纯粹(类型 + 规则,不含 DOM/fetch)
    models.ts             Station、Train、DestinationAvailability…
    time.ts               时长(处理跨零点)
    availability.ts       热力图等级 + 按目的地聚合
    roundtrip.ts          当日 / 周末往返算法
  data/                   数据访问
    SncfApiClient.ts      带类型的 OpenDataSoft 客户端(注入 fetch,分页)
    query.ts              构建 ODSQL 子句(纯函数)
    TgvmaxRepository.ts   业务查询 -> 领域模型
    StationRepository.ts  车站目录(搜索、查找)
    railNetwork.ts        加载铁路网 GeoJSON(懒加载,带缓存)
  ui/                     表现层
    dom.ts                带类型的 DOM 辅助函数(el/clear/field/select)
    components/           StationPicker、列车、状态、旗标
    map/                  MapKit(Leaflet) + railLayer(按速度着色)
    views/                CalendarView、DestinationsView、MapView、RoundtripView
  lib/                    横切工具(日期、格式化、文本)
  assets/data/            stations.json(生成)
public/railnet.geojson    简化后的铁路网(生成)
tests/                    Vitest 单元测试(与 src/ 镜像对应)
data/                     Python 数据生成脚本
```

### ADR —— 为什么不用 UI 框架?

本应用的价值在于其**业务逻辑**(聚合、日期计算、往返组合、API 层)——这正是最能
从类型与测试中获益的部分,而它们都由纯函数覆盖。视图数量不多,且大多是数据可视化
(包括本质上命令式的 Leaflet)。用 JSX 全部重写只会带来无谓的改动和一个笨重的依赖,
却没有相应的收益。因此我们通过一个小巧的带类型辅助函数直接渲染 DOM,并在逻辑(经过
测试)与表现之间保持清晰边界。这一选择是可逆的:`domain`/`data` 层并不依赖 UI。

## 测试

针对纯逻辑与数据层契约的单元测试:

```bash
npm test
```

- `domain/`:时长、热力图等级、聚合、往返算法(当日与周末)。
- `lib/`:日期、格式化、文本归一化。
- `data/`:URL 构建 + 客户端分页(注入伪造的 `fetch`)、ODSQL 构建器、车站搜索。

## 重新生成数据

有两个静态数据集由 Python 脚本预先计算(若 SNCF 更新了数据,请重新运行):

```bash
npm run data:stations   # -> src/assets/data/stations.json
npm run data:railnet    # -> public/railnet.geojson
```

## 数据来源与限制

- **tgvmax**:MAX 席位可用情况,**每日更新**,滚动约 30 天窗口。
- **车站**:坐标 + UIC 来自 [trainline-eu/stations](https://github.com/trainline-eu/stations);
  **客流量**来自 [frequentation-gares](https://ressources.data.sncf.com/explore/dataset/frequentation-gares/)(按 UIC 关联)。
- **铁路网与速度**:[vitesse-maximale-nominale-sur-ligne](https://ressources.data.sncf.com/explore/dataset/vitesse-maximale-nominale-sur-ligne/)
  (Douglas-Peucker 简化几何)。可选的 [OpenRailwayMap](https://www.openrailwaymap.org/) 图层。
- **非官方**项目,与 SNCF 无任何关联。
