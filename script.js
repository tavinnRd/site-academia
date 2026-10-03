/* ===== 1. CONEXÃO COM O SUPABASE =====
   Cole aqui os dois valores do seu projeto (Project Settings > API). */
const SUPABASE_URL = 'https://iplbjdpoefdvutnjtyjf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwbGJqZHBvZWZkdnV0bmp0eWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNDMyNzMsImV4cCI6MjEwNjYxOTI3M30.wAahVYUSVeZmYo7nsIyJpfgdKlbELOTi5QgH0I1IMEY';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const erro = r => { if (r.error) { alert('Erro: ' + r.error.message); return true; } return false; };

let perfil = null;     // dados do usuário logado (vem da tabela perfis)
let alunoSel = null;   // aluno escolhido no painel do professor

/* ===== DICAS (guia de treino) ===== */
const DICAS = [
  ['🔥', 'Aquecimento', 'Antes de treinar, faça de 5 a 10 minutos de movimentos leves, como caminhada, bicicleta suave e giros de ombros e quadril. Isso prepara as articulações e o corpo para o esforço.'],
  ['❤️', 'Cardio', 'Esteira, bicicleta, elíptico ou spinning. Comece em um ritmo em que ainda consiga conversar e aumente o tempo e a intensidade aos poucos, conforme seu professor orientar.'],
  ['🧘', 'Alongamento', 'Faça depois do treino. Segure cada posição por cerca de 20 a 30 segundos, respirando com calma. Deve haver leve tensão, nunca dor.'],
  ['🔄', 'Mobilidade', 'Movimentos lentos e controlados de quadril, ombros e coluna ajudam a ganhar amplitude e a executar melhor os exercícios.'],
  ['💧', 'Descanso e hidratação', 'Beba água ao longo do treino, durma bem e respeite os dias de descanso. É no descanso que o corpo se recupera e evolui.'],
  ['🎯', 'Técnica e postura', 'Priorize a execução correta antes de aumentar a carga. Se tiver dúvida em algum aparelho, peça ajuda ao professor.']
];
function renderDicas() {
  const html = `<div class="dicas">${DICAS.map(([i, t, d]) => `<details class="dica"><summary><span>${i}</span>${t}</summary><p>${d}</p></details>`).join('')}</div>
    <p class="aviso">Dicas gerais, que não substituem a orientação do professor. Sentiu dor durante o exercício? Pare e procure ajuda.</p>`;
  $('#guia-lista').outerHTML = `<div id="guia-lista">${html}</div>`;
  $('#aluno-dicas').innerHTML = `<div class="cartao"><h2>Guia rápido de treino</h2><br>${html}</div>`;
}

/* ===== 2. SESSÃO E PERMISSÃO =====
   O login é feito pelo Supabase (senha com hash no servidor).
   Quem realmente protege os dados é o RLS; aqui só escolhemos o que mostrar. */
async function mostrarTela() {
  const { data } = await sb.auth.getSession();
  perfil = null;
  if (data.session) {
    const r = await sb.from('perfis').select('*').eq('id', data.session.user.id).single();
    perfil = r.data;
  }
  $('#auth').hidden = !!perfil;
  $('#site').hidden = !!perfil;
  document.body.classList.toggle('logado', !!perfil);
  $('#banner').hidden = !perfil;
  $('#menu-site').hidden = !!perfil;
  $('#usuario').hidden = !perfil;
  $('#area-aluno').hidden = !(perfil && perfil.papel === 'aluno');
  $('#area-prof').hidden = !(perfil && perfil.papel === 'professor');
  if (!perfil) return;
  $('#nome-usuario').innerHTML = `<span class="avatar">${esc(perfil.nome.trim()[0].toUpperCase())}</span>${esc(perfil.nome.split(' ')[0])}`;
  perfil.papel === 'aluno' ? renderAluno() : renderProf();
}

/* ===== 3. LOGIN E CADASTRO ===== */
$$('[data-ir]').forEach(b => b.onclick = () => {
  $('#tela-login').hidden = b.dataset.ir !== 'login';
  $('#tela-cadastro').hidden = b.dataset.ir !== 'cadastro';
  $('#msg').textContent = '';
});

$('#form-login').onsubmit = async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const { error } = await sb.auth.signInWithPassword({ email: f.get('email').trim(), password: f.get('senha') });
  if (error) return $('#msg').textContent = 'E-mail ou senha incorretos.';
  $('#msg').textContent = ''; e.target.reset(); mostrarTela();
};

