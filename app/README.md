# Stop Masturbating Dashboard

一个基于 `React 18 + Vite + Supabase + Vercel` 的三人统计站。

## 技术选择

- 前端：React 18
- 部署：Vercel
- 后端与鉴权：Supabase

这个版本只使用 `Supabase` 做鉴权和数据存储，不再发送邮件。

## 本地启动

1. 安装依赖

```bash
npm install
```

2. 复制环境变量模板到 `.env`

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. 在 Supabase SQL Editor 里执行 [supabase/schema.sql](./supabase/schema.sql)

4. 到 Supabase Auth 里预先创建这 3 个账号，并配置站点地址

5. 启动开发环境

```bash
npm run dev
```

## Vercel 部署

1. 把这个 `app` 目录推到 Git 仓库，或者直接导入到 Vercel
2. Framework 选择 `Vite`
3. 在 Vercel 项目环境变量里填入：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

4. 重新部署

## 数据模型

`profiles`

- `id`: 对应 `auth.users.id`
- `email`
- `display_name`
- `created_at`

`habit_events`

- `id`
- `user_id`
- `created_at`

每点击一次 `+1`，就往 `habit_events` 插入一条记录。排行榜和个人统计全部基于事件表计算。

## 当前功能

- 成员昵称 + 密码登录
- 每人只能插入自己的记录
- 今日 / 本周 / 本月 / 本季度 / 年度排行榜
- 最近动态流

## 当前固定成员

- `小刚`
- `cmd`
- `校长`

前端目前已经限制为固定成员站点，登录时只显示成员昵称，不展示邮箱；注册入口也已移除。

## 可以继续增强的点

- 增加管理员审核
- 增加撤销最近一次记录
