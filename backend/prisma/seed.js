const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {

  // 1. Secretarias
  const [segov, semob, sefaz, semad, semed, sms] = await Promise.all([
    prisma.secretary.upsert({ where: { acronym: 'SEGOV' }, update: {}, create: { name: 'Secretaria Municipal de Governo e Gestão',  acronym: 'SEGOV' } }),
    prisma.secretary.upsert({ where: { acronym: 'SEMOB' }, update: {}, create: { name: 'Secretaria Municipal de Obras',             acronym: 'SEMOB' } }),
    prisma.secretary.upsert({ where: { acronym: 'SEFAZ' }, update: {}, create: { name: 'Secretaria Municipal de Fazenda',           acronym: 'SEFAZ' } }),
    prisma.secretary.upsert({ where: { acronym: 'SEMAD' }, update: {}, create: { name: 'Secretaria Municipal de Administração',     acronym: 'SEMAD' } }),
    prisma.secretary.upsert({ where: { acronym: 'SEMED' }, update: {}, create: { name: 'Secretaria Municipal de Educação',          acronym: 'SEMED' } }),
    prisma.secretary.upsert({ where: { acronym: 'SMS'   }, update: {}, create: { name: 'Secretaria Municipal de Saúde',             acronym: 'SMS'   } }),
  ])

  console.log('✅ Secretarias criadas')

  // 2. Departamentos (um padrão por secretaria)
  await Promise.all([
    prisma.department.upsert({ where: { secretaryId_acronym: { secretaryId: segov.id, acronym: 'GOV' } }, update: {}, create: { name: 'Departamento de Governo',       acronym: 'GOV', secretaryId: segov.id } }),
    prisma.department.upsert({ where: { secretaryId_acronym: { secretaryId: semob.id, acronym: 'OBR' } }, update: {}, create: { name: 'Departamento de Obras',         acronym: 'OBR', secretaryId: semob.id } }),
    prisma.department.upsert({ where: { secretaryId_acronym: { secretaryId: sefaz.id, acronym: 'FAZ' } }, update: {}, create: { name: 'Departamento de Fazenda',       acronym: 'FAZ', secretaryId: sefaz.id } }),
    prisma.department.upsert({ where: { secretaryId_acronym: { secretaryId: semad.id, acronym: 'ADM' } }, update: {}, create: { name: 'Departamento de Administração', acronym: 'ADM', secretaryId: semad.id } }),
    prisma.department.upsert({ where: { secretaryId_acronym: { secretaryId: semed.id, acronym: 'EDU' } }, update: {}, create: { name: 'Departamento de Educação',      acronym: 'EDU', secretaryId: semed.id } }),
    prisma.department.upsert({ where: { secretaryId_acronym: { secretaryId: sms.id,   acronym: 'SAU' } }, update: {}, create: { name: 'Departamento de Saúde',         acronym: 'SAU', secretaryId: sms.id   } }),
  ])

  console.log('✅ Departamentos criados')

  // 3. Super Admin — vinculado direto à SEGOV (sem departamento)
  const hash = await bcrypt.hash('Admin@2026', 10)
  await prisma.user.upsert({
    where: { email: 'admin@mvinformatica.cloud' },
    update: {},
    create: {
      name:         'Administrador do Sistema',
      email:        'admin@mvinformatica.cloud',
      password:     hash,
      registration: '00000001',
      position:     'Super Administrador',
      role:         'SUPER_ADMIN',
      departmentId: null,
      secretaryId:  segov.id,
      isActive:     true,
    },
  })

  console.log('✅ Seed concluído!')
  console.log('👤 Login: admin@mvinformatica.cloud')
  console.log('🔑 Senha: Admin@2026')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
