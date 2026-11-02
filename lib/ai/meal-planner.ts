import { normalizeArabic, searchTokens } from "../utils/arabic"
import { storeDistanceKm } from "../utils/geo"
import { parseFoodDetails } from "./food-details"
import { validLocation, type Protein, type ShoppingRequest } from "./shopping-request"

export type MealProduct = {
  id: string; name: string; description?: string; category?: string; stock: number
  price: number; unit_price: number; store_id: string; store_name: string
  discount_percentage: number; image_url: string | null
  weight?: unknown; weight_unit?: unknown; food_details?: unknown
}
export type MealStore = { id: string; name?: string; category?: string; latitude?: number | null; longitude?: number | null }
export type MealLine = { product: MealProduct; quantity: number; concept: string }
export type MealOption = {
  id: string; title: string; kind: "single" | "multi"; meal_type: "ready" | "cook"
  lines: MealLine[]; people: number; store_ids: string[]; subtotal: number; distance_km: number
  note: string
  recipe_steps?: string[]
}
type Ingredient = { key: string; label: string; words: string[]; amount: number; unit: "g" | "ml" | "piece"; exclude?: string[]; basic?: boolean }
type Recipe = { id: string; title: string; protein: Protein; ingredients: Ingredient[] }
const rice: Ingredient = { key: "rice", label: "أرز", words: ["ارز", "رز", "rice"], amount: 100, unit: "g" }
const onion: Ingredient = { key: "onion", label: "بصل", words: ["بصل", "onion"], amount: 60, unit: "g" }
const tomato: Ingredient = { key: "tomato", label: "طماطم", words: ["طماطم", "tomato"], amount: 100, unit: "g", exclude: ["كاتشب", "ketchup", "صلصه", "sauce"] }
const oil: Ingredient = { key: "oil", label: "زيت طعام", words: ["زيت", "oil"], amount: 15, unit: "ml", exclude: ["شعر", "بشره", "خروع", "hair", "castor", "body", "كريم"], basic: true }
const salt: Ingredient = { key: "salt", label: "ملح", words: ["ملح", "salt"], amount: 2, unit: "g", basic: true }
const pepper: Ingredient = { key: "pepper", label: "فلفل أسود", words: ["فلفل اسود", "black pepper"], amount: 1, unit: "g", basic: true }
const chicken: Ingredient = { key: "chicken", label: "فراخ", words: ["فراخ", "دجاج", "chicken"], amount: 350, unit: "g", exclude: ["مرقه", "شوربه", "مكعب", "نكهه", "flavour", "flavor", "stock", "bouillon", "soup", "توابل", "بهارات"] }
const meat: Ingredient = { key: "meat", label: "لحمة", words: ["لحمه", "لحم", "beef", "meat"], amount: 200, unit: "g", exclude: ["مرقه", "مكعب", "نكهه", "stock", "bouillon", "flavour", "flavor"] }
const fish: Ingredient = { key: "fish", label: "سمك", words: ["سمك", "بلطي", "بوري", "fish", "tilapia"], amount: 350, unit: "g", exclude: ["زيت", "oil", "كبسول", "capsule", "نكهه"] }
const pasta: Ingredient = { key: "pasta", label: "مكرونة", words: ["مكرونه", "مكرونة", "pasta", "macaroni"], amount: 125, unit: "g" }
const potato: Ingredient = { key: "potato", label: "بطاطس", words: ["بطاطس", "potato"], amount: 200, unit: "g", exclude: ["شيبس", "شيبسي", "chips", "crisps", "نكهه"] }
const egg: Ingredient = { key: "egg", label: "بيض", words: ["بيض", "egg", "eggs"], amount: 3, unit: "piece", exclude: ["شامبو", "shampoo", "مايونيز"] }
const bread: Ingredient = { key: "bread", label: "عيش", words: ["عيش", "خبز", "bread"], amount: 2, unit: "piece" }
// Quantities are per adult, approximate cooking amounts. Display this explicitly; never nutritional advice.
const recipes: Recipe[] = [
  { id: "chicken-rice", title: "فراخ وأرز", protein: "chicken", ingredients: [chicken, rice, onion, oil, salt, pepper] },
  { id: "chicken-potato", title: "صينية فراخ وبطاطس", protein: "chicken", ingredients: [chicken, potato, onion, tomato, oil, salt, pepper] },
  { id: "fish-rice", title: "سمك وأرز", protein: "fish", ingredients: [fish, rice, onion, oil, salt, pepper] },
  { id: "meat-rice", title: "لحمة وأرز", protein: "meat", ingredients: [meat, rice, onion, tomato, oil, salt, pepper] },
  { id: "meat-pasta", title: "مكرونة باللحمة", protein: "meat", ingredients: [meat, pasta, onion, tomato, oil, salt, pepper] },
  { id: "egg-potato", title: "بيض وبطاطس وعيش", protein: "egg", ingredients: [egg, potato, bread, oil, salt, pepper] },
  { id: "tuna-sandwich", title: "سندوتشات تونة وطماطم", protein: "fish", ingredients: [{ key: "tuna", label: "تونة", words: ["تونه", "tuna"], amount: 150, unit: "g" }, bread, tomato] },
  { id: "lentil-rice", title: "عدس وأرز", protein: "vegetarian", ingredients: [{ key: "lentil", label: "عدس", words: ["عدس", "lentil", "lentils"], amount: 100, unit: "g" }, rice, onion, tomato, oil, salt, pepper] },
  { id: "koshari", title: "كشري", protein: "vegetarian", ingredients: [{ ...rice, amount: 60 }, { ...pasta, amount: 60 }, { key: "lentil", label: "عدس بجبة", words: ["عدس بجبه", "عدس اسمر", "brown lentils"], amount: 40, unit: "g" }, { key: "chickpeas", label: "حمص", words: ["حمص", "chickpeas"], amount: 30, unit: "g" }, onion, tomato, oil, salt, pepper] },
]
const recipeSteps: Record<string, string[]> = {
  "chicken-rice": ["تبّل الفراخ بالملح والفلفل والبصل، وسوّيها في الفرن أو الحلة لحد ما تستوي تمامًا.", "اغسل الأرز وسوّيه بالمياه وقليل من الزيت، وقدّمه مع الفراخ."],
  "chicken-potato": ["قطّع البطاطس والبصل والطماطم وحطّهم في صينية مع الفراخ والزيت والملح والفلفل.", "ضيف مياه حسب الحاجة وسوّي الصينية في الفرن لحد ما الفراخ والبطاطس يستووا تمامًا."],
  "fish-rice": ["نضّف السمك وتبّله بالملح والفلفل، وسوّيه في الفرن مع قليل من الزيت لحد ما يستوي.", "شوّح البصل وسوّي معاه الأرز بالمياه، وقدّمه مع السمك."],
  "meat-rice": ["شوّح البصل واللحمة بالزيت، وضيف الطماطم والملح والفلفل ومياه حسب الحاجة.", "كمّل تسوية اللحمة لحد ما تستوي وتطرى، وسوّي الأرز في حلة منفصلة."],
  "meat-pasta": ["اسلق المكرونة في المياه وصفّيها.", "سوّي اللحمة مع البصل والزيت والطماطم والملح والفلفل لحد ما تستوي تمامًا، وقدّمها مع المكرونة."],
  "egg-potato": ["قطّع البطاطس واسلقها أو سوّيها بقليل من الزيت والملح والفلفل.", "سوّي البيض تمامًا بالطريقة اللي تفضلها، وقدّمه مع البطاطس والعيش."],
  "tuna-sandwich": ["صفّي التونة وقطّع الطماطم.", "وزّع التونة والطماطم على العيش بالكميات الموضحة."],
  "lentil-rice": ["اغسل العدس وسوّيه مع البصل والطماطم والمياه والملح والفلفل.", "سوّي الأرز بقليل من الزيت في حلة منفصلة، وقدّمه مع العدس."],
  "koshari": ["انقع الحمص وسوّيه، واسلق العدس والمكرونة وسوّي الأرز كل واحد حسب حاجته.", "حمّر البصل بالزيت، وسوّي الطماطم مع الملح والفلفل لعمل صلصة بسيطة.", "اجمع الأرز والعدس والمكرونة والحمص، وضيف الصلصة والبصل. الخل والشطة إضافات اختيارية غير محسوبة في السلة."],
}

