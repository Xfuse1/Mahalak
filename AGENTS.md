# AGENTS.md — قواعد العمل على ريبو محلك

هذا الملف هو المصدر الوحيد لقواعد أي وكيل (Claude Code / OpenCode / غيره) يعمل على هذا الريبو.
كل رقم وكل حالة أمر في هذا الملف **مقيسة فعليًا** على هذه الشجرة بتاريخ 2026-07-30 على الكوميت `f05df5f`، لا مأخوذة من ملف إعدادات.

---

## 1) المشروع

**محلك (Mahalak)** — منصّة تجارة محلية في مصر: واجهة عميل (تصفّح متاجر/منتجات، سلة، checkout بالدفع عند الاستلام)، لوحة بائع (منتجات، طلبات، دفتر ديون، تسويات، استيراد كتالوج من Excel)، كاشير POS (عام + صيدلية + ملابس)، تطبيق سائق/توزيع طلبات، ولوحة أدمن (اعتماد متاجر، سائقون، شكاوى، عمولة).

**الـ stack بنسخه المقيسة:**

| العنصر | النسخة |
|---|---|
| Next.js | 16.1.3 (App Router، `next build --webpack`) |
| React | 19.2.3 |
| TypeScript | 5.9.3 (`strict: true`) |
| Node / npm (بيئة المالك) | v24.12.0 / 11.6.2 — `engines.node >= 20` |
| مدير الحزم | **npm** (`package-lock.json` موجود ومتتبَّع؛ لا pnpm/yarn) |
| قاعدة البيانات | **Firebase Firestore** — قراءة/كتابة عبر `firebase-admin` 12.7.0 سيرفر-سايد؛ عميل Firebase 10.14.1 للمصادقة والرسائل فقط |
| التخزين | **Cloudflare R2** عبر `@aws-sdk/client-s3` (نطاق العرض `cdn.m7lk.com`) |
| الأنماط | Tailwind CSS 4.1.9 + tokens في `app/globals.css` |
| الاختبار | Vitest 2.1.9 (بيئة node) |
| الاستضافة | Vercel (`.vercel/` موجود، `deploy:vercel` في package.json) |

**شكل المجلدات:**

```
app/                 صفحات App Router + app/api/**/route.ts (19 مسار، كلها تحت /api/driver و /api/cron)
  admin/ seller/ pos/ driver/ account/ store/ product/ cart/ checkout/ supermarket/
components/          مكوّنات مشتركة + components/ui (shadcn-style) + components/dashboard
lib/
  actions/           25 ملف server actions — كل الطفرات (أول سطر "use server" في 25/25)
  auth/              session.ts (جلسة المستخدم) · driver-session.ts (جلسة السائق) · roles.ts (تعريف الأدوار)
  delivery/          dispatch.ts · fee.ts · bids.ts · location.ts · dispatch-timeout.ts
  firebase/          admin.ts (Admin SDK) · client.ts · firestore-helpers.ts
  storage/           public-url.ts (محوّل المسار→رابط) · r2.ts · kyc-key.ts · legacy-url.ts
  utils/             phone.ts · geo.ts · rate-limit.ts · offer-discount.ts · product-pricing.ts
  import/            parse.ts · images.ts (استيراد كتالوج)
middleware.ts        حارس كوكي على /seller و /account فقط
firestore.rules · storage.rules · firestore.indexes.json
.github/workflows/ci.yml
docs/                خطط ووثائق استراتيجية (6 ملفات متتبَّعة)
scripts/             سكربتات صيانة تمسّ قاعدة البيانات الحقيقية — ممنوعة (انظر §3)
testsprite_tests/    سكربتات Playwright بايثون مولَّدة (ليست بوابة — انظر §2)
```

**نقاط الدخول:** `app/layout.tsx` (الجذر) · `middleware.ts` · `app/api/**/route.ts` · كل دالة مُصدَّرة من `lib/actions/*.ts` هي **نقطة دخول عامة** على الشبكة (انظر §4).

---

## 2) الـ gates

كل الأرقام أدناه من تشغيل حقيقي على هذه الشجرة، بالتقاط `$?` من لوج مُعاد توجيهه (لا `| tail`).

