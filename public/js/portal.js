import {
  auth, db, ensureProfile, errorMessage, onAuthStateChanged, signOut, addDoc,
  collection, deleteDoc, doc, onSnapshot, query, runTransaction, serverTimestamp,
  updateDoc, where,
} from './firebase-client.js';

const byId = id => document.getElementById(id);
const feedback = byId('feedback');
const ticketForm = byId('ticket-form');
const search = byId('search');
const filter = byId('filter');
const roles = { user: 'User', tecnico: 'Técnico / Analista de TI', admin: 'Admin' };
const priorities = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
const statuses = ['Aberto', 'Em Atendimento', 'Resolvido'];
let activeTickets = [];
let unsubscribeProfile;
let unsubscribeTickets;
let unsubscribeUsers;
let sessionNumber = 0;

function options(select, entries, current) {
  select.replaceChildren(...entries.map(([value, label]) => new Option(label, value, false, value === current)));
}

function report(error) {
  feedback.textContent = errorMessage(error);
}

async function action(button, operation, message) {
  button.disabled = true;
  try {
    await operation();
    feedback.textContent = message;
  } catch (error) {
    report(error);
  } finally {
    button.disabled = false;
  }
}

function details(form) {
  const values = new FormData(form);
  const titulo = values.get('titulo').trim();
  const descricao = values.get('descricao').trim();
  if (titulo.length < 3 || !descricao) return null;

  return {
    titulo,
    descricao,
    setor: values.get('setor').trim(),
    prioridade: values.get('prioridade'),
    atualizadoEm: serverTimestamp(),
  };
}

function saveDetails(event, operation, message) {
  event.preventDefault();
  const values = details(event.currentTarget);
  if (!values) {
    feedback.textContent = 'Informe um título de pelo menos 3 caracteres e descreva o problema.';
    return;
  }
  void action(event.submitter ?? event.currentTarget.querySelector('button'), () => operation(values), message);
}

function renderTicket(ticket, profile) {
  const card = byId('ticket-template').content.firstElementChild.cloneNode(true);
  const find = selector => card.querySelector(selector);
  const ref = doc(db, 'chamados', ticket.id);
  find('[data-title]').textContent = ticket.titulo;
  find('[data-status]').textContent = ticket.status;
  find('[data-description]').textContent = ticket.descricao;
  find('[data-author]').textContent = `Solicitante: ${ticket.autorNome} (${ticket.autorEmail})`;
  const date = ticket.criadoEm?.toDate().toLocaleString('pt-BR');
  find('[data-details]').textContent = [
    `Prioridade: ${priorities[ticket.prioridade]}`, ticket.setor, date,
  ].filter(Boolean).join(' · ');
  const assigned = ticket.tecnicoResponsavel === profile.uid ? 'você' : 'equipe de TI';
  find('[data-service]').textContent = [
    ticket.tecnicoResponsavel ? `Responsável: ${assigned}` : 'Sem responsável',
    ticket.parecerTecnico && `Parecer: ${ticket.parecerTecnico}`,
  ].filter(Boolean).join('\n');

  if (profile.perfil === 'tecnico' || profile.perfil === 'admin') {
    const attendance = find('[data-attendance]');
    attendance.hidden = false;
    options(attendance.elements.status, statuses.map(status => [status, status]), ticket.status);
    attendance.elements.parecer.value = ticket.parecerTecnico;
    const claim = find('[data-claim]');
    claim.hidden = Boolean(ticket.tecnicoResponsavel);
    claim.addEventListener('click', () => void action(claim, () => runTransaction(db, async transaction => {
      const current = await transaction.get(ref);
      if (!current.exists() || current.data().tecnicoResponsavel) {
        const error = new Error('Chamado indisponível para assumir.');
        error.code = 'ticket-already-assigned';
        throw error;
      }
      const status = current.data().status;
      transaction.update(ref, {
        tecnicoResponsavel: profile.uid,
        status: status === 'Aberto' ? 'Em Atendimento' : status,
        atualizadoEm: serverTimestamp(),
      });
    }), 'Chamado assumido.'));

    attendance.addEventListener('submit', event => {
      event.preventDefault();
      const status = attendance.elements.status.value;
      const parecerTecnico = attendance.elements.parecer.value.trim();
      const submit = attendance.querySelector('[type=submit], button:not([type])');
      void action(submit, () => runTransaction(db, async transaction => {
        const current = await transaction.get(ref);
        if (!current.exists()) throw new Error('Chamado removido.');
        transaction.update(ref, {
          status,
          parecerTecnico,
          tecnicoResponsavel: current.data().tecnicoResponsavel || profile.uid,
          atualizadoEm: serverTimestamp(),
        });
      }), 'Atendimento salvo.');
    });
  }

  if (profile.perfil === 'admin') {
    const edit = find('[data-edit]');
    edit.hidden = false;
    const form = edit.querySelector('form');
    for (const name of ['titulo', 'descricao', 'setor']) form.elements[name].value = ticket[name];
    options(form.elements.prioridade, Object.entries(priorities), ticket.prioridade);
    form.addEventListener('submit', event => saveDetails(event, values => updateDoc(ref, values), 'Chamado atualizado.'));

    const remove = find('[data-delete]');
    remove.hidden = false;
    remove.addEventListener('click', () => {
      if (confirm('Excluir este chamado permanentemente?')) {
        void action(remove, () => deleteDoc(ref), 'Chamado excluído.');
      }
    });
  }

  return card;
}