function proteinAllowed(actual: string, wanted: Protein): boolean {
  return wanted === "any" || wanted === actual || (wanted === "animal" && ["chicken", "meat", "fish", "egg"].includes(actual))
}

/** Flavoring is not the raw protein a concept requests. Named bouillon queries still work. */
export function foodConceptAllows(name: string, concept: string): boolean {
  const tokens = searchTokens(concept)
  const head = tokens[0]
  const ingredient = [chicken, meat, fish, egg].find((i) => i.words.some((w) => searchTokens(w)[0] === head))
  if (!ingredient) return true
  const normalized = normalizeArabic(name)
  return !ingredient.exclude?.some((word) => normalized.includes(normalizeArabic(word)))
}

function packSize(p: MealProduct, unit: Ingredient["unit"]): number | null {
  const details = parseFoodDetails(p.food_details)
  if (details?.kind === "ingredient") return details.pack_unit === unit ? details.pack_quantity! : null
  if (details?.kind === "meal") return null
  const amount = Number(p.weight)
  const weightUnit = normalizeArabic(String(p.weight_unit || ""))
  const factor: Partial<Record<string, number>> = unit === "g" ? { g: 1, kg: 1000 } : unit === "ml" ? { ml: 1, l: 1000 } : { pcs: 1, piece: 1 }
  const multiplier = factor[weightUnit]
  if (Number.isFinite(amount) && amount > 0 && multiplier) return amount * multiplier
  // Source labels only. No default "1 kg" for an unlabelled unit or per-kilo price.
  const name = normalizeArabic(p.name)
  const expression = unit === "g" ? /(\d+(?:\.\d+)?)\s*(كيلو(?:جرام)?|كجم|kg|جرام|جم|gm|g)(?=$|[^\p{L}])/u :
    unit === "ml" ? /(\d+(?:\.\d+)?)\s*(لتر|liter|litre|l|مل(?:لي)?|ml)(?=$|[^\p{L}])/u :
    /(\d+)\s*(?:قطعه|قطع|رغيف|ارغفه|بيضه|بيضات|pcs|pieces|eggs)(?=$|[^\p{L}])/u
  const match = expression.exec(name)
  if (!match) return null
  const value = Number(match[1]) * (unit !== "piece" && /^(?:كيلو|كجم|kg|لتر|liter|litre|l$)/.test(match[2]) ? 1000 : 1)
  return Number.isFinite(value) && value > 0 ? value : null
}

