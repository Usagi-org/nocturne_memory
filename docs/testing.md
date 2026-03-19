# 测试说明

本文档说明 `nocturne_memory` 当前的自动化测试设计、覆盖范围、本地运行方式，以及 GitHub Actions 中的触发策略。目标不是追求“测试数量”，而是让核心记忆链路在真实使用场景下可验证、可回归、可持续扩展。

## 1. 测试目标

当前测试体系重点覆盖三类风险：

1. 后端图式记忆模型在 CRUD、版本链、搜索、glossary、审核快照上的行为正确性。
2. 前端管理面板在真实页面交互下能够完成审核、浏览、编辑、清理等主要流程。
3. 从浏览器到 FastAPI 到数据库的整条链路在 CI 中可以稳定复现，不依赖人工手动准备数据。

## 2. 分层策略

| 层级 | 框架 | 目标 | 对应目录 |
| --- | --- | --- | --- |
| 后端单元/服务/API/MCP | `pytest` + `pytest-asyncio` + `pytest-cov` | 验证核心业务逻辑、接口和 MCP 工具行为 | `backend/tests/` |
| 前端单元/组件 | `Vitest` + `React Testing Library` + `MSW` + `jsdom` | 验证组件交互、API 调用、副作用和页面状态切换 | `frontend/src/**/*.test.*` |
| 端到端 | `Playwright` | 验证真实浏览器下的关键用户路径和前后端联动 | `frontend/tests/e2e/` |
| 持续集成 | GitHub Actions | 按“快反馈 + 慢兜底”分层执行 | `.github/workflows/` |

这套分层对应的原则是：

- 后端优先覆盖“数据是否正确”。
- 前端单测优先覆盖“交互是否正确”。
- E2E 只覆盖跨层关键路径，不在浏览器里重复后端细节。

## 3. 覆盖范围

### 3.1 后端

后端测试目录：

- `backend/tests/unit/`
- `backend/tests/service/`
- `backend/tests/api/`
- `backend/tests/mcp/`

当前重点覆盖：

- 鉴权中间件与排除路径：`test_auth.py`
- 搜索分词与 search terms 生成：`test_search_terms.py`
- changeset/snapshot 的 before/after 语义：`test_snapshot.py`
- 图服务的记忆创建、更新、删除、路径与版本行为：`test_graph_service.py`
- glossary 关键词绑定与召回：`test_glossary_service.py`
- 搜索索引构建与更新：`test_search_indexer.py`
- 审核、浏览、维护接口的链路：`test_api_routes.py`
- MCP 工具对系统视图与写入行为的封装：`test_mcp_tools.py`

### 3.2 前端单测

前端单测目录：

- `frontend/src/lib/api.test.js`
- `frontend/src/components/TokenAuth.test.jsx`
- `frontend/src/features/review/ReviewPage.test.jsx`
- `frontend/src/features/memory/MemoryBrowser.test.jsx`
- `frontend/src/features/memory/components/GlossaryHighlighter.test.jsx`
- `frontend/src/features/maintenance/MaintenancePage.test.jsx`

当前重点覆盖：

- `api.js` 的 token 注入与 401 处理
- `TokenAuth` 的鉴权成功/失败分支
- `ReviewPage` 的待审核组加载、集成、拒绝
- `MemoryBrowser` 的节点加载、编辑、仅提交变更字段
- `GlossaryHighlighter` 的弹层与节点跳转
- `MaintenancePage` 的孤儿记忆展开与批量删除

### 3.3 端到端

E2E 入口：

- `frontend/tests/e2e/nocturne.spec.js`
- `frontend/tests/e2e/helpers/seed.js`
- `backend/scripts/e2e_seed.py`

当前重点覆盖的真实场景：

1. 在审核页集成一个待审核 group。
2. 在审核页拒绝一个待审核 group，并验证旧内容恢复。
3. 在记忆浏览页编辑正文与 disclosure。
4. 在 `project://` 别名路径下浏览子树。
5. 从 glossary 高亮词跳转到目标记忆。
6. 在维护页查看 deprecated/orphaned 记忆并展开详情。

## 4. 测试数据与隔离策略

### 4.1 后端测试隔离

后端测试通过 `backend/tests/conftest.py` 隔离数据库与快照目录：

- 默认使用 SQLite 临时库。
- 可通过 `TEST_DATABASE_URL` 切换到 PostgreSQL。
- 每轮测试都会重建干净状态，避免跨测试污染。

### 4.2 E2E 种子数据

E2E 不依赖“手工准备数据库”，而是通过 `backend/scripts/e2e_seed.py` 注入确定性场景数据。

