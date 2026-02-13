import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUTPUT_PATH = resolve(process.cwd(), "data", "ar_8020_msa_syrian.v1.json");

function entry(key, gloss, msa, syrian = msa) {
  return {
    key,
    gloss,
    msa,
    syrian,
  };
}

const genericChunkTemplates = [
  {
    key: "where_is",
    gloss: (ref) => `where is the ${ref.gloss}?`,
    msa: (ref) => `أين ${ref.msa}؟`,
    syrian: (ref) => `وين ${ref.syrian}؟`,
  },
  {
    key: "i_need",
    gloss: (ref) => `I need ${ref.gloss}`,
    msa: (ref) => `أحتاج ${ref.msa}`,
    syrian: (ref) => `بدي ${ref.syrian}`,
  },
  {
    key: "do_you_have",
    gloss: (ref) => `do you have ${ref.gloss}?`,
    msa: (ref) => `هل لديك ${ref.msa}؟`,
    syrian: (ref) => `معك ${ref.syrian}؟`,
  },
  {
    key: "i_do_not_have",
    gloss: (ref) => `I do not have ${ref.gloss}`,
    msa: (ref) => `ليس لدي ${ref.msa}`,
    syrian: (ref) => `ما معي ${ref.syrian}`,
  },
  {
    key: "this_is",
    gloss: (ref) => `this is ${ref.gloss}`,
    msa: (ref) => `هذا ${ref.msa}`,
    syrian: (ref) => `هاد ${ref.syrian}`,
  },
];

const feelingsChunkTemplates = [
  {
    key: "i_feel",
    gloss: (ref) => `I feel ${ref.gloss}`,
    msa: (ref) => `أشعر بـ${ref.msa}`,
    syrian: (ref) => `حاسس بـ${ref.syrian}`,
  },
  {
    key: "i_am",
    gloss: (ref) => `I am ${ref.gloss}`,
    msa: (ref) => `أنا ${ref.msa}`,
    syrian: (ref) => `أنا ${ref.syrian}`,
  },
  {
    key: "today_i_am",
    gloss: (ref) => `today I am ${ref.gloss}`,
    msa: (ref) => `اليوم أنا ${ref.msa}`,
    syrian: (ref) => `اليوم أنا ${ref.syrian}`,
  },
  {
    key: "why_are_you",
    gloss: (ref) => `why are you ${ref.gloss}?`,
    msa: (ref) => `لماذا أنت ${ref.msa}؟`,
    syrian: (ref) => `ليش إنت ${ref.syrian}؟`,
  },
  {
    key: "not_now",
    gloss: (ref) => `I am not ${ref.gloss} now`,
    msa: (ref) => `لست ${ref.msa} الآن`,
    syrian: (ref) => `مو ${ref.syrian} هلق`,
  },
];

