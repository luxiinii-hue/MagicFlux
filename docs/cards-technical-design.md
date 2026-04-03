# Card System — Technical Design

Owner: Card System Worker
Status: Technical planning (pre-implementation)
Date: 2026-04-03

This document covers the internal design of `packages/cards/` — the Scryfall data pipeline, mana cost parser, card instantiation flow, and card implementation pattern.

---

## 1. Scryfall Bulk Data Pipeline

### Data Source

Scryfall provides bulk data exports at `https://api.scryfall.com/bulk-data`. We use the **Oracle Cards** dataset:

- **Type:** `oracle_cards` — one card object per Oracle ID (deduplicated across printings)
- **Size:** ~170 MB (gzip-encoded JSON array)
- **Updated:** Daily (timestamp in the download URL)
- **Format:** JSON array of card objects

The Oracle Cards dataset is the right choice because:
1. It deduplicates across printings (one entry per unique card, not per printing)
2. It selects the most up-to-date recognizable version of each card
3. It's ~3x smaller than `default_cards` and ~15x smaller than `all_cards`
4. It contains all fields we need: oracle text, mana cost, type line, keywords, legalities, image URIs

### Pipeline Flow

```
[1] Fetch bulk-data metadata (GET /bulk-data)
         ↓
[2] Check if local cache is stale (compare updated_at)
         ↓ (if stale or missing)
[3] Stream-download oracle-cards JSON to data/oracle-cards.json
         ↓
[4] Parse JSON array → Map<oracleId, ScryfallCard>
         ↓
[5] Transform each ScryfallCard → CardData
         ↓
[6] Build in-memory indexes: byId, byOracleId, byName (lowercase)
         ↓
[7] Ready for queries
```

### Implementation: `src/scryfall/`

#### `src/scryfall/types.ts` — Raw Scryfall JSON shape

TypeScript interface matching the raw Scryfall card object. This is NOT the same as our `CardData` — it's the wire format with snake_case field names and Scryfall-specific fields we don't need.

Key fields to map:
```
Scryfall field        → CardData field
─────────────────────────────────────────
id                    → id
oracle_id             → oracleId
name                  → name
mana_cost             → manaCost (string)
                      → parsedManaCost (via cost parser)
cmc                   → cmc
type_line             → typeLine, supertypes, cardTypes, subtypes (parsed)
oracle_text           → oracleText
power                 → power
toughness             → toughness
loyalty               → loyalty
defense               → defense
colors                → colors (map ["R"] to ManaColor[])
color_identity        → colorIdentity
keywords              → keywords
layout                → layout
card_faces            → faces (mapped to CardFace[])
image_uris            → imageUris
legalities            → legalities
produced_mana         → producedMana
```

Fields we **discard** from Scryfall (not needed for gameplay):
`prices`, `purchase_uris`, `related_uris`, `edhrec_rank`, `artist`, `artist_ids`, `illustration_id`, `border_color`, `frame`, `full_art`, `textless`, `booster`, `story_spotlight`, `promo`, `reprint`, `variation`, `set_uri`, `set_search_uri`, `scryfall_set_uri`, `rulings_uri`, `prints_search_uri`, `flavor_text`, `card_back_id`, `collector_number`, `digital`, `rarity`, `released_at`, `uri`, `scryfall_uri`, `highres_image`, `image_status`, `multiverse_ids`, `mtgo_id`, `tcgplayer_id`, `cardmarket_id`, `all_parts`, `games`, `reserved`, `game_changer`, `foil`, `nonfoil`, `finishes`, `oversized`, `set_type`, `lang`

Fields we **keep but don't map to CardData** (used during transform only):
`set`, `set_name`, `set_id` — we keep `set` on a separate index for printing selection in decklists.

#### `src/scryfall/bulk-loader.ts` — Download and cache

```typescript
export async function loadCardDatabase(): Promise<void>
```

1. **Check metadata**: `GET https://api.scryfall.com/bulk-data` with `User-Agent: MagicFlux/1.0`. Find the `oracle_cards` entry. Compare `updated_at` against local cache timestamp stored in `data/cache-meta.json`.

2. **Download if stale**: Stream the `download_uri` to `data/oracle-cards.json`. The response is gzip-encoded; Node's `fetch` handles decompression automatically. Write a progress callback for server startup logging.

3. **Cache metadata**: Write `{ updatedAt, downloadedAt, cardCount }` to `data/cache-meta.json`.