`full` 场景会构造：

- `core://agent` 与 `core://my_user` 启动记忆
- `core://workspace` 及其子节点
- `project://mirror_workspace` 别名路径
- glossary 关键词 `Salem`
- 一个待审核的 `core://review_item`
- 一个 orphan/deprecated 清理场景

注意事项：

- `frontend/tests/e2e/helpers/seed.js` 会从 `frontend/tests/e2e/helpers` 回溯到仓库根目录后执行后端脚本。
- `backend/scripts/e2e_seed.py` 对 SQLite 采用“清空 schema”而不是“删除数据库文件重建”，避免运行中的 FastAPI 仍持有旧文件句柄。

## 5. 本地运行

### 5.1 后端测试

```bash
.venv/bin/pytest backend/tests
```

如需覆盖率：

```bash
.venv/bin/pytest backend/tests --cov=backend --cov-report=term-missing
```

### 5.2 前端单测

前端需要 Node 版本满足：

- `>=20.19.0`
- 或 `>=22.12.0`

安装依赖后运行：

```bash
cd frontend
npm run test
```

覆盖率：

```bash
cd frontend
npm run test:coverage
```

### 5.3 前端构建

CI 会先构建再跑单测，因此本地建议同步验证：

```bash
cd frontend
npm run build
```

### 5.4 本地 E2E

最小可用环境变量示例：

```bash
export DATABASE_URL="sqlite+aiosqlite:///$PWD/.tmp/e2e-local.db"
export SNAPSHOT_DIR="$PWD/.tmp/e2e-snapshots"
export VALID_DOMAINS="core,writer,game,notes,project"
export CORE_MEMORY_URIS="core://agent,core://my_user"
export API_TOKEN=""
export PLAYWRIGHT_BASE_URL="http://127.0.0.1:3000"
export PYTHON="python"
```

启动后端与前端后，运行：

```bash
cd frontend
npm run test:e2e -- --grep @smoke
```

完整 E2E：

```bash
cd frontend
npm run test:e2e
```

## 6. GitHub Actions 触发策略

### 6.1 `backend-tests.yml`

触发：

- `pull_request`
- `push`
- `workflow_dispatch`

执行内容：

- Python `3.10` / `3.12` 矩阵下跑 SQLite 后端测试
- 在 `main` 或手动触发时额外跑 PostgreSQL smoke

### 6.2 `frontend-tests.yml`

触发：

- `pull_request`
- `push`
- `workflow_dispatch`

执行内容：

- Node `22`
- `npm ci`
- `npm run build`
- `npm run test:coverage`

### 6.3 `e2e.yml`

触发：

- `pull_request`
- `push`
- `workflow_dispatch`

执行内容：

- `e2e-smoke`：所有 PR / push / 手动触发都跑
- `e2e-full-sqlite`：仅 `main` 或手动触发
- `e2e-full-docker`：仅 `main` 或手动触发，走 Docker Compose + PostgreSQL + Nginx

这种拆分的目的：

- PR 阶段尽快发现回归
- 主分支阶段再补全更重的端到端兜底

## 7. 维护约定

新增功能时，优先按下面顺序补测试：

1. 后端行为变更：先补 `backend/tests/`
2. 前端交互变更：补对应页面/组件单测
3. 用户主流程变更：再决定是否补 Playwright

建议遵守的规则：

- 不把 Playwright 当成“所有问题都往浏览器里塞”的兜底桶。
- 新增 E2E 场景时，优先复用 `full` seed；只有数据模型明显不同才扩展新 scenario。
- 新增前端测试时，优先使用语义选择器（role、label、heading），避免纯文本歧义。
- 新增 workflow 依赖时，先确认本地与 CI 的 Node/Python 版本一致。

## 8. 已知关键坑位

这些问题已经在当前测试基建中处理过，后续不要回退：

1. `Vitest` 环境必须手动注入 `localStorage/sessionStorage` mock。
2. `vite.config.js` 必须排除 `frontend/tests/e2e/**`，否则单测会误扫 Playwright spec。
3. E2E seed 的仓库根目录回溯必须是 `../../../..`。
4. 前端相关 workflow 必须固定 Node `22`，不能只写宽泛的 `20`。

## 9. 推荐回归顺序

提交前的最低回归建议：

1. `pytest backend/tests`
2. `cd frontend && npm run test`
3. `cd frontend && npm run build`
4. 涉及主流程改动时，再跑 `cd frontend && npm run test:e2e -- --grep @smoke`

如果改动触及以下区域，建议跑完整 E2E：

- 审核页
- 记忆浏览页
- 维护页
- 路由 / 鉴权 / glossary / alias
