# 园境 · 智慧园区平面图编辑器

基于 HTML / SVG、React 与 TypeScript 的二维园区编辑器。SVG 是可交互的矢量图，不依赖鸟瞰照片。

## 使用

- 结构线：点击起点，再点击终点；Shift 约束水平 / 垂直。
- 房间、大棚区、露天区、大门：拖拽绘制；Shift 绘制正方形。
- 选择工具：拖拽移动，右下角控制点调整尺寸；属性面板可输入精确尺寸、位置和旋转角度。
- 复制后拖动可快速排列商铺。支持删除、撤销、重做、平移、缩放、适应全部图形。
- 修改属性后离开输入框生效。坐标和尺寸的单位均为米。
- 自动保存仅保留当前浏览器的一张图。新建、载入示例、导入会替换当前图，可撤销恢复。请定期导出 JSON 备份。
- JSON 导出包含所有业务属性，可以再次导入。SVG 导出是当前视图的独立矢量图，建议先点“适应全部图形”。
- 参考示例借鉴参考图中的商铺、公共建筑和开放区域，尺寸与布局均为示意，不是测绘结果。

## 后续系统集成

数据结构定义位于 `lib/plan.ts`，图纸为 `{schemaVersion:1, name, unit:'m', elements:Space[]}`。
每个空间有稳定 `id`、类型 `kind`、名称、几何和业务属性；后续可通过 `id` 关联房源、租赁合同、设备、水电表与账单。

坐标：X 向右、Y 向下。矩形 `(x,y)` 是未旋转左上角，宽高为米，`rotation` 绕该点顺时针旋转。结构线起点是 `(x,y)`，终点是 `(x+width,y+height)`，旋转同样绕起点应用。

类型：`room` 房间、`greenhouse` 大棚、`outdoor` 露天区、`gate` 大门、`line` 结构线。

费用：`rent` 为整个区域每月租金（元/月），`waterRate` 为元/m³，`electricityRate` 为元/kWh；0 表示尚未设置或免费，由业务方确认。`floor` 是楼层数，面积显示为占地宽×长，不自动乘楼层。面积合计未消除区域重叠。

当前没有后端同步、账户权限、计费或真实地图坐标；对接时应在后端再次验证 JSON，并使用数据库保存。浏览器支持 WebMCP 时注册 `read_park_plan` 和 `select_park_space`；当前环境未进行 WebMCP 运行验证。

## 开发

安装依赖后 `pnpm run dev`，构建 `pnpm run build`。类型检查 `pnpm exec tsc --noEmit`。数据测试使用 Node 22.13+：`node --experimental-strip-types --test tests/plan.test.mjs`。
