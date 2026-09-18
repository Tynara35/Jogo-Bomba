// ======================================================
//  BOOM! — Lógica do jogo + Editor + Configurações
// ======================================================

// ---------- CONFIGURAÇÕES ----------
const CONFIG_PADRAO = {
  TEMPO_POR_BOMBA: 30,
  PONTOS_ACERTO: 10,
  BONUS_MAX: 5,
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
  equipes: [],
  equipeAtual: 0,
  fila: [],
  bombaAtual: 0,
  totalBombas: 0,
  tempoRestante: 0,
  timerId: null,
  respondido: false,
  ultimoTick: -1,
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
//  FORMULÁRIO EQUIPES
// ======================================================
function montarFormularioEquipes() {
  const num = parseInt($('#select-num-equipes').value, 10);
  const container = $('#lista-nomes-equipes');
  const atuais = [...container.querySelectorAll('input')].map(i => i.value);
  const nomesPadrao = ['Vermelha', 'Azul', 'Verde', 'Amarela'];
  container.innerHTML = '';
  for (let i = 0; i < num; i++) {
    const label = document.createElement('label');
    label.className = 'campo';
    label.innerHTML = `
      <span>Nome da equipe ${i + 1}</span>
      <input type="text" maxlength="20" value="${atuais[i] || 'Equipe ' + nomesPadrao[i]}" />
    `;
    container.appendChild(label);
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
  iniciarJogo('solo', [{ nome, pontos: 0, eliminada: false }], qtd, mortesubita);
});

$('#btn-iniciar-equipes').addEventListener('click', () => {
  const inputs = [...$('#lista-nomes-equipes').querySelectorAll('input')];
  const equipes = inputs.map((inp, i) => ({
    nome: inp.value.trim() || `Equipe ${i + 1}`,
    pontos: 0,
    eliminada: false,
  }));
  const porEquipe = parseInt($('#select-bombas-equipe').value, 10);
  const mortesubita = $('#check-morte-equipes').checked;
  iniciarJogo('equipes', equipes, porEquipe * equipes.length, mortesubita);
});

function iniciarJogo(modo, equipes, totalBombas, mortesubita) {
  const banco = carregarPerguntas();
  if (banco.length < 4) {
    toast('Adicione pelo menos 4 perguntas no editor!', 'erro');
    return;
  }

  estado.modo = modo;
  estado.mortesubita = mortesubita;
  estado.equipes = equipes;
  estado.equipeAtual = 0;
  estado.bombaAtual = 0;
  estado.totalBombas = Math.min(totalBombas, banco.length);
  estado.fila = embaralhar(banco).slice(0, estado.totalBombas);
  estado.respondido = false;

  if (modo === 'equipes') {
    $('#placar').classList.remove('escondido');
    renderizarPlacar();
  } else {
    $('#placar').classList.add('escondido');
  }

  mostrarTela('tela-jogo');
  Audio.resume();
  proximaBomba();
}

// ======================================================
//  PLACAR
// ======================================================
function renderizarPlacar() {
  $('#placar').innerHTML = estado.equipes.map((eq, i) => `
    <div class="placar-item ${i === estado.equipeAtual ? 'ativo' : ''} ${eq.eliminada ? 'eliminada' : ''}">
      ${eq.nome}<span class="pts">${eq.pontos}</span>
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

  $('#hud-bomba').textContent = `${estado.bombaAtual + 1} / ${estado.totalBombas}`;
  const eqAtual = estado.equipes[estado.equipeAtual];
  $('#hud-equipe').textContent = eqAtual.nome;
  $('#hud-pontos').textContent = eqAtual.pontos;

  $('#pergunta').textContent = pergunta.p;

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
  if (estado.respondido) return;
  estado.respondido = true;
  clearInterval(estado.timerId);
  $('#bomba').classList.remove('perigo');

  const alternativas = $$('#alternativas .alternativa');
  alternativas.forEach(b => b.disabled = true);

  let acertou = false;

  if (botao === null) {
    Audio.explosao();
    $('#bomba').classList.add('explodir');
    toast('💥 Tempo esgotado!', 'timeout');
    alternativas.forEach(b => {
      if (b.dataset.correta === '1') b.classList.add('correta');
    });
  } else if (botao.dataset.correta === '1') {
    acertou = true;
    const bonus = Math.round((estado.tempoRestante / CONFIG.TEMPO_POR_BOMBA) * CONFIG.BONUS_MAX);
    Audio.acerto();
    botao.classList.add('correta');
    estado.equipes[estado.equipeAtual].pontos += CONFIG.PONTOS_ACERTO + bonus;
    toast(`✅ +${CONFIG.PONTOS_ACERTO + bonus} pontos!`, 'sucesso');
  } else {
    Audio.explosao();
    botao.classList.add('errada');
    alternativas.forEach(b => {
      if (b.dataset.correta === '1') b.classList.add('correta');
    });
    $('#bomba').classList.add('explodir');
    toast(estado.mortesubita ? '💀 Errou! Eliminado.' : '❌ Errou!', 'erro');
  }

  if (estado.modo === 'equipes') renderizarPlacar();
  $('#hud-pontos').textContent = estado.equipes[estado.equipeAtual].pontos;

  setTimeout(() => avancarTurno(acertou), acertou ? 1200 : 1800);
}

// ======================================================
//  AVANÇAR TURNO / MORTE SÚBITA
// ======================================================
function avancarTurno(acertou) {
  estado.bombaAtual++;

  if (estado.modo === 'solo') {
    if (estado.mortesubita && !acertou) return finalizarJogo();
    if (estado.bombaAtual >= estado.totalBombas) return finalizarJogo();
    return proximaBomba();
  }

  if (estado.mortesubita && !acertou) {
    estado.equipes[estado.equipeAtual].eliminada = true;
  }

  const vivas = estado.equipes.filter(e => !e.eliminada);
  if (estado.mortesubita && vivas.length <= 1) return finalizarJogo();
  if (estado.bombaAtual >= estado.totalBombas) return finalizarJogo();

  let prox = (estado.equipeAtual + 1) % estado.equipes.length;
  let tentativas = 0;
  while (estado.equipes[prox].eliminada && tentativas < estado.equipes.length) {
    prox = (prox + 1) % estado.equipes.length;
    tentativas++;
  }
  estado.equipeAtual = prox;
  proximaBomba();
}

// ======================================================
//  FIM DE JOGO
// ======================================================
function finalizarJogo() {
  clearInterval(estado.timerId);
  Audio.vitoria();

  if (estado.modo === 'solo') {
    const p = estado.equipes[0].pontos;
    const acertos = Math.min(Math.floor(p / CONFIG.PONTOS_ACERTO), estado.totalBombas);
    $('#fim-titulo').textContent = estado.mortesubita ? '💀 Fim da linha!' : '🏁 Fim de jogo!';
    $('#fim-conteudo').innerHTML = `
      <p>${estado.equipes[0].nome}, você fez:</p>
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
          <div class="rank-item ${destacadas.includes(eq.nome) ? 'vencedor' : ''} ${eq.eliminada ? 'eliminada' : ''}">
            <span>${eq.eliminada ? '💀 ' : ''}${eq.nome}</span>
            <strong>${eq.pontos} pts</strong>
          </div>
        `).join('')}
      </div>
    `;
  }

  mostrarTela('tela-fim');
}

// ======================================================
//  BOTÕES DE FIM
// ======================================================
$('#btn-menu').addEventListener('click', () => {
  atualizarInfoPerguntas();
  mostrarTela('tela-inicio');
});

$('#btn-reiniciar').addEventListener('click', () => {
  const equipes = estado.equipes.map(e => ({ ...e, pontos: 0, eliminada: false }));
  iniciarJogo(estado.modo, equipes, estado.totalBombas, estado.mortesubita);
});

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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
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

// Sliders de jogo
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

// Sliders de volume
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

// Restaurar padrão
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

  const iniciarAudio = () => {
    Audio.init();
    Audio.resume();
    if (Audio.musicaLigada) Audio.tocarMusica();
    document.removeEventListener('pointerdown', iniciarAudio);
    document.removeEventListener('keydown', iniciarAudio);
  };
  document.addEventListener('pointerdown', iniciarAudio);
  document.addEventListener('keydown', iniciarAudio);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();