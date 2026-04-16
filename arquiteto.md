# TramitaDOC — Sistema de Tramitação de Memorandos
> Documento de Escopo e Planejamento do Projeto
> Versão 2.1 | Abril 2026 — ATUALIZADO COM SISTEMA DE PAGINAÇÃO DINÂMICA

---

## 1. Visão Geral

O **TramitaDOC** é um sistema web institucional para gestão eletrônica de
memorandos internos da Prefeitura Municipal de Redenção — PA. Permite criação,
assinatura digital com carimbo minimalista no PDF, envio para um ou múltiplos
departamentos, tramitação, rastreamento de status e geração de PDF oficial.
Elimina memorandos físicos com segurança jurídica plena, sem necessidade
de certificados externos (A1, A3 ou Gov.br).

---

## 2. Objetivos do Projeto

- Digitalizar o fluxo de comunicação interna via memorandos
- Aplicar **Carimbo Minimalista** no PDF (estilo A3 — pequeno, discreto,
  canto inferior direito do documento)
- Detalhes completos da assinatura acessíveis apenas via consulta no
  sistema (link/QR Code) — sem expor dados criptográficos no impresso
- Garantir autenticidade via **Assinatura Eletrônica Avançada**
  (Lei nº 14.063/2020, Art. 4º, II)
- Permitir envio para **um ou múltiplos departamentos** simultaneamente
- Memorando recebido é visível **somente** pelos usuários do departamento
  destinatário
- Controlar o ciclo de vida: Rascunho → Enviado → Recebido →
  Concluído / Devolvido

---

## 3. Perfis de Acesso (3 Níveis)

### 3.1 SUPER_ADMIN
Acesso irrestrito ao sistema inteiro. Gerencia secretarias, departamentos, usuários e audita.

### 3.2 ADM — Administrador do Departamento
Responsável pela gestão da plataforma dentro da sua secretaria.

**Gestão da Plataforma:**
- Cadastrar, editar e inativar usuários da sua secretaria
- Cadastrar, editar e inativar departamentos da sua secretaria
- Atribuir usuários a departamentos
- Upload/gerenciar marca d'água de secretarias e departamentos
- Visualizar **todos** os memorandos da sua secretaria
- Configurações globais (nome da prefeitura, logo, rodapé do PDF)

**Ações em Memorandos (idênticas ao Usuário):**
- Criar, editar e excluir rascunhos
- Assinar digitalmente e enviar para um ou múltiplos departamentos
- Confirmar recebimento, devolver, reenviar, concluir
- Baixar PDF de qualquer memorando

### 3.3 USER — Usuário Comum
Responsável pela operação diária dos memorandos no seu departamento.

**Regras de Visibilidade:**
- Com departamento: vê apenas memorandos enviados ou recebidos pelo seu departamento
- Sem departamento: vê apenas memorandos endereçados à sua secretaria
- ADM é a única exceção (acesso à secretaria inteira)

**Ações em Memorandos:**
- Criar, editar e excluir próprios rascunhos
- Assinar digitalmente e enviar
- Confirmar recebimento dos memos do seu departamento
- Devolver com justificativa obrigatória
- Reenviar memorandos devolvidos
- Concluir memorandos que enviou ou recebeu
- Baixar PDF dos memorandos que enviou ou recebeu

---

## 4. Envio para Múltiplos Destinatários

### 4.1 Funcionamento
- Campo "Destinatários" aceita **seleção múltipla** de departamentos **ou** secretarias (chips com busca)
- Ao enviar, o sistema cria uma entrada em `MemoRecipient` por destinatário
- Cada destinatário possui **status independente**
- Status consolidado do memorando é calculado sobre todos os destinatários
- PDF lista todos os destinatários no campo PARA: do cabeçalho

### 4.2 Status Consolidado

| Status Consolidado | Condição                                      |
|--------------------|-----------------------------------------------|
| ENVIADO            | ≥1 destinatário ainda não recebeu             |
| RECEBIDO           | Todos receberam, nenhum concluiu              |
| EM ANDAMENTO       | Parte concluiu, parte ainda em tramitação     |
| DEVOLVIDO          | ≥1 destinatário devolveu                      |
| CONCLUÍDO          | Todos os destinatários concluíram             |

---

## 5. Carimbo de Assinatura Digital

### 5.1 Conceito — Dois Níveis de Visualização