function matchesIngredient(product: MealProduct, ingredient: Ingredient): boolean {
  const name = normalizeArabic(product.name)
  const category = normalizeArabic(product.category || "")
  if (/medicine|cleaning|skincare|haircare|vitamin|pet|دواء|ادويه|منظف|بشره|شعر|قطط|كلاب/.test(category)) return false
  if (/شامبو|كريم|منظف|دواء|كبسول|قطط|كلاب|shampoo|cream|cleaner|capsule|cat food|dog food/.test(name)) return false
  const details = parseFoodDetails(product.food_details)
  if (details?.kind === "meal") return false
  if (/(?:مشوي|مقلي|وجبه|سندوتش|sandwich|grilled|fried|meal)/.test(name) && details?.kind !== "ingredient") return false
  if (ingredient.exclude?.some((word) => name.includes(normalizeArabic(word)))) return false
  const tokens = searchTokens(name)
  return ingredient.words.some((word) => searchTokens(word).every((token) => tokens.includes(token)))
}

function chooseLines(products: MealProduct[], ingredients: Ingredient[], people: number): MealLine[] | null {
  const lines: MealLine[] = []
  for (const ingredient of ingredients) {
    const choices = products.flatMap((p) => {
      if (!matchesIngredient(p, ingredient)) return []
      const pack = packSize(p, ingredient.unit)
      if (!pack) return []
      const quantity = Math.ceil(ingredient.amount * people / pack)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > p.stock) return []
      return [{ product: p, quantity, concept: `${ingredient.label} · ${ingredient.amount * people} ${ingredient.unit === "g" ? "جم" : ingredient.unit === "ml" ? "مل" : "قطعة"} تقريبًا` }]
    }).sort((a, b) => a.quantity * a.product.unit_price - b.quantity * b.product.unit_price || a.product.id.localeCompare(b.product.id))
    if (!choices.length) return null
    lines.push(choices[0])
  }
  // One physical product may satisfy multiple requirements: aggregate, then check combined stock.
  const combined = new Map<string, MealLine>()
  for (const line of lines) {
    const prev = combined.get(line.product.id)
    combined.set(line.product.id, prev ? { ...prev, quantity: prev.quantity + line.quantity, concept: prev.concept + "، " + line.concept } : line)
  }
  const result = [...combined.values()]
  return result.some((line) => line.quantity > line.product.stock) ? null : result
}

