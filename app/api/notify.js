import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function buildEmailHtml({ recipientName, actorName, actorEmail, totalToday, totalWeek, recordedAt }) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f1f1f;">
      <h2 style="margin-bottom: 12px;">无限火力战报</h2>
      <p>${recipientName}，你好。</p>
      <p><strong>${actorName}</strong> 刚刚新增了一次记录。</p>
      <ul>
        <li>成员邮箱：${actorEmail}</li>
        <li>今日次数：${totalToday}</li>
        <li>本周次数：${totalWeek}</li>
        <li>记录时间：${recordedAt}</li>
      </ul>
      <p>打开面板查看最新排行。</p>
    </div>
  `
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ message: 'Method not allowed.' })
  }

  const { RESEND_API_KEY, RESEND_FROM_EMAIL } = process.env

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return response.status(500).json({ message: 'Resend environment variables are incomplete.' })
  }

  const { actorName, actorEmail, totalToday, totalWeek, recordedAt, recipients } = request.body ?? {}

  if (!actorName || !actorEmail || !Array.isArray(recipients) || recipients.length === 0) {
    return response.status(400).json({ message: 'Invalid notification payload.' })
  }

  try {
    await Promise.all(
      recipients.map(async (recipient) => {
        const { error } = await resend.emails.send({
          from: RESEND_FROM_EMAIL,
          to: recipient.email,
          subject: `战报提醒：${actorName} 新增了一次记录`,
          html: buildEmailHtml({
            recipientName: recipient.name,
            actorName,
            actorEmail,
            totalToday,
            totalWeek,
            recordedAt,
          }),
        })

        if (error) {
          throw new Error(error.message || 'Resend rejected the request.')
        }
      }),
    )

    return response.status(200).json({ ok: true })
  } catch (error) {
    return response.status(500).json({ message: error.message || 'Notification failed.' })
  }
}
