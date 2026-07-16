import "server-only"

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

/**
 * طبقة تخزين Cloudflare R2 (متوافقة مع S3).
 *
 * bucket‑ان بفصل صارم:
 *  - العام  (R2_BUCKET)         — صور المنتجات وشعارات المتاجر. يُقدَّم عبر نطاق CDN مخصص.
 *  - الخاص  (R2_BUCKET_PRIVATE) — مستندات KYC. **لا يُوصَّل عليه نطاق أبدًا** — يُقدَّم عبر
 *    روابط موقّعة قصيرة العمر فقط. في R2 النطاق المخصص يفتح الـbucket **بالكامل**، لا بادئة
 *    منه — لذلك الفصل يجب أن يكون على مستوى bucket، لا على مستوى مسار.
 *
 * اختيار الـbucket يتم **باسم الحقل** في طبقة الاستدعاء، لا بتخمين شكل النص:
 * `registrations/<id>/logo/x.jpg` (عام) و`registrations/<id>/id-card-front/x.jpg` (خاص)
 * لا يمكن تمييزهما كنصّين.
 */

export const PUBLIC_BUCKET = "public" as const
export const PRIVATE_BUCKET = "private" as const
export type BucketKind = typeof PUBLIC_BUCKET | typeof PRIVATE_BUCKET

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`[storage/r2] متغيّر البيئة المطلوب غير مضبوط: ${name}`)
  return v
}

let client: S3Client | null = null
function getClient(): S3Client {
  if (client) return client
  client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT || `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  })
  return client
}

function bucketName(kind: BucketKind): string {
  return kind === PRIVATE_BUCKET ? requireEnv("R2_BUCKET_PRIVATE") : requireEnv("R2_BUCKET")
}

/**
 * يرفع كائنًا ويُعيد **مفتاحه (المسار)** — لا رابطًا مطلقًا.
 * تخزين المسار هو ما يجعل نقل التخزين لاحقًا تغييرَ إعدادٍ لا ترحيلَ بيانات.
 */
export async function putObject(
  kind: BucketKind,
  key: string,
  body: Buffer | Uint8Array,
  contentType?: string,
): Promise<string> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucketName(kind),
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
      // الأصول العامة غير قابلة للتغيير (كل رفع يولّد اسمًا عشوائيًا جديدًا) — كاش أبدي آمن.
      // الخاصة لا تُكاش إطلاقًا: الرابط الموقّع قصير العمر، وكاش وسيط يُبطِل هذا الضمان.
      CacheControl: kind === PUBLIC_BUCKET ? "public, max-age=31536000, immutable" : "private, no-store",
    }),
  )
  return key
}

/** رابط موقّع قصير العمر لقراءة كائن خاص (KYC). */
export async function presignGet(kind: BucketKind, key: string, expiresInSeconds = 300): Promise<string> {
  return getSignedUrl(getClient(), new GetObjectCommand({ Bucket: bucketName(kind), Key: key }), {
    expiresIn: expiresInSeconds,
  })
}
