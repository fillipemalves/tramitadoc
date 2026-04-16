const router = require('express').Router()
const prisma = require('../prisma')
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const puppeteer = require('puppeteer-core')
const QRCode    = require('qrcode')
const fs        = require('fs')
const path      = require('path')

const include = {
  sender:     { include: { department: true, secretary: true } },
  recipients: { include: { department: true, secretary: true } },
  signature:  true,
  events:     { orderBy: { createdAt: 'asc' } },
}

async function gerarProtocolo(acronym) {
  const ano = new Date().getFullYear()
  const count = await prisma.memo.count({
    where: { protocol: { contains: `/${ano}` } },
  })
  const num = String(count + 1).padStart(3, '0')
  return `Memorando ${num}/${ano} - ${acronym}`
}

async function addEvent(memoId, { icon, label, user, dept, color }) {
  await prisma.memoEvent.create({
    data: {
      memoId,
      icon,
      label,
      user:  user  || 'Sistema',
      dept:  dept  || '—',
      color: color || 'bg-slate-700 text-slate-400',
    },
  })
}

function senderDept(user) {
  return user?.department?.acronym || user?.secretary?.acronym || '—'
}

// GET /memos
router.get('/', async (req, res) => {
  try {
    const { status, search, limit, departmentId: filterDeptId } = req.query
    const { id: userId, role, departmentId, secretaryId } = req.user

    let accessFilter = null

    if (role !== 'SUPER_ADMIN') {
      if (role === 'ADM') {
        const branches = [{ senderId: userId }]
        if (departmentId) {
          // ADM com departamento: vê o que enviou + o que chegou ao seu departamento
          branches.push({ recipients: { some: { departmentId } }, status: { not: 'DRAFT' } })
        } else if (secretaryId) {
          // ADM sem departamento (chefe de secretaria): vê TUDO da secretaria
          // — enviados por qualquer usuário da secretaria/departamentos dela
          branches.push({
            sender: { OR: [
              { secretaryId },
              { department: { secretaryId } },
            ]},
            status: { not: 'DRAFT' },
          })
          // — recebidos pela secretaria ou por qualquer departamento dela
          branches.push({
            recipients: { some: { OR: [
              { secretaryId },
              { department: { secretaryId } },
            ]}},
            status: { not: 'DRAFT' },
          })
        }
        accessFilter = { OR: branches }
      } else {
        // USER: vê apenas memos onde é destinatário (departamento ou secretaria direta)
        if (departmentId) {
          accessFilter = { recipients: { some: { departmentId } }, status: { not: 'DRAFT' } }
        } else if (secretaryId) {
          accessFilter = { recipients: { some: { secretaryId } }, status: { not: 'DRAFT' } }
        } else {
          accessFilter = { id: '__none__' }
        }
      }
    }

    const conditions = []
    if (accessFilter)  conditions.push(accessFilter)
    if (status)        conditions.push({ status })
    if (filterDeptId)  conditions.push({ recipients: { some: { departmentId: filterDeptId } } })
    if (search)        conditions.push({ OR: [
      { subject:  { contains: search, mode: 'insensitive' } },
      { protocol: { contains: search, mode: 'insensitive' } },
    ]})

    const where = conditions.length > 0 ? { AND: conditions } : {}

    const memos = await prisma.memo.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      take:    limit ? parseInt(limit) : undefined,
    })
    return res.json({ items: memos, total: memos.length })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// GET /memos/:id
router.get('/:id', async (req, res) => {
  try {
    const memo = await prisma.memo.findUnique({
      where: { id: req.params.id },
      include,
    })
    if (!memo) return res.status(404).json({ error: 'Memorando não encontrado.' })
    return res.json(memo)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// POST /memos
router.post('/', async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADM')
    return res.status(403).json({ error: 'Apenas administradores podem criar memorandos.' })
  try {
    const { subject, body, priority, recipientDepartmentIds = [], recipientSecretaryIds = [] } = req.body
    const recipientRows = [
      ...recipientDepartmentIds.map(id => ({ departmentId: id })),
      ...recipientSecretaryIds.map(id => ({ secretaryId: id })),
    ]
    const memo = await prisma.memo.create({
      data: {
        subject,
        body:      body || '',
        priority:  priority || 'NORMAL',
        status:    'DRAFT',
        senderId:  req.user.id,
        recipients: { create: recipientRows },
        events: {
          create: [{
            icon:  '📝',
            label: 'Rascunho criado',
            user:  req.user.name,
            dept:  senderDept(req.user),
            color: 'bg-slate-700 text-slate-400',
          }],
        },
      },
      include,
    })
    return res.status(201).json(memo)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// PUT /memos/:id
router.put('/:id', async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADM')
    return res.status(403).json({ error: 'Apenas administradores podem editar memorandos.' })
  try {
    const { subject, body, priority, recipientDepartmentIds = [], recipientSecretaryIds = [] } = req.body
    const recipientRows = [
      ...recipientDepartmentIds.map(id => ({ departmentId: id })),
      ...recipientSecretaryIds.map(id => ({ secretaryId: id })),
    ]
    await prisma.memoRecipient.deleteMany({ where: { memoId: req.params.id } })
    const memo = await prisma.memo.update({
      where: { id: req.params.id },
      data: {
        subject,
        body,
        priority,
        recipients: { create: recipientRows },
      },
      include,
    })
    return res.json(memo)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// POST /memos/:id/sign
router.post('/:id/sign', async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADM')
    return res.status(403).json({ error: 'Apenas administradores podem assinar memorandos.' })
  try {
    const { password } = req.body
    if (!password) return res.status(400).json({ error: 'Senha obrigatória.' })

    const dbUser = await prisma.user.findUnique({ where: { id: req.user.id } })
    const ok = await bcrypt.compare(password, dbUser.password)
    if (!ok) return res.status(400).json({ error: 'Senha incorreta.' })

    const code = `TDC-${uuidv4().replace(/-/g, '').slice(0, 20)}`

    await prisma.signature.upsert({
      where:  { memoId: req.params.id },
      update: { verificationCode: code, signedAt: new Date() },
      create: { memoId: req.params.id, verificationCode: code },
    })

    await addEvent(req.params.id, {
      icon:  '✍️',
      label: 'Assinado digitalmente',
      user:  req.user.name,
      dept:  senderDept(req.user),
      color: 'bg-blue-900 text-blue-300',
    })

    const memo = await prisma.memo.findUnique({ where: { id: req.params.id }, include })
    return res.json(memo)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// POST /memos/:id/send
router.post('/:id/send', async (req, res) => {
  try {
    const memo = await prisma.memo.findUnique({
      where:   { id: req.params.id },
      include: { sender: { include: { department: true, secretary: true } }, recipients: { include: { department: true, secretary: true } }, signature: true },
    })
    if (!memo) return res.status(404).json({ error: 'Memorando não encontrado.' })
    if (!memo.signature) return res.status(400).json({ error: 'Assine o memorando antes de enviar.' })

    const senderAcronym = memo.sender?.department?.acronym || memo.sender?.secretary?.acronym || 'TDC'
    const protocol = memo.protocol || await gerarProtocolo(senderAcronym)
    const destinos  = memo.recipients.map(r => r.department?.acronym || r.secretary?.acronym || '?').join(', ')

    await prisma.memo.update({
      where: { id: req.params.id },
      data:  { status: 'SENT', protocol },
    })

    await prisma.memoRecipient.updateMany({
      where: { memoId: req.params.id },
      data:  { status: 'SENT' },
    })

    await addEvent(req.params.id, {
      icon:  '📤',
      label: `Enviado para ${destinos}`,
      user:  req.user.name,
      dept:  senderDept(req.user),
      color: 'bg-blue-900 text-blue-300',
    })

    const updated = await prisma.memo.findUnique({ where: { id: req.params.id }, include })
    return res.json(updated)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// POST /memos/:id/receive
router.post('/:id/receive', async (req, res) => {
  try {
    const { recipientId } = req.body
    if (!recipientId) return res.status(400).json({ error: 'recipientId obrigatório.' })

    const current = await prisma.memo.findUnique({
      where: { id: req.params.id },
      include: { recipients: true },
    })
    if (!current) return res.status(404).json({ error: 'Memorando não encontrado.' })
    if (current.status !== 'SENT' && current.status !== 'RECEIVED')
      return res.status(400).json({ error: 'Memorando não está em estado recebível.' })

    const recip = current.recipients.find(r => r.id === recipientId)
    if (!recip) return res.status(404).json({ error: 'Destinatário não encontrado.' })
    if (recip.status === 'RECEIVED') {
      // Já marcado — retorna sem erro (idempotente)
      const memo = await prisma.memo.findUnique({ where: { id: req.params.id }, include })
      return res.json(memo)
    }

    await prisma.memoRecipient.update({ where: { id: recipientId }, data: { status: 'RECEIVED' } })

    // Atualiza o memo para RECEIVED apenas se ainda estiver como SENT
    if (current.status === 'SENT') {
      await prisma.memo.update({ where: { id: req.params.id }, data: { status: 'RECEIVED' } })
    }

    await addEvent(req.params.id, {
      icon:  '📬',
      label: 'Recebimento confirmado',
      user:  req.user.name,
      dept:  senderDept(req.user),
      color: 'bg-emerald-900 text-emerald-300',
    })
    const memo = await prisma.memo.findUnique({ where: { id: req.params.id }, include })
    return res.json(memo)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// POST /memos/:id/complete
router.post('/:id/complete', async (req, res) => {
  try {
    const { recipientId } = req.body
    if (!recipientId) return res.status(400).json({ error: 'recipientId obrigatório.' })
    const current = await prisma.memo.findUnique({ where: { id: req.params.id } })
    if (!current) return res.status(404).json({ error: 'Memorando não encontrado.' })
    if (current.status !== 'RECEIVED')
      return res.status(400).json({ error: 'Apenas memorandos recebidos podem ser concluídos.' })
    await prisma.memoRecipient.update({ where: { id: recipientId }, data: { status: 'COMPLETED' } })
    await prisma.memo.update({ where: { id: req.params.id }, data: { status: 'COMPLETED' } })
    await addEvent(req.params.id, {
      icon:  '✅',
      label: 'Memorando concluído',
      user:  req.user.name,
      dept:  senderDept(req.user),
      color: 'bg-violet-900 text-violet-300',
    })
    const memo = await prisma.memo.findUnique({ where: { id: req.params.id }, include })
    return res.json(memo)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// POST /memos/:id/return
router.post('/:id/return', async (req, res) => {
  try {
    const { recipientId, notes } = req.body
    if (!recipientId) return res.status(400).json({ error: 'recipientId obrigatório.' })
    const current = await prisma.memo.findUnique({ where: { id: req.params.id } })
    if (!current) return res.status(404).json({ error: 'Memorando não encontrado.' })
    if (current.status !== 'RECEIVED')
      return res.status(400).json({ error: 'Apenas memorandos recebidos podem ser devolvidos.' })
    await prisma.memoRecipient.update({ where: { id: recipientId }, data: { status: 'RETURNED' } })
    await prisma.memo.update({ where: { id: req.params.id }, data: { status: 'RETURNED' } })
    await addEvent(req.params.id, {
      icon:  '↩️',
      label: `Devolvido${notes ? `: ${notes}` : ''}`,
      user:  req.user.name,
      dept:  senderDept(req.user),
      color: 'bg-red-900 text-red-300',
    })
    const memo = await prisma.memo.findUnique({ where: { id: req.params.id }, include })
    return res.json(memo)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// DELETE /memos/:id
router.delete('/:id', async (req, res) => {
  // SUPER_ADMIN pode excluir qualquer memorando; ADM só pode excluir rascunhos próprios
  const isSuperAdmin = req.user.role === 'SUPER_ADMIN'
  const isAdm        = req.user.role === 'ADM'
  if (!isSuperAdmin && !isAdm)
    return res.status(403).json({ error: 'Acesso negado.' })
  try {
    const memo = await prisma.memo.findUnique({ where: { id: req.params.id } })
    if (!memo) return res.status(404).json({ error: 'Memorando não encontrado.' })
    if (!isSuperAdmin && memo.status !== 'DRAFT')
      return res.status(400).json({ error: 'Apenas rascunhos podem ser excluídos.' })

    await prisma.memoEvent.deleteMany({ where: { memoId: req.params.id } })
    await prisma.signature.deleteMany({ where: { memoId: req.params.id } })
    await prisma.memoRecipient.deleteMany({ where: { memoId: req.params.id } })
    await prisma.memo.delete({ where: { id: req.params.id } })

    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// GET /memos/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const memo = await prisma.memo.findUnique({ where: { id: req.params.id }, include })
    if (!memo) return res.status(404).json({ error: 'Memorando não encontrado.' })

    const proto  = req.headers['x-forwarded-proto'] || req.protocol
    const host   = req.headers['x-forwarded-host']  || req.headers.host
    const origin = `${proto}://${host}`
    const verifyUrl = memo.signature
      ? `${origin}/verificar/${memo.signature.verificationCode}`
      : null

    const qrDataUrl = verifyUrl
      ? await QRCode.toDataURL(verifyUrl, { width: 60, margin: 1 })
      : null

    let watermarkSrc = null
    const watermarkRelPath = memo.sender?.department?.watermarkUrl || memo.sender?.secretary?.watermarkUrl
    if (watermarkRelPath) {
      try {
        const filePath = path.join(__dirname, '../../uploads', path.basename(watermarkRelPath))
        const fileBuffer = fs.readFileSync(filePath)
        const ext = path.extname(watermarkRelPath).replace('.', '').toLowerCase()
        const mime = ext === 'png' ? 'image/png' : (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`
        watermarkSrc = `data:${mime};base64,${fileBuffer.toString('base64')}`
      } catch { /* sem watermark se arquivo não encontrado */ }
    }

    // Margens em px para a área do timbrado (cabeçalho/rodapé)
    const topPx = watermarkSrc ? 180 : 0
    const botPx = watermarkSrc ? 130 : 0

    const html = buildMemoHtml(memo, { qrDataUrl, verifyUrl, watermarkSrc, topPx, botPx })

    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      // '--headless=old' necessário no Chromium 112+ — o modo headless padrão
      // mudou e o novo modo falha em containers Docker sem display server.
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--headless=old', '--no-zygote'],
      headless: false,
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'domcontentloaded' })

    // Usar headerTemplate/footerTemplate do Puppeteer é a única forma confiável de
    // ter cabeçalho/rodapé em TODAS as páginas — position:fixed é clipado à área
    // de conteúdo e não cobre as margens do @page no Chromium.
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: !!watermarkSrc,
      headerTemplate: watermarkSrc
        ? `<img src="${watermarkSrc}" style="display:block;width:210mm;height:${topPx}px;object-fit:cover;object-position:top;margin:0;padding:0;" />`
        : '<span></span>',
      footerTemplate: watermarkSrc
        ? `<img src="${watermarkSrc}" style="display:block;width:210mm;height:${botPx}px;object-fit:cover;object-position:bottom;margin:0;padding:0;" />`
        : '<span></span>',
      margin: { top: `${topPx}px`, bottom: `${botPx}px`, left: '0', right: '0' },
    })
    await browser.close()

    const filename = (memo.protocol || 'memorando').replace(/[\\/]/g, '-')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`)
    res.send(pdf)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

function buildMemoHtml(memo, { qrDataUrl, verifyUrl, topPx = 0, botPx = 0 }) {
  const d = new Date(memo.createdAt)
  const dateStr = `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`

  const senderAcronym     = memo.sender?.department?.acronym || memo.sender?.secretary?.acronym || 'TDC'
  const registrationLabel = memo.sender?.registrationLabel || 'Matrícula'

  // Destinatários: primeiro usa "À:", demais usam "C/c:"
  const recipients = memo.recipients || []
  const recipientsHtml = recipients.map((r, idx) => {
    const name  = r.department?.name || r.secretary?.name || '—'
    const label = idx === 0 ? 'À:' : 'C/c:'
    return `<div class="field-row"><strong>${label}</strong> ${name}</div>`
  }).join('')

  let signedAtStr = '—'
  if (memo.signature?.signedAt) {
    const s = new Date(memo.signature.signedAt)
    signedAtStr = s.toLocaleDateString('pt-BR') + ' ' + s.toLocaleTimeString('pt-BR')
  }

  const sigBlock = memo.signature && qrDataUrl ? `
    <div class="sig-block">
      <div class="sig-inner">
        <div class="sig-body">
          <img src="${qrDataUrl}" width="60" height="60" style="flex-shrink:0" />
          <div>
            <div style="font-weight:700;font-size:12px;margin-bottom:2px">${memo.sender?.name || ''}</div>
            <div style="color:#374151;font-size:11px;margin-bottom:2px">Assinado em: ${signedAtStr}</div>
            <div style="color:#6b7280;font-size:10px;word-break:break-all">Verifique em ${verifyUrl}</div>
          </div>
        </div>
      </div>
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8">
<style>
  /*
   * @page margin deve coincidir com o margin passado ao page.pdf() do Puppeteer.
   * CSS @page tem precedência sobre o margin do page.pdf() no Chromium — se for 0
   * aqui, o Puppeteer não consegue reservar espaço para o headerTemplate/footerTemplate.
   */
  @page { size: A4; margin: ${topPx}px 0 ${botPx}px 0; }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: #111827;
    width: 210mm;
  }

  /*
   * Flex column min-height = área de conteúdo de uma página A4 após descontar
   * as margens do timbrado injetadas pelo Puppeteer (topPx + botPx).
   * Garante que o bloco do remetente fique no final da última página.
   */
  .page-flow {
    min-height: calc(297mm - ${topPx}px - ${botPx}px);
    display: flex;
    flex-direction: column;
  }

  /* Metadados: padding lateral igual ao do editor (80px) */
  .meta { padding: 0 80px; }

  /* Linha 1: protocolo (esquerda) + data (direita) */
  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 10px;
  }

  .field-row   { margin-bottom: 6px; line-height: 1.8; }
  .subject-row { margin-bottom: 10px; padding-bottom: 14px; border-bottom: 1px solid #d1d5db; }

  /* flex:1 faz o corpo crescer e empurrar o remetente para baixo */
  .body {
    flex: 1;
    padding: 16px 80px 24px;
    font-size: 14px;
    line-height: 1.9;
    color: #111827;
  }
  .body p  { margin-bottom: 0.5em; }
  .body ul { list-style: disc;     padding-left: 1.5rem; margin-bottom: 0.5em; }
  .body ol { list-style: decimal;  padding-left: 1.5rem; margin-bottom: 0.5em; }

  /* Bloco de assinatura digital */
  .sig-block { padding: 0 80px 16px; page-break-inside: avoid; text-align: center; }
  .sig-inner { display: inline-block; border: 1px solid #d1d5db; border-radius: 4px; overflow: hidden; }
  .sig-body  { background: #f9fafb; padding: 8px 10px; display: flex; align-items: center; gap: 12px; }

  /*
   * Bloco do remetente: posicionado no final do page-flow (flex-end via body flex:1).
   * O espaço do rodapé é controlado pelo .footer-space fora do page-flow — sem
   * necessidade de padding-bottom excessivo aqui.
   */
  .sender-block {
    padding: 24px 80px;
    text-align: center;
    page-break-inside: avoid;
  }
</style>
</head>
<body>
  <div class="content">
    <div class="page-flow">
      <div class="meta">
        <div class="header-row">
          <strong>${memo.protocol || `Memorando [gerado no envio]/${d.getFullYear()} - ${senderAcronym}`}</strong>
          <span>Redenção/PA, ${dateStr}.</span>
        </div>
        ${recipientsHtml}
        <div class="subject-row"><strong>Assunto:</strong> ${memo.subject || ''}</div>
      </div>
      <div class="body">${memo.body || ''}</div>
      ${sigBlock}
      <div class="sender-block">
        <div style="font-size:14px;font-weight:700">${memo.sender?.name || ''}</div>
        <div style="font-size:13px;color:#374151;margin-top:2px">${memo.sender?.position || ''}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px">${registrationLabel}: ${memo.sender?.registration || '—'}</div>
      </div>
    </div>
  </div>
</body></html>`
}

module.exports = router