export function planMeals(products: MealProduct[], stores: MealStore[], request: ShoppingRequest, mode: "single_store" | "multi_store" | "customer_choice"): MealOption[] {
  if (!request.people || !request.location) return []
  const distances = new Map<string, number>()
  for (const store of stores) {
    if (!validLocation({ lat: store.latitude, lng: store.longitude })) continue
    const distance = storeDistanceKm(request.location, store)
    if (distance !== null && Number.isFinite(distance) && distance <= request.radiusKm) distances.set(store.id, distance)
  }
  const available = products.filter((p) => distances.has(p.store_id) && Number.isFinite(p.stock) && p.stock > 0 &&
    Number.isFinite(p.unit_price) && p.unit_price >= 0 && Number.isFinite(p.price) && p.price > 0)
  const out: MealOption[] = []
  const append = (id: string, title: string, type: "ready" | "cook", lines: MealLine[], note: string) => {
    const storeIds = [...new Set(lines.map((l) => l.product.store_id))].sort()
    out.push({ id, title, kind: storeIds.length === 1 ? "single" : "multi", meal_type: type, lines, people: request.people!, store_ids: storeIds,
      subtotal: Math.round(lines.reduce((s, l) => s + l.product.unit_price * l.quantity, 0) * 100) / 100,
      distance_km: Math.max(...storeIds.map((id) => distances.get(id)!)), note })
  }
  if (request.foodMode !== "cook") {
    for (const p of available) {
      let details = parseFoodDetails(p.food_details)
      if (!details) {
        // Explicit legacy portion labels are source data too; a generic "family offer" is insufficient.
        const text = normalizeArabic(`${p.name} ${p.description || ""}`)
        const portions = /(?:تكفي|يكفي)\s*(\d{1,2})\s*(?:افراد|اشخاص|فرد|شخص)/.exec(text)
        const protein = /فراخ|دجاج|chicken/.test(text) ? "chicken" : /لحمه|لحم|كفته|كبده|beef/.test(text) ? "meat" : /سمك|تونه|سردين|fish|tuna/.test(text) ? "fish" : /بيض|eggs?/.test(text) ? "egg" : /نباتي/.test(text) ? "vegetarian" : null
        if (portions && protein && /وجبه|وجبات|meal/.test(text)) details = parseFoodDetails({ kind: "meal", protein, servings: Number(portions[1]) })
      }
      // A full meal requires a merchant-declared portion count and protein, never a guess from its title.
      if (details?.kind !== "meal" || !proteinAllowed(details.protein, request.protein)) continue
      if (request.dish && !normalizeArabic(p.name).includes(request.dish)) continue
      const quantity = Math.ceil(request.people / details.servings!)
      if (quantity > p.stock) continue
      append(`ready:${p.id}`, p.name, "ready", [{ product: p, quantity, concept: `${quantity} × وجبة تكفي ${details.servings} فرد حسب بيانات المتجر` }], "عدد الحصص حسب بيانات المتجر")
    }
  }
  if (request.foodMode !== "ready") {
    for (const recipe of recipes.filter((r) => proteinAllowed(r.protein, request.protein) && (!request.dish || normalizeArabic(r.title).includes(request.dish)))) {
      const ingredients = recipe.ingredients.filter((i) => !i.basic || !request.pantryBasics)
      for (const storeId of [...distances.keys()].sort()) {
        const lines = chooseLines(available.filter((p) => p.store_id === storeId), ingredients, request.people)
        if (lines) {
          append(`${recipe.id}:${storeId}`, recipe.title, "cook", lines, "كميات الطبخ تقديرية للأفراد البالغين؛ السعر يشمل شراء العبوات كاملة")
          out[out.length - 1].recipe_steps = recipeSteps[recipe.id]
        }
      }
      if (mode !== "single_store") {
        const lines = chooseLines(available, ingredients, request.people)
        if (lines && new Set(lines.map((l) => l.product.store_id)).size > 1) {
          append(`${recipe.id}:multi`, recipe.title, "cook", lines, "كميات الطبخ تقديرية للأفراد البالغين؛ السعر يشمل شراء العبوات كاملة")
          out[out.length - 1].recipe_steps = recipeSteps[recipe.id]
        }
      }
    }
  }
  // Bound pricing work, but retain different recipes before extra store variants of the same recipe.
  out.sort((a, b) => a.subtotal - b.subtotal || a.distance_km - b.distance_km || a.id.localeCompare(b.id))
  const first: MealOption[] = [], rest: MealOption[] = []
  const seen = new Set<string>()
  for (const option of out) {
    const key = `${option.meal_type}:${option.title}`
    if (seen.has(key)) rest.push(option)
    else { first.push(option); seen.add(key) }
  }
  return [...first, ...rest].slice(0, 40)
}
