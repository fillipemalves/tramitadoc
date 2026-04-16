const router  = require('express').Router()
const prisma  = require('../prisma')
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')
const auth    = require('../middleware/auth')

const uploadDir = path.join(__dirname, '../../uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, `wm-${Date.now()}${path.extname(file.originalname)}`),
})
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })

const userSelect = {
  id: true, name: true, registration: true,
  position: true, role: true, isActive: true,
}

const secInclude = {
  departments: {
    orderBy: { acronym: 'asc' },
    include: {
      users: {
        where:   { role: { not: 'SUPER_ADMIN' } },
        orderBy: { name: 'asc' },
        select:  userSelect,
      },
    },
  },
  users: {
    where:   { role: { not: 'SUPER_ADMIN' } },
    orderBy: { name: 'asc' },
    select:  userSelect,
  },
}

// Resolve o secretaryId efetivo do usuário autenticado (suporta JWTs antigos sem o campo)
async function resolveSecretaryId(jwtUser) {
  if (jwtUser.secretaryId) return jwtUser.secretaryId
  // Fallback: busca no banco (para tokens gerados antes da inclusão do campo)
  const u = await prisma.user.findUnique({
    where: { id: jwtUser.id },
    include: { department: true },
  })
  return u?.secretaryId || u?.department?.secretaryId || null
}

// GET /secretaries
// Com ?scope=manage: ADM vê apenas a própria (para Entidades/gestão)
// Sem parâmetro: retorna todas (para endereçamento de memorandos)
router.get('/', auth, async (req, res) => {
  try {
    // SUPER_ADMIN sempre vê tudo
    if (req.user.role === 'SUPER_ADMIN') {
      const secs = await prisma.secretary.findMany({ include: secInclude, orderBy: { acronym: 'asc' } })
      return res.json(secs)
    }

    // ADM/USER em modo gestão: só a própria secretaria
    if (req.query.scope === 'manage') {
      const secretaryId = await resolveSecretaryId(req.user)
      if (!secretaryId) return res.json([])
      const secs = await prisma.secretary.findMany({
        where:   { id: secretaryId },
        include: secInclude,
      })
      return res.json(secs)
    }

    // Sem filtro: retorna todas (necessário para endereçamento de memorandos)
    const secs = await prisma.secretary.findMany({ include: secInclude, orderBy: { acronym: 'asc' } })
    return res.json(secs)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// POST /secretaries — apenas SUPER_ADMIN
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN')
    return res.status(403).json({ error: 'Apenas o Super Admin pode criar secretarias.' })
  try {
    const sec = await prisma.secretary.create({ data: req.body })
    return res.status(201).json(sec)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// PUT /secretaries/:id — apenas SUPER_ADMIN
router.put('/:id', auth, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN')
    return res.status(403).json({ error: 'Apenas o Super Admin pode editar secretarias.' })
  try {
    const sec = await prisma.secretary.update({ where: { id: req.params.id }, data: req.body })
    return res.json(sec)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// DELETE /secretaries/:id — apenas SUPER_ADMIN
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN')
    return res.status(403).json({ error: 'Apenas o Super Admin pode excluir secretarias.' })
  try {
    const [depts, users] = await Promise.all([
      prisma.department.count({ where: { secretaryId: req.params.id } }),
      prisma.user.count({ where: { secretaryId: req.params.id } }),
    ])
    if (depts > 0 || users > 0)
      return res.status(400).json({ error: `Não é possível excluir: existem ${depts} departamento(s) e ${users} usuário(s) vinculados.` })
    await prisma.secretary.delete({ where: { id: req.params.id } })
    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// POST /secretaries/:id/watermark — apenas SUPER_ADMIN
router.post('/:id/watermark', auth, upload.single('watermark'), async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN')
    return res.status(403).json({ error: 'Apenas o Super Admin pode alterar o template.' })
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' })
    // Remove arquivo antigo se existir
    const old = await prisma.secretary.findUnique({ where: { id: req.params.id }, select: { watermarkUrl: true } })
    if (old?.watermarkUrl) {
      const oldPath = path.join(uploadDir, path.basename(old.watermarkUrl))
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    }
    const watermarkUrl = `/uploads/${req.file.filename}`
    const sec = await prisma.secretary.update({ where: { id: req.params.id }, data: { watermarkUrl } })
    return res.json(sec)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// DELETE /secretaries/:id/watermark — apenas SUPER_ADMIN
router.delete('/:id/watermark', auth, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN')
    return res.status(403).json({ error: 'Apenas o Super Admin pode remover o template.' })
  try {
    const sec = await prisma.secretary.findUnique({ where: { id: req.params.id }, select: { watermarkUrl: true } })
    if (sec?.watermarkUrl) {
      const filePath = path.join(uploadDir, path.basename(sec.watermarkUrl))
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    }
    const updated = await prisma.secretary.update({ where: { id: req.params.id }, data: { watermarkUrl: null } })
    return res.json(updated)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

module.exports = router
