// ======================================================
//  BOOM! — Lógica do jogo + Editor + Configurações
// ======================================================

// ---------- CONFIGURAÇÕES ----------
const CONFIG_PADRAO = {
  TEMPO_POR_BOMBA: 30,
  PONTOS_ACERTO: 10,
  BONUS_MAX: 5,
  ALTERNAR_TURNOS: true,
};

const CONFIG = { ...CONFIG_PADRAO };

function carregarConfig() {
  try {
    const raw = localStorage.getItem('boom_config_v1');
    if (raw) Object.assign(CONFIG, JSON.parse(raw));
  } catch (e) {}
}
function salvarConfig() {
  localStorage.setItem('boom_config_v1', JSON.stringify(CONFIG));
}

// ---------- CORES PADRÃO DAS EQUIPES ----------
const CORES_PADRAO = ['#ff6b35', '#3b82f6', '#22c55e', '#a855f7'];

// ---------- CHAVES DE STORAGE ----------
const CHAVES = { PERGUNTAS: 'boom_perguntas_v1' };

// ---------- HELPERS ----------
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function embaralhar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mostrarTela(id) {
  $$('.tela').forEach(t => t.classList.remove('ativa'));
  $('#' + id).classList.add('ativa');
  window.scrollTo(0, 0);
}

