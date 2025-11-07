# 📧 Sistema de Notificações por Email - Documentação Completa

## 🔧 Configuração Necessária

### 1. Configurar Gmail com Senha de Aplicativo

1. **Acesse sua conta do Google**
2. **Vá para Segurança da Conta**: https://myaccount.google.com/security
3. **Ative a Verificação em Duas Etapas** (se não estiver ativada)
4. **Gere uma Senha de Aplicativo**:
   - Vá em "Senhas de aplicativo"
   - Selecione "Email" e "Outro (nome personalizado)"
   - Digite "Sistema de Agendamento"
   - Copie a senha gerada (16 caracteres)

### 2. Configurar Variáveis de Ambiente

Edite o arquivo `backend/config.env`:

```env
# Configuração de Email SMTP Gmail
SMTP_EMAIL=seu-email@gmail.com
SMTP_PASSWORD=sua-senha-de-aplicativo-de-16-caracteres
```

### 3. Instalar Dependências

```bash
cd backend
npm install
```

## 📋 TODOS OS CASOS DE ENVIO DE EMAIL

### 🔄 **FLUXO DE RESERVAS DE ESPAÇOS**

#### **1. 📝 Criação de Nova Reserva**
**Arquivo:** `backend/pages/api/reservations/index.js` (POST)
**Trigger:** Aluno cria uma nova reserva

**Cenários de Envio:**

##### **1.1. Reserva com Professor Responsável**
- **Para quem:** Professor responsável pelo projeto
- **Quando:** Status inicial = `pending` E projeto tem professor
- **Template:** `newReservationForProfessor`
- **Conteúdo:**
  - Nome do evento
  - Nome do aluno
  - Sala solicitada
  - Data e horário
  - Nome do projeto
  - Descrição (se houver)
  - Mensagem: "Nova reserva pendente que precisa de sua aprovação"

##### **1.2. Reserva sem Professor Responsável**
- **Para quem:** Administrador do sistema
- **Quando:** Status inicial = `pending` E projeto NÃO tem professor
- **Template:** `newReservationForAdmin`
- **Conteúdo:**
  - Nome do evento
  - Nome do aluno
  - Sala solicitada
  - Data e horário
  - Nome do projeto
  - Descrição (se houver)
  - Mensagem: "Nova reserva pendente para aprovação administrativa"

##### **1.3. Reserva Aprovada Automaticamente**
- **Para quem:** Ninguém (não envia email)
- **Quando:** Status inicial = `approved` (admin/coordenador criou)
- **Motivo:** Já está aprovada, não precisa de notificação

#### **2. ✅ Aprovação de Reserva pelo Professor**
**Arquivo:** `backend/pages/api/reservations/approve.js` (POST)
**Trigger:** Professor aprova uma reserva pendente

**Cenários de Envio:**

##### **2.1. Notificação para o Aluno**
- **Para quem:** Aluno que fez a reserva
- **Quando:** Professor aprova (action = 'approve')
- **Template:** `reservationStatusUpdate`
- **Status:** `professor_approved`
- **Conteúdo:**
  - Nome do evento
  - Sala
  - Data e horário
  - Status: "APROVADA PELO PROFESSOR"
  - Mensagem: "Sua reserva foi aprovada pelo professor e enviada para aprovação final"

##### **2.2. Notificação para o Admin**
- **Para quem:** Administrador do sistema
- **Quando:** Professor aprova (action = 'approve')
- **Template:** `newReservationForAdmin`
- **Conteúdo:**
  - Nome do evento
  - Nome do aluno
  - Sala
  - Data e horário
  - Nome do projeto
  - Nome do professor que aprovou
  - Mensagem: "Reserva aprovada pelo professor, precisa de aprovação final"

#### **3. ✅ Aprovação Final pelo Admin**
**Arquivo:** `backend/pages/api/reservations/approve.js` (POST)
**Trigger:** Admin aprova uma reserva `professor_approved`

**Cenário de Envio:**

