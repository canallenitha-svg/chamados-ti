# HelpDesk TI — Chamados com Firebase

**Aluna** · Lenitha Borges da Silva

**Aplicação no Render** · Pendente de publicação.

**Contas de teste** · Pendentes de criação no projeto Firebase. Preencha os e-mails abaixo após o cadastro e compartilhe as senhas de avaliação em canal privado.

| Perfil | E-mail de teste |
| --- | --- |
| User | A cadastrar |
| Técnico / Analista de TI | A cadastrar |
| Admin | A cadastrar |

## Configurar o Firebase

1. No [Console do Firebase](https://console.firebase.google.com/), crie um projeto e registre um aplicativo Web. Copie o objeto `firebaseConfig` para `public/js/firebase-config.js`.
2. Em **Authentication → Sign-in method**, habilite **E-mail/senha** e **Google**. Informe um e-mail de suporte para o Google.
3. Crie o banco **Cloud Firestore** padrão. Em **Firestore Database → Rules**, cole e publique o conteúdo de `firestore.rules` antes de testar ou publicar o portal.
4. Em **Authentication → Settings → Authorized domains**, adicione `localhost` para testar localmente.
5. Abra o portal, crie uma conta e faça o primeiro acesso. Em **Firestore Database → Data → usuarios**, edite o documento dessa conta e defina `perfil` como `admin`. Use **Gestão de Usuários** para promover outra conta de teste a `tecnico`.

Use a configuração do SDK Web, que é pública. Mantenha chaves de conta de serviço e senhas fora do repositório.

## Rodar localmente

Na raiz do projeto, execute um servidor HTTP para a pasta `public` e abra [http://localhost:3000](http://localhost:3000).

```sh
python -m http.server 3000 --directory public
```

Com Node.js e as dependências instaladas, `npm start` também serve a pasta `public` na porta 3000.

## Permissões

| Perfil | Chamados | Gestão de usuários |
| --- | --- | --- |
| User | Abre chamados e acompanha os próprios | — |
| Técnico | Consulta a fila, assume chamados, registra parecer e atualiza status | — |
| Admin | Abre, consulta, edita, atende e exclui chamados | Lista contas e altera o perfil das outras contas |

O primeiro acesso cria `usuarios/{uid}` com perfil `user`. O Firestore guarda o vínculo com o solicitante em `chamados/{id}.autorUid` e armazena o UID do responsável em `tecnicoResponsavel`. Os status são **Aberto**, **Em Atendimento** e **Resolvido**. A fila técnica inclui resolvidos para consulta e reabertura.

Esta versão usa o portal em `public/` e dados do Firestore. Os registros de exemplo da versão MVC/SQLite não são importados automaticamente. A conta admin em uso fica protegida contra mudança do próprio perfil pelo painel.

## Publicar no Render

1. Faça commit da configuração Web do Firebase e envie a versão ao GitHub.
2. No [Render](https://dashboard.render.com/), crie um **Static Site** para o repositório e selecione a branch `main`.
3. Configure **Publish Directory** como `public`. Deixe **Build Command** vazio ou use `true` se o painel exigir um comando.
4. Quando o deploy terminar, copie o endereço HTTPS para o topo deste README. Em **Firebase Authentication → Settings → Authorized domains**, adicione o hostname do Render, sem `https://`.
5. Preencha no topo os três e-mails de teste e valide a URL do Render.

## Roteiro de validação

| Fluxo | Resultado esperado |
| --- | --- |
| Acesso sem sessão a `index.html` | Redireciona para login |
| Cadastro por e-mail e primeiro login pelo Google | Cria um perfil `user` por UID |
| Login novamente depois de uma promoção | Mantém o perfil atribuído |
| Dois solicitantes abrem chamados | Cada um visualiza apenas os seus, com status **Aberto** e sem responsável |
| Técnico assume e salva parecer | Vincula o UID, salva parecer e permite alterar para **Resolvido** |
| Admin edita, exclui e promove outra conta | Mudanças persistem e o novo perfil passa a controlar o acesso |
| Logout | Encerra a sessão e volta à tela de login |
