export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ message: 'Method not allowed.' })
  }

  const {
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    EMAILJS_PUBLIC_KEY,
    EMAILJS_PRIVATE_KEY,
  } = process.env

  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_PRIVATE_KEY) {
    return response.status(500).json({ message: 'EmailJS environment variables are incomplete.' })
  }

  const { actorName, actorEmail, totalToday, totalWeek, recordedAt, recipients } = request.body ?? {}

  if (!actorName || !actorEmail || !Array.isArray(recipients) || recipients.length === 0) {
    return response.status(400).json({ message: 'Invalid notification payload.' })
  }

  try {
    await Promise.all(
      recipients.map(async (recipient) => {
        const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            service_id: EMAILJS_SERVICE_ID,
            template_id: EMAILJS_TEMPLATE_ID,
            user_id: EMAILJS_PUBLIC_KEY,
            accessToken: EMAILJS_PRIVATE_KEY,
            template_params: {
              to_name: recipient.name,
              to_email: recipient.email,
              actor_name: actorName,
              actor_email: actorEmail,
              total_today: totalToday,
              total_week: totalWeek,
              recorded_at: recordedAt,
            },
          }),
        })

        if (!emailResponse.ok) {
          const message = await emailResponse.text()
          throw new Error(message || 'EmailJS rejected the request.')
        }
      }),
    )

    return response.status(200).json({ ok: true })
  } catch (error) {
    return response.status(500).json({ message: error.message || 'Notification failed.' })
  }
}
