<div align="center">

# SUSTech Course Advisor

**面向南科大学生的本地优先、可解释选课顾问**<br>
**A local-first, explainable course-planning companion for SUSTech students**

[简体中文](#简体中文) · [English](#english)

[![Status](https://img.shields.io/badge/status-early%20preview-F59E0B)](#项目状态)
[![Version](https://img.shields.io/badge/version-0.2.5-173F5F)](https://github.com/Stevvven777/sustech-course-advisor/releases/tag/v0.2.5)
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

## 快速开始

普通用户不需要学习下面的 CLI 命令。这个项目的主要入口就是随项目提供的 Agent Skill：

1. 在支持 [Agent Skills](https://agentskills.io/) 的 Agent 中导入整个 [`skills/sustech-course-advisor`](./skills/sustech-course-advisor/) 文件夹，而不是只复制 `SKILL.md`；
2. 新建对话，然后直接说：

> 使用 `$sustech-course-advisor`，按照我的学年和专业推荐 2026 秋季课程。

接下来 Agent 会自行说明流程并检查环境。缺少 Node.js、`sustech` 或 `sustech-advisor` 时，它会先说明安装来源、版本、位置和影响，在你确认后自动完成可执行的配置；需要登录时，它会引导你在安全的本地交互界面完成，不会在聊天中索要密码。环境就绪后，它才会征求个人信息读取许可、请你确认学籍摘要，再给出三套可比较的方案。

Advisor 的正式发布物位于本仓库的 [GitHub Releases](https://github.com/Stevvven777/sustech-course-advisor/releases)，不发布到 npm。Skill 会固定到明确版本，下载发布归档及其 SHA-256 文件，校验后再安装到用户目录；npm 只用于解析运行时依赖和安装上游目前正式发布的 `sustech-cli`，不会执行全局安装。

项目以 macOS、Windows 和 Linux 三端兼容为约束。核心逻辑使用跨平台 Node.js；文档在 shell 语法不同时分别给出 Windows PowerShell 与 macOS/Linux POSIX shell 写法。

> [!NOTE]
> 该 Skill 遵循开放的 Agent Skills 目录规范，可在**支持该规范**且能够读取本地文件、执行本地命令的 Agent 中复用。不同客户端的导入入口可能不同；通用的项目级目录是 `.agents/skills/sustech-course-advisor/`。Agent 可以帮助配置环境，但不会绕过联网下载、系统级安装、登录或个人信息读取所需的确认。

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

当前版本为 **0.2.5 early preview**。核心求解、环境检查、HTML/XLSX/ICS 输出和只读选课预览已经具备测试覆盖，但真实学期中的培养方案差异、课程供给和上游服务变化仍需要更多验证。

欢迎通过 Issues 报告可复现的问题、培养方案边界或输出改进建议。如果这个项目对你有帮助，也欢迎点一个 Star。

## 开发

以下内容面向希望从源码运行或参与开发的人。需要 Node.js 20.18.0 或更新版本。

```bash
npm install
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
npm run check
npm test
```

## 许可

本项目采用 [PolyForm Noncommercial License 1.0.0](./LICENSE)。允许非商业用途；商业使用需要另行获得许可。

---

# English

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

## Quick start

Regular users do not need to learn the CLI commands below. The bundled Agent Skill is the primary way to use this project:

1. Import the entire [`skills/sustech-course-advisor`](./skills/sustech-course-advisor/) folder into an Agent that supports [Agent Skills](https://agentskills.io/); do not copy only `SKILL.md`.
2. Start a new conversation and simply say:

> Use `$sustech-course-advisor` to recommend courses for Fall 2026 based on my year and major.

The Agent will explain the flow and inspect the environment. If Node.js, `sustech`, or `sustech-advisor` is missing, it will first show the install source, version, destination, and impact, then complete the supported setup after you approve it. When login is needed, it will guide you through a secure local prompt and never ask for your password in chat. Only after the environment is ready will it request permission for personal academic reads, ask you to confirm the redacted snapshot, and present three comparable plans.

The advisor's official artifacts are published in this repository's [GitHub Releases](https://github.com/Stevvven777/sustech-course-advisor/releases), not to npm. The Skill pins an exact release, downloads the archive and its SHA-256 file, verifies it, and installs it under the user's own directory. npm is used only to resolve runtime dependencies and install the upstream `sustech-cli` from its current official distribution channel; the bootstrap never performs a global install.

The project treats macOS, Windows, and Linux support as a product constraint. Core behavior uses cross-platform Node.js, and the documentation gives separate Windows PowerShell and macOS/Linux POSIX shell commands when syntax differs.

> [!NOTE]
> The Skill follows the open Agent Skills directory format and can be reused by any **skills-compatible** Agent that can read local files and execute local commands. Import mechanisms vary by client; `.agents/skills/sustech-course-advisor/` is the common project-level location. The Agent can help configure the environment, but it cannot bypass confirmations required for downloads, system-wide installs, login, or personal-data access.

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

The current release is **0.2.5 early preview**. Core solving, environment checks, HTML/XLSX/ICS exports, and read-only enrollment previews have automated coverage, but real-semester curriculum differences, course supply, and upstream changes still need broader validation.

Reproducible bug reports, curriculum edge cases, and output ideas are welcome through Issues. If the project helps you, consider giving it a Star.

## Development

This section is for contributors and people running directly from source. Node.js 20.18.0 or newer is required.

```bash
npm install
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
npm run check
npm test
```

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](./LICENSE). Noncommercial use is permitted; commercial use requires separate permission.