##### **3.1. Notificação para o Aluno**
- **Para quem:** Aluno que fez a reserva
- **Quando:** Admin aprova (action = 'approve' E status anterior = 'professor_approved')
- **Template:** `reservationStatusUpdate`
- **Status:** `approved`
- **Conteúdo:**
  - Nome do evento
  - Sala
  - Data e horário
  - Status: "APROVADA"
  - Mensagem: "Sua reserva foi confirmada! Você pode usar o espaço no horário agendado"

#### **4. ❌ Rejeição de Reserva**
**Arquivo:** `backend/pages/api/reservations/approve.js` (POST)
**Trigger:** Professor ou Admin rejeita uma reserva

**Cenário de Envio:**

##### **4.1. Notificação para o Aluno**
- **Para quem:** Aluno que fez a reserva
- **Quando:** Professor ou Admin rejeita (action = 'reject')
- **Template:** `reservationStatusUpdate`
- **Status:** `rejected`
- **Conteúdo:**
  - Nome do evento
  - Sala
  - Data e horário
  - Status: "REJEITADA"
  - Motivo da rejeição (se fornecido)
  - Mensagem: "Sua reserva foi rejeitada. Entre em contato com a administração se tiver dúvidas"

### 👥 **FLUXO DE SOLICITAÇÕES DE PROJETO**

#### **5. 📝 Nova Solicitação de Projeto**
**Arquivo:** `backend/pages/api/projects/requests.js` (POST)
**Trigger:** Aluno solicita entrada em um projeto

**Cenário de Envio:**

##### **5.1. Notificação para o Professor**
- **Para quem:** Professor responsável pelo projeto
- **Quando:** Aluno cria solicitação (status = 'pending')
- **Template:** `newProjectRequest`
- **Conteúdo:**
  - Nome do projeto
  - Tipo do projeto
  - Nome do aluno
  - Email do aluno
  - Matrícula do aluno
  - Mensagem do aluno (se houver)
  - Mensagem: "Nova solicitação de entrada em seu projeto"

#### **6. ✅/❌ Processamento da Solicitação**
**Arquivo:** `backend/pages/api/projects/requests.js` (PUT)
**Trigger:** Professor aprova ou rejeita solicitação

**Cenários de Envio:**

##### **6.1. Aprovação da Solicitação**
- **Para quem:** Aluno que fez a solicitação
- **Quando:** Professor aprova (action = 'approved')
- **Template:** `projectRequestStatusUpdate`
- **Status:** `approved`
- **Conteúdo:**
  - Nome do projeto
  - Tipo do projeto
  - Nome do professor
  - Status: "APROVADA"
  - Mensagem: "Parabéns! Você foi aceito no projeto e já pode fazer reservas de espaços"

##### **6.2. Rejeição da Solicitação**
- **Para quem:** Aluno que fez a solicitação
- **Quando:** Professor rejeita (action = 'rejected')
- **Template:** `projectRequestStatusUpdate`
- **Status:** `rejected`
- **Conteúdo:**
  - Nome do projeto
  - Tipo do projeto
  - Nome do professor
  - Status: "REJEITADA"
  - Mensagem: "Sua solicitação foi rejeitada. Entre em contato com o professor se tiver dúvidas"

## 🚫 **CASOS QUE NÃO ENVIAM EMAIL**

### **Reservas:**
- ❌ Admin/Coordenador cria reserva (já aprovada automaticamente)
- ❌ Reserva cancelada pelo próprio usuário
- ❌ Atualização de dados da reserva (sem mudança de status)

### **Projetos:**
- ❌ Criação de projeto
- ❌ Atualização de dados do projeto
- ❌ Remoção de aluno do projeto

### **Usuários:**
- ❌ Criação de conta
- ❌ Login/Logout
- ❌ Atualização de perfil
- ❌ Recuperação de senha

## 📊 **RESUMO DE NOTIFICAÇÕES**

