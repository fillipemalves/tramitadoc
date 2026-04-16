const router = require('express').Router()
const bcrypt = require('bcryptjs')
const prisma = require('../prisma')
const auth = require('../middleware/auth')

const include = {
  department: { include: { secretary: true } },
  secretary: true,
}

async function resolveSecretaryId(jwtUser) {
  if (jwtUser.secretaryId) return jwtUser.secretaryId
  const u = await prisma.user.findUnique({
    where: { id: jwtUser.id },
    include: { department: true },
  })
  return u?.secretaryId || u?.department?.secretaryId || null
}

// GET /users
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN vê todos, incluindo outras contas SUPER_ADMIN
      const users = await prisma.user.findMany({ include, orderBy: { name: 'asc' } })
      return res.json(users.map(u => ({ ...u, password: undefined })))
    }

    const secretaryId = await resolveSecretaryId(req.user)
    if (!secretaryId) return res.json([])

    // ADM/USER: vê apenas usuários da própria secretaria, excluindo SUPER_ADMIN
    const users = await prisma.user.findMany({
      where: {
        role: { not: 'SUPER_ADMIN' },
        OR: [
          { secretaryId },
          { department: { secretaryId } },
        ],
      },
      include,
      orderBy: { name: 'asc' },
    })
    return res.json(users.map(u => ({ ...u, password: undefined })))
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// POST /users
router.post('/', auth, async (req, res) => {
  const { role } = req.user
  if (role !== 'SUPER_ADMIN' && role !== 'ADM')
    return res.status(403).json({ error: 'Acesso negado.' })
  try {
    const { password, ...data } = req.body
    if (!data.departmentId) data.departmentId = null
    if (!data.secretaryId)  data.secretaryId  = null
    if (role === 'ADM') {
      const secretaryId = await resolveSecretaryId(req.user)
      data.secretaryId = secretaryId
      if (data.departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: data.departmentId } })
        if (!dept || dept.secretaryId !== secretaryId)
          return res.status(403).json({ error: 'Departamento não pertence à sua secretaria.' })
      }
    }
    const hashed = await bcrypt.hash(password || 'Redef@2026', 10)
    const user = await prisma.user.create({ data: { ...data, password: hashed }, include })
    return res.status(201).json({ ...user, password: undefined })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// PUT /users/:id
router.put('/:id', auth, async (req, res) => {
  const { role } = req.user
  if (role !== 'SUPER_ADMIN' && role !== 'ADM')
    return res.status(403).json({ error: 'Acesso negado.' })
  try {
    const { password, department, secretary, id, ...data } = req.body
    if (!data.departmentId) data.departmentId = null
    if (!data.secretaryId)  data.secretaryId  = null
    if (role === 'ADM') {
      const secretaryId = await resolveSecretaryId(req.user)
      const target = await prisma.user.findUnique({ where: { id: req.params.id }, include: { department: true } })
      const targetSecId = target?.secretaryId || target?.department?.secretaryId
      if (targetSecId !== secretaryId)
        return res.status(403).json({ error: 'Acesso negado.' })
      data.secretaryId = secretaryId
    }
    const update = { ...data }
    if (password) update.password = await bcrypt.hash(password, 10)
    const user = await prisma.user.update({ where: { id: req.params.id }, data: update, include })
    return res.json({ ...user, password: undefined })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// PATCH /users/me — qualquer usuário autenticado pode atualizar seus próprios dados
router.patch('/me', auth, async (req, res) => {
  try {
    const { name, email, position } = req.body
    const data = {}
    if (name)     data.name     = name
    if (email)    data.email    = email
    if (position !== undefined) data.position = position
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      include,
    })
    return res.json({ ...user, password: undefined })
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'E-mail já está em uso.' })
    return res.status(500).json({ error: e.message })
  }
})

// PATCH /users/me/password — qualquer usuário autenticado pode trocar a própria senha
router.patch('/me/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' })
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' })

    const dbUser = await prisma.user.findUnique({ where: { id: req.user.id } })
    const ok = await bcrypt.compare(currentPassword, dbUser.password)
    if (!ok) return res.status(400).json({ error: 'Senha atual incorreta.' })

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } })
    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// DELETE /users/:id — apenas SUPER_ADMIN (exclusão permanente)
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN')
    return res.status(403).json({ error: 'Apenas o Super Admin pode excluir usuários.' })
  // Impede auto-exclusão
  if (req.params.id === req.user.id)
    return res.status(400).json({ error: 'Você não pode excluir a própria conta.' })
  try {
    // Impede exclusão de qualquer conta SUPER_ADMIN
    const target = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' })
    if (target.role === 'SUPER_ADMIN')
      return res.status(400).json({ error: 'Contas Super Admin não podem ser excluídas.' })
    const memos = await prisma.memo.count({ where: { senderId: req.params.id } })
    if (memos > 0)
      return res.status(400).json({ error: `Não é possível excluir: usuário possui ${memos} memorando(s) enviado(s). Remova os memorandos antes.` })
    await prisma.user.delete({ where: { id: req.params.id } })
    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

module.exports = router
