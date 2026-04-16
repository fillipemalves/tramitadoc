const jwt    = require('jsonwebtoken')
const prisma  = require('../prisma')

module.exports = async (req, res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token não informado.' })

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET)

    // Busca dados frescos do banco para garantir departmentId/secretaryId corretos
    const dbUser = await prisma.user.findUnique({
      where:   { id: payload.id },
      include: { department: { include: { secretary: true } }, secretary: true },
    })
    if (!dbUser || !dbUser.isActive)
      return res.status(401).json({ error: 'Usuário inativo ou não encontrado.' })

    const effectiveSecretaryId = dbUser.secretaryId || dbUser.department?.secretaryId || null

    req.user = {
      ...payload,
      departmentId: dbUser.departmentId,
      secretaryId:  effectiveSecretaryId,
      department:   dbUser.department,
      secretary:    dbUser.secretary,
    }
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado.' })
  }
}
