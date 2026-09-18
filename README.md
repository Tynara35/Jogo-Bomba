# 💣 Boom! — Jogo de Quiz

Jogo de perguntas com bombas para desarmar.

## ✨ Recursos
- 🎯 **Modo Solo** — um jogador responde tudo
- 👥 **Modo Equipes** — 2 a 4 times se enfrentando
- 💀 **Morte Súbita** — 1 erro elimina (solo) / elimina a equipe (time)
- ✏️ **Editor de perguntas** — dentro do app, com importar/exportar JSON
- ⚙️ **Configurações** — tempo, pontos, bônus e volumes ajustáveis
- 🎵 **Música de fundo** e 💥 **som de explosão** (via Web Audio API)
- 📱 **PWA** — instalável e funciona offline

## 🚀 Rodar localmente
Basta abrir `index.html` no navegador — sem build, sem dependências.

## ✏️ Adicionar perguntas
Use o botão **Editar Perguntas** no menu do app. As perguntas ficam salvas
no `localStorage` do navegador. Você também pode **importar/exportar**
um arquivo `.json`.

Formato:
```json
{ "p": "Pergunta?", "a": ["A","B","C","D"], "c": 2 }
```
O campo `c` é o índice da alternativa correta (0 a 3).

## ⚙️ Configurações ajustáveis
| Ajuste | Faixa | Padrão |
|---|---|---|
| ⏱️ Tempo por bomba | 5 – 90s | 30s |
| 🏆 Pontos por acerto | 1 – 50 | 10 |
| ⚡ Bônus por tempo | 0 – 20 | 5 |
| 🎵 Volume da música | 0 – 30% | 9% |
| 💥 Volume dos efeitos | 0 – 100% | 32% |

Tudo é salvo automaticamente no navegador.

## 🎮 Como usar
1. Menu → **Jogar Solo** ou **Jogar em Equipes**
2. Configure nome/equipes e ligue **💀 Morte Súbita** se quiser
3. Responda antes do tempo acabar! Acertar = pontos + bônus de rapidez
4. No editor você cria, importa e exporta perguntas
5. Botão 🎵 no canto liga/desliga a música; sliders regulam os volumes

## 🛠 Personalizar
| O que mudar | Onde |
|---|---|
| Valores padrão | `CONFIG_PADRAO` em `app.js` |
| Cores | variáveis no topo de `styles.css` |
| Perguntas padrão | `questions.js` |
| Música/efeitos | `audio.js` |