| الأمر | يشتغل؟ | خط الأساس المقيس | الحكم |
|---|---|---|---|
| `npx tsc --noEmit` | ✅ يشتغل | **exit 0 — صفر أخطاء، صفر مخرجات** | 🔴 **حاكم — لازم يفضل نظيف** |
| `npm test` | ✅ يشتغل | **exit 0 — 6 ملفات / 85 تست / 85 ناجح / ~5 ثوان** | 🔴 **حاكم — لازم يفضل نظيف** |
| `npm run check:auth-types` | ✅ يشتغل | **exit 0 — صفر أخطاء** | فرعي (نطاقه ملفات المصادقة فقط، `tsconfig.auth.json`) |
| `npm run lint` | ⚠️ يشتغل لكن **أحمر عند خط الأساس** | **exit 1 — 4 أخطاء + 5 تحذيرات** | إرشادي فقط — **لا تُصلَّح ولا تزيد** |
| `npm run build` | ✅ يشتغل | **exit 0** | ✅ **مسموح ومطلوب قبل أي دفع إلى `main`** — انظر أدناه |
| `testsprite_tests/*.py` | ❌ **مكسور كبوابة** | لا يوجد runner ولا `requirements.txt` ولا سكربت npm؛ يحتاج سيرفر حيّ + حسابات حقيقية | ❌ **ممنوع تشغيله** |

**البوابة الحاكمة = `npx tsc --noEmit` + `npm test`.** هذا ليس اختيارًا: `.github/workflows/ci.yml` يجعلهما الحارسين الصلبين (`fails the build on any type error`) ويشغّل `npm run lint` بـ `continue-on-error: true`. لاحظ أن `npx tsc --noEmit` **غير موجود في `package.json`** — هو أمر CI فقط، فلا تبحث عنه في السكربتات.

### تفصيل خط أساس lint (4 أخطاء + 5 تحذيرات — كلها سابقة لأي عمل جديد)

الأخطاء الأربعة كلها في سطر واحد:
- `app/admin/dispatch/page.tsx:98` — أربع مرات `react/no-unescaped-entities` (علامات `"` عربية داخل JSX)، من الكوميت `2a7a95d`.

التحذيرات الخمسة:
- `app/store/[id]/page.tsx:153` — `react-hooks/exhaustive-deps`
- `components/dispatch-monitor-map.tsx:58` و `:101` — `eslint-disable` غير مستخدَم
- `lib/sms/send.ts:23` — `eslint-disable` غير مستخدَم
- `public/sw.js:1` — `eslint-disable` غير مستخدَم

**التعليمة:** شغّل `npm run lint` للمقارنة فقط. إن ظهرت أخطاء **جديدة** في ملفاتك أصلحها؛ الأربعة أعلاه تُترك كما هي. إصلاحها تغيير خارج النطاق (`app/admin/dispatch/page.tsx` ليس في نطاق أي مهمة إلا لو نصّ عليه الـ brief).

### `npm run build` — مسموح، ومطلوب قبل أي دفع إلى `main` (قرار المالك 2026-08-07)

المنع السابق أُلغي بالكامل. السبب المباشر واقعة مقيسة: `export const` من ملف `"use server"` **يكسر البناء** وهو خطأ مُجمِّع لا خطأ أنواع، فمرّ من `npx tsc --noEmit` ومن 349 تستًا معًا ولم يُمسك إلا بالبناء. أي أن البوابتين الحاكمتين **عمياوان عن صنف أخطاء كامل** يخصّ حدود سيرفر/عميل في Next:

- تصدير غير-دالّة من ملف `"use server"`
- استيراد قيمة سيرفرية داخل مكوّن عميل
- أخطاء التوليد الساكن (prerender) في مكوّنات السيرفر

⇒ **`tsc` + `test` تبقيان البوابتين الحاكمتين لكل عمل، ويُضاف `npm run build` قبل أي دفع إلى `main`** لأن الدفع إلى `main` نشرٌ إنتاجي مباشر.

ثلاث ملاحظات تشغيلية تبقى صحيحة (وصفٌ لا منع):
1. **يقرأ Firestore الإنتاج وقت البناء** — `app/store/page.tsx:8-14` يستدعي `getStores()` في مكوّن سيرفر يُبنى prerendered. قراءة فقط وملفوفة في `try/catch`.
2. **يحتاج `.env.local`** — موجود على جهاز المالك. يبقى **ممنوعًا قراءته أو طباعة أي قيمة منه** (§3)؛ البناء يستهلكه ولا يعرضه.
3. ينتج `.next/` و`tsconfig.tsbuildinfo` — ضجيج لا يدخل الـdiff (مُستبعَد في `.gitignore`).

CI لا يشغّل `build` (اختار `tsc` لأنها بلا أسرار) — فهذه مسؤولية مَن يدفع لا مسؤولية CI.

### `npm run dev` — ممنوع

