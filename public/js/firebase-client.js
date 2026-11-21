export * from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
export * from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, runTransaction } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const configured = ['apiKey', 'authDomain', 'projectId', 'appId'].every(key => firebaseConfig[key]);
const app = configured ? initializeApp(firebaseConfig) : null;
export const auth = app && getAuth(app);
export const db = app && getFirestore(app);

export function ensureProfile(user, nome) {
  const ref = doc(db, 'usuarios', user.uid);
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists()) return snapshot.data();

    const profile = {
      uid: user.uid,
      nome: (nome || user.displayName || user.email).trim().slice(0, 120),
      email: user.email,
      perfil: 'user',
    };
    transaction.set(ref, profile);
    return profile;
  });
}

export function errorMessage(error) {
  const messages = {
    'auth/invalid-credential': 'Confira seu e-mail e sua senha.',
    'auth/user-not-found': 'Confira seu e-mail e sua senha.',
    'auth/wrong-password': 'Confira seu e-mail e sua senha.',
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/weak-password': 'Escolha uma senha de pelo menos 6 caracteres.',
    'auth/popup-closed-by-user': 'A janela do Google foi fechada. Tente novamente.',
    'auth/popup-blocked': 'Permita pop-ups neste site para entrar com o Google.',
    'auth/unauthorized-domain': 'Adicione este domínio aos domínios autorizados no Firebase.',
    'auth/operation-not-allowed': 'Habilite este provedor em Firebase Authentication.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.',
    'auth/network-request-failed': 'Confira sua conexão e tente novamente.',
    'permission-denied': 'Você não tem permissão para acessar ou alterar estes dados.',
    unavailable: 'O banco está indisponível. Confira sua conexão e tente novamente.',
    'ticket-already-assigned': 'Este chamado já foi assumido ou removido. Atualize a página.',
  };
  return messages[error.code] || 'Não foi possível concluir a operação. Tente novamente.';
}
