# 🔐 Credenciais de Acesso - Claude Code UI

## 📧 Usuários Disponíveis

### 1. Usuário Admin (Novo)
- **Email**: `admin@example.com`
- **Senha**: `admin123`
- ✅ **Recomendado para teste**

### 2. Usuário Guilherme
- **Email**: `guilherme-varela@hotmail.com`
- **Senha**: *(senha original - não conhecida)*

### 3. Usuário Test
- **Email**: `test@test.com`
- **Senha**: *(senha original - não conhecida)*

## 🔄 Como Resetar Senha

Se você esqueceu a senha ou quer criar um novo usuário:

```bash
# Resetar senha de um usuário existente
node reset-user.mjs guilherme-varela@hotmail.com nova-senha-aqui

# Criar novo usuário
node reset-user.mjs novo-email@example.com senha-nova
```

## 🚀 Como Fazer Login

1. Acesse http://localhost:5892
2. Use uma das credenciais acima
3. Se aparecer erro de token inválido, limpe o localStorage do navegador:
   - Abra o DevTools (F12)
   - Application/Storage > Local Storage
   - Clear all

## 🛠️ Resolução de Problemas

### Erro 401 Unauthorized
- Verifique se está usando as credenciais corretas
- Use `admin@example.com` com senha `admin123`
- Ou crie um novo usuário com o script

### Token Invalid
- Limpe o localStorage do navegador
- Faça logout e login novamente

## 📝 Notas

- As senhas são criptografadas com bcrypt (12 rounds)
- O banco de dados está em `server/database/auth.db`
- Você pode gerenciar usuários diretamente via SQLite se preferir