function toast(msg, tipo = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast mostrar ' + tipo;
  clearTimeout(t._id);
  t._id = setTimeout(() => t.classList.remove('mostrar'), 1800);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ======================================================
//  PERGUNTAS — carregar / salvar
// ======================================================
function carregarPerguntas() {
  try {
    const raw = localStorage.getItem(CHAVES.PERGUNTAS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch (e) {}
  const padrao = window.BANCO_PADRAO || [];
  salvarPerguntas(padrao);
  return [...padrao];
}
function salvarPerguntas(arr) {
  localStorage.setItem(CHAVES.PERGUNTAS, JSON.stringify(arr));
}
function atualizarInfoPerguntas() {
  const total = carregarPerguntas().length;
  $('#info-total-perguntas').textContent =
    `${total} pergunta${total === 1 ? '' : 's'} carregada${total === 1 ? '' : 's'}`;
}

// ======================================================
//  ESTADO DO JOGO
// ======================================================
const estado = {
  modo: null,
  mortesubita: false,
  alternar: true,
  equipes: [],
  equipeAtual: 0,
  fila: [],
  bombaAtual: 0,
  totalBombas: 0,
  tempoRestante: 0,
  timerId: null,
  respondido: false,
  ultimoTick: -1,
  pausado: false,
  configuracoesIniciais: null, // para "reiniciar"
};

// ======================================================
//  NAVEGAÇÃO
// ======================================================
document.addEventListener('click', (e) => {
  const alvo = e.target.closest('[data-modo],[data-tela],[data-voltar]');
  if (!alvo) return;

  if (alvo.matches('[data-modo]')) {
    const modo = alvo.dataset.modo;
    if (modo === 'solo') {
      mostrarTela('tela-config-solo');
    } else {
      montarFormularioEquipes();
      mostrarTela('tela-config-equipes');
    }
  }
  if (alvo.matches('[data-tela]')) {
    const destino = alvo.dataset.tela;
    if (destino === 'tela-editor') abrirEditor();
    else if (destino === 'tela-config-global') abrirConfig();
    else mostrarTela(destino);
  }
  if (alvo.matches('[data-voltar]')) {
    if ($('#tela-editor').classList.contains('ativa')) atualizarInfoPerguntas();
    mostrarTela('tela-inicio');
  }
});

// ======================================================
//  FORMULÁRIO EQUIPES (nome + cor)
// ======================================================
function montarFormularioEquipes() {
  const num = parseInt($('#select-num-equipes').value, 10);
  const container = $('#lista-nomes-equipes');

  // Salva estado atual
  const atuais = [...container.querySelectorAll('.equipe-linha')].map(l => ({
    nome: l.querySelector('.input-nome-equipe').value,
    cor: l.querySelector('.input-cor-equipe').value,
  }));

  const nomesPadrao = ['Vermelha', 'Azul', 'Verde', 'Roxa'];
  container.innerHTML = '';

  for (let i = 0; i < num; i++) {
    const dados = atuais[i] || {
      nome: `Equipe ${nomesPadrao[i] || (i + 1)}`,
      cor: CORES_PADRAO[i] || '#888888',
    };
    const linha = document.createElement('div');
    linha.className = 'equipe-linha';
    linha.innerHTML = `
      <span class="numero">${i + 1}</span>
      <input type="text" class="input-nome-equipe" maxlength="20" value="${escapeHtml(dados.nome)}" />
      <input type="color" class="input-cor-equipe" value="${dados.cor}" />
    `;
    container.appendChild(linha);
  }
}
$('#select-num-equipes').addEventListener('change', montarFormularioEquipes);

// ======================================================
//  INICIAR JOGO
// ======================================================
$('#btn-iniciar-solo').addEventListener('click', () => {
  const nome = $('#input-nome-solo').value.trim() || 'Jogador';
  const qtd = parseInt($('#select-bombas-solo').value, 10);
  const mortesubita = $('#check-morte-solo').checked;
  iniciarJogo(
    'solo',
    [{ nome, pontos: 0, eliminada: false, cor: CORES_PADRAO[0] }],
    qtd,
    mortesubita,
    false
  );
});

$('#btn-iniciar-equipes').addEventListener('click', () => {
  const linhas = [...$('#lista-nomes-equipes').querySelectorAll('.equipe-linha')];
  const equipes = linhas.map((l, i) => ({
    nome: l.querySelector('.input-nome-equipe').value.trim() || `Equipe ${i + 1}`,
    cor: l.querySelector('.input-cor-equipe').value,
    pontos: 0,
    eliminada: false,
  }));

  // Verifica nomes duplicados
  const nomes = equipes.map(e => e.nome.toLowerCase());
  if (new Set(nomes).size !== nomes.length) {
    toast('Cada equipe precisa de um nome único!', 'erro');
    return;
  }

  const porEquipe = parseInt($('#select-bombas-equipe').value, 10);
  const mortesubita = $('#check-morte-equipes').checked;
  const alternar = $('#check-alternar').checked;

  iniciarJogo('equipes', equipes, porEquipe * equipes.length, mortesubita, alternar);
});

function iniciarJogo(modo, equipes, totalBombas, mortesubita, alternar) {
  const banco = carregarPerguntas();
  if (banco.length < 4) {
    toast('Adicione pelo menos 4 perguntas no editor!', 'erro');
    return;
  }

  estado.modo = modo;
  estado.mortesubita = mortesubita;
  estado.alternar = alternar;
  estado.equipes = equipes;
  estado.equipeAtual = 0;
  estado.bombaAtual = 0;
  estado.totalBombas = Math.min(totalBombas, banco.length);
  estado.fila = embaralhar(banco).slice(0, estado.totalBombas);
  estado.respondido = false;
  estado.pausado = false;

  // Guarda config para "reiniciar"
  estado.configuracoesIniciais = {
    modo,
    equipes: equipes.map(e => ({ ...e, pontos: 0, eliminada: false })),
    totalBombas: estado.totalBombas,
    mortesubita,
    alternar,
  };

  if (modo === 'equipes') {
    $('#placar').classList.remove('escondido');
    $('#turno-banner').classList.remove('escondido');
    renderizarPlacar();
  } else {
    $('#placar').classList.add('escondido');
    $('#turno-banner').classList.add('escondido');
  }

  mostrarTela('tela-jogo');
  Audio.resume();
  atualizarCorEquipe();
  proximaBomba();
}

// ======================================================
//  COR DA EQUIPE (aplica em todo o app)
// ======================================================
function atualizarCorEquipe() {
  const eq = estado.equipes[estado.equipeAtual];
  const cor = eq?.cor || CORES_PADRAO[0];
  document.documentElement.style.setProperty('--cor-equipe', cor);
}

// ======================================================
//  PLACAR
// ======================================================
function renderizarPlacar() {
  $('#placar').innerHTML = estado.equipes.map((eq, i) => `
    <div class="placar-item ${i === estado.equipeAtual ? 'ativo' : ''} ${eq.eliminada ? 'eliminada' : ''}"
         style="--cor-item:${eq.cor}">
      <span class="dot" style="background:${eq.cor}"></span>
      ${escapeHtml(eq.nome)}<span class="pts">${eq.pontos}</span>
    </div>
  `).join('');
}

// ======================================================
//  FLUXO DAS BOMBAS
// ======================================================
function proximaBomba() {
  if (estado.bombaAtual >= estado.totalBombas) return finalizarJogo();

  estado.respondido = false;
  estado.ultimoTick = -1;
  const pergunta = estado.fila[estado.bombaAtual];

  // HUD
  $('#hud-bomba').textContent = `${estado.bombaAtual + 1} / ${estado.totalBombas}`;
  const eqAtual = estado.equipes[estado.equipeAtual];
  $('#hud-equipe').textContent = eqAtual.nome;
  $('#hud-pontos').textContent = eqAtual.pontos;

  // Banner de vez
  if (estado.modo === 'equipes') {
    $('#turno-nome').textContent = eqAtual.nome;
  }

  // Aplica cor
  atualizarCorEquipe();
  $('#hud').classList.add('tem-cor');
  $('#bomba').classList.add('tem-cor');
  $('#pergunta').classList.add('tem-cor');

  // Pergunta
  $('#pergunta').textContent = pergunta.p;

  // Alternativas embaralhadas
  const indices = embaralhar(pergunta.a.map((_, i) => i));
  const alt = $('#alternativas');
  alt.innerHTML = '';
  indices.forEach(i => {
    const btn = document.createElement('button');
    btn.className = 'alternativa';
    btn.textContent = pergunta.a[i];
    btn.dataset.correta = (i === pergunta.c) ? '1' : '0';
    btn.addEventListener('click', () => responder(btn));
    alt.appendChild(btn);
  });

  $('#bomba').classList.remove('explodir', 'perigo');
  iniciarTimer();
}

function iniciarTimer() {
  clearInterval(estado.timerId);
  estado.tempoRestante = CONFIG.TEMPO_POR_BOMBA;
  atualizarTimer();

  estado.timerId = setInterval(() => {
    if (estado.pausado) return;

    estado.tempoRestante -= 0.1;
    if (estado.tempoRestante <= 0) {
      estado.tempoRestante = 0;
      atualizarTimer();
      clearInterval(estado.timerId);
      if (!estado.respondido) responder(null);
      return;
    }
    atualizarTimer();

    const seg = Math.ceil(estado.tempoRestante);
    if (seg <= 5 && seg !== estado.ultimoTick && seg > 0) {
      estado.ultimoTick = seg;
      Audio.tick();
    }
    if (estado.tempoRestante <= 10) $('#bomba').classList.add('perigo');
  }, 100);
}

function atualizarTimer() {
  const pct = (estado.tempoRestante / CONFIG.TEMPO_POR_BOMBA) * 100;
  $('#timer-barra').style.width = pct + '%';
  $('#timer-texto').textContent = Math.ceil(estado.tempoRestante) + 's';
}

// ======================================================
//  RESPOSTA
// ======================================================
function responder(botao) {
  if (estado.respondido || estado.pausado) return;
  estado.respondido = true;
  clearInterval(estado.timerId);
  $('#bomba').classList.remove('perigo');

  const alternativas = $$('#alternativas .alternativa');
  alternativas.forEach(b => b.disabled = true);

  let acertou = false;

  if (botao === null) {
    // Timeout
    Audio.explosao();
    $('#bomba').classList.add('explodir');
    toast('💥 Tempo esgotado!', 'timeout');
    alternativas.forEach(b => {
      if (b.dataset.correta === '1') b.classList.add('correta');
    });
  } else if (botao.dataset.correta === '1') {
    // ACERTOU — bomba explode como recompensa
    acertou = true;
    const bonus = Math.round((estado.tempoRestante / CONFIG.TEMPO_POR_BOMBA) * CONFIG.BONUS_MAX);
    Audio.acerto();
    setTimeout(() => Audio.explosao(), 150);
    botao.classList.add('correta');
    $('#bomba').classList.add('explodir'); // 💥 explode ao acertar
    estado.equipes[estado.equipeAtual].pontos += CONFIG.PONTOS_ACERTO + bonus;
    toast(`💥 +${CONFIG.PONTOS_ACERTO + bonus} pontos!`, 'sucesso');
  } else {
    // ERROU
    Audio.erro();
    botao.classList.add('errada');
    alternativas.forEach(b => {
      if (b.dataset.correta === '1') b.classList.add('correta');
    });
    toast(estado.mortesubita ? '💀 Errou! Eliminado.' : '❌ Errou!', 'erro');
  }

  if (estado.modo === 'equipes') renderizarPlacar();
  $('#hud-pontos').textContent = estado.equipes[estado.equipeAtual].pontos;

  setTimeout(() => avancarTurno(acertou), acertou ? 1300 : 1800);
}

// ======================================================
//  AVANÇAR TURNO / MORTE SÚBITA
// ======================================================
function avancarTurno(acertou) {
  estado.bombaAtual++;

  // ---- Solo ----
  if (estado.modo === 'solo') {
    if (estado.mortesubita && !acertou) return finalizarJogo();
    if (estado.bombaAtual >= estado.totalBombas) return finalizarJogo();
    return proximaBomba();
  }

  // ---- Equipes ----
  if (estado.mortesubita && !acertou) {
    estado.equipes[estado.equipeAtual].eliminada = true;
  }

  const vivas = estado.equipes.filter(e => !e.eliminada);
  if (estado.mortesubita && vivas.length <= 1) return finalizarJogo();
  if (estado.bombaAtual >= estado.totalBombas) return finalizarJogo();

  // Decide se troca de equipe
  let trocar = true;
  if (!estado.alternar) {
    // Só troca se errou
    trocar = !acertou;
  }

  if (trocar) {
    estado.equipeAtual = proximaEquipeViva(estado.equipeAtual);
  } else {
    // Mesma equipe continua — mas se ela foi eliminada (não é possível com morte súbita
    // porque errar = eliminada = troca obrigatória), garante que continua viva
    if (estado.equipes[estado.equipeAtual].eliminada) {
      estado.equipeAtual = proximaEquipeViva(estado.equipeAtual);
    }
  }

  proximaBomba();
}

function proximaEquipeViva(atual) {
  let prox = (atual + 1) % estado.equipes.length;
  let tentativas = 0;
  while (estado.equipes[prox].eliminada && tentativas < estado.equipes.length) {
    prox = (prox + 1) % estado.equipes.length;
    tentativas++;
  }
  return prox;
}

// ======================================================
//  FIM DE JOGO
// ======================================================
function finalizarJogo() {
  clearInterval(estado.timerId);
  estado.pausado = false;
  Audio.vitoria();

  $('#hud').classList.remove('tem-cor');
  $('#bomba').classList.remove('tem-cor');
  $('#pergunta').classList.remove('tem-cor');

  if (estado.modo === 'solo') {
    const p = estado.equipes[0].pontos;
    const acertos = Math.min(Math.floor(p / CONFIG.PONTOS_ACERTO), estado.totalBombas);
    $('#fim-titulo').textContent = estado.mortesubita ? '💀 Fim da linha!' : '🏁 Fim de jogo!';
    $('#fim-conteudo').innerHTML = `
      <p>${escapeHtml(estado.equipes[0].nome)}, você fez:</p>
      <div class="grande">${p} pts</div>
      <p style="margin-top:10px;color:var(--texto-suave)">
        ${estado.mortesubita
          ? (acertos >= 3 ? '🔥 Você chegou longe na morte súbita!' : '😅 A bomba explodiu rápido...')
          : (p >= estado.totalBombas * 12 ? '🔥 Incrível!'
            : p >= estado.totalBombas * 8  ? '👏 Muito bom!'
            : p >= estado.totalBombas * 5  ? '💪 Bom trabalho!'
            :                                '😅 Continue tentando!')}
      </p>
    `;
  } else {
    const ordenado = [...estado.equipes].sort((a, b) => b.pontos - a.pontos);
    let titulo, destacadas;

    if (estado.mortesubita) {
      const vivas = estado.equipes.filter(e => !e.eliminada);
      if (vivas.length === 1) {
        titulo = `🏆 ${vivas[0].nome} venceu!`;
        destacadas = vivas.map(v => v.nome);
      } else if (vivas.length > 1) {
        const maxPts = Math.max(...vivas.map(v => v.pontos));
        const top = vivas.filter(v => v.pontos === maxPts);
        titulo = top.length > 1 ? '🤝 Empate entre sobreviventes!' : `🏆 ${top[0].nome} venceu!`;
        destacadas = top.map(v => v.nome);
      } else {
        titulo = '💥 Todas explodiram!';
        destacadas = [];
      }
    } else {
      const maxPts = ordenado[0].pontos;
      const top = ordenado.filter(e => e.pontos === maxPts);
      titulo = top.length > 1 ? '🤝 Empate!' : `🏆 ${top[0].nome} venceu!`;
      destacadas = top.map(v => v.nome);
    }

    $('#fim-titulo').textContent = titulo;
    $('#fim-conteudo').innerHTML = `
      <div class="ranking">
        ${ordenado.map(eq => `
          <div class="rank-item ${destacadas.includes(eq.nome) ? 'vencedor' : ''} ${eq.eliminada ? 'eliminada' : ''}"
               style="--cor-item:${eq.cor}">
            <span class="dot" style="background:${eq.cor}"></span>
            <span class="nome">${eq.eliminada ? '💀 ' : ''}${escapeHtml(eq.nome)}</span>
            <strong>${eq.pontos} pts</strong>
          </div>
        `).join('')}
      </div>
    `;
  }

  mostrarTela('tela-fim');
}

// ======================================================
//  PAUSAR / RETOMAR
// ======================================================
function pausarJogo() {
  if (estado.pausado || estado.respondido) return;
  estado.pausado = true;

  $('#pausa-tempo').textContent = Math.ceil(estado.tempoRestante) + 's';
  $('#pausa-equipe').textContent = estado.equipes[estado.equipeAtual]?.nome || '—';
  $('#overlay-pausa').classList.remove('escondido');
}

function continuarJogo() {
  if (!estado.pausado) return;
  estado.pausado = false;
  $('#overlay-pausa').classList.add('escondido');
}

$('#btn-pausar').addEventListener('click', pausarJogo);
$('#btn-continuar').addEventListener('click', continuarJogo);

$('#btn-menu-da-pausa').addEventListener('click', () => {
  estado.pausado = false;
  clearInterval(estado.timerId);
  $('#overlay-pausa').classList.add('escondido');
  $('#hud').classList.remove('tem-cor');
  $('#bomba').classList.remove('tem-cor');
  $('#pergunta').classList.remove('tem-cor');
  atualizarInfoPerguntas();
  mostrarTela('tela-inicio');
});

// ======================================================
//  REINICIAR DURANTE O JOGO
// ======================================================
function reiniciarJogoAtual() {
  if (!estado.configuracoesIniciais) return;
  const cfg = estado.configuracoesIniciais;
  clearInterval(estado.timerId);
  estado.pausado = false;
  $('#overlay-pausa').classList.add('escondido');
  iniciarJogo(
    cfg.modo,
    cfg.equipes.map(e => ({ ...e, pontos: 0, eliminada: false })),
    cfg.totalBombas,
    cfg.mortesubita,
    cfg.alternar
  );
  toast('🔄 Jogo reiniciado!', 'info');
}

$('#btn-reiniciar-jogo').addEventListener('click', () => {
  if (!confirm('Reiniciar o jogo atual? Toda a pontuação será perdida.')) return;
  reiniciarJogoAtual();
});

$('#btn-reiniciar-da-pausa').addEventListener('click', () => {
  if (!confirm('Reiniciar o jogo atual? Toda a pontuação será perdida.')) return;
  reiniciarJogoAtual();
});

// ======================================================
//  BOTÕES DE FIM
// ======================================================
$('#btn-menu').addEventListener('click', () => {
  atualizarInfoPerguntas();
  mostrarTela('tela-inicio');
});

$('#btn-reiniciar').addEventListener('click', reiniciarJogoAtual);

// ======================================================
//  EDITOR DE PERGUNTAS
// ======================================================
let perguntaEmEdicao = -1;

function abrirEditor() {
  perguntaEmEdicao = -1;
  renderizarListaPerguntas();
  mostrarTela('tela-editor');
}

function renderizarListaPerguntas() {
  const perguntas = carregarPerguntas();
  $('#editor-info').textContent =
    `${perguntas.length} pergunta${perguntas.length === 1 ? '' : 's'} salva${perguntas.length === 1 ? '' : 's'}`;

  const lista = $('#lista-perguntas');
  if (perguntas.length === 0) {
    lista.innerHTML = '<p style="text-align:center;color:var(--texto-suave);padding:20px">Nenhuma pergunta ainda. Clique em "+ Nova".</p>';
    return;
  }

  lista.innerHTML = perguntas.map((q, i) => `
    <div class="pergunta-item">
      <div class="txt">
        <strong>${i + 1}.</strong> ${escapeHtml(q.p)}
        <small>✓ ${escapeHtml(q.a[q.c])}</small>
      </div>
      <div class="btns">
        <button class="btn-icon" data-editar="${i}" title="Editar">✏️</button>
        <button class="btn-icon del" data-excluir="${i}" title="Excluir">🗑</button>
      </div>
    </div>
  `).join('');

  lista.querySelectorAll('[data-editar]').forEach(b =>
    b.addEventListener('click', () => abrirModalEdicao(parseInt(b.dataset.editar, 10)))
  );
  lista.querySelectorAll('[data-excluir]').forEach(b =>
    b.addEventListener('click', () => excluirPergunta(parseInt(b.dataset.excluir, 10)))
  );
}

function abrirModalEdicao(idx = -1) {
  perguntaEmEdicao = idx;
  const modal = $('#modal-editor');
  const perguntas = carregarPerguntas();

  if (idx === -1) {
    $('#modal-titulo').textContent = 'Nova pergunta';
    $('#edit-p').value = '';
    $$('.edit-alt').forEach(i => i.value = '');
    document.querySelector('input[name="correta"][value="0"]').checked = true;
  } else {
    const q = perguntas[idx];
    $('#modal-titulo').textContent = `Editar pergunta ${idx + 1}`;
    $('#edit-p').value = q.p;
    $$('.edit-alt').forEach((inp, i) => inp.value = q.a[i] || '');
    document.querySelector(`input[name="correta"][value="${q.c}"]`).checked = true;
  }

  modal.classList.remove('escondido');
  setTimeout(() => $('#edit-p').focus(), 100);
}

function fecharModal() {
  $('#modal-editor').classList.add('escondido');
  perguntaEmEdicao = -1;
}

$('#btn-nova-pergunta').addEventListener('click', () => abrirModalEdicao(-1));
$('#btn-cancelar-edit').addEventListener('click', fecharModal);
$('#modal-editor').addEventListener('click', (e) => {
  if (e.target.id === 'modal-editor') fecharModal();
});

$('#btn-salvar-pergunta').addEventListener('click', () => {
  const p = $('#edit-p').value.trim();
  const alts = [...$$('.edit-alt')].map(i => i.value.trim());
  const correta = parseInt(document.querySelector('input[name="correta"]:checked').value, 10);

  if (!p) return toast('Digite a pergunta!', 'erro');
  if (alts.some(a => !a)) return toast('Preencha todas as 4 alternativas!', 'erro');

  const nova = { p, a: alts, c: correta };
  const perguntas = carregarPerguntas();

  if (perguntaEmEdicao === -1) perguntas.push(nova);
  else perguntas[perguntaEmEdicao] = nova;

  salvarPerguntas(perguntas);
  fecharModal();
  renderizarListaPerguntas();
  atualizarInfoPerguntas();
  toast('✅ Pergunta salva!', 'sucesso');
});

function excluirPergunta(idx) {
  if (!confirm('Excluir esta pergunta?')) return;
  const perguntas = carregarPerguntas();
  perguntas.splice(idx, 1);
  salvarPerguntas(perguntas);
  renderizarListaPerguntas();
  atualizarInfoPerguntas();
  toast('Pergunta excluída.', 'info');
}

// ---------- Exportar / Importar / Restaurar ----------
$('#btn-exportar').addEventListener('click', () => {
  const perguntas = carregarPerguntas();
  const blob = new Blob([JSON.stringify(perguntas, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `boom-perguntas-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('⬇ Arquivo exportado!', 'sucesso');
});

$('#btn-importar').addEventListener('click', () => $('#input-importar').click());

$('#input-importar').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const arr = JSON.parse(ev.target.result);
      if (!Array.isArray(arr)) throw new Error('Formato inválido');
      const validas = arr.filter(q =>
        q && typeof q.p === 'string' && Array.isArray(q.a) && q.a.length === 4 &&
        typeof q.c === 'number' && q.c >= 0 && q.c < 4
      );
      if (validas.length === 0) throw new Error('Nenhuma pergunta válida');
      const juntas = [...carregarPerguntas(), ...validas];
      salvarPerguntas(juntas);
      renderizarListaPerguntas();
      atualizarInfoPerguntas();
      toast(`✅ ${validas.length} perguntas importadas!`, 'sucesso');
    } catch (err) {
      toast('❌ Arquivo inválido', 'erro');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

$('#btn-restaurar').addEventListener('click', () => {
  if (!confirm('Isso vai substituir TODAS as perguntas pelo banco padrão. Continuar?')) return;
  salvarPerguntas([...window.BANCO_PADRAO]);
  renderizarListaPerguntas();
  atualizarInfoPerguntas();
  toast('↺ Perguntas restauradas!', 'sucesso');
});

// ======================================================
//  IMPORTAR DO WORD
// ======================================================
function parseTextoPerguntas(texto) {
  if (!texto || !texto.trim()) return [];
  const temTabs = texto.split('\n').some(l => l.includes('\t'));
  return temTabs ? parseTabSeparado(texto) : parseBloco(texto);
}

function parseTabSeparado(texto) {
  const perguntas = [];
  const linhas = texto.split(/\r?\n/).filter(l => l.trim());
  for (const linha of linhas) {
    const cols = linha.split('\t').map(c => c.trim());
    if (cols.length < 6) continue;
    const [p, a, b, c, d, resp] = cols;
    if (!p || p.toLowerCase() === 'pergunta') continue;
    if (!a || !b || !c || !d) continue;
    const letra = (resp || '').trim().toUpperCase().charAt(0);
    const idx = { A: 0, B: 1, C: 2, D: 3 }[letra];
    if (idx === undefined) continue;
    perguntas.push({ p, a: [a, b, c, d], c: idx });
  }
  return perguntas;
}

function parseBloco(texto) {
  const perguntas = [];
  const blocos = texto
    .replace(/\r/g, '')
    .split(/\n\s*\n|^[-*_]{3,}\s*$/m)
    .map(b => b.trim())
    .filter(Boolean);

  for (const bloco of blocos) {
    const linhas = bloco.split('\n').map(l => l.trim()).filter(Boolean);
    if (linhas.length < 5) continue;

    let pergunta = linhas[0]
      .replace(/^\d+\s*[\.\)\-]\s*/, '')
      .replace(/^[-•*]\s*/, '')
      .trim();

    const alternativas = [];
    let corretaIdx = -1;

    for (let i = 1; i < linhas.length; i++) {
      const linha = linhas[i];

      const mResp = linha.match(/^(resposta|correta|gabarito|answer)\s*[:\-]?\s*([a-d])\b/i);
      if (mResp) {
        corretaIdx = mResp[2].toUpperCase().charCodeAt(0) - 65;
        continue;
      }

      const mAlt = linha.match(/^([a-dA-D])\s*[\)\.\-:]\s*(.+)$/);
      if (mAlt) {
        alternativas.push(mAlt[2].trim());
        continue;
      }

      const mStar = linha.match(/^[*•]\s*(.+)$/);
      if (mStar) {
        alternativas.push(mStar[1].trim());
        continue;
      }

      if (i === linhas.length - 1 && /^[a-d]$/i.test(linha)) {
        corretaIdx = linha.toUpperCase().charCodeAt(0) - 65;
      }
    }

    if (alternativas.length === 0 && linhas.length >= 5) {
      for (let i = 1; i <= 4; i++) alternativas.push(linhas[i]);
      const ultima = linhas[linhas.length - 1];
      if (/^[a-d]$/i.test(ultima)) corretaIdx = ultima.toUpperCase().charCodeAt(0) - 65;
    }

    if (alternativas.length === 4 && corretaIdx >= 0 && corretaIdx < 4) {
      perguntas.push({ p: pergunta, a: alternativas, c: corretaIdx });
    }
  }
  return perguntas;
}

function abrirModalImportTexto() {
  $('#import-texto').value = '';
  $('#import-preview').classList.add('escondido');
  $('#modal-import-texto').classList.remove('escondido');
  setTimeout(() => $('#import-texto').focus(), 100);
}

function fecharModalImportTexto() {
  $('#modal-import-texto').classList.add('escondido');
}

$('#btn-colar-word').addEventListener('click', abrirModalImportTexto);
$('#btn-cancelar-import-texto').addEventListener('click', fecharModalImportTexto);
$('#modal-import-texto').addEventListener('click', (e) => {
  if (e.target.id === 'modal-import-texto') fecharModalImportTexto();
});

$('#import-texto').addEventListener('input', (e) => {
  const perguntas = parseTextoPerguntas(e.target.value);
  const prev = $('#import-preview');
  if (!e.target.value.trim()) {
    prev.classList.add('escondido');
    return;
  }
  prev.classList.remove('escondido');
  if (perguntas.length === 0) {
    prev.innerHTML = '<span class="bad">⚠️ Nenhuma pergunta válida detectada ainda. Verifique o formato.</span>';
    return;
  }
  prev.innerHTML = `<strong>✅ ${perguntas.length} pergunta${perguntas.length === 1 ? '' : 's'} detectada${perguntas.length === 1 ? '' : 's'}:</strong><br><br>` +
    perguntas.slice(0, 5).map((q, i) =>
      `${i + 1}. ${escapeHtml(q.p)}<br><small style="color:var(--sucesso)">✓ ${escapeHtml(q.a[q.c])}</small>`
    ).join('<br>') +
    (perguntas.length > 5 ? `<br><em>... e mais ${perguntas.length - 5}</em>` : '');
});

$('#btn-confirmar-import-texto').addEventListener('click', () => {
  const texto = $('#import-texto').value;
  const novas = parseTextoPerguntas(texto);

  if (novas.length === 0) {
    return toast('Nenhuma pergunta válida encontrada', 'erro');
  }

  const atuais = carregarPerguntas();
  const juntas = [...atuais, ...novas];
  salvarPerguntas(juntas);
  fecharModalImportTexto();
  renderizarListaPerguntas();
  atualizarInfoPerguntas();
  toast(`✅ ${novas.length} perguntas importadas!`, 'sucesso');
});

// ======================================================
//  TELA DE CONFIGURAÇÕES
// ======================================================
function abrirConfig() {
  atualizarSlidersConfig();
  mostrarTela('tela-config-global');
}

function atualizarSlidersConfig() {
  $('#sl-tempo').value = CONFIG.TEMPO_POR_BOMBA;
  $('#lbl-tempo').textContent = CONFIG.TEMPO_POR_BOMBA;

  $('#sl-pontos').value = CONFIG.PONTOS_ACERTO;
  $('#lbl-pontos').textContent = CONFIG.PONTOS_ACERTO;

  $('#sl-bonus').value = CONFIG.BONUS_MAX;
  $('#lbl-bonus').textContent = CONFIG.BONUS_MAX;

  const vm = Math.round(Audio.getVolumeMusica() * 100);
  $('#sl-vol-musica').value = vm;
  $('#lbl-vol-musica').textContent = vm;

  const vs = Math.round(Audio.getVolumeSfx() * 100);
  $('#sl-vol-sfx').value = vs;
  $('#lbl-vol-sfx').textContent = vs;
}

$('#sl-tempo').addEventListener('input', (e) => {
  CONFIG.TEMPO_POR_BOMBA = parseFloat(e.target.value);
  $('#lbl-tempo').textContent = CONFIG.TEMPO_POR_BOMBA;
  salvarConfig();
});
$('#sl-pontos').addEventListener('input', (e) => {
  CONFIG.PONTOS_ACERTO = parseFloat(e.target.value);
  $('#lbl-pontos').textContent = CONFIG.PONTOS_ACERTO;
  salvarConfig();
});
$('#sl-bonus').addEventListener('input', (e) => {
  CONFIG.BONUS_MAX = parseFloat(e.target.value);
  $('#lbl-bonus').textContent = CONFIG.BONUS_MAX;
  salvarConfig();
});

$('#sl-vol-musica').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  $('#lbl-vol-musica').textContent = v;
  Audio.init();
  Audio.setVolumeMusica(v / 100);
  if (Audio.ctx) Audio.resume();
});
$('#sl-vol-sfx').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  $('#lbl-vol-sfx').textContent = v;
  Audio.init();
  Audio.setVolumeSfx(v / 100);
  if (Audio.ctx) Audio.resume();
});

$('#btn-config-padrao').addEventListener('click', () => {
  if (!confirm('Restaurar todas as configurações para o padrão?')) return;
  Object.assign(CONFIG, CONFIG_PADRAO);
  salvarConfig();
  Audio.setVolumeMusica(0.09);
  Audio.setVolumeSfx(0.32);
  atualizarSlidersConfig();
  toast('↺ Configurações restauradas!', 'sucesso');
});

// ======================================================
//  CONTROLE DE ÁUDIO
// ======================================================
$('#btn-audio').addEventListener('click', () => {
  Audio.init();
  const ligada = Audio.toggleMusica();
  $('#btn-audio').textContent = ligada ? '🎵' : '🔇';
  $('#btn-audio').classList.toggle('mudo', !ligada);
  if (ligada) toast('🎵 Música ligada', 'info');
});

// ======================================================
//  INIT
// ======================================================
(function init() {
  carregarConfig();
  Audio.carregarPreferencias();

  $('#btn-audio').textContent = Audio.musicaLigada ? '🎵' : '🔇';
  $('#btn-audio').classList.toggle('mudo', !Audio.musicaLigada);

  atualizarInfoPerguntas();
  atualizarSlidersConfig();

  // Estado inicial do checkbox "alternar"
  $('#check-alternar').checked = CONFIG.ALTERNAR_TURNOS !== false;

  const iniciarAudio = () => {
    Audio.init();
    Audio.resume();
    if (Audio.musicaLigada) Audio.tocarMusica();
    document.removeEventListener('pointerdown', iniciarAudio);
    document.removeEventListener('keydown', iniciarAudio);
  };
  document.addEventListener('pointerdown', iniciarAudio);
  document.addEventListener('keydown', iniciarAudio);

  // Atalho: barra de espaço pausa/retoma durante o jogo
  document.addEventListener('keydown', (e) => {
    if (!$('#tela-jogo').classList.contains('ativa')) return;
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      if (estado.pausado) continuarJogo();
      else pausarJogo();
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