const domainConfigs = [
  {
    id: "home",
    vocabBase: [
      entry("house", "house", "بيت"),
      entry("apartment", "apartment", "شقة"),
      entry("room", "room", "غرفة", "أوضة"),
      entry("bedroom", "bedroom", "غرفة النوم", "أوضة النوم"),
      entry("kitchen", "kitchen", "مطبخ"),
      entry("bathroom", "bathroom", "حمام"),
      entry("door", "door", "باب"),
      entry("window", "window", "نافذة", "شباك"),
      entry("key", "key", "مفتاح"),
      entry("lock", "lock", "قفل"),
      entry("bed", "bed", "سرير", "تخت"),
      entry("pillow", "pillow", "وسادة", "مخدة"),
      entry("blanket", "blanket", "بطانية", "حرام"),
      entry("table", "table", "طاولة"),
      entry("chair", "chair", "كرسي"),
      entry("light", "light", "ضوء", "ضو"),
      entry("electricity", "electricity", "كهرباء", "كهربا"),
      entry("fan", "fan", "مروحة"),
      entry("fridge", "fridge", "ثلاجة", "براد"),
      entry("stove", "stove", "موقد", "غاز"),
      entry("washing_machine", "washing machine", "غسالة"),
      entry("floor", "floor", "أرضية", "أرض"),
      entry("wall", "wall", "جدار", "حيط"),
      entry("roof", "roof", "سقف"),
      entry("rent", "rent", "إيجار", "أجار"),
    ],
    modifiers: [
      entry("new", "new", "جديد"),
      entry("old", "old", "قديم"),
      entry("clean", "clean", "نظيف", "نضيف"),
      entry("dirty", "dirty", "متسخ", "وسخ"),
      entry("broken", "broken", "مكسور"),
    ],
    modifierTargets: ["room", "kitchen", "bathroom", "door", "window"],
    chunkRefs: ["house", "room", "kitchen", "bathroom", "door", "window", "key", "bed", "electricity", "rent"],
    chunkTemplates: genericChunkTemplates,
  },
  {
    id: "food",
    vocabBase: [
      entry("bread", "bread", "خبز", "خبز"),
      entry("water", "water", "ماء", "مي"),
      entry("coffee", "coffee", "قهوة"),
      entry("tea", "tea", "شاي"),
      entry("milk", "milk", "حليب"),
      entry("sugar", "sugar", "سكر"),
      entry("salt", "salt", "ملح"),
      entry("rice", "rice", "أرز", "رز"),
      entry("chicken", "chicken", "دجاج", "جاج"),
      entry("meat", "meat", "لحم", "لحمة"),
      entry("fish", "fish", "سمك"),
      entry("egg", "egg", "بيضة"),
      entry("vegetables", "vegetables", "خضروات", "خضرة"),
      entry("fruit", "fruit", "فاكهة", "فواكه"),
      entry("apple", "apple", "تفاح"),
      entry("banana", "banana", "موز"),
      entry("tomato", "tomato", "طماطم", "بندورة"),
      entry("potato", "potato", "بطاطس", "بطاطا"),
      entry("soup", "soup", "شوربة"),
      entry("salad", "salad", "سلطة"),
      entry("breakfast", "breakfast", "فطور"),
      entry("lunch", "lunch", "غداء", "غدا"),
      entry("dinner", "dinner", "عشاء", "عشا"),
      entry("hungry", "hungry", "جائع", "جوعان"),
      entry("thirsty", "thirsty", "عطشان"),
    ],
    modifiers: [
      entry("hot", "hot", "ساخن", "سخن"),
      entry("cold", "cold", "بارد"),
      entry("fresh", "fresh", "طازج", "طازة"),
      entry("salty", "salty", "مالح"),
      entry("sweet", "sweet", "حلو"),
    ],
    modifierTargets: ["bread", "coffee", "tea", "soup", "salad"],
    chunkRefs: ["water", "bread", "coffee", "tea", "rice", "chicken", "soup", "salad", "breakfast", "dinner"],
    chunkTemplates: genericChunkTemplates,
  },
  {
    id: "transport",
    vocabBase: [
      entry("car", "car", "سيارة"),
      entry("bus", "bus", "حافلة", "باص"),
      entry("taxi", "taxi", "سيارة أجرة", "تكسي"),
      entry("train", "train", "قطار"),
      entry("station", "station", "محطة"),
      entry("airport", "airport", "مطار"),
      entry("road", "road", "طريق"),
      entry("street", "street", "شارع"),
      entry("traffic", "traffic", "ازدحام", "عجقة"),
      entry("ticket", "ticket", "تذكرة"),
      entry("driver", "driver", "سائق", "سواق"),
      entry("passenger", "passenger", "راكب"),
      entry("seat", "seat", "مقعد"),
      entry("map", "map", "خريطة"),
      entry("direction", "direction", "اتجاه"),
      entry("left", "left", "يسار"),
      entry("right", "right", "يمين"),
      entry("near", "near", "قريب"),
      entry("far", "far", "بعيد"),
      entry("arrival", "arrival", "وصول"),
      entry("departure", "departure", "مغادرة"),
      entry("stop", "stop", "موقف"),
      entry("bridge", "bridge", "جسر"),
      entry("fuel", "fuel", "وقود", "بنزين"),
      entry("parking", "parking", "موقف سيارات", "باركينغ"),
    ],
    modifiers: [
      entry("fast", "fast", "سريع"),
      entry("slow", "slow", "بطيء"),
      entry("crowded", "crowded", "مزدحم"),
      entry("empty", "empty", "فارغ", "فاضي"),
      entry("late", "late", "متأخر"),
    ],
    modifierTargets: ["bus", "train", "station", "road", "traffic"],
    chunkRefs: ["car", "bus", "taxi", "train", "station", "airport", "ticket", "direction", "fuel", "parking"],
    chunkTemplates: genericChunkTemplates,
  },
  {
    id: "shopping",
    vocabBase: [
      entry("store", "store", "متجر", "محل"),
      entry("market", "market", "سوق"),
      entry("mall", "mall", "مركز تجاري", "مول"),
      entry("price", "price", "سعر"),
      entry("money", "money", "مال", "مصاري"),
      entry("cash", "cash", "نقد", "كاش"),
      entry("card", "card", "بطاقة"),
      entry("receipt", "receipt", "إيصال", "فاتورة"),
      entry("bag", "bag", "حقيبة", "كيس"),
      entry("size", "size", "مقاس", "قياس"),
      entry("color", "color", "لون"),
      entry("cheap", "cheap", "رخيص"),
      entry("expensive", "expensive", "غالي"),
      entry("discount", "discount", "خصم", "حسم"),
      entry("brand", "brand", "علامة تجارية", "ماركة"),
      entry("shirt", "shirt", "قميص"),
      entry("pants", "pants", "بنطال", "بنطلون"),
      entry("shoes", "shoes", "أحذية", "صباط"),
      entry("jacket", "jacket", "سترة", "جاكيت"),
      entry("gift", "gift", "هدية"),
      entry("open", "open", "مفتوح", "فاتح"),
      entry("closed", "closed", "مغلق", "مسكر"),
      entry("exchange", "exchange", "استبدال", "تبديل"),
      entry("return", "return", "إرجاع", "ترجيع"),
      entry("queue", "queue", "طابور", "دور"),
    ],
    modifiers: [
      entry("cheap", "cheap", "رخيص"),
      entry("expensive", "expensive", "غالي"),
      entry("new", "new", "جديد"),
      entry("used", "used", "مستعمل"),
      entry("available", "available", "متاح", "متوفر"),
    ],
    modifierTargets: ["price", "size", "color", "shirt", "shoes"],
    chunkRefs: ["store", "market", "price", "money", "card", "bag", "size", "discount", "shirt", "queue"],
    chunkTemplates: genericChunkTemplates,
  },
  {
    id: "work",
    vocabBase: [
      entry("job", "job", "وظيفة", "شغل"),
      entry("office", "office", "مكتب"),
      entry("meeting", "meeting", "اجتماع"),
      entry("email", "email", "بريد إلكتروني", "إيميل"),
      entry("phone", "phone", "هاتف", "تلفون"),
      entry("computer", "computer", "حاسوب", "كمبيوتر"),
      entry("internet", "internet", "إنترنت"),
      entry("project", "project", "مشروع"),
      entry("deadline", "deadline", "موعد نهائي", "ديدلاين"),
      entry("manager", "manager", "مدير"),
      entry("colleague", "colleague", "زميل"),
      entry("customer", "customer", "عميل", "زبون"),
      entry("salary", "salary", "راتب"),
      entry("vacation", "vacation", "إجازة"),
      entry("schedule", "schedule", "جدول", "برنامج"),
      entry("task", "task", "مهمة"),
      entry("report", "report", "تقرير"),
      entry("idea", "idea", "فكرة"),
      entry("problem", "problem", "مشكلة"),
      entry("solution", "solution", "حل"),
      entry("break", "break", "استراحة"),
      entry("team", "team", "فريق"),
      entry("training", "training", "تدريب"),
      entry("interview", "interview", "مقابلة"),
      entry("experience", "experience", "خبرة"),
    ],
    modifiers: [
      entry("urgent", "urgent", "عاجل", "مستعجل"),
      entry("important", "important", "مهم"),
      entry("clear", "clear", "واضح"),
      entry("difficult", "difficult", "صعب"),
      entry("finished", "finished", "منتهي", "مخلص"),
    ],
    modifierTargets: ["meeting", "project", "deadline", "task", "report"],
    chunkRefs: ["job", "office", "meeting", "email", "project", "deadline", "manager", "salary", "task", "team"],
    chunkTemplates: genericChunkTemplates,
  },
  {
    id: "health",
    vocabBase: [
      entry("doctor", "doctor", "طبيب", "دكتور"),
      entry("hospital", "hospital", "مستشفى", "مشفى"),
      entry("clinic", "clinic", "عيادة"),
      entry("pharmacy", "pharmacy", "صيدلية"),
      entry("medicine", "medicine", "دواء", "دوا"),
      entry("pain", "pain", "ألم", "وجع"),
      entry("headache", "headache", "صداع", "وجع راس"),
      entry("fever", "fever", "حمى", "حرارة"),
      entry("cough", "cough", "سعال", "كحة"),
      entry("cold", "cold", "نزلة برد", "رشح"),
      entry("stomach", "stomach", "معدة"),
      entry("back", "back", "ظهر"),
      entry("tooth", "tooth", "سن"),
      entry("blood", "blood", "دم"),
      entry("pressure", "pressure", "ضغط"),
      entry("allergy", "allergy", "حساسية"),
      entry("appointment", "appointment", "موعد"),
      entry("insurance", "insurance", "تأمين"),
      entry("healthy", "healthy", "صحي", "منيح"),
      entry("sick", "sick", "مريض", "تعبان"),
      entry("tired", "tired", "متعب", "تعبان"),
      entry("sleep", "sleep", "نوم"),
      entry("exercise", "exercise", "تمرين", "رياضة"),
      entry("diet", "diet", "حمية", "دايت"),
      entry("emergency", "emergency", "طوارئ"),
    ],
    modifiers: [
      entry("severe", "severe", "شديد"),
      entry("mild", "mild", "خفيف"),
      entry("chronic", "chronic", "مزمن"),
      entry("better", "better", "أفضل", "أحسن"),
      entry("worse", "worse", "أسوأ"),
    ],
    modifierTargets: ["pain", "fever", "cough", "pressure", "appointment"],
    chunkRefs: ["doctor", "hospital", "pharmacy", "medicine", "pain", "headache", "fever", "appointment", "insurance", "emergency"],
    chunkTemplates: genericChunkTemplates,
  },
  {
    id: "feelings",
    vocabBase: [
      entry("happy", "happy", "سعيد", "مبسوط"),
      entry("sad", "sad", "حزين", "زعلان"),
      entry("angry", "angry", "غاضب", "معصب"),
      entry("afraid", "afraid", "خائف", "خايف"),
      entry("worried", "worried", "قلق", "مهموم"),
      entry("calm", "calm", "هادئ", "رايق"),
      entry("excited", "excited", "متحمس"),
      entry("tired", "tired", "متعب", "تعبان"),
      entry("stressed", "stressed", "متوتر", "مضغوط"),
      entry("confused", "confused", "مرتبك", "ملخبط"),
      entry("bored", "bored", "ملل", "زهقان"),
      entry("surprised", "surprised", "متفاجئ", "مستغرب"),
      entry("proud", "proud", "فخور"),
      entry("ashamed", "ashamed", "خجلان", "مستحي"),
      entry("lonely", "lonely", "وحيد", "وحداني"),
      entry("comfortable", "comfortable", "مرتاح"),
      entry("hopeful", "hopeful", "متفائل"),
      entry("grateful", "grateful", "ممتن"),
      entry("love", "love", "حب"),
      entry("hate", "hate", "كره"),
      entry("trust", "trust", "ثقة"),
      entry("doubt", "doubt", "شك"),
      entry("patience", "patience", "صبر"),
      entry("motivation", "motivation", "دافع"),
      entry("mood", "mood", "مزاج"),
    ],
    modifiers: [
      entry("good", "good", "جيد", "منيح"),
      entry("bad", "bad", "سيئ", "مو منيح"),
      entry("strong", "strong", "قوي"),
      entry("weak", "weak", "ضعيف"),
      entry("stable", "stable", "مستقر"),
    ],
    modifierTargets: ["mood", "motivation", "patience", "trust", "doubt"],
    chunkRefs: ["happy", "sad", "angry", "afraid", "worried", "calm", "excited", "tired", "stressed", "confused"],
    chunkTemplates: feelingsChunkTemplates,
  },
  {
    id: "emergencies",
    vocabBase: [
      entry("help", "help", "مساعدة"),
      entry("police", "police", "شرطة"),
      entry("fire", "fire", "حريق", "حريقة"),
      entry("ambulance", "ambulance", "إسعاف"),
      entry("danger", "danger", "خطر"),
      entry("accident", "accident", "حادث"),
      entry("injury", "injury", "إصابة"),
      entry("lost", "lost", "ضائع", "ضايع"),
      entry("stolen", "stolen", "مسروق"),
      entry("emergency", "emergency", "طارئ"),
      entry("call", "call", "اتصال"),
      entry("phone_number", "phone number", "رقم الهاتف", "رقم التلفون"),
      entry("address", "address", "عنوان"),
      entry("id_card", "ID card", "بطاقة هوية", "هوية"),
      entry("passport", "passport", "جواز سفر"),
      entry("safe", "safe", "آمن"),
      entry("unsafe", "unsafe", "غير آمن", "مو آمن"),
      entry("problem", "problem", "مشكلة"),
      entry("urgent", "urgent", "عاجل", "مستعجل"),
      entry("earthquake", "earthquake", "زلزال"),
      entry("flood", "flood", "فيضان"),
      entry("power_cut", "power cut", "انقطاع الكهرباء", "انقطاع الكهربا"),
      entry("gas_leak", "gas leak", "تسرب غاز"),
      entry("first_aid", "first aid", "إسعافات أولية"),
      entry("exit", "exit", "مخرج"),
    ],
    modifiers: [
      entry("immediate", "immediate", "فوري"),
      entry("serious", "serious", "خطير"),
      entry("nearby", "nearby", "قريب"),
      entry("safe", "safe", "آمن"),
      entry("dangerous", "dangerous", "خطير"),
    ],
    modifierTargets: ["danger", "injury", "problem", "exit", "help"],
    chunkRefs: ["help", "police", "fire", "ambulance", "danger", "accident", "injury", "lost", "address", "exit"],
    chunkTemplates: genericChunkTemplates,
  },
];

