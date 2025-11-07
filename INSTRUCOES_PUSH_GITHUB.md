# 🔧 Instruções para Fazer Push para o GitHub

## 🐛 Problema: Erro 403 (Permission Denied)

O erro ocorre porque você precisa estar autenticado no GitHub ou ter permissão no repositório.

## ✅ Soluções

### Opção 1: Usar GitHub CLI (Recomendado)

1. Instale o GitHub CLI se ainda não tiver:
   ```bash
   winget install GitHub.cli
   ```

2. Autentique-se:
   ```bash
   gh auth login
   ```

3. Faça o push:
   ```bash
   git push -u origin main
   ```

### Opção 2: Usar Token de Acesso Pessoal

1. Crie um token no GitHub:
   - Acesse: https://github.com/settings/tokens
   - Clique em **Generate new token (classic)**
   - Selecione escopos: `repo` (acesso completo a repositórios)
   - Copie o token gerado

2. Use o token no push:
   ```bash
   git push https://SEU_TOKEN@github.com/sistemasufcrussas/sistemadeagenddamentodesalas.git main
   ```

   Ou configure a URL remota com o token:
   ```bash
   git remote set-url origin https://SEU_TOKEN@github.com/sistemasufcrussas/sistemadeagenddamentodesalas.git
   git push -u origin main
   ```

### Opção 3: Verificar Permissões na Organização

1. Certifique-se de que você tem permissão de escrita no repositório
2. Se o repositório pertence à organização `sistemasufcrussas`, você precisa ser membro ou ter permissão de escrita

### Opção 4: Usar SSH (Mais Seguro)

1. Configure uma chave SSH no GitHub
2. Altere a URL remota:
   ```bash
   git remote set-url origin git@github.com:sistemasufcrussas/sistemadeagenddamentodesalas.git
   git push -u origin main
   ```

## 🔍 Verificar Status

```bash
git remote -v
git status
```

## 📝 Após o Push Bem-Sucedido

Depois de fazer o push, você pode:

1. **Deploy no Render**:
   - Conecte o repositório GitHub no Render
   - Configure as variáveis de ambiente
   - Faça o deploy

2. **Verificar no GitHub**:
   - Acesse: https://github.com/sistemasufcrussas/sistemadeagenddamentodesalas
   - Deve aparecer todos os arquivos do backend

