import { describe, it, expect } from "vitest"
import { isOtcEligible, otcVerdict, OTC_GROUPS, FORBIDDEN_GROUPS } from "./otc"

const p = (name: string, requires_prescription?: boolean) => ({ name, requires_prescription })

describe("otcVerdict — القائمة المبيضّة", () => {
  it("يسمح بالمسكّنات التي تُصرف بلا روشتة، بالعربي وباللاتيني", () => {
    for (const name of [
      "شريط بنادول اكسترا",
      "PANADOL EXTRA 24 TAB",
      "CETAL 500 MG 20 TAB",
      "BRUFEN 400 MG 30 TAB",
      "ADOL 500 GM 24 CAPS",
      "ASPIRin protect 100 mg 30 TAB",
    ]) {
      expect(isOtcEligible(p(name))).toBe(true)
    }
  })

  it("يسمح بالفيتامينات والمستلزمات الطبية", () => {
    for (const name of ["فيتامين سي فوار", "vitamin d3 capsules", "كمامة طبية 50 قطعة", "ترمومتر رقمي", "شرائط قياس السكر"]) {
      expect(isOtcEligible(p(name))).toBe(true)
    }
  })

  it("يسمح بالعناية الموضعية والمطهّرات", () => {
    for (const name of ["bepanthen cream 30 gm", "بيتادين محلول مطهر", "ديتول مطهر 250 مل"]) {
      expect(isOtcEligible(p(name))).toBe(true)
    }
  })
})

describe("otcVerdict — النقض", () => {
  it("يمنع كل المضادات الحيوية", () => {
    for (const name of [
      "AUGMENTIN 625 MG 10 TAB",
      "اوجمنتين شراب",
      "ZITHROMAX 500 MG",
      "FLAGYL (20 TAB) 500 MG",
      "CIPROFAR 500 MG",
    ]) {
      expect(otcVerdict(p(name))).toEqual({ allowed: false, reason: "forbidden" })
    }
  })

  it("يمنع أدوية الأمراض المزمنة", () => {
    for (const name of ["CONCOR 5 MG", "سيدوفاج 500", "LIPITOR 20 MG", "انسولين لانتوس", "ELTROXIN 50 MCG"]) {
      expect(otcVerdict(p(name)).allowed).toBe(false)
    }
  })

  it("يمنع المؤثّرات العصبية ومركّبات الكودايين", () => {
    for (const name of ["LYRICA 75 MG", "SOLPADEINE active", "سولبادين"]) {
      expect(otcVerdict(p(name))).toEqual({ allowed: false, reason: "forbidden" })
    }
  })

  it("النقض يسبق الإذن: مركّب فيه باراسيتامول + كودايين يُرفض رغم الباراسيتامول", () => {
    // سولبادين = باراسيتامول + كودايين، ومجموعته في جدول المرادفات تحوي «باراسيتامول» فعلًا،
    // فالإذن وحده كان يمرّرها. هذه بالضبط الحالة التي وُجد النقض من أجلها.
    expect(otcVerdict(p("SOLPADEINE paracetamol codeine"))).toEqual({ allowed: false, reason: "forbidden" })
  })

  it("يمنع المضادات الفموية للالتهاب والبخّاخات والكورتيزون", () => {
    for (const name of ["CATAFLAM 50 MG 20 TAB", "VENTOLIN inhaler", "SERETIDE 25/250", "هوستاكورتين اقراص"]) {
      expect(otcVerdict(p(name)).allowed).toBe(false)
    }
  })

  it("يمنع الريتينويدات والمضاد الحيوي الموضعي", () => {
    for (const name of ["ACRETIN cream", "DIFFERIN gel", "FUCIDIN 2% cream", "روكتان 20"]) {
      expect(otcVerdict(p(name)).allowed).toBe(false)
    }
  })
})

describe("otcVerdict — الافتراض الآمن", () => {
  it("ما ليس في القائمة يُرفض (فشل مقفول لا مفتوح)", () => {
    for (const name of ["صنف مجهول 123", "SOME UNKNOWN BRAND", "منتج جديد"]) {
      expect(otcVerdict(p(name))).toEqual({ allowed: false, reason: "not_listed" })
    }
  })

  it("علم requires_prescription ينقض الإذن مهما كان الاسم", () => {
    expect(otcVerdict(p("PANADOL EXTRA 24 TAB", true))).toEqual({ allowed: false, reason: "prescription" })
  })

  it("الاسم الفارغ أو المشوّه يُرفض بلا رمي", () => {
    expect(otcVerdict({ name: "" }).allowed).toBe(false)
    expect(otcVerdict({ name: null }).allowed).toBe(false)
    expect(otcVerdict({}).allowed).toBe(false)
    expect(() => otcVerdict({ name: 123 as unknown as string })).not.toThrow()
  })
})

