# Guia de imagens

O site procura cada imagem num caminho fixo. Se o arquivo existir, ele aparece. Se não existir, o site mostra a **ilustração vetorial própria** (de `assets/js/art.js`) — veja todas em `design/artes.html`. Ou seja: o site já está completo sem fotos; os arquivos aqui servem para substituir as ilustrações por artes finais (3D, IA ou designer). Para trocar uma foto, salve o arquivo **com o nome exato** na pasta certa, **adicione o caminho na lista `RD.imgFiles` em `assets/js/data.js`** e publique. Sem estar na lista, o site nem tenta carregar a foto (assim não gera dezenas de erros 404 a cada visita).

O painel admin (`admin/` → Banners & Imagens) lista todos os espaços e marca quais já têm arquivo (OK) e quais estão faltando.

## Formatos

- **JPG** para fotos, qualidade ~80%. Use **WebP** se quiser arquivos menores (aí ajuste a extensão em `assets/js/data.js`).
- **SVG** ou **PNG** com fundo transparente para logo.
- Mantenha cada arquivo abaixo de ~300 KB. Imagem pesada derruba a conversão no celular.

## Espaços e tamanhos

| Pasta | Arquivo | Tamanho | Onde aparece |
|---|---|---|---|
| `brand/` | `logo.svg`, `favicon.svg` | 64×64 (vetor) | Sidebar, aba do navegador, admin |
| `banners/` | `welcome.jpg`, `leaderboard.jpg`, `affiliate.jpg` | 1200×600 | Os 3 cards de promoção do topo da home (estilo Stake) |
| `promos/` | `welcome.jpg`, `reload.jpg`, `rakeback.jpg`, `race.jpg` | 1200×600 | Cards da página Promotions |
| `games/` | `<id-do-jogo>.jpg` (ex.: `dice.jpg`, `gates-olympus.jpg`) | 600×800 (3:4) | Capas dos jogos |
| `affiliate/` | `hero.jpg` | 1920×800 | Topo da página de afiliados |
| `affiliate/` | `banner-728x90.jpg`, `banner-300x250.jpg`, `story-1080x1920.jpg`, `post-1200x628.jpg` | No nome | Materiais para afiliados baixarem |

Os IDs dos jogos estão em `assets/js/data.js` (campo `id`).

## Direção de arte (para manter a identidade)

- **Banners (estilo Stake/Shuffle/Goated):** o texto fica no lado **esquerdo**, com uma sombra escura por cima. Coloque o elemento principal (personagem 3D, fichas, troféu, moedas cripto) no **lado direito**, recortado sobre um fundo de cor sólida ou degradê.
- **Paleta (Rubi Real):** fundo preto quente (#0E090D), rubi (#FF2E55) e ouro (#FFC85C). Banners em tons de rubi, ameixa e ouro; capas dos jogos com cor própria e saturada, como na Shuffle.
- **Capas de jogos:** formato vertical 3:4 com o nome do jogo escrito na arte, como nos sites de referência.
- **Fotos de pessoas:** prefira cenas reais (celebração discreta, mãos com celular, lounge) a montagens com moedas voando.

## Direitos de uso

- **Capas de jogos de provedores** (Pragmatic, Evolution etc.) vêm do agregador ou do provedor junto com a integração. Não baixe do Google.
- **Fotos de banco de imagens:** use licença comercial (Unsplash/Pexels para começar, Adobe Stock/Getty para campanha).
- **Imagens geradas por IA:** podem ser usadas. Evite rostos de pessoas reais e marcas de terceiros.
