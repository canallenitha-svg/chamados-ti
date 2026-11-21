import {
  auth, ensureProfile, errorMessage, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, updateProfile,
} from './firebase-client.js';

const form = document.querySelector('#login-form');
const feedback = document.querySelector('#feedback');
const register = document.querySelector('#register');
const google = document.querySelector('#google');
const buttons = document.querySelectorAll('button');
let busy = false;

function enableActions(enabled) {
  for (const button of buttons) button.disabled = !enabled;
}

async function complete(user, name) {
  await ensureProfile(user, name);
  location.replace('./index.html');
}

async function login(action) {
  busy = true;
  enableActions(false);
  feedback.textContent = 'Aguarde…';
  try {
    await action();
  } catch (error) {
    feedback.textContent = errorMessage(error);
    enableActions(true);
  } finally {
    busy = false;
  }
}

if (!auth) {
  feedback.textContent = 'Preencha a configuração do Firebase em js/firebase-config.js.';
} else {
  onAuthStateChanged(auth, user => {
    if (busy) return;
    if (user) {
      void login(() => complete(user));
      return;
    }
    feedback.textContent = '';
    enableActions(true);
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    void login(async () => {
      const { user } = await signInWithEmailAndPassword(auth, form.elements.email.value.trim(), form.elements.senha.value);
      await complete(user);
    });
  });

  register.addEventListener('click', () => {
    if (!form.reportValidity()) return;
    const name = form.elements.nome.value.trim();
    const password = form.elements.senha.value;
    if (!name || password.length < 6) {
      feedback.textContent = 'Informe seu nome e escolha uma senha de pelo menos 6 caracteres.';
      return;
    }

    void login(async () => {
      const { user } = await createUserWithEmailAndPassword(auth, form.elements.email.value.trim(), password);
      // O nome no Firestore fica disponível mesmo se a atualização do displayName falhar.
      await ensureProfile(user, name);
      await updateProfile(user, { displayName: name }).catch(console.warn);
      location.replace('./index.html');
    });
  });

  google.addEventListener('click', () => {
    void login(async () => {
      const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
      await complete(user);
    });
  });
}
