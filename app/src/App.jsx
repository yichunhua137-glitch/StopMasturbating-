import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { supabase } from './lib/supabase'

const PERIODS = [
  { key: 'day', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'quarter', label: '本季度' },
  { key: 'year', label: '今年' },
]

const ROSTER = [
  { key: 'principal', displayName: '校长', email: 'jiangyosuf@gmail.com', status: 'active' },
  { key: 'cmd', displayName: 'cmd', email: 'brriliantcmd@gmail.com', status: 'active' },
  { key: 'xiaogang', displayName: '小刚', email: 'yichunhua137@gmail.com', status: 'active' },
]

const INITIAL_AUTH = {
  email: '',
  password: '',
}

const allowedEmailMap = ROSTER.reduce((accumulator, member) => {
  if (member.email) {
    accumulator[member.email.toLowerCase()] = member
  }
  return accumulator
}, {})

function getRosterMemberByEmail(email) {
  return allowedEmailMap[email?.toLowerCase?.() ?? ''] ?? null
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeek(date) {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const next = new Date(date)
  next.setDate(date.getDate() + diff)
  next.setHours(0, 0, 0, 0)
  return next
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function startOfQuarter(date) {
  const quarterMonth = Math.floor(date.getMonth() / 3) * 3
  return new Date(date.getFullYear(), quarterMonth, 1)
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1)
}

function isWithinPeriod(date, period, now) {
  const entryTime = date.getTime()

  switch (period) {
    case 'day':
      return entryTime >= startOfDay(now).getTime()
    case 'week':
      return entryTime >= startOfWeek(now).getTime()
    case 'month':
      return entryTime >= startOfMonth(now).getTime()
    case 'quarter':
      return entryTime >= startOfQuarter(now).getTime()
    case 'year':
      return entryTime >= startOfYear(now).getTime()
    default:
      return true
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function buildFixedProfiles(profiles) {
  return ROSTER.map((member) => {
    const matchedProfile = profiles.find(
      (profile) => profile.email?.toLowerCase() === member.email.toLowerCase(),
    )

    return {
      id: matchedProfile?.id ?? member.key,
      email: member.email,
      display_name: member.displayName,
      created_at: matchedProfile?.created_at ?? null,
      status: member.status,
      isRegistered: Boolean(matchedProfile),
      isRosterPlaceholder: !matchedProfile,
    }
  })
}

function App() {
  const [session, setSession] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [events, setEvents] = useState([])
  const [period, setPeriod] = useState('week')
  const [authForm, setAuthForm] = useState(INITIAL_AUTH)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [booting, setBooting] = useState(true)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession()

        if (!active) {
          return
        }

        setSession(currentSession)

        if (currentSession?.user) {
          await ensureProfile(currentSession.user)
          await loadDashboard()
        }
      } catch (bootstrapError) {
        if (active) {
          setError(bootstrapError.message || '初始化失败，请检查 Supabase 配置。')
        }
      } finally {
        if (active) {
          setBooting(false)
        }
      }
    }

    bootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      try {
        setSession(nextSession)

        if (nextSession?.user) {
          await ensureProfile(nextSession.user)
          await loadDashboard()
        } else {
          setProfiles([])
          setEvents([])
        }
      } catch (authError) {
        setError(authError.message || '同步账户数据失败。')
      } finally {
        setBooting(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function ensureProfile(user) {
    const rosterMember = getRosterMemberByEmail(user.email)

    if (!rosterMember) {
      throw new Error('这个站点只允许固定的三个人使用。')
    }

    const { error: upsertError } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        email: user.email,
        display_name: rosterMember.displayName,
      },
      { onConflict: 'id' },
    )

    if (upsertError) {
      throw upsertError
    }
  }

  async function loadDashboard() {
    const [{ data: profileRows, error: profileError }, { data: eventRows, error: eventError }] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, display_name, created_at')
          .order('display_name', { ascending: true }),
        supabase
          .from('habit_events')
          .select('id, user_id, created_at')
          .order('created_at', { ascending: false })
          .limit(5000),
      ])

    if (profileError) {
      throw profileError
    }

    if (eventError) {
      throw eventError
    }

    setProfiles(buildFixedProfiles(profileRows ?? []))
    setEvents(eventRows ?? [])
  }

  const profileMap = useMemo(() => {
    return profiles.reduce((accumulator, profile) => {
      accumulator[profile.id] = profile
      return accumulator
    }, {})
  }, [profiles])

  const currentMember = getRosterMemberByEmail(session?.user?.email)
  const currentUser = session?.user ? profileMap[session.user.id] : null

  const leaderboard = useMemo(() => {
    const now = new Date()
    const counts = profiles.map((profile) => ({
      userId: profile.id,
      displayName: profile.display_name,
      email: profile.email,
      total: 0,
      status: profile.status,
      isRegistered: profile.isRegistered,
    }))

    const countMap = counts.reduce((accumulator, item) => {
      accumulator[item.userId] = item
      return accumulator
    }, {})

    for (const event of events) {
      const eventDate = new Date(event.created_at)

      if (!isWithinPeriod(eventDate, period, now)) {
        continue
      }

      if (countMap[event.user_id]) {
        countMap[event.user_id].total += 1
      }
    }

    return counts.sort((left, right) => {
      if (right.total !== left.total) {
        return right.total - left.total
      }

      return left.displayName.localeCompare(right.displayName, 'zh-CN')
    })
  }, [events, period, profiles])

  const summary = useMemo(() => {
    const now = new Date()
    const mine = events.filter((event) => event.user_id === session?.user?.id)

    return {
      total: mine.length,
      today: mine.filter((event) => isWithinPeriod(new Date(event.created_at), 'day', now)).length,
      week: mine.filter((event) => isWithinPeriod(new Date(event.created_at), 'week', now)).length,
      month: mine.filter((event) => isWithinPeriod(new Date(event.created_at), 'month', now)).length,
      latest: mine[0] ?? null,
    }
  }, [events, session?.user?.id])

  const recentFeed = useMemo(() => {
    return events.slice(0, 12).map((event) => ({
      ...event,
      profile: profileMap[event.user_id],
    }))
  }, [events, profileMap])

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setWorking(true)
    setError('')
    setNotice('')

    const normalizedEmail = authForm.email.trim().toLowerCase()
    const rosterMember = getRosterMemberByEmail(normalizedEmail)

    if (!rosterMember) {
      setWorking(false)
      setError('只允许固定三人使用。目前开放的邮箱只有 cmd 和小刚。')
      return
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: authForm.password,
      })

      if (signInError) {
        throw signInError
      }

      setNotice(`欢迎回来，${rosterMember.displayName}。`)

      setAuthForm(INITIAL_AUTH)
    } catch (submitError) {
      setError(submitError.message || '认证失败，请稍后重试。')
    } finally {
      setWorking(false)
    }
  }

  async function handleAddEvent() {
    if (!session?.user || !currentMember) {
      return
    }

    setWorking(true)
    setError('')
    setNotice('')

    try {
      const { error: insertError } = await supabase.from('habit_events').insert({
        user_id: session.user.id,
      })

      if (insertError) {
        throw insertError
      }

      await loadDashboard()

      const recipients = ROSTER.filter(
        (member) => member.email && member.email.toLowerCase() !== session.user.email.toLowerCase(),
      ).map((member) => ({
        email: member.email,
        name: member.displayName,
      }))

      const payload = {
        actorName: currentMember.displayName,
        actorEmail: session.user.email,
        totalToday: summary.today + 1,
        totalWeek: summary.week + 1,
        recordedAt: new Date().toISOString(),
        recipients,
      }

      const response = await fetch('/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setNotice(`本次火力已入榜，但邮件发送失败：${body.message || '请检查 Resend 配置。'}`)
        return
      }

      setNotice('本次火力已记入榜单，另外两位也会收到战报。')
    } catch (actionError) {
      setError(actionError.message || '保存失败，请稍后重试。')
    } finally {
      setWorking(false)
    }
  }

  async function handleSignOut() {
    setWorking(true)
    setError('')
    setNotice('')

    try {
      const { error: signOutError } = await supabase.auth.signOut()

      if (signOutError) {
        throw signOutError
      }
    } catch (signOutFailure) {
      setError(signOutFailure.message || '退出失败，请稍后再试。')
    } finally {
      setWorking(false)
    }
  }

  if (booting) {
    return (
      <main className="shell loading-shell">
        <div className="panel hero-panel">
          <p className="eyebrow">Unlimited Firepower</p>
          <h1>无限火力，谁与争锋</h1>
          <p className="hero-copy">正在连接 Supabase，准备加载战场面板。</p>
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="shell auth-shell">
        <section className="panel hero-panel">
          <p className="eyebrow">Unlimited Firepower</p>
          <h1>无限火力，谁与争锋</h1>
          <div className="hero-points">
            {ROSTER.map((member) => (
              <span key={member.key}>
                {member.displayName} · {member.email}
              </span>
            ))}
          </div>
          <div className="fire-banner">
            <strong>战区规则</strong>
            <p>只允许固定成员登录。</p>
          </div>
        </section>

        <section className="panel auth-panel">
          <div className="auth-switch">
            <button type="button" className="active">
              登录
            </button>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <label>
              邮箱
              <input
                type="email"
                value={authForm.email}
                onChange={(event) =>
                  setAuthForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="请输入固定成员邮箱"
                required
              />
            </label>

            <label>
              密码
              <input
                type="password"
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="至少 6 位"
                minLength={6}
                required
              />
            </label>

            <button type="submit" className="primary-button" disabled={working}>
              {working ? '处理中…' : '进入战场'}
            </button>
          </form>

          {notice ? <p className="message success">{notice}</p> : null}
          {error ? <p className="message error">{error}</p> : null}
        </section>
      </main>
    )
  }

  return (
    <main className="shell dashboard-shell">
      <section className="panel hero-panel">
        <div className="hero-header">
          <div>
            <p className="eyebrow">Unlimited Firepower Board</p>
            <h1>{currentUser?.display_name || currentMember?.displayName || session.user.email}</h1>
            <p className="hero-copy">
              当前总战绩 {summary.total} 次，今日 {summary.today} 次，本周 {summary.week} 次，本月 {summary.month} 次。
            </p>
          </div>
          <button type="button" className="secondary-button" onClick={handleSignOut} disabled={working}>
            退出
          </button>
        </div>

        <div className="metric-grid">
          <article className="metric-card accent-card">
            <span>今日火力</span>
            <strong>{summary.today}</strong>
          </article>
          <article className="metric-card">
            <span>本周战报</span>
            <strong>{summary.week}</strong>
          </article>
          <article className="metric-card">
            <span>本月累计</span>
            <strong>{summary.month}</strong>
          </article>
          <article className="metric-card">
            <span>总榜次数</span>
            <strong>{summary.total}</strong>
          </article>
        </div>

        <div className="cta-row">
          <button type="button" className="primary-button big-button" onClick={handleAddEvent} disabled={working}>
            {working ? '战报提交中…' : '点火 +1'}
          </button>
          <p className="helper-text">每次点火都会进入个人记录，并向另外两位发送邮件战报。</p>
        </div>

        {notice ? <p className="message success">{notice}</p> : null}
        {error ? <p className="message error">{error}</p> : null}
      </section>

      <section className="panel leaderboard-panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">排行榜</p>
            <h2>无限火力总榜</h2>
          </div>
          <div className="period-tabs">
            {PERIODS.map((item) => (
              <button
                type="button"
                key={item.key}
                className={period === item.key ? 'active' : ''}
                onClick={() => setPeriod(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ranking-list">
          {leaderboard.map((entry, index) => (
            <article className="ranking-row" key={entry.userId}>
              <div className="rank-badge">{index + 1}</div>
              <div>
                <h3>{entry.displayName}</h3>
                <p>{entry.email || '邮箱待定'}</p>
              </div>
              <div className="rank-meta">
                <strong>{entry.total} 次</strong>
                <span>{entry.isRegistered ? '已入场' : '待加入'}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel feed-panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">最新战报</p>
            <h2>最近 12 次记录</h2>
          </div>
          <p className="helper-text">
            {summary.latest ? `你最近一次记录于 ${formatDate(summary.latest.created_at)}` : '你还没有记录。'}
          </p>
        </div>

        <div className="feed-list">
          {recentFeed.length ? (
            recentFeed.map((item) => (
              <article className="feed-row" key={item.id}>
                <div>
                  <h3>{item.profile?.display_name || '未知成员'}</h3>
                  <p>{item.profile?.email || '邮箱待定'}</p>
                </div>
                <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
              </article>
            ))
          ) : (
            <p className="empty-text">还没有任何战报。</p>
          )}
        </div>
      </section>
    </main>
  )
}

export default App
