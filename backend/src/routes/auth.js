const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const prisma  = require('../prisma')

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ error: 'E-mail e senha obrigatórios.' })

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        department: { include: { secretary: true } },
        secretary: true,
      },
    })

    if (!user || !user.isActive)
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo.' })

    const ok = await bcrypt.compare(password, user.password)
    if (!ok)
      return res.status(401).json({ error: 'Senha incorreta.' })

    // secretaryId efetivo: direto ou via departamento
    const effectiveSecretaryId = user.secretaryId || user.department?.secretaryId || null

    const token = jwt.sign(
      {
        id:           user.id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        registration: user.registration,
        position:     user.position,
        department:   user.department,
        departmentId: user.departmentId,
        secretaryId:  effectiveSecretaryId,
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    )

    return res.json({ token, user: { ...user, password: undefined } })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

module.exports = router