**Nível 1 — Carimbo no PDF (minimalista):**
- Pequeno bloco visual no **canto inferior direito** do documento
- Ocupa aproximadamente 4 cm × 2,5 cm no A4 impresso
- Contém QR Code para acesso à consulta completa

**Nível 2 — Consulta Completa no Sistema (via QR Code / link):**
- Página pública acessível **sem login** em `/verificar/:codigo`
- Confirma autenticidade do documento sem necessidade de login

### 5.2 Fluxo de Assinatura (implementado)
1. Usuário clica em "Assinar e Enviar" → abre `ModalAssinatura`
2. Autentica com senha (confirma identidade no backend via bcrypt)
3. Backend gera `verificationCode` único (`TDC-{uuid-20chars}`)
4. Salva em `Signature` com `signedAt` e muda memo para `SENT`
5. Carimbo aparece no PDF com QR Code e URL de verificação
6. Rota pública `GET /verificar/:code` confirma autenticidade sem login

### 5.3 Especificação Técnica
- **verificationCode:** `TDC-{uuid-parcial}` (único por memorando)
- **QR Code:** gerado via biblioteca `qrcode` como data URL (60×60px)
- **Conformidade:** Lei nº 14.063/2020, Art. 4º, II

---

## 6. Geração de PDF

### 6.1 Implementação (implementado e funcional)
- **Rota:** `GET /memos/:id/pdf`
- **Engine:** Puppeteer-core com Chromium headless
- **Formato:** A4, margens: 3cm (topo), 0 (lateral), 2cm (rodapé)

### 6.2 Conteúdo do PDF
- **Cabeçalho:** espaço de 180px para timbrado (papel timbrado pré-impresso)
- **Metadados:** data (formato português), protocolo, De/Para, assunto
- **Corpo:** HTML renderizado do editor TipTap (line-height 1.9, padding 80px lateral)
- **Bloco de assinatura:** QR Code + nome do signatário + data/hora + URL de verificação
- **Bloco do remetente:** nome, cargo, matrícula + espaço de 200px para rubrica manuscrita
- **Marca d'água:** imagem de fundo via `position: fixed`, cobre toda a página A4