4. **Rate limiting**: Scryfall asks for 50-100ms between requests. Since we only make 1-2 requests (metadata + bulk download), this is trivially satisfied. If we ever add per-card API calls, use a rate limiter.

#### `src/scryfall/client.ts` — Scryfall API client

Minimal client for the two endpoints we need:
- `fetchBulkDataMetadata(): Promise<BulkDataEntry[]>`
- `downloadBulkData(url: string, destPath: string): Promise<void>`

Handles User-Agent header, HTTP errors, and retry on 5xx/network errors (1 retry with 1s delay — bulk data is idempotent).

### Type Line Parser

The `type_line` field from Scryfall is a string like `"Legendary Creature — Human Wizard"`. We need to parse it into `supertypes`, `cardTypes`, and `subtypes`.

Grammar:
```
type_line = [supertypes] card_types [" — " subtypes]
supertypes = ("Basic" | "Legendary" | "Snow" | "World")*
card_types = ("Creature" | "Instant" | "Sorcery" | ...)+
subtypes = subtype (" " subtype)*
```

Split on ` — ` (em dash with spaces, or `—` or `–`). Left side: separate supertypes from card types by checking against the known supertype list. Right side: split on spaces for subtypes.

Edge cases:
- No subtypes: `"Instant"` → supertypes=[], cardTypes=["Instant"], subtypes=[]
- Multiple types: `"Artifact Creature — Golem"` → cardTypes=["Artifact", "Creature"]
- Double-faced: Scryfall gives the front face type line by default; back face is in `card_faces[1].type_line`

### In-Memory Indexes

After parsing all cards into `CardData[]`, build these lookup structures:

```typescript
// Primary index — by Scryfall UUID (for DecklistEntry.cardDataId)
readonly byId: Map<string, CardData>

// By oracle ID — groups all printings (we only have one per oracle in this dataset)
readonly byOracleId: Map<string, CardData>

// By lowercase name — for name lookups and decklist parsing
readonly byName: Map<string, CardData>

// For split/DFC cards: also index by each face name
// "Fire // Ice" → indexed under "fire // ice", "fire", and "ice"
```

Total in-memory footprint estimate: ~30,000 cards × ~2KB each ≈ 60MB. Acceptable for a Node.js server process.

---

## 2. Mana Cost String Parser

### Input Format

Scryfall mana cost strings follow this pattern: `"{2}{W}{U}"`, `"{X}{R}{R}"`, `"{W/U}{W/U}"`, `"{2/W}"`, `"{W/P}"`.

### Grammar

```
mana_cost = symbol*
symbol    = "{" symbol_body "}"
symbol_body = generic | color | hybrid | hybrid_generic | phyrexian | snow | X | colorless

generic        = [0-9]+          → ManaSymbol { type: "generic", amount: N }
color          = [WUBRGC]        → ManaSymbol { type: "colored", color: C }
                                   (but "C" alone → { type: "colorless" })
hybrid         = [WUBRG]/[WUBRG] → ManaSymbol { type: "hybrid", colors: [A, B] }
hybrid_generic = [0-9]+/[WUBRG]  → ManaSymbol { type: "hybridGeneric", amount: N, color: C }
phyrexian      = [WUBRG]/P       → ManaSymbol { type: "phyrexian", color: C }
snow           = S               → ManaSymbol { type: "snow" }
X              = X               → ManaSymbol { type: "X" }
colorless      = C               → ManaSymbol { type: "colorless" }
```

**Ambiguity: `{C}`** — In modern MTG, `{C}` means specifically colorless mana (not generic). Map to `{ type: "colorless" }`.

### CMC Calculation

Per MTG rules:
- Generic `{N}` → N
- Colored `{W}` → 1
- Hybrid `{W/U}` → 1
- Hybrid-generic `{2/W}` → 2
- Phyrexian `{W/P}` → 1
- Snow `{S}` → 1
- `{X}` → 0 (on the card; actual value determined at cast time)
- Colorless `{C}` → 1

### Implementation: `src/parser/cost-parser.ts`

```typescript
export function parseManaCost(manaCostString: string): ManaCost
```

A simple regex-based parser. Extract all `{...}` groups, classify each one, compute CMC. This is deterministic and stateless — pure function, easy to test.

