# Briefing: artes 3D do RDCasino (para IA de imagem ou designer)

O site já tem ilustrações vetoriais próprias para tudo (veja `design/artes.html`). Este briefing é para gerar a **versão final em 3D**, no nível da Shuffle, sem perder a identidade **Rubi Real**.

## Como usar
1. Cole o **estilo base** + o **prompt da peça** na ferramenta (Midjourney v7, GPT Image, Ideogram ou Flux).
2. Gere 4 variações e escolha a que tiver o objeto mais limpo e legível em tamanho pequeno.
3. Coloque o **nome do jogo por cima no Figma/Canva** (IA ainda erra texto). Fonte: **Unbounded ExtraBold**, branca, centralizada na parte de baixo.
4. Exporte em JPG, qualidade 80%, com o nome e o tamanho da tabela abaixo, e salve em `assets/img/...`. O site troca a ilustração automaticamente.

## Estilo base (colar antes de cada prompt)

> 3D render, glossy stylized casino game icon, single hero object centered, soft studio lighting with strong rim light, subtle reflections, smooth gradients, vivid saturated colors, clean background with soft radial glow, light diagonal light streaks, high detail, octane render, no text, no watermark, no logos

Para manter a família visual: **mesma luz, mesmo ângulo (3/4 levemente de cima), um objeto principal, fundo em degradê de uma cor só.**

## Capas dos jogos — 600×800 (proporção 3:4)

| Arquivo | Fundo | Prompt da peça |
|---|---|---|
| `games/dice.jpg` | azul royal → azul-marinho | two white dice with red and blue pips tumbling mid-air, one tilted, soft shadow below |
| `games/limbo.jpg` | âmbar → laranja-queimado | glowing white and orange target rings with a navy arrow shooting upward through the center, small "100x" style badge shape (no text) |
| `games/crash.jpg` | azul-céu → azul-noite com estrelas | white and ruby red cartoon rocket flying diagonally up-right, bright yellow-orange flame trail, rising line graph behind it |
| `games/mines.jpg` | violeta → roxo profundo | large faceted emerald gem glowing, small black bomb with lit fuse floating behind it |
| `games/plinko.jpg` | rosa-pink → vinho | triangular grid of white pegs with two golden balls bouncing, row of red-to-yellow slots at the bottom |
| `games/keno.jpg` | rubi → vinho escuro | three glossy lottery balls (blue, red, green bands) floating over a faint number grid |
| `games/hilo.jpg` | ciano → petróleo | two playing cards fanned (ace of spades and king of hearts), green up-arrow and red down-arrow badges |
| `games/wheel.jpg` | laranja → marrom-escuro | colorful prize wheel with 12 segments (blue, violet, cyan, yellow, ruby, green), white pointer on top, light bulbs on the rim |
| `games/blackjack.jpg` | verde-feltro → verde-escuro | ace of spades and king of hearts fanned, stack of ruby and blue casino chips, small gold coin |
| `games/roulette.jpg` | índigo → azul-noite | European roulette wheel seen from slightly above, gold rim, red/black pockets, white ball |

## Banners da home — 1200×600 (objeto no **lado direito**, metade esquerda livre para texto)

| Arquivo | Fundo | Prompt da peça |
|---|---|---|
| `banners/welcome.jpg` | rubi → vinho escuro | ruby red gift box with gold ribbon bursting open, gold crypto coins flying out, sparkles, composition on the right third |
| `banners/leaderboard.jpg` | ameixa → quase preto | shiny gold trophy cup with "1" emblem, gold coins and confetti around it, composition on the right third |
| `banners/affiliate.jpg` | roxo → índigo profundo | two interlocked chain links (white and gold) with gold coins, network glow, composition on the right third |

## Promoções — 1200×600

| Arquivo | Prompt da peça |
|---|---|
| `promos/welcome.jpg` | mesmo conceito do banner welcome, variação mais fechada no presente |
| `promos/reload.jpg` | gold coin inside two circular refresh arrows (white and gold), magenta background |
| `promos/rakeback.jpg` | big gold coin with a lightning bolt embossed, purple background |
| `promos/race.jpg` | gold trophy with speed lines, amber background |

## Afiliados

| Arquivo | Tamanho | Prompt da peça |
|---|---|---|
| `affiliate/hero.jpg` | 1920×800 | rising white bar chart with a gold trend line and gold coins, ruby to black background, composition on the right half |

## O que evitar
- **Personagens ou marcas de terceiros** (nada de mascote da Stake, logos de provedores, celebridades).
- **Dinheiro em notas de real ou bandeira do Brasil**, por coerência com o público internacional.
- **Excesso de elementos:** a capa aparece pequena no celular, então o objeto precisa ser lido em 120px de largura.
- **Texto gerado pela IA:** sempre aplique o título depois, no editor.

## Direitos
Imagens geradas por IA podem ser usadas comercialmente na maioria das ferramentas pagas. Confira os termos do plano que você usar. Nunca use capas oficiais de Pragmatic, Evolution e outros provedores fora do contrato com eles.