### 6.3 Marca d'água no PDF
- Busca `watermarkUrl` do departamento do remetente, com fallback para a secretaria
- Renderizada via `<img>` com `position: fixed; top:0; left:0; width:210mm; height:297mm; z-index:0`
- Conteúdo do documento em `z-index: 1` (sobre a marca d'água)

### 6.4 Dockerização
- Backend usa `node:20-slim` (Debian) com Chromium instalado via apt
- Variável: `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`
- Args: `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`

---

## 7. Marca d'água — Frontend (Preview)

- Preview do documento em `VisualizarMemo.jsx` renderiza marca d'água em cada página
- Hook `useMemoPages()` calcula paginação dinamicamente via `ResizeObserver`
- Cada página recebe sua própria imagem de marca d'água em `position: absolute; top: 0; left: 0`
- `objectFit: 'fill'` — estende a imagem para cobrir 794×1123px

---

## 8. Modelo de Dados (Prisma Schema — Implementado)

```prisma
model Secretary {
  id            String       @id @default(uuid())
  name          String
  acronym       String       @unique
  secretaryName String
  watermarkUrl  String?
  isActive      Boolean      @default(true)
  createdAt     DateTime     @default(now())
  departments   Department[]
  users         User[]
  recipients    MemoRecipient[]
}

model Department {
  id           String       @id @default(uuid())
  name         String
  acronym      String
  logoUrl      String?
  watermarkUrl String?
  isActive     Boolean      @default(true)
  createdAt    DateTime     @default(now())
  secretaryId  String
  secretary    Secretary    @relation(fields: [secretaryId], references: [id])
  users        User[]
  recipients   MemoRecipient[]

  @@unique([secretaryId, acronym])
}

model User {
  id                String     @id @default(uuid())
  name              String
  email             String     @unique
  password          String
  registration      String     @unique
  registrationLabel String?
  position          String?
  role              Role       @default(USER)
  isActive          Boolean    @default(true)
  createdAt         DateTime   @default(now())
  departmentId      String?
  department        Department? @relation(fields: [departmentId], references: [id])
  secretaryId       String?
  secretary         Secretary?  @relation(fields: [secretaryId], references: [id])
  sentMemos         Memo[]     @relation("SenderUser")
}

model Memo {
  id         String        @id @default(uuid())
  protocol   String?       @unique
  subject    String
  body       String        @db.Text
  status     MemoStatus    @default(DRAFT)
  priority   Priority      @default(NORMAL)
  senderId   String
  sender     User          @relation("SenderUser", fields: [senderId], references: [id])
  recipients MemoRecipient[]
  signature  Signature?
  events     MemoEvent[]
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt
}

model MemoRecipient {
  id           String          @id @default(uuid())
  memoId       String
  memo         Memo            @relation(fields: [memoId], references: [id])
  departmentId String?
  department   Department?     @relation(fields: [departmentId], references: [id])
  secretaryId  String?
  secretary    Secretary?      @relation(fields: [secretaryId], references: [id])
  status       RecipientStatus @default(SENT)
  receivedAt   DateTime?
  completedAt  DateTime?
  notes        String?
  createdAt    DateTime        @default(now())
}

model Signature {
  id               String   @id @default(uuid())
  memoId           String   @unique
  memo             Memo     @relation(fields: [memoId], references: [id])
  userId           String
  verificationCode String   @unique
  signedAt         DateTime @default(now())
}

model MemoEvent {
  id        String   @id @default(uuid())
  memoId    String
  memo      Memo     @relation(fields: [memoId], references: [id])
  userId    String?
  icon      String?
  label     String?
  user      String?
  dept      String?
  color     String?
  eventType EventType?
  notes     String?
  createdAt DateTime @default(now())
}

enum Role            { USER ADM SUPER_ADMIN }
enum MemoStatus      { DRAFT SENT RECEIVED IN_PROGRESS RETURNED COMPLETED }
enum Priority        { NORMAL HIGH URGENT CONFIDENTIAL }
enum RecipientStatus { SENT RECEIVED RETURNED COMPLETED }
enum EventType       { CREATED SIGNED SENT RECEIVED RETURNED COMPLETED }
```

---

## 9. Stack Tecnológica

| Camada       | Tecnologia                               |
|--------------|------------------------------------------|
| Frontend     | React 18 + Vite 5 + Tailwind CSS 3       |
| Roteamento   | React Router v6                          |
| Editor       | TipTap v2 (ProseMirror)                  |
| Datas        | date-fns v3                              |
| HTTP Client  | Axios (interceptors JWT automáticos)     |
| QR Code (FE) | qrcode.react                             |
| Backend      | Node.js 20 + Express 4                   |
| ORM          | Prisma 5 + PostgreSQL 16                 |
| Autenticação | JWT (12h) + bcryptjs                     |
| PDF          | Puppeteer-core + Chromium headless       |
| QR Code (BE) | qrcode (data URL para o PDF)             |
| Upload       | Multer (marca d'água)                    |
| Containers   | Docker + Docker Compose                  |
| Servidor web | Nginx 1.25 (proxy reverso + React Router)|

---

## 10. Infraestrutura e Deploy

### 10.1 Hierarquia de Pastas do Projeto

```
tramitaDOC/                        ← raiz do repositório
├── docker-compose.yml
├── .env.example
├── .env                           ← NUNCA commitar
├── deploy.sh                      ← git pull + build + migrate
├── ssl-setup.sh                   ← Certbot (rodar uma vez em produção)
│
├── frontend/
│   ├── Dockerfile                 ← node:20-alpine (build) + nginx:1.25-alpine (serve)
│   ├── nginx.conf                 ← React Router + proxy /api → backend:3333
│   ├── .dockerignore
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                ← rotas + PrivateRoute por perfil
│       ├── index.css              ← Tailwind + scrollbar customizada
│       ├── context/
│       │   └── AuthContext.jsx    ← token + user no localStorage
│       ├── hooks/
│       │   ├── useDebounce.js
│       │   ├── usePageBreaks.js   ← legado (não usado no fluxo principal)
│       │   └── useMemoPages.js    ← paginação dinâmica via ResizeObserver
│       ├── services/
│       │   └── api.js             ← axios + interceptors + todos os services
│       ├── components/
│       │   ├── Sidebar.jsx
│       │   ├── StatusBadge.jsx
│       │   ├── ModalAssinatura.jsx
│       │   └── ModalDevolucao.jsx
│       └── pages/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Memos.jsx
│           ├── NovoMemo.jsx
│           ├── VisualizarMemo.jsx
│           ├── Usuarios.jsx
│           ├── Entidades.jsx      ← gestão de secretarias e departamentos
│           ├── MeuPerfil.jsx      ← perfil do usuário logado
│           ├── SuperAdmin.jsx     ← painel SUPER_ADMIN
│           └── VerificarAssinatura.jsx ← página pública de verificação
│
└── backend/
    ├── Dockerfile                 ← node:20-slim (Debian — Chromium + Prisma/OpenSSL)
    ├── .dockerignore
    ├── package.json
    ├── uploads/                   ← marcas d'água dos departamentos/secretarias
    ├── prisma/
    │   ├── schema.prisma
    │   └── seed.js                ← secretarias + departamentos + admin padrão
    └── src/
        ├── server.js              ← Express + rotas + CORS + /uploads estático
        ├── prisma.js              ← singleton PrismaClient
        ├── middleware/
        │   └── auth.js            ← valida JWT Bearer
        └── routes/
            ├── auth.js            ← POST /auth/login
            ├── memos.js           ← CRUD + sign/send/receive/complete/return + PDF
            ├── users.js           ← CRUD usuários
            ├── departments.js     ← CRUD departamentos + upload watermark
            ├── secretaries.js     ← CRUD secretarias + upload watermark
            └── verificar.js       ← GET /verificar/:code (rota pública)
```

### 10.2 Variáveis de Ambiente (.env raiz)
```
DB_NAME=tramitadoc
DB_USER=postgres
DB_PASSWORD=postgres
DATABASE_URL=postgresql://postgres:postgres@db:5432/tramitadoc
JWT_SECRET=tramitadoc_secret_2026
VITE_API_URL=/api
DOMAIN=localhost
```

### 10.3 Docker Compose (serviços)

| Serviço  | Imagem             | Porta exposta | Observação                        |
|----------|--------------------|---------------|-----------------------------------|
| db       | postgres:16-alpine | interna       | healthcheck pg_isready            |
| backend  | node:20-slim       | 3333 (intern) | depende do db healthy + Chromium  |
| frontend | nginx:1.25-alpine  | 80 (público)  | proxy /api → backend:3333         |

⚠️ Atenção: usar `node:20-slim` (Debian) no backend — Alpine não tem
OpenSSL compatível com o engine binário do Prisma (erro libssl).

### 10.4 Comandos de Deploy Local
```bash
# 1ª vez
docker compose up -d --build
docker compose exec backend npx prisma migrate dev --name init
docker compose exec backend npm run seed

# Atualizações
docker compose down
docker compose up -d --build

# Reset total (apaga banco)
docker compose down -v
```

### 10.5 Deploy em Produção (VPS)
```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Clonar e configurar
git clone https://github.com/seu-usuario/tramitadoc.git
cd tramitadoc && cp .env.example .env && nano .env

# SSL (uma vez)
bash ssl-setup.sh

# Deploy
bash deploy.sh
```

VPS mínima recomendada: 2 vCPU · 2 GB RAM · 40 GB · Ubuntu 22.04

---

## 11. Rotas da API (Backend)

| Método | Rota                          | Auth | Descrição                            |
|--------|-------------------------------|------|--------------------------------------|
| POST   | /auth/login                   | ❌    | Login, retorna JWT                   |
| GET    | /verificar/:code              | ❌    | Verifica autenticidade pública       |
| GET    | /memos                        | ✅    | Lista memorandos (filtros por role)  |
| GET    | /memos/:id                    | ✅    | Detalhe do memorando                 |
| POST   | /memos                        | ✅    | Criar rascunho (ADM/SUPER_ADMIN)     |
| PUT    | /memos/:id                    | ✅    | Editar rascunho (ADM/SUPER_ADMIN)    |
| DELETE | /memos/:id                    | ✅    | Excluir rascunho                     |
| POST   | /memos/:id/sign               | ✅    | Assinar (valida senha via bcrypt)    |
| POST   | /memos/:id/send               | ✅    | Enviar + gerar protocolo             |
| POST   | /memos/:id/receive            | ✅    | Confirmar recebimento                |
| POST   | /memos/:id/complete           | ✅    | Concluir                             |
| POST   | /memos/:id/return             | ✅    | Devolver com justificativa           |
| GET    | /memos/:id/pdf                | ✅    | Gerar PDF via Puppeteer              |
| GET    | /users                        | ✅    | Listar usuários                      |
| POST   | /users                        | ✅    | Criar usuário                        |
| PUT    | /users/:id                    | ✅    | Editar usuário                       |
| DELETE | /users/:id                    | ✅    | Excluir usuário (SUPER_ADMIN)        |
| GET    | /departments                  | ✅    | Listar departamentos                 |
| POST   | /departments                  | ✅    | Criar departamento                   |
| PUT    | /departments/:id              | ✅    | Editar departamento                  |
| DELETE | /departments/:id              | ✅    | Excluir departamento                 |
| POST   | /departments/:id/watermark    | ✅    | Upload marca d'água do departamento  |
| GET    | /secretaries                  | ✅    | Listar secretarias                   |
| POST   | /secretaries                  | ✅    | Criar secretaria (SUPER_ADMIN)       |
| PUT    | /secretaries/:id              | ✅    | Editar secretaria (SUPER_ADMIN)      |
| DELETE | /secretaries/:id              | ✅    | Excluir secretaria (SUPER_ADMIN)     |
| POST   | /secretaries/:id/watermark    | ✅    | Upload marca d'água da secretaria    |

---

## 12. Protocolo de Numeração

- Formato: `Mem. nº {SEQ}/{ANO} - {SIGLA}`
- Exemplo: `Mem. nº 001/2026 - SEGOV`
- Sequencial anual, gerado no momento do envio
- Rascunhos não possuem protocolo
- Imutável após gerado

---

## 13. Segurança

- HTTPS obrigatório em produção (TLS 1.2+ via Certbot/Let's Encrypt)
- Senhas: bcryptjs (hash + compare no backend)
- JWT expira em 12h; interceptor axios redireciona para /login em 401
- Rate limiting e bloqueio de tentativas: planejado para Fase 2
- Middleware `auth.js` protege todas as rotas exceto `/auth/login` e `/verificar`
- Senha nunca retornada nas respostas da API
- Senha padrão de novos usuários: `Redef@2026`

---

## 14. Fases de Desenvolvimento

### Fase 1 — MVP ✅ Concluída

#### Frontend — Páginas
- [x] Login.jsx — autenticação com JWT
- [x] Dashboard.jsx — KPIs e resumo
- [x] Memos.jsx — listagem com filtros e abas de status
- [x] NovoMemo.jsx — editor TipTap + autosave + chips destinatários
- [x] VisualizarMemo.jsx — documento + marca d'água multi-página + timeline + ações
- [x] Usuarios.jsx — CRUD com modal
- [x] Entidades.jsx — gestão de secretarias e departamentos + upload de watermark
- [x] MeuPerfil.jsx — perfil do usuário logado
- [x] SuperAdmin.jsx — painel SUPER_ADMIN
- [x] VerificarAssinatura.jsx — verificação pública de assinatura

#### Frontend — Componentes
- [x] Sidebar.jsx (colapsável, menu por role)
- [x] StatusBadge.jsx
- [x] ModalAssinatura.jsx
- [x] ModalDevolucao.jsx
- [x] AuthContext.jsx
- [x] api.js (axios + interceptors + todos os services)
- [x] useDebounce.js
- [x] usePageBreaks.js (legado)
- [x] useMemoPages.js (paginação dinâmica — ResizeObserver + offsets)

#### Backend — Rotas
- [x] POST /auth/login
- [x] GET/POST/PUT/DELETE /users
- [x] GET/POST/PUT/DELETE /departments + watermark
- [x] GET/POST/PUT/DELETE /secretaries + watermark
- [x] GET/POST/PUT/DELETE /memos + sign/send/receive/complete/return
- [x] GET /memos/:id/pdf (Puppeteer + marca d'água + QR Code)
- [x] GET /verificar/:code (pública)

#### Infraestrutura
- [x] Docker Compose (db + backend + frontend)
- [x] Nginx como proxy reverso
- [x] Prisma schema + migrations
- [x] Seed (secretarias + departamentos + admin padrão)
- [x] Scripts deploy.sh + ssl-setup.sh
- [x] Geração de PDF (Puppeteer + carimbo + QR Code + marca d'água)
- [x] Upload de marca d'água (Multer)

### Fase 2 — Incremento (planejado)
- [ ] Anexos nos memorandos (upload/download, Multer)
- [ ] Notificações por e-mail ao receber memorando
- [ ] Rubrica visual (canvas no modal de assinatura)
- [ ] Rate limiting + bloqueio de login
- [ ] Refresh token
- [ ] Dashboard com KPIs reais do banco

### Fase 3 — Maturidade (planejado)
- [ ] Relatórios gerenciais + exportação CSV/PDF
- [ ] Templates de memorando configuráveis
- [ ] Busca full-text no corpo
- [ ] Versionamento e comparação de reenvios

---

## 15. Credenciais Padrão (seed)

| Campo    | Valor                          |
|----------|--------------------------------|
| E-mail   | admin@mvinformatica.cloud      |
| Senha    | Admin@2026                     |
| Perfil   | SUPER_ADMIN                    |
| Depto    | SEGOV                          |

Senha padrão para novos usuários criados via sistema: `Redef@2026`

---

## 16. Identidade Visual

- **Tema:** Dark mode — bg `slate-950`, cards `slate-900`, bordas `slate-800`
- **Destaque:** azul `blue-700` com bordas `blue-700`
- **Badges:** `rounded-full` com `bg-X-950 border-X-900 text-X-400`
- **Tabelas:** thead em `slate-950`, linhas em `slate-900`, hover `slate-800/50`
- **Botões de ação:** `bg-X-950 border-X-900` com `transition-colors`
- **Scrollbar:** customizada (6px, `slate-700`, hover `slate-500`)
- **Sidebar:** fixa, colapsável, item ativo em azul
- **Status colors:** SENT=blue · RECEIVED=emerald · DRAFT=slate · RETURNED=red · COMPLETED=violet · IN_PROGRESS=amber

---

## 17. Editor de Texto — TipTap

- **Biblioteca:** TipTap v2 (`@tiptap/react`) sobre ProseMirror
- **Extensões:** StarterKit, Underline, TextAlign, Link, Placeholder
- **Toolbar:** Negrito · Itálico · Sublinhado · Tachado · Alinhamentos · Listas · Desfazer/Refazer
- **Documento:** papel A4 simulado com zoom ajustável (padrão 0.85)
- **Autosave:** debounce de 30s, salva rascunho automaticamente
- **Persistência:** HTML sanitizado no banco (campo `body` TEXT)
- **Exportação:** HTML do TipTap → template Puppeteer → PDF A4

---

## 18. Sistema de Paginação Dinâmica (NovoMemo + VisualizarMemo)

### 18.1 Constantes de Layout (em `useMemoPages.js`)

| Constante  | Valor | Significado                          |
|------------|-------|--------------------------------------|
| `PAGE_W`   | 794px | Largura do A4 em pixels              |
| `PAGE_H`   | 1123px| Altura do A4 em pixels               |
| `HEADER_H` | 180px | Zona reservada para timbrado (topo)  |
| `FOOTER_H` | 130px | Zona reservada para timbrado (rodapé)|
| `CONTENT_H`| 813px | Área útil por página (PAGE_H - HEADER_H - FOOTER_H) |
| `BODY_W`   | 634px | Largura do corpo de texto (PAGE_W - 2×80px margens) |

### 18.2 Hook `useMemoPages`

**Arquivo:** `frontend/src/hooks/useMemoPages.js`

Gerencia a paginação dinâmica com `ResizeObserver`. Recebe `metaRef` (div dos metadados) e `bodyRef` (div invisível de medição do corpo). Retorna:

```js
{ totalPages, page1BodyH, offsets }
```

- `page1BodyH = Math.max(50, CONTENT_H - metaH)` — espaço disponível na página 1 após os metadados
- `offsets[i]` — deslocamento vertical `translateY` para exibir a fatia de conteúdo da página i
- Reavalia via `ResizeObserver` sempre que metaRef ou bodyRef mudam de tamanho

### 18.3 Arquitetura de Páginas no NovoMemo

**Princípio:** o editor TipTap (live, editável) existe apenas na **página 1**. As páginas 2+ são clones estáticos do HTML do editor, exibindo a fatia de overflow via `translateY(-offset)`.

**Clip de cada página:**
```jsx
<div style={{ overflow: 'hidden', height: piPage1BodyH_ou_CONTENT_H }}>
  <div style={{ transform: `translateY(-${pages.offsets[pi]}px)` }}>
    {pi === 0 ? <EditorContent /> : <div dangerouslySetInnerHTML={editorHtml} />}
  </div>
</div>
```

**Refs de layout:**
- `scrollContainerRef` — container externo com `overflow-y: auto` (o que o usuário vê)
- `bodyRef` — div invisível fora da tela (`left: -9999`) que mede só o corpo do texto (sem metadados nem bloco do remetente) para que `useMemoPages` calcule páginas corretamente
- `metaRef` — div dos metadados na página 1 (De/Para/Assunto)
- `pageEls` — ref map `{[pi]: HTMLElement}` das divs físicas de cada página

**Compensação de zoom (sem espaço morto abaixo):**
```js
marginBottom: (pages.totalPages * PAGE_H + Math.max(0, pages.totalPages - 1) * 36) * (zoom - 1)
```
O `transform: scale(zoom)` mantém o tamanho do layout box original, então o `marginBottom` compensa a diferença entre o tamanho visual e o tamanho do layout.

### 18.4 Auto-scroll e Cursor Virtual

**Problema fundamental:** o cursor do editor está fisicamente dentro do clip `overflow:hidden` da página 1. Quando o texto transborda para a página 2, o cursor DOM fica invisível no clip — a posição visual do texto está 346px mais abaixo (FOOTER_H + separador + HEADER_H).

**`handleScrollToSelection: () => true`** — configurado no `useEditor` para impedir que o ProseMirror altere o `scrollTop` do clip da página 1 (que apesar de `overflow: hidden`, é modificável via JS e causaria o conteúdo "subir" dentro do clip).

**`getCursorContentY()`** — mapeia o cursor para coordenada Y não-escalada relativa ao topo do editor:
```js
(coordsAtPos(from).top - editorEl.getBoundingClientRect().top) / zoom
```

**`scrollToCursor()`** — rola o `scrollContainerRef` para manter o cursor visível:
- Se `cursorContentY <= page1BodyH`: rola pelo nó DOM do cursor (página 1 normal)
- Se `cursorContentY > page1BodyH`: calcula a página visual (pi = 1 + floor(overflowY / CONTENT_H)) e rola para `pageRect.top + (HEADER_H + offsetInPage) * zoom`

**`updateVirtualCursor()`** — renderiza um cursor piscante (1.5px) na página 2+ na posição visual correta, já que o cursor real está oculto no clip da página 1.

**`useLayoutEffect`** — dispara `scrollToCursor` + `updateVirtualCursor` após o browser pintar uma nova página (quando `pages.totalPages` muda).

**Sincronização do clone:** `setEditorHtml(editor.getHTML())` é chamado imediatamente em cada `update` do editor (sem debounce) para que as páginas 2+ mostrem o conteúdo atualizado em tempo real.

### 18.5 Bloco do Remetente — Posicionamento Fixo

Em ambas as páginas (`NovoMemo` e `VisualizarMemo`), o bloco do remetente (nome/cargo/matrícula + QR Code se assinado) é posicionado como:

```jsx
<div style={{
  position: 'absolute',
  bottom: FOOTER_H + 16,   // 16px acima da zona do timbrado de rodapé
  left: 80, right: 80,
  zIndex: 2,
  backgroundColor: 'white',
}}>
  {/* nome, cargo, matrícula (+ QR em VisualizarMemo) */}
</div>
```

Isso garante que o bloco apareça sempre acima do timbrado, independente de quantas linhas o corpo tiver. O clip da última página recebe `paddingBottom: 100` (apenas quando `pi > 0`) para evitar sobreposição visual entre o texto do corpo e o bloco fixo.

### 18.6 Clique nas Páginas 2+

Um overlay `position: absolute; inset: 0; cursor: text` captura cliques nas páginas 2+. O handler:
1. Calcula `contentOffsetY = clickY + pages.offsets[pi]` (Y no espaço do editor)
2. Itera `editor.state.doc.descendants` para encontrar o bloco cujo Y (`coordsAtPos`) seja próximo do clique
3. Chama `editor.chain().focus().setTextSelection(pos).run()` no bloco encontrado

### 18.7 VisualizarMemo — Paginação

Usa o mesmo `useMemoPages` com um `bodyRef` medindo apenas o HTML do corpo (`memo.body`). O bloco do remetente + QR Code é renderizado como `position: absolute; bottom: FOOTER_H + 16` na última página, igual ao NovoMemo. O `bodyRef` usa `left: -9999` para não contribuir para o scroll height do container.