function renderTickets(profile) {
  const text = search.value.trim().toLocaleLowerCase('pt-BR');
  const visible = activeTickets.filter(ticket =>
    (!filter.value || ticket.status === filter.value) &&
    `${ticket.titulo} ${ticket.autorNome}`.toLocaleLowerCase('pt-BR').includes(text)
  );
  byId('summary').textContent = statuses.map(status =>
    `${status}: ${activeTickets.filter(ticket => ticket.status === status).length}`
  ).join(' · ');
  byId('tickets').replaceChildren(...visible.map(ticket => renderTicket(ticket, profile)));
  if (visible.length === 0) byId('tickets').textContent = 'Nenhum chamado encontrado.';
}

function renderUsers(snapshot, profile) {
  const rows = snapshot.docs.map(item => {
    const account = item.data();
    const row = document.createElement('form');
    const label = document.createElement('label');
    label.textContent = `${account.nome} (${account.email})`;
    if (item.id === profile.uid) {
      label.textContent += ' · Você (Admin)';
      row.append(label);
      return row;
    }

    const select = document.createElement('select');
    options(select, Object.entries(roles), account.perfil);
    label.append(select);
    const save = document.createElement('button');
    save.className = 'btn btn-secondary';
    save.textContent = 'Salvar perfil';
    row.append(label, save);
    row.addEventListener('submit', event => {
      event.preventDefault();
      void action(save, () => updateDoc(item.ref, { perfil: select.value }), 'Perfil atualizado.');
    });
    return row;
  });
  byId('users').replaceChildren(...rows);
}

function clearWorkspace() {
  unsubscribeTickets?.();
  unsubscribeUsers?.();
  activeTickets = [];
  byId('tickets').replaceChildren();
  byId('users').replaceChildren();
  search.oninput = filter.onchange = ticketForm.onsubmit = null;
  for (const id of ['new-ticket', 'ticket-section', 'user-management']) byId(id).hidden = true;
}

function openWorkspace(profile, user) {
  const isAdmin = profile.perfil === 'admin';
  const isRequester = profile.perfil === 'user';
  byId('identity').textContent = `${profile.nome} (${user.email})`;
  byId('role').textContent = roles[profile.perfil];
  byId('ticket-heading').textContent = isRequester ? 'Meus chamados' : 'Fila de chamados';
  byId('new-ticket').hidden = !(isRequester || isAdmin);
  byId('ticket-section').hidden = false;
  byId('user-management').hidden = !isAdmin;
  byId('summary').textContent = '';
  byId('tickets').textContent = 'Carregando chamados…';

  const tickets = collection(db, 'chamados');
  const visibleTickets = isRequester ? query(tickets, where('autorUid', '==', user.uid)) : tickets;
  unsubscribeTickets = onSnapshot(visibleTickets, snapshot => {
    activeTickets = snapshot.docs.map(item => ({ ...item.data(), id: item.id }));
    activeTickets.sort((a, b) => (b.criadoEm?.toMillis() ?? 0) - (a.criadoEm?.toMillis() ?? 0));
    renderTickets(profile);
  }, error => {
    byId('tickets').replaceChildren();
    byId('summary').textContent = '';
    report(error);
  });

  search.oninput = filter.onchange = () => renderTickets(profile);
  if (isRequester || isAdmin) {
    ticketForm.onsubmit = event => saveDetails(event, async values => {
      await addDoc(tickets, {
        ...values,
        autorUid: user.uid,
        autorNome: user.displayName || profile.nome,
        autorEmail: user.email,
        status: 'Aberto',
        tecnicoResponsavel: null,
        parecerTecnico: '',
        criadoEm: serverTimestamp(),
      });
      ticketForm.reset();
    }, 'Chamado aberto com sucesso.');
  }

  if (isAdmin) {
    byId('users').textContent = 'Carregando usuários…';
    unsubscribeUsers = onSnapshot(collection(db, 'usuarios'), snapshot => renderUsers(snapshot, profile), error => {
      byId('users').replaceChildren();
      report(error);
    });
  }
}

options(ticketForm.elements.prioridade, Object.entries(priorities), 'media');
options(filter, [['', 'Todos'], ...statuses.map(status => [status, status])], '');

if (!auth) {
  location.replace('./login.html');
} else {
  const logout = byId('logout');
  logout.onclick = () => void action(logout, () => signOut(auth), 'Sessão encerrada.');
  onAuthStateChanged(auth, async user => {
    const currentSession = ++sessionNumber;
    unsubscribeProfile?.();
    clearWorkspace();
    if (!user) {
      location.replace('./login.html');
      return;
    }

    byId('session').hidden = false;
    byId('identity').textContent = user.email;
    byId('role').textContent = '';
    try {
      await ensureProfile(user);
      if (currentSession !== sessionNumber) return;
      unsubscribeProfile = onSnapshot(doc(db, 'usuarios', user.uid), snapshot => {
        clearWorkspace();
        const profile = snapshot.data();
        if (!profile || !Object.hasOwn(roles, profile.perfil)) {
          feedback.textContent = 'Perfil indisponível. Entre novamente ou procure um administrador.';
          return;
        }
        feedback.textContent = '';
        openWorkspace(profile, user);
      }, error => {
        clearWorkspace();
        report(error);
      });
    } catch (error) {
      if (currentSession === sessionNumber) report(error);
    }
  });
}
