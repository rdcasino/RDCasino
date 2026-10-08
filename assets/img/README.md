# Guia de imagens

O site procura cada imagem num caminho fixo. Se o arquivo existir, ele aparece. Se não existir, o site mostra um degradê com o nome no lugar, sem ícone de imagem quebrada. Para trocar uma foto, salve o arquivo **com o nome exato** na pasta certa e publique.

O painel admin (`admin/` → Banners & Imagens) lista todos os espaços e marca quais já têm arquivo (OK) e quais estão faltando.

## Formatos

- **JPG** para fotos, qualidade ~80%. Use **WebP** se quiser arquivos menores (aí ajuste a extensão em `assets/js/data.js`).
- **SVG** ou **PNG** com fundo transparente para logo.
- Mantenha cada arquivo abaixo de ~300 KB. Imagem pesada derruba a conversão no celular.

## Espaços e tamanhos

| Pasta | Arquivo | Tamanho | Onde aparece |
|---|---|---|---|
| `brand/` | `logo.svg`, `favicon.svg` | 64×64 (vetor) | Sidebar, aba do navegador, admin |
| `banners/` | `welcome.jpg` | 1600×700 | Banner principal da home |
| `banners/` | `leaderboard.jpg`, `affiliate.jpg` | 800×400 | Banners laterais da home |
| `promos/` | `welcome.jpg`, `reload.jpg`, `rakeback.jpg`, `race.jpg`, `drops.jpg`, `cashback.jpg` | 1200×600 | Cards da página Promotions |
| `games/` | `<id-do-jogo>.jpg` (ex.: `dice.jpg`, `gates-olympus.jpg`) | 600×800 (3:4) | Capas dos jogos |
| `affiliate/` | `hero.jpg` | 1920×800 | Topo da página de afiliados |
| `affiliate/` | `banner-728x90.jpg`, `banner-300x250.jpg`, `story-1080x1920.jpg`, `post-1200x628.jpg` | No nome | Materiais para afiliados baixarem |

Os IDs dos jogos estão em `assets/js/data.js` (campo `id`).

## Direção de arte (para manter a identidade)

- **Banners e hero:** o texto fica sobre o lado **esquerdo** da imagem, com uma sombra escura aplicada por cima. Coloque o elemento principal (pessoa, objeto, ficha) no **terço direito**.
- **Paleta:** fundos escuros e frios, com acento verde (#1FC77F) ou dourado (#E6B450). Evite neon rosa e roxo saturado. Isso é o que dá a sensação de "premium e confiável" em vez de "cassino genérico".
- **Fotos de pessoas:** prefira cenas reais (celebração discreta, mãos com celular, lounge) a montagens com moedas voando.

## Direitos de uso

- **Capas de jogos de provedores** (Pragmatic, Evolution etc.) vêm do agregador ou do provedor junto com a integração. Não baixe do Google.
- **Fotos de banco de imagens:** use licença comercial (Unsplash/Pexels para começar, Adobe Stock/Getty para campanha).
- **Imagens geradas por IA:** podem ser usadas. Evite rostos de pessoas reais e marcas de terceiros.
