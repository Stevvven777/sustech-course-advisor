<div align="center">

# SUSTech Course Advisor

**面向南科大学生的本地优先、可解释选课顾问**<br>
**A local-first, explainable course-planning companion for SUSTech students**

[简体中文](#简体中文) · [English](#english)

[**🚀 中文快速开始**](#quick-start-cn) · [**🚀 English Quick Start**](#quick-start-en)

[![Status](https://img.shields.io/badge/status-early%20preview-F59E0B)](#项目状态)
[![Version](https://img.shields.io/badge/version-0.2.8-173F5F)](https://github.com/Stevvven777/sustech-course-advisor/releases/tag/v0.2.8)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520.18.0-339933?logo=nodedotjs&logoColor=white)](./package.json)
[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-5B5B5B)](./LICENSE)

把培养方案、个人进度、课程供给和社区经验放在同一张桌上，给出能解释、能比较、能复核的课表方案。

Bring curriculum requirements, personal progress, live course supply, and community knowledge together in plans you can explain, compare, and review.

</div>

> [!IMPORTANT]
> 本项目是非官方 early preview，不是自动抢课器。推荐只用于规划，选课预览不授权实际选课。
>
> This is an unofficial early preview, not an automatic enrollment bot. Recommendations are planning aids, and previews never authorize enrollment.

---

# 简体中文

<a id="quick-start-cn"></a>

## 🚀 快速开始：选择适合你的入口

> [!TIP]
> 不确定自己属于哪一类，就选 **A：让 Agent 全程处理**。普通用户不需要手动安装 npm 包、解压运行时或排查环境。

| 你的情况 | 选择 | 你需要负责 |
| --- | --- | --- |
| 不会或不想配置环境 | **A · Agent 全程处理（推荐）** | 发出安装请求，审核并批准明确的操作 |
| 掌握基本 Git 命令 | **B · 克隆仓库并固定发布版本** | 克隆仓库，其余版本固定、安装和检查交给 Agent |
| 完全理解项目原理 | **C · 从源码构建** | 自己控制依赖、构建、测试、运行方式与调试 |

### A · 不会配置环境：让 Agent 全程处理（推荐）

在支持 [Agent Skills](https://agentskills.io/)、本地文件和命令执行的 Agent 中新建对话，发送：

> 请从本项目的[当前 GitHub Release](https://github.com/Stevvven777/sustech-course-advisor/releases/latest)为我安装完整的 `$sustech-course-advisor` Skill。请由你检查系统与安装位置，确认最新正式发布的 tag，下载对应 Release 资产及 SHA-256 文件并完成校验，安装 Skill、运行时和所需依赖，最后运行环境检查。联网、写入或系统级变更前，先向我说明来源、版本、位置和影响并征得确认；不要让我手动执行本可由你安全完成的步骤。

Agent 应负责下载、校验、安装和验收。你只需要核对它提出的具体操作并决定是否批准，不需要把修复建议转换成命令。

### B · 掌握基本 Git：克隆仓库并固定发布版本

先克隆仓库：

```bash
git clone --depth 1 https://github.com/Stevvven777/sustech-course-advisor.git
cd sustech-course-advisor
```

然后在能够访问该目录的 Agent 中发送：

> 请先对照 GitHub Releases，把当前仓库固定到最新正式发布的 tag；然后安装完整的 `skills/sustech-course-advisor/`，不要只复制 `SKILL.md`。请根据我的操作系统运行对应的 bootstrap，安装并校验与该 Release 一致的运行时及依赖，运行 `doctor` 检查安装；需要个性化数据时，在我通过安全交互完成登录后再运行 `doctor --live`。需要联网或写入前先说明影响并征得确认。

这条路径只要求你能够克隆并查看 Git 状态；Release tag 的确认与检出、依赖安装、跨平台 bootstrap 和就绪检查仍由 Agent 完成。不要在仓库根目录运行 `npm install`。

### C · 完全理解项目原理：从源码构建

如果你要审查实现、修改求解器、维护 Skill 或调试边界，可以直接使用锁文件构建：

```bash
git clone https://github.com/Stevvven777/sustech-course-advisor.git
cd sustech-course-advisor
npm ci
npm run prepack
node dist/cli.js help
```

克隆后、运行 `npm ci` 前，自行检出准备审查的 Release tag、分支或 commit。`npm ci` 在这里仅用于从锁文件安装源码开发依赖；Advisor 仍不发布到 npm。继续前建议阅读 [`package.json`](./package.json)、[Skill 主流程](./skills/sustech-course-advisor/SKILL.md)、[环境边界](./skills/sustech-course-advisor/references/environment.md)、[工具链](./skills/sustech-course-advisor/references/toolkit.md)和 [`debug/` 维护记录](./debug/README.md)。选择非发布 tag 时，应自行承担版本、依赖和测试结果的审查责任。

### 分路径完成标准

**A / B · Release 安装路径**

- 安装了完整 Skill 目录，包括 `SKILL.md`、`references/` 和 `scripts/`；
- Advisor 归档与同一 GitHub Release 提供的 SHA-256 一致；
- Advisor 运行时版本与所选 Release tag 一致，默认绑定同一受控安装目录中由发布策略固定的上游 CLI，且没有全局安装；
- `doctor` 确认安装、上游 CLI 能力和本地凭据状态；需要个性化数据时，登录后再由 `doctor --live` 检查实时 TIS 可达性。

**C · 源码构建路径**

- 记录实际检出的 tag、分支或 commit，并确认 `npm ci` 与 `npm run prepack` 通过；
- 确认 `node dist/cli.js help` 可以启动；需要个性化数据时，依次运行源码入口的 `doctor`，并在安全登录后运行 `doctor --live`；
- 除非正在测试 Release bootstrap，否则源码构建不要求下载或校验 Release 归档。

所有路径都必须把安装状态、凭据状态和上游网络状态分开；TIS/CAS 超时不等于凭据失效，也不应触发自动重复登录。

A / B 路径确认 Skill 可以加载后，新建对话并说；C 路径如果也导入了仓库内的 Skill，同样从这里开始：

> 使用 `$sustech-course-advisor`，按照我的学年和专业推荐 2026 秋季课程。

需要登录时，Agent 会引导你在安全的本地交互界面完成，不会在聊天中索要密码。环境和登录状态就绪后，它才会征求个人学业信息读取许可、请你确认脱敏摘要，再给出三套可比较的方案。

> [!NOTE]
> Advisor 的正式发布物只位于本仓库的 [GitHub Releases](https://github.com/Stevvven777/sustech-course-advisor/releases)，不发布到 npm。`.tgz` 是由 npm 打包工具生成、带校验值的 GitHub Release 资产，不是要求用户从 npm 获取的公共包。项目支持 macOS、Windows 和 Linux；不同客户端的 Skill 导入入口可能不同，通用项目级目录是 `.agents/skills/sustech-course-advisor/`。

## 它是什么

SUSTech Course Advisor 是一个面向南方科技大学学生的本地选课规划工具和 Agent Skill。它通过已安装的 [`sustech`](https://github.com/wormforce/sustech-cli) CLI 读取校园服务与 NCES 数据，在本地维护培养方案解释、个人偏好、评分逻辑和课表输出。

它不会把“看起来不错”包装成确定结论，而是给出三套带理由的方案：

- **高负载方案**：在学分与时间约束内优先覆盖更多培养方案课程；
- **高评分证据方案**：仅在教学团队能够可靠匹配时使用 NCES 评分证据；
- **兴趣导向方案**：优先匹配你的兴趣、指定课程与时间偏好。

## 亮点功能

- **先确认，再推荐**：先说明流程，区分“已有意向课程”和“直接推荐”，再征求个人学业信息读取许可。
- **培养方案感知**：以确认过的官方培养方案 PDF 为要求依据，每条规则保留来源页码和人工复核项。
- **个性化但克制**：结合 TIS 培养方案进度、已修/在修课程和当前课表；缺失的专业或方向会询问本人，不从课程名称猜测。
- **证据可追溯**：区分官方 PDF、TIS 实时状态、可信社区来源 [`sustech.online`](https://sustech.online/) 与 NCES 评价证据。
- **三套可解释方案**：展示入选理由、学分、冲突、要求覆盖和证据置信度，而不是只给一串课程代码。
- **多格式输出**：从同一份版本化结果导出 HTML、XLSX 和按方案拆分的 ICS 日历。
- **安全预览**：可以生成精确的 TIS 选课 preview，但本项目本身从不调用 apply。

## 工作流程

1. 说明整体流程和安全边界；
2. 选择“分析已有意向课程”或“直接生成推荐”；
3. 检查本地环境、`sustech` 能力和 TIS 登录状态；
4. 登录成功后，说明并征求读取最小个人学业信息的许可；
5. 展示脱敏学籍与进度摘要，请你确认或补充；
6. 确认官方培养方案、学分范围、时间限制和兴趣偏好；
7. 生成并比较三套方案；
8. 按需导出，或生成独立的选课预览。

读取学业信息、写入本地 profile、导出文件、生成预览和实际选课始终是彼此独立的授权。

## 信息源与可信边界

| 信息源 | 用途 | 边界 |
| --- | --- | --- |
| 官方培养方案 PDF | 培养要求、课程模块、推荐学期 | 适用版本和歧义条款必须由学生确认 |
| TIS（经 `sustech` CLI） | 个人进度、当前课程供给、课表和选课状态 | 实时且个性化；保留来源失败和冲突 |
| [`sustech.online`](https://sustech.online/) | 南科大术语、选课指南和学生经验 | 可信的社区辅助来源，不覆盖官方要求或实时 TIS 状态 |
| NCES（经 `sustech` CLI） | 课程与教学团队评价证据 | 多人团队评分不拆分到单个教师或助教 |

## CLI

| 命令 | 作用 |
| --- | --- |
| `doctor` | 检查构建、Node.js、`sustech` 能力、后果记录和凭据状态 |
| `diagnose` | 生成不含个人学业数据的本地滚动诊断及可选脱敏支持包 |
| `init` | 交互式创建本地 advisor profile |
| `show` | 查看已有 profile |
| `refresh` | 刷新 TIS 培养方案进度时间戳 |
| `recommend` | 生成高负载、高评分证据和兴趣导向方案 |
| `workflow` | 显式运行 live、cached 或 render-only 路径，并输出完整执行证据 |
| `export` | 导出 HTML、XLSX 和 ICS |
| `preview` | 为一个方案生成 TIS 购物车或选课预览，不执行 apply |

`workflow` 不会在三种模式间静默回退：`live` 在一个总超时预算内刷新权威课程事实，并把脱敏快照写到 `--cache`；`cached` 只使用该快照重新规划，同时明确报告数据年龄与是否过期；`render-only` 只读取已经审计过的 plan 并生成 HTML/XLSX/ICS，不启动 `sustech`。三种模式都报告来源时间、代理模式、各阶段耗时与重试次数、缓存状态和用户可见总耗时。具体命令见[工具说明](./skills/sustech-course-advisor/references/toolkit.md)。

校园请求默认直连。重复出现实时查询超时后，可在当前终端临时设置 `SUSTECH_ADVISOR_PROXY_MODE=inherit` 以继承代理进行对照；Windows PowerShell 使用 `$env:SUSTECH_ADVISOR_PROXY_MODE="inherit"`，macOS/Linux 使用 `export SUSTECH_ADVISOR_PROXY_MODE=inherit`。完整启用与恢复方法见[环境说明](./skills/sustech-course-advisor/references/environment.md)。

## 隐私与安全

- 密码保留在操作系统凭据存储中；本项目不读取、打印或保存密码、Cookie、Token 和原始 TIS 响应。
- 若执行沙箱看不到 macOS 钥匙串，应在获准后让完整 CLI 命令在可访问钥匙串的环境运行，而不是导出密码。
- profile 和输出文件默认以受限权限写入，并通过 `.gitignore` 排除常见个人数据文件。
- 诊断仅保留平台、版本、能力、阶段与错误码，最多保存 10 份；支持包不会自动上传。
- 不覆盖已有文件，除非明确传入 `--overwrite`。
- 任何不完整来源、培养方案冲突和模糊规则都会保留为警告或人工复核项。
- 项目只生成推荐和 preview；实际校园状态变更必须由 `sustech` 独立完成并再次确认。

## 项目状态

当前版本为 **0.2.8 early preview**。核心求解、环境检查、HTML/XLSX/ICS 输出和只读选课预览已经具备测试覆盖，但真实学期中的培养方案差异、课程供给和上游服务变化仍需要更多验证。

欢迎通过 Issues 报告可复现的问题、培养方案边界或输出改进建议。如果这个项目对你有帮助，也欢迎点一个 Star。

## 开发

以下内容面向希望从源码运行或参与开发的人。需要 Node.js 20.18.0 或更新版本。

```bash
npm ci
npm run build
node dist/cli.js help
```

常用的本地调试流程：

```bash
node dist/cli.js doctor --profile default --live
node dist/cli.js init --path ./student.advisor.json
node dist/cli.js recommend \
  --path ./student.advisor.json \
  --semester 2026-2027-1 \
  --week-one-monday 2026-09-07 \
  --destination ./plan.json
```

质量检查：

```bash
npm run prepack
```

## 许可

本项目采用 [PolyForm Noncommercial License 1.0.0](./LICENSE)。允许非商业用途；商业使用需要另行获得许可。

---

# English

<a id="quick-start-en"></a>

## 🚀 Quick start: choose your path

> [!TIP]
> If you are unsure which path fits, choose **A: let the Agent handle everything**. Regular users do not need to install npm packages, unpack runtimes, or troubleshoot the environment.

| Your experience | Choose | What you handle |
| --- | --- | --- |
| You cannot or do not want to configure the environment | **A · Agent-managed setup (recommended)** | Send one request, review and approve clearly described operations |
| You know basic Git commands | **B · Clone and pin a release** | Clone the repository, then delegate release pinning, setup, and checks to the Agent |
| You fully understand the project | **C · Build from source** | Own dependency, build, test, execution, and debugging decisions |

### A · No environment experience: let the Agent handle everything (recommended)

Start a conversation in an Agent that supports [Agent Skills](https://agentskills.io/), local files, and shell execution, then send:

> Install the complete `$sustech-course-advisor` Skill for me from the project's [current GitHub Release](https://github.com/Stevvven777/sustech-course-advisor/releases/latest). Inspect my platform and installation location, identify the latest formally published tag, download and verify its Release asset and SHA-256 file, install the Skill, runtime, and required dependencies, then run the environment checks. Before network access, writes, or system-level changes, show me the source, version, destination, and impact and obtain my approval. Do not make me perform steps that you can safely complete yourself.

The Agent should own download, verification, installation, and acceptance checks. You only need to review each concrete operation and decide whether to approve it; you should not have to translate remediation into commands.

### B · Basic Git experience: clone the repository and pin a release

First clone the repository:

```bash
git clone --depth 1 https://github.com/Stevvven777/sustech-course-advisor.git
cd sustech-course-advisor
```

Then send this request to an Agent that can access the checkout:

> First compare this checkout with GitHub Releases and pin it to the latest formally published tag. Then install the complete `skills/sustech-course-advisor/` directory; do not copy only `SKILL.md`. Run the bootstrap matching my operating system, install and verify the runtime and dependencies for that Release, then run `doctor` to check the installation. If personalized data is needed, run `doctor --live` only after I complete login through the secure interactive prompt. Before network access or writes, explain the impact and obtain my approval.

This path requires only enough Git knowledge to clone the repository and inspect its status. The Agent still identifies and checks out the Release tag, installs dependencies, runs the cross-platform bootstrap, and performs readiness checks. Do not run `npm install` at the repository root.

### C · Full project understanding: build from source

To review the implementation, change the solver, maintain the Skill, or debug boundaries, build directly from the lockfile:

```bash
git clone https://github.com/Stevvven777/sustech-course-advisor.git
cd sustech-course-advisor
npm ci
npm run prepack
node dist/cli.js help
```

After cloning and before running `npm ci`, check out the Release tag, branch, or commit you intend to review. Here, `npm ci` installs source-development dependencies from the lockfile; the Advisor is still not published to npm. Before continuing, review [`package.json`](./package.json), the [Skill workflow](./skills/sustech-course-advisor/SKILL.md), [environment boundaries](./skills/sustech-course-advisor/references/environment.md), the [toolkit](./skills/sustech-course-advisor/references/toolkit.md), and the [`debug/` maintenance records](./debug/README.md). If you select anything other than a published tag, you own review of versions, dependencies, and test results.

### Completion criteria by path

**A / B · Release installation paths**

- the complete Skill directory is installed, including `SKILL.md`, `references/`, and `scripts/`;
- the Advisor archive matches the SHA-256 published with the same GitHub Release;
- the Advisor runtime version matches the selected Release tag, binds the upstream CLI pinned by that Release policy from the same controlled installation by default, and performs no global install;
- `doctor` confirms installation, upstream CLI capabilities, and local credential state; when personalized data is needed, `doctor --live` checks live TIS reachability after login.

**C · Source-build path**

- record the tag, branch, or commit actually checked out, and confirm that `npm ci` and `npm run prepack` pass;
- confirm that `node dist/cli.js help` starts; when personalized data is needed, run `doctor` through the source entry point, then run `doctor --live` after secure login;
- a source build does not need to download or verify a Release archive unless it is specifically testing the Release bootstrap.

Every path must keep installation, credential, and upstream network states separate. A TIS/CAS timeout is not equivalent to expired credentials and must not trigger an automatic login loop.

After the Skill can be loaded on path A or B, start a new conversation and say. Path C can start the same way if the bundled Skill was also imported:

> Use `$sustech-course-advisor` to recommend courses for Fall 2026 based on my year and major.

When login is needed, the Agent will guide you through a secure local prompt and never ask for your password in chat. Only after the environment and login state are ready will it request permission for personal academic reads, ask you to confirm the redacted snapshot, and present three comparable plans.

> [!NOTE]
> Official Advisor artifacts are published only in this repository's [GitHub Releases](https://github.com/Stevvven777/sustech-course-advisor/releases), not to npm. The `.tgz` is a checksummed GitHub Release asset produced with npm's packing tool, not a public package users are expected to obtain from npm. The project supports macOS, Windows, and Linux. Skill import mechanisms vary by client; `.agents/skills/sustech-course-advisor/` is the common project-level location.

## What it is

SUSTech Course Advisor is a local course-planning engine and Agent Skill for Southern University of Science and Technology students. It uses the installed [`sustech`](https://github.com/wormforce/sustech-cli) CLI for campus and NCES reads, while keeping curriculum interpretation, preferences, scoring, and schedule exports local.

Instead of presenting one opaque answer, it builds three explainable alternatives:

- **High load:** prioritizes more curriculum-relevant credits within workload and timetable constraints;
- **High grading evidence:** uses NCES grading evidence only when the complete teaching team can be matched reliably;
- **Interest aligned:** favors your interests, requested courses, and schedule preferences.

## Highlights

- **Confirm before recommending:** explains the process, routes between candidate-course analysis and direct recommendation, and asks permission before personal academic reads.
- **Curriculum aware:** treats the confirmed official curriculum PDF as the requirements authority, with page-level provenance and manual-review items.
- **Personalized with restraint:** considers TIS progress, completed and in-progress work, and the current schedule without guessing a missing major or track.
- **Traceable evidence:** separates official PDFs, live TIS state, trusted community guidance from [`sustech.online`](https://sustech.online/), and NCES review evidence.
- **Three explainable plans:** exposes credits, conflicts, requirement coverage, reasons, warnings, and evidence confidence.
- **Reviewable exports:** produces HTML, XLSX, and one ICS calendar per strategy from the same versioned result.
- **Safe previews:** can request exact TIS enrollment previews but never calls an apply command itself.

## How it works

1. Explain the workflow and safety boundaries.
2. Choose between analyzing candidate courses and receiving direct recommendations.
3. Check the local build, required `sustech` capabilities, and TIS authentication.
4. After login, describe and request permission for the minimum personal academic data needed.
5. Present a redacted academic snapshot for confirmation or correction.
6. Confirm the official curriculum framework, credit range, blocked times, and interests.
7. Generate and compare three plans.
8. Export results or create a separate read-only enrollment preview.

Permission to read academic data never implies permission to write a profile, export files, generate previews, or mutate campus state.

## Sources and trust boundaries

| Source | Role | Boundary |
| --- | --- | --- |
| Official curriculum PDF | Requirements, modules, and recommended sequencing | The student must confirm applicability and ambiguous clauses |
| TIS through the `sustech` CLI | Personal progress, current supply, schedules, and enrollment state | Live and personalized; partial failures and disagreements remain visible |
| [`sustech.online`](https://sustech.online/) | SUSTech terminology, planning guides, and student experience | Trusted community context; it does not override official requirements or live TIS state |
| NCES through the `sustech` CLI | Course and teaching-team review evidence | Multi-person ratings are never assigned to one instructor or assistant |

## CLI

| Command | Purpose |
| --- | --- |
| `doctor` | Check the build, Node.js, required `sustech` capabilities, consequence records, and credentials |
| `diagnose` | Write a rotating projected diagnostic and an optional sanitized local support bundle |
| `init` | Create a local advisor profile interactively |
| `show` | Inspect an existing profile |
| `refresh` | Refresh the TIS degree-progress timestamp |
| `recommend` | Generate high-load, high-grading-evidence, and interest-aligned plans |
| `workflow` | Explicitly run a live, cached, or render-only path with complete execution evidence |
| `export` | Export HTML, XLSX, and ICS artifacts |
| `preview` | Generate TIS cart or enrollment previews without applying them |

`workflow` never silently falls back between modes. `live` refreshes authoritative course facts inside one total timeout budget and writes a redacted `--cache` snapshot. `cached` replans only from that snapshot and visibly reports its age and freshness. `render-only` reads an already audited plan and produces HTML/XLSX/ICS without starting `sustech`. Every mode reports source timestamps, proxy mode, stage durations and retry counts, cache state, and total user-visible wall-clock time. See the [toolkit](./skills/sustech-course-advisor/references/toolkit.md) for exact invocations.

Campus requests use direct access by default. After repeated live-query timeouts, temporarily set `SUSTECH_ADVISOR_PROXY_MODE=inherit` in the current terminal for a comparison run: use `$env:SUSTECH_ADVISOR_PROXY_MODE="inherit"` in Windows PowerShell or `export SUSTECH_ADVISOR_PROXY_MODE=inherit` on macOS/Linux. See the [environment guide](./skills/sustech-course-advisor/references/environment.md) for activation and reset instructions.

## Privacy and safety

- Passwords remain in the operating-system credential store. The advisor does not read, print, or store passwords, cookies, tokens, or raw TIS responses.
- If a sandbox cannot see the macOS Keychain, the complete CLI command should run in an approved keychain-capable context; the password must never be exported.
- Profiles and outputs are written with restrictive permissions, and common personal-data files are excluded by `.gitignore`.
- Existing files are not replaced unless `--overwrite` is explicitly supplied.
- Partial sources, curriculum disagreements, and ambiguous rules remain visible as warnings or manual-review items.
- The project produces recommendations and previews only. Any real campus-state mutation must be handled separately by `sustech` with fresh, exact confirmation.

## Project status

The current release is **0.2.8 early preview**. Core solving, environment checks, HTML/XLSX/ICS exports, and read-only enrollment previews have automated coverage, but real-semester curriculum differences, course supply, and upstream changes still need broader validation.

Reproducible bug reports, curriculum edge cases, and output ideas are welcome through Issues. If the project helps you, consider giving it a Star.

## Development

This section is for contributors and people running directly from source. Node.js 20.18.0 or newer is required.

```bash
npm ci
npm run build
node dist/cli.js help
```

A typical local debugging flow is:

```bash
node dist/cli.js doctor --profile default --live
node dist/cli.js init --path ./student.advisor.json
node dist/cli.js recommend \
  --path ./student.advisor.json \
  --semester 2026-2027-1 \
  --week-one-monday 2026-09-07 \
  --destination ./plan.json
```

Quality checks:

```bash
npm run prepack
```

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](./LICENSE). Noncommercial use is permitted; commercial use requires separate permission.