Test cases:
- `"{R}"` → [colored R], cmc=1
- `"{2}{W}{U}"` → [generic 2, colored W, colored U], cmc=4
- `"{X}{R}{R}"` → [X, colored R, colored R], cmc=2
- `"{W/U}{W/U}"` → [hybrid W/U, hybrid W/U], cmc=2
- `"{2/W}"` → [hybridGeneric 2 W], cmc=2
- `"{W/P}"` → [phyrexian W], cmc=1
- `""` or `null` → { symbols: [], totalCMC: 0 }
- `"{0}"` → [generic 0], cmc=0
- `"{C}"` → [colorless], cmc=1
- `"{S}"` → [snow], cmc=1

---

## 3. Card Registry and Instantiation

### Registry: `src/registry/card-registry.ts`

Central module that holds the loaded card database and serves queries.

```typescript
// Called once at server startup
export async function loadCardDatabase(): Promise<void>

// Lookups (all synchronous after load)
export function getCardData(cardDataId: string): CardData | undefined
export function getCardDataByName(name: string): CardData | undefined
export function searchCards(query: CardQuery): CardData[]
export function isLegalInFormat(cardDataId: string, format: string): boolean
```

`searchCards` applies filters from `CardQuery` in sequence:
1. Start with all cards (or pre-filter by name prefix using the index)
2. Filter by types, colors, format, keywords, cmc
3. Apply `limit`
4. Return results

### Instantiation: `src/registry/card-registry.ts`

```typescript
export function instantiateCard(
  cardData: CardData,
  owner: string,
  instanceId: string
): CardInstance
```

The three-tier system (DEC-008):

```
[1] Keyword registry → generate abilities from cardData.keywords
         ↓
[2] Oracle parser → parse oracleText into structured SpellAbility[]
         ↓
[3] Override check → if override exists for this card, replace abilities
         ↓
[4] Add implicit "cast this spell" SpellAbility
         ↓
[5] Set base stats (power/toughness from CardData, parse "*" → null for CDA)
         ↓
Return CardInstance with all abilities populated
```

For Phase 2: steps 1 and 2 will be minimal (no keywords, basic oracle parsing). Manual overrides (step 3) carry the load for the initial 10 cards.

---

## 4. Card Implementation Pattern (Manual Overrides)

### Structure: `src/overrides/`

One file per card (or per card group for trivially similar cards):

```
overrides/
  lightning-bolt.ts
  counterspell.ts
  giant-growth.ts
  shock.ts
  dark-ritual.ts
  doom-blade.ts
  healing-salve.ts
  ancestral-recall.ts
  naturalize.ts
  divination.ts
```

### Override Interface

Each override exports a function that returns the `SpellAbility[]` for that card:

```typescript
import type { SpellAbility, Effect, TargetRequirement } from "@magic-flux/types";

export interface CardOverride {
  /** Card name (exact match against CardData.name) */
  readonly cardName: string;
  /**
   * Returns the abilities for this card.
   * Called during instantiateCard, replaces parser/keyword output.
   */
  getAbilities(cardDataId: string): SpellAbility[];
}
```

### Example: Lightning Bolt

```typescript
// overrides/lightning-bolt.ts
export const lightningBolt: CardOverride = {
  cardName: "Lightning Bolt",
  getAbilities(cardDataId) {
    return [{
      id: `${cardDataId}:spell`,
      type: "spell",
      sourceCardInstanceId: null, // set during instantiation
      effects: [{
        type: "dealDamage",
        amount: 3,
        to: { targetRequirementId: "t1" },
      }],
      zones: [ZoneType.Hand],
    }];
  },
};
```

The override doesn't define targeting — that comes from the `StackItem` when the spell is cast. Wait, actually looking at the types more carefully:

- `SpellAbilitySpell` has `effects` but no `targets` field
- `SpellAbilityActivated` and `SpellAbilityTriggered` have `targets`
- For spells, targeting is implicit in the effects' `TargetRef`

Actually, the spell needs its target requirements declared somewhere so `getLegalActions` can check if valid targets exist. Looking at the current types, `SpellAbilitySpell` extends `SpellAbilityBase` which doesn't have a `targets` field.

**Potential contract issue:** `SpellAbilitySpell` needs a `targets` field for the engine to validate targeting on cast. The engine's `getLegalActions` must know what targets a spell requires to determine castability. I will raise this with the Project Planner if it's not already addressed in the engine's implementation.

For now, assume spells carry their target requirements, and the override pattern includes them:

