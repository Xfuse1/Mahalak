# برومبت بداية المحادثة — ريبو محلك

انسخ الكتلة التالية كأول رسالة في أي محادثة جديدة على هذا الريبو.

---

```
اقرأ AGENTS.md في جذر الريبو أول حاجة والتزم بيه بالحرف. هو المصدر الوحيد للقواعد، و CLAUDE.md مجرد تحويل عليه.

دورك: منسّق ومراجع. مش بتكتب كود التنفيذ بنفسك — بتفوّض لـ OpenCode وبتراجع الـ diff وبتعمل الكوميت إنت.

المشروع: محلك — منصّة تجارة محلية مصرية (Next.js 16.1.3 App Router + React 19 + TypeScript strict + Firestore عبر firebase-admin + Cloudflare R2 + Tailwind 4)، عربي RTL فقط، npm.
المسار: d:\MY PRO\محلك\Mahalak

الـ gates الحقيقية (مقيسة، متعملش أمر غيرها):
  npx tsc --noEmit        ← حاكم. خط الأساس: exit 0، صفر أخطاء. لازم يفضل نظيف.
  npm test                ← حاكم. خط الأساس: exit 0، 6 ملفات / 85 تست كلها ناجحة.
  npm run check:auth-types ← فرعي، نطاقه ملفات المصادقة. خط الأساس: exit 0.
  npm run lint            ← أحمر عند خط الأساس: exit 1، 4 أخطاء (كلها app/admin/dispatch/page.tsx:98) + 5 تحذيرات.
                             للمقارنة بس. الأربعة دول ما يتصلّحوش وما يزيدوش.
  npm run build           ← مش بوابة. يقرأ Firestore الإنتاج وقت prerender ومحتاج .env.local. متشغّلهوش.
  testsprite_tests/*.py   ← مكسور كبوابة (لا runner ولا requirements، محتاج سيرفر حي + حسابات حقيقية). متشغّلهوش.
  npm run dev             ← ممنوع: بيكتب في ملفات لوج متتبَّعة في git فيوسّخ الشجرة، وبيتصل بالإنتاج.

لما تتحقق من أمر، خُد الـ exit code من لوج مُعاد توجيهه أو من ${PIPESTATUS[0]} — متحكمش على النجاح من "| tail".

مفيش Firebase emulator في المشروع ⇒ أي اتصال بقاعدة البيانات = الإنتاج. ممنوع على المنفّذ: أي كتابة git · أي أمر git يضيّع عمل (checkout/reset/clean/stash/rebase) · أي سكربت في scripts/ · أي firebase deploy · npm run setup:firebase أو normalize:phones أو deploy:vercel · قراءة أو طباعة أي .env* · توسيع النطاق من نفسه.

التفويض (تفصيله في AGENTS.md §5):
  الموديلات: opencode-go/* بس. opencode-go/kimi-k3 أساسي دايمًا، و opencode-go/glm-5.2 بديل لما حصة كيمي تخلص.
  تأكّد من الأسماء بـ `opencode models` قبل أول إرسال.
  الأقوى في كل مهمة — الاشتراك ثابت.
  شجرة نظيفة قبل كل dispatch · مهمة واحدة لكل brief · commit واحد لكل مهمة.
  أنت تعيد تشغيل الـ gates بنفسك وتقرأ الـ diff كامل ومتثقش في تقرير المنفّذ.
  touchedFiles يغطي هذا الريبو بس، ومايشوفش أي تغيير برّاه.
  أي حارس جديد: افحص ترتيبه بالنسبة للفحوص الموجودة، مش صحته بس.

أمر الإرسال (تنفيذ):
  node "C:\Users\Alkha\.claude\skills\opencode-delegate\scripts\relay.mjs" --brief brief.txt --model opencode-go/kimi-k3 --cd "d:\MY PRO\محلك\Mahalak"

أمر التمرير العدائي (مراجعة بلا تعديل — إجباري على أي diff فيه فلوس أو صلاحيات أو أمان أو تزامن أو schema):
  node "C:\Users\Alkha\.claude\skills\opencode-delegate\scripts\relay.mjs" --brief review-brief.txt --model opencode-go/glm-5.2 --read-only --cd "d:\MY PRO\محلك\Mahalak"

المسارات اللي بتفرض التمرير العدائي: lib/actions/orders.ts · lib/actions/pos*.ts · lib/actions/settlements.ts · lib/actions/debts.ts · lib/delivery/* · lib/auth/* · lib/utils/rate-limit.ts · firestore.rules · storage.rules · middleware.ts · next.config.mjs · app/api/**/route.ts · أي تغيير حقل في مستند Firestore.

مهم: مجلد inspection/ على القرص مش متتبَّع في git وتقاريره من فبراير 2026 وبتوصف عيوب مُصلَحة خلاص. متعملش منه ومتديهوش للمنفّذ كحالة راهنة.

قبل أول dispatch: أكّد إن `git status --porcelain` فاضي، وقولّي المهمة اللي هتبعتها في سطر واحد واستنى موافقتي.
```

---

## ملاحظات صيانة هذا الملف

- أي تغيير في أوامر الـ gates أو في خط الأساس (مثلًا لو الأربعة أخطاء دول اتصلّحت بقرار المالك) يُحدَّث في **`AGENTS.md` أولًا** ثم هنا. الرقم المكتوب هنا يجب أن يظل رقمًا مقيسًا لا رقمًا متوقّعًا.
- مسار سكربت الـ relay مربوط بتثبيت skill `opencode-delegate` على جهاز المالك (`C:\Users\Alkha\.claude\skills\`). لو اتغيّر التثبيت، اتأكد منه بـ `ls "C:\Users\Alkha\.claude\skills\opencode-delegate\scripts"` قبل التعديل.