يوسّخ الشجرة **بلا أي تعديل منك**: `dev-log.txt`, `dev-server.out.log`, `dev-server.err.log`, `.next-dev.log`, `.next-dev.err.log` كلها **ملفات متتبَّعة في git** (انظر §6/بند 10)، وتشغيل dev يكتب فيها فيظهر diff كاذب. كما أنه يتصل بـ Firestore الإنتاج.

### لا يوجد إطار E2E عامل

`testsprite_tests/` سكربتات Playwright بايثون مولَّدة (28 ملف متتبَّع) بلا مُشغِّل ولا اعتماديات ولا سكربت npm. **إضافة إطار E2E أو أي إطار اختبار جديد = قرار بشري للمالك، لا يتخذه وكيل.** إطار الاختبار الوحيد العامل هو Vitest، ونطاقه محدَّد في `vitest.config.ts:13` بـ `lib/**/*.test.ts` و `app/**/*.test.ts` — اختبار مكتوب خارج هذين المسارين **لن يُشتغَّل** ولن يحميك.

---

## 3) الممنوعات الصارمة (على المنفّذ — implementer)

- **ممنوع أي كتابة في git:** لا `git add`، لا `git commit`، لا `git push`، لا `git tag`. المراجع وحده يعمل الكوميت.
- **ممنوع أي أمر git يضيّع عملًا:** لا `git checkout`، لا `git switch`، لا `git restore`، لا `git reset`، لا `git clean`، لا `git stash`، لا `git rebase`، لا `git revert`. القراءة مسموحة (`git status`, `git diff`, `git log`, `git show`).
- **ممنوع أي أمر يمسّ قاعدة بيانات أو خدمة حقيقية.** لا يوجد Firebase emulator في هذا المشروع (`firebase.json` فيه `firestore` و `storage` فقط، ولا ذكر لـ emulator في أي ملف) ⇒ **أي اتصال بـ Firestore هو اتصال بالإنتاج**. المحظور تحديدًا:
  - `npm run setup:firebase` و `npm run setup:firebase:cleanup` (ينشئ/يحذف مجموعات في الإنتاج)
  - `npm run normalize:phones` (يعدّل أرقام مستخدمين حقيقيين عند `--apply`)
  - `npm run deploy:vercel` (نشر إنتاج)
  - `firebase deploy` بأي صيغة (بما فيها `--only firestore:rules,storage:rules`) — نشر القواعد قرار وعمل المالك
  - `npm run dev` / `npm start` / `npm run preview` — (`npm run build` **لم يعد ممنوعًا**: انظر §2)
  - أي سكربت في `scripts/`، وأي كود مؤقّت تكتبه أنت لتجريب استدعاء Firestore
- **ممنوع قراءة أو طباعة `.env`:** لا `cat`, لا `Read`, لا `grep`, لا `Get-Content` على `.env.local` أو أي `.env*` (كلها في `.gitignore`). أسماء المتغيّرات كافية وهي مستنبطة من الكود؛ إن احتجت اسمًا فاستنبطه من `process.env.X` في المصدر. لا تكتب قيمة سرّ في أي ملف ولا في تقريرك ولا في رسالة كوميت.
- **ممنوع توسيع النطاق:** لا refactor، لا ترقية حزم، لا تنسيق جماعي، لا "إصلاح بالمناسبة" لملف لم يذكره الـ brief. أي مشكلة تكتشفها خارج النطاق → **اذكرها في تقريرك ولا تلمسها**.
- **ممنوع تعديل الـ gates أو تخفيفها:** لا تلمس `.github/workflows/ci.yml`، `eslint.config.mjs`، `tsconfig*.json`، `vitest.config.ts`، ولا تضيف `ignoreBuildErrors`/`eslint-disable`/`@ts-ignore`/`as any` للمرور من فحص. `next.config.mjs:5` يحمل `ignoreBuildErrors: false` بتعليق صريح — إعادته إلى `true` تُلغي البوابة الحاكمة كلها.
- **ممنوع لمس ملفات الأمان بلا نصّ صريح في الـ brief:** `firestore.rules`، `storage.rules`، `middleware.ts`، `lib/auth/*`، `next.config.mjs`.
- **ممنوع حذف أو تجاهل `crmAndCacher1`** — مدخل submodule معطوب (انظر §6/بند 9). أي أمر يلمسه قد ينتج نتائج غريبة.

---

## 4) قواعد الكود المُلزِمة

كل قاعدة أدناه لها دليل مباشر في الكود، والسطر يقول **لماذا** لا "إيه" فقط.

### أ) الهوية والصلاحيات

