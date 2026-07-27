# Stop Masturbating Dashboard

一个基于 `React 18 + Vite + Supabase + Vercel` 的三人互相监督统计站。

## 技术选择

- 前端：React 18
- 部署：Vercel
- 后端与鉴权：Supabase
- 邮件通知：EmailJS

你提到的包名大概率是 `@emailjs/browser`。这个项目里我没有把它直接放到前端，而是改成了 `Vercel Serverless Function + EmailJS REST API`，这样 `EmailJS Private Key` 不会暴露给浏览器。

EmailJS 官方 `/send` REST API 当前需要：

- `service_id`
- `template_id`
- `user_id`：Public Key
- `accessToken`：Private Key

参考文档：

- https://www.emailjs.com/docs/rest-api/send/

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

4. 到 Supabase Auth 里开启邮箱注册，并配置站点地址

5. 在 EmailJS 后台创建：

- 一个 email service
- 一个 template
- 一个 Public Key
- 一个 Private Key

模板里至少用到这些变量：

- `to_name`
- `to_email`
- `actor_name`
- `actor_email`
- `total_today`
- `total_week`
- `recorded_at`

6. 启动开发环境

```bash
npm run dev
```

## Vercel 部署

1. 把这个 `app` 目录推到 Git 仓库，或者直接导入到 Vercel
2. Framework 选择 `Vite`
3. 在 Vercel 项目环境变量里填入：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `EMAILJS_SERVICE_ID`
- `EMAILJS_TEMPLATE_ID`
- `EMAILJS_PUBLIC_KEY`
- `EMAILJS_PRIVATE_KEY`

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

- 邮箱密码注册 / 登录
- 每人只能插入自己的记录
- 今日 / 本周 / 本月 / 本季度 / 年度排行榜
- 最近动态流
- 记录后自动通知另外两位成员

## 当前固定成员

- `小刚`: `yichunhua137@gmail.com`
- `cmd`: `brriliantcmd@gmail.com`
- `校长`: 邮箱待定

前端目前已经限制为固定成员站点，非名单内邮箱不能注册或登录。

## 可以继续增强的点

- 增加管理员审核
- 增加撤销最近一次记录
- 用 Supabase Edge Function 或数据库 Trigger 做更稳的邮件通知
