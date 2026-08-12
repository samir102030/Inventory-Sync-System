# اختبارات النظام

اختبارات من طرف إلى طرف: تتكلم مع خادم شغّال عبر HTTP بالضبط كما يفعل
المتصفح. لا تستورد كودَ التطبيق عمدًا — اختبارٌ يستورد ما يختبره لا يمسك خطأ
في التوصيل، والتوصيل هو ما انكسر في هذا النظام قبلًا: ميدلوير في ترتيب خاطئ،
أو راوت نسي فلترة.

## لماذا خارج مساحة pnpm

هذا المجلد ليس حزمة في `pnpm-workspace.yaml`، ويُثبَّت بـ `npm` وحده. السبب:
أي تغيير في `pnpm-lock.yaml` يمسّ ما يبنيه Render، والاختبارات يجب ألا تكون
سببًا لتعطّل نشر.

## ما تغطّيه

| المجموعة | تغطّي |
|---|---|
| `isolation` | لا شركة ترى أو تلمس صفوف شركة أخرى — بما فيه **اختبار التزامن** |
| `switching` | تبديل الشركة، النسخ الاحتياطي والإعدادات لكل شركة، نقل المستخدمين |
| `numbering` | ترقيم المستندات بعد حذف، واستقلاله بين الشركات |
| `signup` | التسجيل الذاتي: مسار الموظف ومسار العميل الجديد، وكود التفعيل |
| `quotations` | خصم البند، الضريبة التلقائية، `created_by`، وخصوصية سعر التكلفة |

**أهم اختبار فيها** هو اختبار التزامن في `isolation`. العطل الذي يمسكه لا
يظهر في طلب واحد إطلاقًا: Neon يشغّل PgBouncer فيعيد استخدام الاتصال، فتتسرب
هوية شركة إلى الطلب التالي. لا يظهر إلا تحت طلبات متوازية.

## التشغيل

يحتاج قاعدة بيانات محلية — **لا تشغّلها على الإنتاج**، فهي تمسح الجداول
وتعيد ملأها.

```bash
# 1) تجهيز قاعدة بيانات محلية وتطبيق الهجرات
export DATABASE_URL="postgres://postgres@127.0.0.1:55432/inv_test"
pnpm run db:migrate

# 2) حساب تطبيق بلا BYPASSRLS يملك الجداول — يحاكي Neon
#    (بدونه يتخطى الاتصال سياسات RLS ويمر كل اختبار عزل زورًا)
psql "$DATABASE_URL" <<'SQL'
CREATE ROLE app_user LOGIN PASSWORD 'app' NOSUPERUSER NOBYPASSRLS;
GRANT ALL ON SCHEMA public TO app_user;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO app_user', r.tablename);
  END LOOP;
  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname='public' LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO app_user', r.sequencename);
  END LOOP;
END $$;
SQL

# 3) بناء وتشغيل الخادم
pnpm run build:deploy
DATABASE_URL="postgres://app_user:app@127.0.0.1:55432/inv_test" \
SESSION_SECRET="a-secret-at-least-thirty-two-characters-long" \
PORT=5099 node artifacts/api-server/dist/index.mjs &

# 4) الاختبارات
cd tests && npm install && npm test
```

مجموعة واحدة فقط: `node run.mjs isolation`

## متغيرات

| المتغير | الافتراضي |
|---|---|
| `TEST_API` | `http://127.0.0.1:5099/api` |
| `TEST_DATABASE_URL` | `postgres://postgres@127.0.0.1:55432/inv_test` |

`TEST_DATABASE_URL` تستخدمه `seed.mjs` وحدها، ويتصل بحساب مسؤول عمدًا: التجهيز
يحتاج تجاوز RLS ليضع صفوفًا في أكثر من شركة. الاختبارات نفسها تمر بالخادم.