| **Ação** | **Quem Recebe** | **Template** | **Frequência** |
|----------|-----------------|--------------|----------------|
| Nova Reserva (com professor) | Professor | newReservationForProfessor | Sempre |
| Nova Reserva (sem professor) | Admin | newReservationForAdmin | Sempre |
| Professor Aprova | Aluno + Admin | reservationStatusUpdate + newReservationForAdmin | Sempre |
| Admin Aprova Final | Aluno | reservationStatusUpdate | Sempre |
| Reserva Rejeitada | Aluno | reservationStatusUpdate | Sempre |
| Nova Solicitação Projeto | Professor | newProjectRequest | Sempre |
| Solicitação Aprovada | Aluno | projectRequestStatusUpdate | Sempre |
| Solicitação Rejeitada | Aluno | projectRequestStatusUpdate | Sempre |

## 🔍 **DETALHES TÉCNICOS**

### **Arquivos Modificados:**
- `backend/lib/emailService.js` - Serviço principal de email
- `backend/pages/api/reservations/index.js` - Criação de reservas
- `backend/pages/api/reservations/approve.js` - Aprovação/rejeição de reservas
- `backend/pages/api/projects/requests.js` - Solicitações de projeto

### **Tratamento de Erros:**
- ✅ Emails falham silenciosamente (não quebram o sistema)
- ✅ Logs detalhados no console do servidor
- ✅ Operações principais continuam mesmo com erro de email

### **Performance:**
- ✅ Emails enviados de forma assíncrona
- ✅ Não bloqueia resposta da API
- ✅ Timeout configurado para evitar travamentos

## 🎨 **TEMPLATES DE EMAIL**

### **Características dos Templates:**
- ✅ **Design responsivo** com cores e ícones
- ✅ **Informações completas** da reserva/solicitação
- ✅ **Status visual** (aprovado/rejeitado)
- ✅ **Motivos de rejeição** quando aplicável
- ✅ **Instruções claras** para o usuário
- ✅ **Formatação HTML** profissional
- ✅ **Versão texto** para compatibilidade