```typescript
// Conceptual — exact shape depends on how the engine consumes spell targets
getAbilities(cardDataId) {
  const targets: TargetRequirement[] = [{
    id: "t1",
    description: "any target",
    count: { exactly: 1 },
    targetTypes: ["creature", "player", "planeswalker"],
    filter: null,
    controller: "any",
  }];

  return [{
    id: `${cardDataId}:spell`,
    type: "spell" as const,
    sourceCardInstanceId: null,
    effects: [{
      type: "dealDamage" as const,
      amount: 3,
      to: { targetRequirementId: "t1" },
    }],
    zones: [ZoneType.Hand],
    targets, // ← needs to be on SpellAbilitySpell
  }];
},
```

### Override Registry

```typescript
// src/overrides/index.ts
const overrides = new Map<string, CardOverride>();

export function registerOverride(override: CardOverride): void
export function getOverride(cardName: string): CardOverride | undefined
export function hasOverride(cardName: string): boolean
```

All override files register themselves when imported. The registry module imports all override files at load time.

---

## 5. The 10 Phase 2 Card Implementations

Quick analysis of what each card needs from the engine:

| Card | Mana Cost | Effect Type | Engine Dependencies |
|------|-----------|-------------|---------------------|
| Lightning Bolt | {R} | dealDamage 3 to any target | target validation, damage dealing |
| Shock | {R} | dealDamage 2 to any target | same as Bolt |
| Giant Growth | {G} | modifyPT +3/+3 until EOT | P/T modification, duration tracking |
| Healing Salve | {W} | gainLife 3 OR preventDamage 3 | modal choice, life gain, damage prevention |
| Dark Ritual | {B} | addMana {B}{B}{B} | mana addition to pool |
| Ancestral Recall | {U} | drawCards 3 | card draw from library |
| Counterspell | {U}{U} | counter target spell | stack interaction, counter |
| Doom Blade | {1}{B} | destroy target nonblack creature | destroy, target filter (nonblack) |
| Naturalize | {1}{G} | destroy target artifact or enchantment | destroy, target filter (artifact/enchantment) |
| Divination | {2}{U} | drawCards 2 | card draw (sorcery speed) |

**Dependency grouping:**
- **Can implement once stack exists:** All 10 (they all go on the stack)
- **Simple (single effect):** Shock, Lightning Bolt, Giant Growth, Dark Ritual, Ancestral Recall, Divination, Doom Blade, Naturalize
- **Modal:** Healing Salve (choose one of two effects)
- **Stack-interacting:** Counterspell (targets a spell on the stack)

---

## 6. What I Can Build Now (Before Engine Is Complete)

These components depend **only on `@magic-flux/types`**, not on engine runtime:

1. **Package scaffolding** — `package.json`, `tsconfig.json`, `vitest.config.ts`
2. **Scryfall types** — `src/scryfall/types.ts`
3. **Scryfall client** — `src/scryfall/client.ts`
4. **Bulk data loader** — `src/scryfall/bulk-loader.ts`
5. **Mana cost string parser** — `src/parser/cost-parser.ts`
6. **Type line parser** — helper for CardData transform
7. **Scryfall → CardData transformer** — mapping function
8. **Card registry** (data loading and queries) — `src/registry/card-registry.ts`
9. **`isLegalInFormat`** — uses only CardData.legalities
10. **Override registry structure** — `src/overrides/index.ts`
11. **Override stubs** for all 10 cards (can define effects using types; can't test resolution without engine)

**Must wait for engine:**
- `instantiateCard` full implementation (needs to know how engine consumes abilities)
- Card behavior tests (need `executeAction` to verify effects resolve correctly)
- The `targets` field question on `SpellAbilitySpell`

---

## 7. Open Questions for Project Planner

1. **SpellAbilitySpell.targets**: The `SpellAbilitySpell` interface lacks a `targets` field. Spells like Lightning Bolt need target requirements so the engine can validate targeting on cast and check `getLegalActions`. Should `SpellAbilitySpell` be extended with `targets: readonly TargetRequirement[]`?

2. **CardData.parsedManaCost**: CardData has a `parsedManaCost` field. This means the cost parser runs during the Scryfall → CardData transform, not lazily. Confirmed — we'll parse all costs at load time. ~30K cards × trivial parse = negligible.

3. **Token lookups**: Scryfall's Oracle Cards includes tokens (`isToken: true`). Should the card registry index these separately, or mixed into the main lookup? Token creation effects reference tokens by name, so `getCardDataByName("Soldier")` needs to find token data. Recommend: same index, but `searchCards` filters by `isToken` when needed.