1. **هوية المستدعي تُشتق من الجلسة سيرفر-سايد، ولا تُقبل أبدًا من العميل.** استخدم `getCurrentUid` / `requireUid` / `requireOwner` من [lib/auth/session.ts](lib/auth/session.ts) (سطور 22، 43، 55)، وللسائق `getCurrentDriverId` من [lib/auth/driver-session.ts:48](lib/auth/driver-session.ts#L48). *لماذا:* كل دالة مُصدَّرة من `lib/actions/*` هي **endpoint عام** يقبل أي payload من أي شخص — 24 من 25 ملف actions يستدعي أحد هذه الحُرّاس بالفعل، والملاحظات في الكود تقول ذلك صراحة (`orders.ts:383` «لا نثق بـ callerId من العميل»). أي دالة جديدة بلا حارس = ثغرة، لا سهو.
2. **حارس الأدمن واحد ولا يُكرَّر inline.** أفعال الإدارة تمرّ بـ `ensureAdmin()` ([lib/actions/admin.ts:59](lib/actions/admin.ts#L59)) أو `requireAdmin()` ([lib/auth/session.ts:108](lib/auth/session.ts#L108))، وأفعال إدارة المسؤولين بـ `ensureSuperAdmin()` ([lib/actions/admin.ts:68](lib/actions/admin.ts#L68)). *لماذا:* «مَن يُعدّ أدمن؟» له تعريف واحد في [lib/auth/roles.ts](lib/auth/roles.ts) غير حسّاس لحالة الأحرف؛ التعليق في نفس الملف يشرح السبب: نسخة للواجهة وأخرى للسيرفر ستفترقان، فتُخفي الواجهة زرًّا يسمح به السيرفر أو العكس. لا تكتب `role === "admin"` بيدك.
3. **حارس العميل (الواجهة) للعرض فقط.** الإخفاء في الواجهة لا يُعتبر حماية؛ الإنفاذ في السيرفر (`app/admin/layout.tsx` + الحارس داخل كل أكشن) — منصوص في [lib/auth/roles.ts:9-10](lib/auth/roles.ts#L9). `middleware.ts` يحرس وجود الكوكي على `/seller` و `/account` فقط ولا يتحقق من الدور، فلا تعتمد عليه كتحقق صلاحية.
4. **الدور لا يُكتب من العميل.** `firestore.rules` تمنع رفع الصلاحية عبر `isSettingPrivilegedRole()`؛ ترقية الأدمن تمرّ بـ Admin SDK فقط. لا تفتح أي مسار كتابة يقبل `role` من طلب عميل.

### ب) شكل الإرجاع ومعالجة الأخطاء

5. **server action تُرجع كائنًا ولا ترمي للعميل أبدًا:** `{ success: boolean; error?: string }`. *الدليل:* 48 موضع `return { success: true`، و 38 موضع `return { success: false, error: "ليس لديك صلاحية" }` في `lib/actions/*`. *لماذا:* الاستثناء العابر لحدود server action يصل العميل كخطأ عام غير قابل للعرض، والواجهة كلها مبنية على قراءة `success`/`error`.
6. **رسالة الخطأ المعروضة للمستخدم عربية وقصيرة؛ الرسائل الرمزية ثابتة معرَّفة.** مثال ثابت: `POS_FEATURE_ERROR.UNAUTHORIZED`, `PRODUCT_ERROR_CODES.STOCK_MUST_BE_POSITIVE`. *لماذا:* الواجهة تُفرّع على الثابت لا على النص، وتغيير النص لا يجوز أن يكسر منطقًا.
7. **مسارات `app/api/**` تُرجع `NextResponse.json` مع حالة HTTP مشتقة من الخطأ، لا 200 دائمًا.** النمط الكامل في [app/api/driver/orders/[id]/accept/route.ts:10-13](app/api/driver/orders/[id]/accept/route.ts#L10) (401 على غياب الجلسة، ثم `dispatchErrorStatus(res.error)`). *لماذا:* تطبيق السائق الأصلي يقرأ status code، فإرجاع 200 لخطأ يُعطِّل منطقه.
8. **السجلّ عبر `logError` من [lib/logger.ts](lib/logger.ts) لا `console.error` مباشرة.** *لماذا:* `next.config.mjs:36` يحذف `console` في الإنتاج ويستثني `error` فقط لكي يعمل مسار التسجيل السيرفري؛ و `logger.ts:16-19` يُعقّم الرسالة في الإنتاج حتى لا تتسرّب تفاصيل تقنية للعميل.
9. **`"use server"` أول سطر في كل ملف داخل `lib/actions/`** (متحقَّق: 25/25). ملف يُستورَد من مكوّن عميل يجب أن يبقى نقيًا — [lib/storage/public-url.ts:7](lib/storage/public-url.ts#L7) ينصّ على أنه ليس `"use server"` عمدًا لأن مكوّنات العميل تستورده.

### ج) الفلوس والمعاملات

10. **كل مبلغ يُعاد حسابه سيرفر-سايد من مستند المصدر؛ رقم العميل يُتجاهل.** *الدليل:* [lib/actions/pos.ts:578-658](lib/actions/pos.ts#L578) («سعر السيرفر لا سعر العميل») و `orders.ts:726` (إعادة احتساب الخصم) و `orders.ts:730,1398,1505` (سعر التوصيل يُشتق من مستند السائق — التعليق يذكر أن القيمة القادمة من العميل «كانت تسمح بجعله 0») و `orders.ts:2790` (إعادة بناء العناصر بأسعار السيرفر). *لماذا:* الطلب دفع عند الاستلام؛ رقم يقبله السيرفر من العميل = فلوس حقيقية تُخسَر.
11. **تقريب الفلوس منزلتين عبر `roundMoney` الموجودة في نفس الملف** (`pos.ts:256`, `pos-features.ts:140`, `pos-pharmacy.ts:202`) أو `calculateProfitPerUnit` من [lib/utils/product-pricing.ts](lib/utils/product-pricing.ts) للربح. *لماذا:* حسابات الوحدات (قطعة/شريط/علبة) تنتج كسورًا عائمة، والإجماليات المخزَّنة تُقارن لاحقًا بمدفوعات نقدية. **لا تُنشئ نسخة رابعة من `roundMoney`** — استخدم الموجودة في الملف الذي تعمل فيه (التكرار الحالي بند مفتوح، §6/بند 3).
12. **رسوم التوصيل تُحسب فقط عبر `computeDeliveryFee` / `computeDeliveryFeeFromCoords` من [lib/delivery/fee.ts](lib/delivery/fee.ts).** الإعدادات تُقرأ بـ `readDispatchSettings()` التي ترجع الافتراضيات عند أي خطأ. *لماذا:* الصيغة (فتح عداد + كم × سعر) وحدّها الأدنى صفر وقاعدة «إحداثي ناقص ⇒ null لا رقم مضلِّل» (`fee.ts:42-43`) قرار مالك مكتوب، لا تفصيل تنفيذي.
13. **أي تعديل على مخزون / رصيد / حالة طلب يجري داخل `db.runTransaction`.** *الدليل:* 34 استخدامًا، منها `orders.ts` (14)، `delivery/dispatch.ts` (5)، `admin.ts` (3)، `delivery/location.ts`, `settlements.ts`, `debts.ts`. *لماذا:* بيع POS وقبول عرض توصيل يتنافسان على نفس المستند؛ read-then-write بلا معاملة يخصم مخزونًا مرتين أو يسند طلبًا لسائقين.
14. **الخصومات تُحدّ إلى الإجمالي ولا تنزل تحت الصفر.** النمط في `pos.ts:639-658`: `Math.min(...)` على مبلغ الخصم و `Math.max(0, ...)` على الإجمالي. *لماذا:* خصم أكبر من الفاتورة ينتج إجماليًا سالبًا يُفسِد التقارير والتسويات.

### د) نموذج الفشل (fail-open مقابل fail-closed)

15. **اتبع نموذج الفشل المستخدَم في الطبقة نفسها؛ لا تقلبه.** الطبقات المساعدة **تفشل مفتوحة** عن قصد وبتعليق يشرح ذلك: [lib/utils/rate-limit.ts:38](lib/utils/rate-limit.ts#L38) («لا نحجب المستخدمين الشرعيين بسبب خطأ في طبقة تحديد المعدل») و [lib/auth/driver-session.ts:77](lib/auth/driver-session.ts#L77) (خطأ عابر في قراءة التعطيل لا يُخرج سائقًا من جلسة متحقَّقة). أما مسارات المال/التسليم فتفشل **مقفولة** (تسليم الطلب يفشل عند غياب كود التسليم). *لماذا:* قلب النموذج في أي اتجاه إما يفتح ثغرة أو يقطع خدمة عن مستخدم شرعي — وكلاهما تغيير سلوك جوهري يحتاج قرارًا لا اجتهادًا.
16. **`checkRateLimit(action, max, windowMs)` من [lib/utils/rate-limit.ts](lib/utils/rate-limit.ts) هو المحدِّد الوحيد.** مستخدَم في `orders.ts`, `profile.ts`, `stores.ts`, `delivery.ts`, `import.ts`, `driver-otp.ts`, `api/driver/location`. لا تكتب عدّادًا خاصًا.

### هـ) البيانات والتخزين

17. **Firestore يخزّن *مسار* التخزين لا رابطًا مطلقًا؛ الرابط يُركَّب وقت العرض بـ `imgSrc()` / `storageUrl()` من [lib/storage/public-url.ts](lib/storage/public-url.ts).** *لماذا:* منصوص في رأس الملف — نقل التخزين لاحقًا يصبح تغيير `NEXT_PUBLIC_R2_PUBLIC_BASE` وحده بلا ترحيل بيانات (`r2.ts:50` يكرّر نفس العقد).
18. **لا تجعل محوّل الروابط صارمًا أبدًا.** خصائصه الأربع الإلزامية موثّقة في [lib/storage/public-url.ts:9-18](lib/storage/public-url.ts#L9): تمرير الروابط المطلقة القديمة، وتمرير `data:`/`blob:`، وتمرير المسارات المحلية `/`، والتماثل (idempotent). *لماذا:* سلال `localStorage` في متصفحات مستخدمين حقيقيين تحمل روابط Supabase مطلقة الآن ولا يصلها أي backfill — التصريم يُسقط صورًا على الإنتاج.
19. **الأرقام المصرية تُطبَّع بـ `normalizeEgyptPhone` والبحث بـ `getEgyptPhoneLookupCandidates` من [lib/utils/phone.ts](lib/utils/phone.ts)** (مستخدَمة في 14 ملفًا). *لماذا:* نفس الرقم مخزَّن بصيغ متعددة في بيانات قديمة؛ مقارنة نصية مباشرة تُنشئ حسابًا مكرّرًا أو تفشل في إيجاد المستخدم.
20. **بيانات Firestore تُسلسَل بـ `serializeData` قبل تمريرها لمكوّن عميل، والاستعلامات بـ `in` تُقسَّم بـ `chunkArray`** ([lib/firebase/firestore-helpers.ts](lib/firebase/firestore-helpers.ts)). *لماذا:* `Timestamp` غير قابل للتسلسل عبر حدود السيرفر/العميل، و Firestore يحدّ `in` بعشر قيم فيرمي على قائمة أطول.
21. **مستندات KYC والحقول الحسّاسة لا تُرجَع خامًا.** أنواع الأدمن في `lib/actions/admin.ts:41-42` تنصّ: «حقول عامة فقط — لا نُرجع أبدًا pin/pin_hash/pin_salt»، ومفاتيح KYC تمرّ بـ `signKycFields` و [lib/storage/kyc-key.ts](lib/storage/kyc-key.ts). *لماذا:* هذه بيانات هوية حقيقية لتجّار، وتسريبها كان ثغرة مُغلقة سابقًا.
22. **المتجر مضمَّن في مستند المستخدم (`users/{uid}`) بحقول snake_case، والمعرّف = uid.** الكود يقرأ كل الصيغ احتياطًا (`admin.ts:31`). *لماذا:* بيانات قديمة كُتبت بصيغ مختلفة من تطبيقات مختلفة (ويب + Flutter)؛ فرض صيغة واحدة يُخفي متاجر قائمة.

### و) الواجهة والنصوص

23. **الألوان من tokens `app/globals.css` لا قيم خام.** `--primary` أخضر مصري، `--accent` ذهبي، `--destructive` أحمر، و `--info` **هو** المسار الوحيد للأزرق ومحصور على «معلومة / أمان الدفع / الروابط» (منصوص في `globals.css:28`). *لماذا:* الهوية مقصودة لتفادي شكل shadcn/v0 الافتراضي (`globals.css:7-8`)، وأزرق خام في مكان عشوائي يكسرها.
24. **ألوان `app/pos/qpos` الوظيفية تُترك كما هي** (ترميز أقسام الكاشير بالألوان) — قرار مالك سابق، ليست دَينًا يُنظَّف.
25. **كل نصوص المستخدم عربية مصرية RTL. لا تضف واجهة إنجليزية.** *الدليل:* [lib/language-context.tsx:20-40](lib/language-context.tsx#L20) يثبّت `language = "ar"`، يجبر `dir="rtl"`، يمسح تفضيل اللغة المحفوظ، و `t = (ar, _en) => ar` **يتجاهل الوسيط الإنجليزي تمامًا**. *لماذا:* المنصّة أُحيلت عربي-فقط عن قصد؛ نصّ إنجليزي جديد ميت مسبقًا ويوهم المراجع بأن هناك ترجمة.
26. **اتبع نظام النصوص المستخدَم في السطح الذي تعدّله، ولا تُدخِل نظامًا ثالثًا.** الموجود: `useLanguage` بصيغة `t("عربي", "English")` في **60 ملفًا** (السائد)، و `react-i18next` بمفاتيح من `lib/i18n.ts` في **4 ملفات**، و `app/admin` نصوصه عربية مكتوبة مباشرة في JSX (0 من 13 ملف يستخدم أي نظام). *لماذا:* التعارض قائم وموثَّق (§6/بند 8)؛ نظام ثالث يزيد الدَين ولا يحلّه.
27. **العملة جنيه مصري.** لا `$` ولا `ر.س` (متحقَّق: صفر مواضع `ر.س` في `app/` و `components/`). *لماذا:* رموز عملة خاطئة كانت عيبًا مُصلَحًا؛ إعادتها تُظهر أسعارًا كاذبة.

### ز) الحُرّاس الجديدة

28. **أي حارس/فحص جديد: افحص *ترتيبه* بالنسبة للفحوص القائمة، لا صحّته فقط.** *لماذا:* الترتيب هو المنطق هنا — `session.ts:32` يتحقق من الكوكي بـ `checkRevoked=true` **قبل** أي قراءة Firestore على المسار الساخن، و `session.ts:91-92` يفحص «هل المستخدم مُميَّز؟» **قبل** إنفاذ `disabled` كي لا يُقفل الأدمن نفسه خارج اللوحة، و `roles.ts:15` يُطبّع حالة الأحرف **قبل** المقارنة (بلا التطبيع يمرّ `"Admin"` من قائمة القواعد ويُعامَل كأدمن في التطبيق ⇒ رفع صلاحية). حارس صحيح في المكان الخطأ = ثغرة أو قفل خدمة.

---

## 5) سياسة التفويض

- الموديلات المسموحة `opencode-go/*` فقط
- `opencode-go/kimi-k3` أساسي دايمًا و `opencode-go/glm-5.2` بديل لما حصة كيمي تخلص (تأكد من الأسماء من `opencode models` قبل الإرسال)
- الأقوى في كل مهمة لأن الاشتراك ثابت
- تمرير عدائي `--read-only` بالموديل التاني على أي diff فيه فلوس أو صلاحيات أو أمان أو تزامن أو schema
- شجرة نظيفة قبل كل dispatch
- مهمة واحدة لكل brief و commit واحد لكل مهمة
- المراجع يعيد تشغيل الـ gates بنفسه ويقرأ الـ diff كامل ومايثقش في تقرير المنفّذ
- `touchedFiles` بيغطي الريبو ده بس ومايشوفش أي تغيير برّاه
- فحص ترتيب أي حارس جديد بالنسبة للفحوص الموجودة مش صحته بس

### ما يُوجَّه للتمرير العدائي في هذا الريبو تحديدًا

أي diff يلمس أحد هذه = تمرير `--read-only` إجباري بالموديل الثاني:
`lib/actions/orders.ts` · `lib/actions/pos*.ts` · `lib/actions/settlements.ts` · `lib/actions/debts.ts` · `lib/delivery/*` · `lib/auth/*` · `lib/utils/rate-limit.ts` · `firestore.rules` · `storage.rules` · `middleware.ts` · `next.config.mjs` · أي `app/api/**/route.ts` · أي إضافة/تغيير حقل في مستند Firestore.

---

## 6) البنود المفتوحة

| # | البند | الدليل | مَن يقرّر |
|---|---|---|---|
| 1 | **`is_approved` بالوضع اللطيف لا الصارم** — `getStores` يُخفي `=== false` فقط ويُظهر المتاجر بلا الحقل، كي لا يفرغ الموقع. الانتقال لـ«المعتمد فقط» يحتاج تجذير (grandfather) المتاجر القديمة أولًا | [lib/actions/stores.ts:246](lib/actions/stores.ts#L246) · [lib/actions/admin.ts:2312](lib/actions/admin.ts#L2312) | **المالك** |
| 2 | **نموذج ثقة الكاشير في POS** — خصومات الولاء / بطاقة الهدية / خصم الفاتورة تُقبل كمبالغ من العميل وتُطوى في الإجمالي (بحدّ `Math.min` على الإجمالي)، لأن الكاشير والمتجر نفس الجهة | [lib/actions/pos.ts:643-654](lib/actions/pos.ts#L643) | **المالك** |
| 3 | **`roundMoney` مكرّرة 4 مرات**، وواحدة بصيغة مختلفة: `pos.ts:256` و `pos-features.ts:140` و `app/pos/qpos/page.tsx:350` متطابقة، و `pos-pharmacy.ts:202` صيغة أخرى | نفس المسارات | **المالك** (توحيدها يمسّ حسابات مال ⇒ لا يقرّرها وكيل) |
| 4 | **لا CSP صارم** — مؤجَّل عن قصد لتفادي كسر السكربتات المضمّنة / Facebook Pixel؛ المقترح المكتوب هو وضع report-only | [next.config.mjs:55-56](next.config.mjs#L55) | **المالك** |
| 5 | **مزوّد SMS غير محدَّد** — المُرسِل قابل للتوصيل والقرار مفتوح (بوابة مصرية / Twilio / Vonage) | [lib/sms/send.ts:3](lib/sms/send.ts#L3) | **المالك** |
| 6 | **بحث صور جوجل غير موصول** — `TODO(المالك)` صريح: توصيل مزوّد بحث صور عبر env عند توفّر الطريقة | [lib/import/images.ts:42](lib/import/images.ts#L42) | **المالك** |
| 7 | **تدوير مفاتيح Gemini** — طريقة معالجة مفاتيح جوجل المجانية سيوفّرها المالك؛ المفتاح env-only ولا يُكتب في الريبو أبدًا | [lib/ai/gemini.ts:4](lib/ai/gemini.ts#L4) | **المالك** |
| 8 | **نظامان متنافسان للنصوص** — `useLanguage` (60 ملف) مقابل `react-i18next` (4 ملفات)، و `app/admin` بلا أي نظام (0/13). التوحيد مشروع قائم بذاته | إحصاء على الشجرة | **المالك** |
| 9 | **`crmAndCacher1` مدخل submodule معطوب** — gitlink بوضع `160000` يشير إلى `d2dbe15`، **بلا `.gitmodules`** ومجلده فارغ. `eslint.config.mjs:13` يستبعده | `git ls-files -s crmAndCacher1` | **المالك** |
| 10 | **ملفات لوج متتبَّعة في git** — `dev-log.txt`, `dev-server.out.log`, `dev-server.err.log`, `.next-dev.log`, `.next-dev.err.log`, `hs_err_pid28052.log`. تشغيل dev/JVM يعدّلها فيوسّخ الشجرة ويخلط الـ diff | `git ls-files` | **المالك** |
| 11 | **`inspection/` غير متتبَّع في git وقديم** — 12 تقرير تدقيق (فبراير 2026، 227 مشكلة) موجودة على القرص فقط، **ومستبعدة في `.gitignore`**، وتصف عيوبًا **مُصلَحة بالفعل** (مثل `ignoreBuildErrors: true` و `hostname: '**'` — الاثنان الآن `false` ومقيَّدان في [next.config.mjs:5](next.config.mjs#L5) و`:12-21`). **لا تقرأها كحالة راهنة ولا تعمل منها** — قراءتها كأنها حديثة تُنتج "إصلاحًا" لما هو مُصلَح | `.gitignore` + `git ls-files inspection` (صفر) | **المالك** |
| 12 | **`firestore.rules` / `storage.rules` في الريبو؛ نشرها عمل خارج الريبو.** تعديل ملف القواعد لا يُغيّر الإنتاج حتى يُنشَر، والنشر ممنوع على الوكلاء (§3) | `firebase.json` | **المالك** |
| 13 | **`README.md` قديم/مضلِّل** — يصف الريبو كمخرَج مُزامَن من v0.app ولا يذكر شيئًا من الـ stack أو الأوامر الحقيقية | [README.md](README.md) | **المالك** |

---

## 7) المتغيّرات البيئية (أسماء فقط — لا قيم)

مستنبطة من `process.env.*` في المصدر. **لا تقرأ `.env*` ولا تكتب أي قيمة في أي مكان.**

`FIREBASE_ADMIN_PROJECT_ID` · `FIREBASE_ADMIN_CLIENT_EMAIL` · `FIREBASE_ADMIN_PRIVATE_KEY` · `GOOGLE_APPLICATION_CREDENTIALS` · `NEXT_PUBLIC_FIREBASE_API_KEY` · `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` · `NEXT_PUBLIC_FIREBASE_PROJECT_ID` · `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` · `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` · `NEXT_PUBLIC_FIREBASE_APP_ID` · `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` · `NEXT_PUBLIC_FIREBASE_VAPID_KEY` · `NEXT_PUBLIC_R2_PUBLIC_BASE` · `R2_ENDPOINT` · `CRON_SECRET` · `GEMINI_API_KEY` · `GEMINI_MODEL` · `IMAGE_SEARCH_API_KEY` · `SMS_PROVIDER` · `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` · `NODE_ENV`