const ARABIC_TO_LATIN = {
  ا: "a",
  أ: "a",
  إ: "i",
  آ: "aa",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "j",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "dh",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  ة: "a",
  و: "w",
  ي: "y",
  ى: "a",
  ء: "a",
  ئ: "i",
  ؤ: "u",
  " ": " ",
  "-": "-",
};

function transliterateArabic(text) {
  return text
    .split("")
    .map((char) => {
      if (ARABIC_TO_LATIN[char] !== undefined) {
        return ARABIC_TO_LATIN[char];
      }
      return /[؟،]/.test(char) ? "" : char;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function autoVowelWord(word) {
  if (!word) {
    return word;
  }

  if (/[\u0610-\u065f\u0670\u06d6-\u06ed]/.test(word)) {
    return word;
  }

  let out = "";
  for (let i = 0; i < word.length; i += 1) {
    const ch = word[i];
    const next = word[i + 1];
    out += ch;

    const isArabicLetter = /[\u0621-\u064A\u0671-\u06D3\u06FA-\u06FF]/.test(ch);
    const hasNextLetter = /[\u0621-\u064A\u0671-\u06D3\u06FA-\u06FF]/.test(next ?? "");
    const isLongCarrier = /[اويى]/.test(ch);
    if (isArabicLetter && hasNextLetter && !isLongCarrier) {
      out += "َ";
    }
  }

  return out;
}

function autoVowelText(text) {
  return text
    .split(" ")
    .map((word) => autoVowelWord(word))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function asConcept({ domainId, itemType, key, gloss, msa, syrian }) {
  return {
    conceptKey: `ar.${domainId}.${itemType}.${key}`,
    domain: domainId,
    itemType,
    gloss,
    msa: {
      scriptText: msa,
      transliteration: transliterateArabic(msa),
      vowelledText: autoVowelText(msa),
    },
    syrian: {
      scriptText: syrian,
      transliteration: transliterateArabic(syrian),
    },
  };
}

function ensureUniqueCount(items, target, label) {
  if (items.length !== target) {
    throw new Error(`${label} expected ${target}, got ${items.length}`);
  }
}

function buildDomainVocabulary(config) {
  const vocabulary = [];
  const byKey = new Map();

  for (const item of config.vocabBase) {
    if (byKey.has(item.key)) {
      throw new Error(`Duplicate base key ${item.key} in ${config.id}`);
    }

    byKey.set(item.key, item);
    vocabulary.push(asConcept({ domainId: config.id, itemType: "vocab", ...item }));
  }

  for (const targetKey of config.modifierTargets) {
    const target = byKey.get(targetKey);
    if (!target) {
      throw new Error(`Modifier target ${targetKey} missing in ${config.id}`);
    }

    for (const modifier of config.modifiers) {
      const key = `${target.key}_${modifier.key}`;
      vocabulary.push(
        asConcept({
          domainId: config.id,
          itemType: "vocab",
          key,
          gloss: `${modifier.gloss} ${target.gloss}`,
          msa: `${target.msa} ${modifier.msa}`,
          syrian: `${target.syrian} ${modifier.syrian}`,
        }),
      );
    }
  }

  ensureUniqueCount(vocabulary, 50, `${config.id} vocabulary`);
  return { vocabulary, byKey };
}

function buildDomainChunks(config, byKey) {
  const refs = config.chunkRefs.map((key) => {
    const ref = byKey.get(key);
    if (!ref) {
      throw new Error(`Chunk ref ${key} missing in ${config.id}`);
    }
    return ref;
  });

  const chunks = [];

  for (const template of config.chunkTemplates) {
    for (const ref of refs) {
      chunks.push(
        asConcept({
          domainId: config.id,
          itemType: "chunk",
          key: `${template.key}_${ref.key}`,
          gloss: template.gloss(ref),
          msa: template.msa(ref),
          syrian: template.syrian(ref),
        }),
      );
    }
  }

  ensureUniqueCount(chunks, 50, `${config.id} chunks`);
  return chunks;
}

function buildLessons(domainConceptMap) {
  const lessons = [];
  let sequenceNo = 1;

  for (const [domain, conceptGroups] of domainConceptMap.entries()) {
    const vocab = conceptGroups.vocab;
    const chunks = conceptGroups.chunks;

    for (let i = 0; i < 10; i += 1) {
      const vocabSlice = vocab.slice(i * 5, i * 5 + 5).map((concept) => concept.conceptKey);
      const chunkSlice = chunks.slice(i * 5, i * 5 + 5).map((concept) => concept.conceptKey);

      lessons.push({
        language: "ar_msa",
        domain,
        sequenceNo,
        estimatedMinutes: 25,
        conceptKeys: [...vocabSlice, ...chunkSlice],
      });

      sequenceNo += 1;
    }
  }

  return lessons;
}

function buildDataset() {
  const concepts = [];
  const domainConceptMap = new Map();

  for (const config of domainConfigs) {
    const { vocabulary, byKey } = buildDomainVocabulary(config);
    const chunks = buildDomainChunks(config, byKey);

    concepts.push(...vocabulary, ...chunks);
    domainConceptMap.set(config.id, { vocab: vocabulary, chunks });
  }

  const lessons = buildLessons(domainConceptMap);

  return {
    version: "2.0.0",
    profile: {
      label: "Syrian companion 80:20 full dataset",
      targetConceptCount: 800,
      targetMix: {
        vocab: 0.5,
        chunk: 0.5,
      },
      notes: "MSA is primary form. Syrian is secondary companion. Concepts are balanced across 8 high-frequency everyday domains.",
    },
    concepts,
    lessons,
  };
}

const dataset = buildDataset();
writeFileSync(OUTPUT_PATH, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
console.log(`Wrote ${dataset.concepts.length} concepts and ${dataset.lessons.length} lessons to ${OUTPUT_PATH}`);
