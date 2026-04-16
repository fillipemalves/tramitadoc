const router = require('express').Router()
const prisma  = require('../prisma')
const auth    = require('../middleware/auth')
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')

const uploadDir = path.join(__dirname, '../../uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, `dwm-${Date.now()}${path.extname(file.originalname)}`),
})
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })

async function resolveSecretaryId(jwtUser) {
  if (jwtUser.secretaryId) return jwtUser.secretaryId
  const u = await prisma.user.findUnique({
    where: { id: jwtUser.id },
    include: { department: true },
  })
  return u?.secretaryId || u?.department?.secretaryId || null
}

// GET /departments
// Com ?secretaryId=xxx filtra por secretaria (Entidades/Usuarios)
// Sem filtro retorna todos — necessário para endereçamento de memorandos
router.get('/', auth, async (req, res) => {
  try {
    const { secretaryId: querySecId } = req.query
    const where = querySecId ? { secretaryId: querySecId } : {}
    const depts = await prisma.department.findMany({
      where,
      include: { secretary: { select: { id: true, name: true, acronym: true } } },
      orderBy: { name: 'asc' },
    })
    return res.json(depts)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// POST /departments — SUPER_ADMIN ou ADM (na própria secretaria)
router.post('/', auth, async (req, res) => {
  const { role } = req.user
  if (role !== 'SUPER_ADMIN' && role !== 'ADM')
    return res.status(403).json({ error: 'Acesso negado.' })
  try {
    const data = { ...req.body }
    if (role === 'ADM') data.secretaryId = await resolveSecretaryId(req.user)
    const dept = await prisma.department.create({ data })
    return res.status(201).json(dept)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// PUT /departments/:id — SUPER_ADMIN ou ADM (própria secretaria)
router.put('/:id', auth, async (req, res) => {
  const { role } = req.user
  try {
    if (role !== 'SUPER_ADMIN') {
      const [dept, secretaryId] = await Promise.all([
        prisma.department.findUnique({ where: { id: req.params.id } }),
        resolveSecretaryId(req.user),
      ])
      if (!dept || dept.secretaryId !== secretaryId)
        return res.status(403).json({ error: 'Acesso negado.' })
    }
    const { secretary, ...data } = req.body
    const updated = await prisma.department.update({ where: { id: req.params.id }, data })
    return res.json(updated)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// DELETE /departments/:id — apenas SUPER_ADMIN
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN')
    return res.status(403).json({ error: 'Apenas o Super Admin pode excluir departamentos.' })
  try {
    const [users, recipients] = await Promise.all([
      prisma.user.count({ where: { departmentId: req.params.id } }),
      prisma.memoRecipient.count({ where: { departmentId: req.params.id } }),
    ])
    if (users > 0 || recipients > 0)
      return res.status(400).json({ error: `Não é possível excluir: existem ${users} usuário(s) e ${recipients} memorando(s) vinculados.` })
    await prisma.department.delete({ where: { id: req.params.id } })
    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// POST /departments/:id/watermark — SUPER_ADMIN ou ADM (própria secretaria)
router.post('/:id/watermark', auth, upload.single('watermark'), async (req, res) => {
  const { role } = req.user
  if (role !== 'SUPER_ADMIN' && role !== 'ADM')
    return res.status(403).json({ error: 'Acesso negado.' })
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' })
    if (role === 'ADM') {
      const [dept, secretaryId] = await Promise.all([
        prisma.department.findUnique({ where: { id: req.params.id } }),
        resolveSecretaryId(req.user),
      ])
      if (!dept || dept.secretaryId !== secretaryId)
        return res.status(403).json({ error: 'Acesso negado.' })
    }
    // Remove arquivo antigo se existir
    const old = await prisma.department.findUnique({ where: { id: req.params.id }, select: { watermarkUrl: true } })
    if (old?.watermarkUrl) {
      const oldPath = path.join(uploadDir, path.basename(old.watermarkUrl))
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    }
    const watermarkUrl = `/uploads/${req.file.filename}`
    const dept = await prisma.department.update({ where: { id: req.params.id }, data: { watermarkUrl } })
    return res.json(dept)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// DELETE /departments/:id/watermark — SUPER_ADMIN ou ADM (própria secretaria)
router.delete('/:id/watermark', auth, async (req, res) => {
  const { role } = req.user
  if (role !== 'SUPER_ADMIN' && role !== 'ADM')
    return res.status(403).json({ error: 'Acesso negado.' })
  try {
    if (role === 'ADM') {
      const [dept, secretaryId] = await Promise.all([
        prisma.department.findUnique({ where: { id: req.params.id } }),
        resolveSecretaryId(req.user),
      ])
      if (!dept || dept.secretaryId !== secretaryId)
        return res.status(403).json({ error: 'Acesso negado.' })
    }
    const dept = await prisma.department.findUnique({ where: { id: req.params.id }, select: { watermarkUrl: true } })
    if (dept?.watermarkUrl) {
      const filePath = path.join(uploadDir, path.basename(dept.watermarkUrl))
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    }
    const updated = await prisma.department.update({ where: { id: req.params.id }, data: { watermarkUrl: null } })
    return res.json(updated)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

module.exports = router