$('#form-cadastro').onsubmit = async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const { data, error } = await sb.auth.signUp({
    email: f.get('email').trim(), password: f.get('senha'),
    options: { data: { nome: f.get('nome').trim() } }   // vira o nome em "perfis" pelo gatilho do SQL
  });
  if (error) return $('#msg').textContent = 'Não foi possível criar a conta: ' + error.message;
  if (!data.session) return $('#msg').textContent = 'Conta criada! Confirme pelo e-mail que enviamos e depois entre.';
  e.target.reset(); mostrarTela();
};

$('#sair').onclick = async () => { await sb.auth.signOut(); mostrarTela(); };

function abas(area) {
  $$(area + ' .aba').forEach(b => b.onclick = () => {
    $$(area + ' .aba').forEach(x => x.classList.toggle('ativa', x === b));
    $$(area + ' .painel').forEach(p => p.hidden = p.id !== b.dataset.painel);
  });
}
abas('#area-aluno'); abas('#area-prof');

const calc = ex => { const feitos = ex.filter(x => x.feito).length; return { feitos, total: ex.length, pct: ex.length ? Math.round(feitos / ex.length * 100) : 0 }; };

/* ===== AJUDANTES DA ÁREA LOGADA ===== */
function banner(html) { const b = $('#banner'); b.hidden = false; b.innerHTML = `<div class="banner-in">${html}</div>`; }
function ligarAtalhos() { $$('[data-vai]').forEach(b => b.onclick = () => $(`[data-painel=${b.dataset.vai}]`).click()); }

/* ===== 4. ÁREA DO ALUNO ===== */
async function renderAluno() {
  const ex = (await sb.from('exercicios').select('*').eq('aluno_id', perfil.id).order('nome')).data || [];
  const p = calc(ex), nome = esc(perfil.nome.split(' ')[0]);
  banner(`<div><small>Bem-vindo(a) de volta</small><h2>Olá, ${nome}!</h2>
    <p>${p.total ? `${p.feitos} de ${p.total} exercícios concluídos` : 'Seu treino ainda não foi cadastrado'}</p></div>
    <div class="anel" style="--p:${p.pct}"><b>${p.pct}%</b></div>`);
  $('#aluno-inicio').innerHTML = `<div class="atalhos">
    <button class="atalho" data-vai="aluno-treino"><span>🏋️</span><b>Meu treino</b><small>${p.total ? `${p.total - p.feitos} exercícios restantes` : 'Aguardando o professor'}</small></button>
    <button class="atalho" data-vai="aluno-horarios"><span>🕐</span><b>Horários</b><small>Aulas e funcionamento</small></button>
    <button class="atalho" data-vai="aluno-dicas"><span>💡</span><b>Dicas</b><small>Cardio, alongamento e mais</small></button>
    <a class="atalho" href="https://wa.me/5519997045058" target="_blank" rel="noopener"><span>💬</span><b>WhatsApp</b><small>Fale com a academia</small></a></div>`;
  $('#aluno-treino').innerHTML = `<div class="cartao">
    <h2>Treino de hoje</h2>
    <div class="barra"><div style="width:${p.pct}%"></div></div>
    ${ex.length ? ex.map(x => `<label class="exercicio ${x.feito ? 'feito' : ''}">
      <input type="checkbox" data-id="${x.id}" ${x.feito ? 'checked' : ''}>
      <span class="info"><span class="nome">${esc(x.nome)}</span><br><span class="chip">${x.series} séries</span><span class="chip">${x.reps} repetições</span></span></label>`).join('')
      : '<p class="vazio">Seu professor ainda não cadastrou seu treino.</p>'}
  </div>`;
  $$('#aluno-treino input[type=checkbox]').forEach(c => c.onchange = async () => {
    if (!erro(await sb.from('exercicios').update({ feito: c.checked }).eq('id', c.dataset.id))) renderAluno();
  });
  const hs = (await sb.from('horarios').select('*')).data || [];
  $('#aluno-horarios').innerHTML = `<div class="cartao"><h2>Horários</h2>${hs.length
    ? hs.map(h => `<div class="horario"><span><b>${esc(h.atividade)}</b><br><small>${esc(h.dia)}</small></span><span class="chip">${esc(h.hora)}</span></div>`).join('')
    : '<p class="vazio">Horários ainda não cadastrados.</p>'}</div>`;
  ligarAtalhos();
}