describe("كلمات الحالات لا تُشغّل النقض", () => {
  // مقيس على الإنتاج: مجموعة «مينوكسيديل» الممنوعة تضمّ «hair loss»، فكان كل شامبو مكتوب عليه
  // `anti hair loss` يُحظَر — وهو مستحضر تجميل لا دواء.
  it("شامبو مضاد لتساقط الشعر مستحضر تجميل لا دواء", () => {
    expect(otcVerdict(p("organica 300ml anti hair loss shampoo")).allowed).toBe(true)
    expect(otcVerdict(p("proven anti -hair loss shampoo 200 ml")).allowed).toBe(true)
  })

  it("لكن الدواء نفسه يبقى ممنوعًا", () => {
    expect(otcVerdict(p("MINOXIDIL 5% topical solution"))).toEqual({ allowed: false, reason: "forbidden" })
    expect(otcVerdict(p("REGAINE 5%"))).toEqual({ allowed: false, reason: "forbidden" })
  })

  it("رفع النقض لا يسمح بشيء لا يطابق قائمة الإذن استقلالًا", () => {
    // «صداع نصفي» رُفعت من النقض، ومع ذلك دواء الشقيقة يبقى محجوبًا باسمه.
    expect(otcVerdict(p("IMIGRAN 50 MG"))).toEqual({ allowed: false, reason: "forbidden" })
    expect(otcVerdict(p("علاج للصداع النصفي")).allowed).toBe(false)
  })
})

describe("المواد السامّة والمستبعَد عمدًا", () => {
  // مقيس على كتالوج الإنتاج: «methyl alcohol 70% 1 litre» كان يمرّ من مجموعة «كحول» المسموحة.
  // الميثانول سامّ عند الابتلاع، وعرضُه ردًّا على شكوى صحّية غير مقبول مهما ندر.
  it("يمنع الميثانول رغم أنه «كحول»", () => {
    expect(otcVerdict(p("methyl alcohol 70% 1 litre"))).toEqual({ allowed: false, reason: "forbidden" })
    expect(otcVerdict(p("كحول ميثيلي 70%"))).toEqual({ allowed: false, reason: "forbidden" })
  })

  it("ويُبقي الكحول الإيثيلي الطبّي مسموحًا", () => {
    expect(otcVerdict(p("ETHYL ALCOHOL 70% 100 ml")).allowed).toBe(true)
    expect(otcVerdict(p("ALCOHOL 70% 100 ML")).allowed).toBe(true)
  })

  it("يمنع النيستاتين (مُستبعَد عمدًا حتى يراجعه صيدلي)", () => {
    expect(otcVerdict(p("NYSTATIN 100000 IU ML ORAL DROPS")).allowed).toBe(false)
    expect(otcVerdict(p("ميكوستاتين معلق")).allowed).toBe(false)
  })
})

describe("بوابة الشكل الصيدلاني (طريق الإعطاء)", () => {
  // العيب الذي كشفته المراجعة: القائمة تعرف الأسماء ولا ترى الشكل. «فيتامين د» مسموح، ومجموعته
  // تجرّ «ديفارول» — وديفارول-اس أمبول حقن عضلي 200,000 وحدة.
  it("يرفض أمبول الحقن ولو كان جزيئه مسموحًا", () => {
    for (const name of [
      "DEVAROL S 200000 IU AMP",
      "ديفارول اس امبول",
      "NEUROTON 3 AMP vitamin b12",
      "حديد امبولات وريد",
      "CALCIUM injection 10 ml",
    ]) {
      expect(otcVerdict(p(name))).toEqual({ allowed: false, reason: "injectable" })
    }
  })

  it("ويُبقي الشكل الفموي من نفس الجزيء مسموحًا", () => {
    expect(otcVerdict(p("VIDROP VITAMIN D3 ORAL DROPS 15 ML")).allowed).toBe(true)
    expect(otcVerdict(p("FEROGLOBIN B12 IRON-ZINC 30 CAP")).allowed).toBe(true)
  })

  it("ولا يخلط السرنجة (سلعة) بالمحقون (دواء)", () => {
    expect(otcVerdict(p("SYRINGE (5 CM)")).allowed).toBe(true)
    expect(otcVerdict(p("سرنجه شراب اطفال")).allowed).toBe(true)
  })

  it("الشكل يُفحَص قبل الاسم فلا يُنقذ أمبولًا أنّ جزيئه مأذون", () => {
    expect(otcVerdict(p("PANADOL 1 GM AMP")).reason).toBe("injectable")
  })
})

describe("اتّساق قرار مضادات الفطريات الفموية", () => {
  it("«دكتارين اورال جل» ممنوع كالنيستاتين لا مسموح", () => {
    expect(otcVerdict(p("DAKTARIN ORAL GEL 40 GM")).allowed).toBe(false)
    expect(otcVerdict(p("ميكونازول جل الفم")).allowed).toBe(false)
  })

  it("ومضاد الفطريات الموضعي الآخر يبقى مسموحًا", () => {
    expect(otcVerdict(p("CANESTEN 1% cream 20 gm")).allowed).toBe(true)
  })
})

describe("سلامة القائمتين نفسيهما", () => {
  it("لا يوجد مفتاح في المسموح والممنوع معًا", () => {
    const overlap = OTC_GROUPS.filter((key) => FORBIDDEN_GROUPS.includes(key))
    expect(overlap).toEqual([])
  })

  it("لا تكرار داخل أي قائمة", () => {
    expect(new Set(OTC_GROUPS).size).toBe(OTC_GROUPS.length)
    expect(new Set(FORBIDDEN_GROUPS).size).toBe(FORBIDDEN_GROUPS.length)
  })
})
