const express = require('express')
const cors    = require('cors')
const path    = require('path')

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '10mb' }))
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// Rotas públicas
app.use('/auth',        require('./routes/auth'))
app.use('/verificar',   require('./routes/verificar'))

// Rotas protegidas
const auth = require('./middleware/auth')
app.use('/memos',       auth, require('./routes/memos'))
app.use('/users',       auth, require('./routes/users'))
app.use('/departments', auth, require('./routes/departments'))
app.use('/secretaries', auth, require('./routes/secretaries'))

// Health check
app.get('/health', (_, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 3333
app.listen(PORT, () => console.log(`TramitaDOC backend na porta ${PORT}`))