/* ===== 5. PAINEL DO PROFESSOR ===== */
async function renderProf() {
  if (perfil?.papel !== 'professor') return;
  const alunos = (await sb.from('perfis').select('*').eq('papel', 'aluno').order('nome')).data || [];
  const todos = (await sb.from('exercicios').select('*').order('nome')).data || [];
  if (!alunos.find(a => a.id === alunoSel)) alunoSel = alunos[0]?.id || null;

  const media = alunos.length ? Math.round(alunos.reduce((t, a) => t + calc(todos.filter(x => x.aluno_id === a.id)).pct, 0) / alunos.length) : 0;
  banner(`<div><small>Painel do professor</small><h2>Olá, ${esc(perfil.nome.split(' ')[0])}!</h2><p>Acompanhe seus alunos e monte os treinos.</p></div>`);
  $('#prof-resumo').innerHTML = `<div class="numeros"><div class="num"><b>${alunos.length}</b><span>alunos</span></div>
    <div class="num"><b>${todos.length}</b><span>exercícios</span></div><div class="num"><b>${media}%</b><span>progresso médio</span></div></div>
    <div class="atalhos"><button class="atalho" data-vai="prof-treino"><span>📋</span><b>Cadastrar treino</b><small>Monte a ficha de um aluno</small></button>
    <button class="atalho" data-vai="prof-alunos"><span>👥</span><b>Ver alunos</b><small>Acompanhe o progresso</small></button></div>`;
  ligarAtalhos();

  $('#prof-alunos').innerHTML = `<div class="cartao"><h2>Alunos (${alunos.length})</h2>
    ${alunos.length ? alunos.map(a => { const p = calc(todos.filter(x => x.aluno_id === a.id)); return `<div class="exercicio">
      <span class="info"><b>${esc(a.nome)}</b><br><small>${p.feitos}/${p.total} feitos</small>
      <div class="barra"><div style="width:${p.pct}%"></div></div></span>
      <button class="btn mini" data-gerenciar="${a.id}">Treino</button></div>`; }).join('')
      : '<p class="vazio">Nenhum aluno cadastrado ainda.</p>'}</div>`;
  $$('[data-gerenciar]').forEach(b => b.onclick = async () => {
    alunoSel = b.dataset.gerenciar; await renderProf(); $('[data-painel=prof-treino]').click();
  });

  if (!alunos.length) return $('#prof-treino').innerHTML = '<p class="vazio">Cadastre um aluno primeiro (aba Criar conta).</p>';
  const ex = todos.filter(x => x.aluno_id === alunoSel);
  $('#prof-treino').innerHTML = `<div class="cartao"><h2>Cadastrar treino</h2>
    <label>Aluno<select id="sel-aluno">${alunos.map(a => `<option value="${a.id}" ${a.id === alunoSel ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}</select></label>
    <form id="form-ex" class="grade" style="margin-top:12px">
      <label>Exercício<input name="nome" required></label>
      <label>Séries<input name="series" type="number" min="1" value="3" required></label>
      <label>Reps<input name="reps" type="number" min="1" value="12" required></label>
      <button class="btn">Adicionar</button></form></div>
    <div class="cartao">${ex.length ? ex.map(x => `<div class="exercicio"><span class="info"><b>${esc(x.nome)}</b><br><span class="chip">${x.series} séries</span><span class="chip">${x.reps} reps</span></span>
      <span class="acoes"><button class="btn btn-sec mini" data-edit="${x.id}">Editar</button><button class="btn btn-sec mini" data-del="${x.id}">Excluir</button></span></div>`).join('')
      : '<p class="vazio">Este aluno ainda não tem exercícios.</p>'}</div>`;

  $('#sel-aluno').onchange = e => { alunoSel = e.target.value; renderProf(); };
  $('#form-ex').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target);
    const r = await sb.from('exercicios').insert({ aluno_id: alunoSel, nome: f.get('nome').trim(), series: +f.get('series'), reps: +f.get('reps') });
    if (!erro(r)) renderProf();
  };
  $$('[data-del]').forEach(b => b.onclick = async () => { if (!erro(await sb.from('exercicios').delete().eq('id', b.dataset.del))) renderProf(); });
  $$('[data-edit]').forEach(b => b.onclick = async () => {
    const x = todos.find(r => r.id === b.dataset.edit);
    const nome = prompt('Nome do exercício:', x.nome); if (nome === null) return;
    const series = prompt('Séries:', x.series); if (series === null) return;
    const reps = prompt('Repetições:', x.reps); if (reps === null) return;
    const r = await sb.from('exercicios').update({ nome: nome.trim() || x.nome, series: +series || x.series, reps: +reps || x.reps }).eq('id', x.id);
    if (!erro(r)) renderProf();
  });
}

renderDicas();
mostrarTela();