### **Cores por Status:**
- 🟢 **Aprovado**: Verde (#059669)
- 🔴 **Rejeitado**: Vermelho (#dc2626)
- 🟡 **Pendente**: Amarelo (#d97706)
- 🔵 **Notificação**: Azul (#2563eb)
- 🟣 **Projeto**: Roxo (#7c3aed)

## 🚀 **COMO TESTAR O SISTEMA**

### **Teste 1: Nova Reserva**
1. **Faça login como aluno**
2. **Crie uma nova reserva** para um projeto com professor
3. **Verifique se o professor recebeu o email**
4. **Aprove a reserva como professor**
5. **Verifique se o aluno e admin receberam emails**

### **Teste 2: Solicitação de Projeto**
1. **Faça login como aluno**
2. **Solicite entrada em um projeto**
3. **Verifique se o professor recebeu o email**
4. **Aprove/rejeite como professor**
5. **Verifique se o aluno recebeu o email**

### **Teste 3: Reserva sem Professor**
1. **Crie uma reserva** para projeto sem professor
2. **Verifique se o admin recebeu o email**

## 📋 **EXEMPLOS PRÁTICOS**

### **Exemplo 1: Fluxo Completo de Reserva**
```
1. Aluno João cria reserva "Reunião de Projeto" para sala A1
   → Email enviado para Professor Maria

2. Professor Maria aprova a reserva
   → Email enviado para Aluno João: "Aprovada pelo professor"
   → Email enviado para Admin: "Precisa de aprovação final"

3. Admin aprova a reserva
   → Email enviado para Aluno João: "Reserva confirmada!"
```

### **Exemplo 2: Rejeição de Reserva**
```
1. Aluno Pedro cria reserva "Evento" para sala B2
   → Email enviado para Professor Ana

2. Professor Ana rejeita com motivo "Sala indisponível"
   → Email enviado para Aluno Pedro: "Reserva rejeitada - Sala indisponível"
```

### **Exemplo 3: Solicitação de Projeto**
```
1. Aluno Carlos solicita entrada no "Projeto de IA"
   → Email enviado para Professor Roberto

2. Professor Roberto aprova a solicitação
   → Email enviado para Aluno Carlos: "Aceito no projeto!"
```

## ⚠️ **TROUBLESHOOTING DETALHADO**

### **🔐 Erro de Autenticação**
**Sintomas:**
- Erro: "Invalid login: 535-5.7.8 Username and Password not accepted"
- Log: "Erro ao enviar email: Authentication failed"

**Soluções:**
1. ✅ Verifique se a senha de aplicativo está correta (16 caracteres)
2. ✅ Confirme que a verificação em duas etapas está ativada
3. ✅ Gere uma nova senha de aplicativo
4. ✅ Teste com um email diferente se necessário

### **📧 Emails não chegam**
**Sintomas:**
- Log mostra "Email enviado com sucesso" mas não chega
- Sem erros no console

**Soluções:**
1. ✅ Verifique a pasta de spam/lixo eletrônico
2. ✅ Confirme se o email de destino está correto
3. ✅ Teste enviando para seu próprio email
4. ✅ Verifique se o Gmail não está bloqueando

### **🌐 Erro de Conexão SMTP**
**Sintomas:**
- Erro: "ECONNREFUSED" ou "ETIMEDOUT"
- Log: "Erro ao enviar email: Connection failed"

**Soluções:**
1. ✅ Verifique a conexão com a internet
2. ✅ Confirme se o Gmail não bloqueou o acesso
3. ✅ Teste com outro provedor SMTP se necessário
4. ✅ Verifique firewall/proxy da rede

### **📝 Erro de Template**
**Sintomas:**
- Erro: "Cannot read property of undefined"
- Log: "Erro ao enviar email: Template error"

**Soluções:**
1. ✅ Verifique se todos os dados necessários estão sendo passados
2. ✅ Confirme se as variáveis do template estão corretas
3. ✅ Teste com dados mínimos primeiro

## 📊 **MONITORAMENTO E LOGS**

### **Logs de Sucesso:**
```
✅ Email enviado com sucesso: <messageId@domain.com>
✅ Notificação enviada para professor@email.com
✅ Template: newReservationForProfessor
```

### **Logs de Erro:**
```
❌ Erro ao enviar email: Authentication failed
❌ Erro ao enviar email: Connection timeout
❌ Erro ao enviar email: Template error - missing data
```

### **Como Monitorar:**
1. **Console do servidor** - Logs em tempo real
2. **Arquivo de log** - Se configurado
3. **Dashboard de email** - Gmail/Google Workspace
4. **Testes manuais** - Criar reservas/solicitações

## 🔒 **SEGURANÇA E BOAS PRÁTICAS**

### **Credenciais:**
- ✅ **Senha de aplicativo** em vez de senha principal
- ✅ **Variáveis de ambiente** para credenciais
- ✅ **Nunca commitar** credenciais no código
- ✅ **Rotacionar** senhas periodicamente

### **Tratamento de Erros:**
- ✅ **Falha silenciosa** - não quebra o sistema
- ✅ **Logs detalhados** para debugging
- ✅ **Não exposição** de dados sensíveis
- ✅ **Retry automático** (se implementado)

### **Performance:**
- ✅ **Envio assíncrono** - não bloqueia API
- ✅ **Timeout configurado** - evita travamentos
- ✅ **Queue de emails** - se implementado
- ✅ **Rate limiting** - evita spam

## 📈 **MÉTRICAS E ESTATÍSTICAS**

### **O que Monitorar:**
- 📊 **Taxa de entrega** de emails
- ⏱️ **Tempo de envio** médio
- ❌ **Taxa de erro** por tipo
- 📧 **Volume** de emails por dia
- 👥 **Usuários** que recebem mais notificações

### **Melhorias Futuras:**
- 🔄 **Sistema de retry** para emails falhados
- 📊 **Dashboard** de métricas de email
- 🎯 **Personalização** de templates por usuário
- 📱 **Notificações push** complementares
- 🔔 **Preferências** de notificação por usuário
