const router = require('express').Router()
const prisma = require('../prisma')

// GET /verificar/:code — rota pública de autenticidade
router.get('/:code', async (req, res) => {
  try {
    const sig = await prisma.signature.findUnique({
      where:   { verificationCode: req.params.code },
      include: { memo: { include: { sender: { include: { department: true } } } } },
    })
    if (!sig) return res.status(404).json({ valid: false, error: 'Código não encontrado.' })
    return res.json({
      valid:    true,
      protocol: sig.memo.protocol,
      subject:  sig.memo.subject,
      signer:   sig.memo.sender?.name,
      dept:     sig.memo.sender?.department?.name,
      signedAt: sig.signedAt,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

module.exports = router
