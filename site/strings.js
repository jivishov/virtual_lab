// ===== REDESIGN UI STRINGS =====
// Extra strings used only by the redesigned index.html and about.html.
// They are merged into the shared `translations` object from i18n/translations.js,
// so the existing I18n engine, language storage key and four languages keep working.
// Existing keys always win: nothing already defined in translations.js is overwritten.

(function () {
    'use strict';

    const extra = {
        en: {
            site: {
                meta: {
                    homeTitle: "Virtual Laboratory · Interactive science experiments & simulations",
                    aboutTitle: "About · Virtual Laboratory"
                },
                skip: "Skip to content",
                nav: { collection: "Collection", github: "GitHub" },
                theme: "Dark mode",
                langLabel: "Language",
                hero: {
                    eyebrow: "Open-source virtual science lab",
                    pre: "The lab",
                    em: "before",
                    post: "the lab.",
                    lead: "Rehearse every step of a real experiment in your browser — like a flight simulator for the lab bench. Make your mistakes safely, then walk into the lab ready.",
                    cta: "Explore the collection",
                    cta2: "About the project"
                },
                table: {
                    title: "Periodic Table of Experiments",
                    hint: "Hover an element to preview · click to launch",
                    hintTouch: "Tap an element to launch",
                    go: "Click to launch",
                    key: "Legend",
                    no: "No.",
                    symbol: "Symbol",
                    families: "Fields"
                },
                eka: {
                    name: "Coming soon",
                    title: "Undiscovered element",
                    desc: "Mendeleev left gaps for elements not yet discovered. So do we — new experiments are in development."
                },
                family: {
                    chem: "Chemistry",
                    phys: "Physical Chemistry",
                    life: "Life Sciences",
                    safety: "Lab Safety"
                },
                type: { lab: "Experiment", simulation: "Simulation" },
                catalog: {
                    eyebrow: "The collection",
                    title: "Pick an experiment. Start rehearsing.",
                    all: "All",
                    search: "Search by name or topic…",
                    empty: "No matches. Try another word.",
                    clear: "Clear filters",
                    filters: "Filters"
                },
                buttons: { v2d: "2D version", v3d: "3D version" },
                band: {
                    quote: "Pilots train in simulators before they fly. Students should rehearse experiments before they touch the glassware.",
                    labs: "experiments & simulations",
                    langs: "languages",
                    installs: "things to install",
                    license: "open-source license",
                    cta: "Read the story"
                },
                short: {
                    spectrophotometry: "Spectrophotometry",
                    dnamicroarray: "DNA Microarray",
                    copperinbrass: "Copper in Brass",
                    labstudio: "Lab Studio",
                    elisaassay: "ELISA",
                    nuclearchemistry: "Nuclear Chemistry",
                    labsafety: "Lab Safety",
                    gaslaws: "Gas Laws",
                    moletycoon: "MoleTycoon",
                    thermodynamics: "Thermo Escape",
                    solubilitycurves: "Solubility Curves",
                    pharmacogenomics: "Pharmacogenomics",
                    virusdefenselab: "Virus Defense",
                    acidbasesolutions: "Acid–Base 3D",
                    latticeenergy: "Lattice Energy"
                },
                about: {
                    eyebrow: "About",
                    checklistTitle: "Pre-lab checklist",
                    checklist: [
                        "Read the procedure",
                        "Rehearse every step",
                        "Make mistakes safely",
                        "Walk into the lab ready"
                    ],
                    now: "Today",
                    next: "Next",
                    t1: "Large language models go mainstream. The first trials begin.",
                    t2: "Many trials and iterations to harness AI coding for teaching.",
                    t3: "Virtual Laboratory goes live at virtuallab.az.",
                    t4: "{n} experiments and simulations in {l} languages.",
                    t5: "More experiments, lesson plans and languages.",
                    stack: "Built with",
                    langsNote: "Pick a language to switch the whole site.",
                    role: "Creator & lead developer",
                    runTitle: "Run it yourself",
                    runNote: "Plain HTML, CSS and JavaScript — host the folder on any web server.",
                    copy: "Copy",
                    copied: "Copied",
                    github: "View on GitHub",
                    ekaNote: "Like Mendeleev's gaps: elements we know are coming."
                }
            },
            labs: {
                latticeenergy: {
                    title: "Lattice Energy Lab",
                    description: "Compare ionic compounds by charge and ionic size, manipulate ion separation, and visualize why stronger electrostatic attraction produces a more exothermic lattice formation energy.",
                    tags: ["Lattice Energy", "Ionic Compounds", "Electrostatics", "Chemistry"]
                }
            }
        },

        az: {
            site: {
                meta: {
                    homeTitle: "Virtual Laboratoriya · İnteraktiv elmi təcrübələr və simulyasiyalar",
                    aboutTitle: "Haqqında · Virtual Laboratoriya"
                },
                skip: "Məzmuna keç",
                nav: { collection: "Kolleksiya", github: "GitHub" },
                theme: "Qaranlıq rejim",
                langLabel: "Dil",
                hero: {
                    eyebrow: "Açıq mənbəli virtual elm laboratoriyası",
                    pre: "Laboratoriyadan",
                    em: "əvvəlki",
                    post: "laboratoriya.",
                    lead: "Real təcrübənin hər addımını brauzerinizdə məşq edin — laboratoriya masası üçün uçuş simulyatoru kimi. Səhvlərinizi təhlükəsiz şəkildə edin, sonra laboratoriyaya hazır daxil olun.",
                    cta: "Kolleksiyanı kəşf edin",
                    cta2: "Layihə haqqında"
                },
                table: {
                    title: "Təcrübələrin dövri cədvəli",
                    hint: "Önizləmə üçün elementin üzərinə gəlin · başlatmaq üçün klikləyin",
                    hintTouch: "Başlatmaq üçün elementə toxunun",
                    go: "Başlatmaq üçün klikləyin",
                    key: "Şərti işarələr",
                    no: "Nömrə",
                    symbol: "Simvol",
                    families: "Sahələr"
                },
                eka: {
                    name: "Tezliklə",
                    title: "Kəşf olunmamış element",
                    desc: "Mendeleyev hələ kəşf olunmamış elementlər üçün boş xanalar saxlamışdı. Biz də belə edirik — yeni təcrübələr hazırlanır."
                },
                family: {
                    chem: "Kimya",
                    phys: "Fiziki kimya",
                    life: "Həyat elmləri",
                    safety: "Laboratoriya təhlükəsizliyi"
                },
                type: { lab: "Təcrübə", simulation: "Simulyasiya" },
                catalog: {
                    eyebrow: "Kolleksiya",
                    title: "Təcrübə seçin. Məşqə başlayın.",
                    all: "Hamısı",
                    search: "Ad və ya mövzu üzrə axtarın…",
                    empty: "Uyğun nəticə tapılmadı. Başqa söz yoxlayın.",
                    clear: "Filtrləri sıfırla",
                    filters: "Filtrlər"
                },
                buttons: { v2d: "2D versiya", v3d: "3D versiya" },
                band: {
                    quote: "Pilotlar uçuşdan əvvəl simulyatorlarda məşq edirlər. Tələbələr də laboratoriya qablarına toxunmazdan əvvəl təcrübələri məşq etməlidirlər.",
                    labs: "təcrübə və simulyasiya",
                    langs: "dil",
                    installs: "quraşdırılacaq proqram",
                    license: "açıq mənbə lisenziyası",
                    cta: "Hekayəni oxuyun"
                },
                short: {
                    spectrophotometry: "Spektrofotometriya",
                    dnamicroarray: "DNT Mikroarray",
                    copperinbrass: "Bürüncdə mis",
                    labstudio: "Laboratoriya studiyası",
                    elisaassay: "ELISA",
                    nuclearchemistry: "Nüvə kimyası",
                    labsafety: "Təhlükəsizlik",
                    gaslaws: "Qaz qanunları",
                    moletycoon: "MoleTycoon",
                    thermodynamics: "Termodinamika",
                    solubilitycurves: "Həllolma əyriləri",
                    pharmacogenomics: "Farmakogenomika",
                    virusdefenselab: "Virus və müdafiə",
                    acidbasesolutions: "Turşu–qələvi 3D",
                    latticeenergy: "Qəfəs enerjisi"
                },
                about: {
                    eyebrow: "Haqqında",
                    checklistTitle: "Laboratoriyadan əvvəl yoxlama siyahısı",
                    checklist: [
                        "Proseduru oxuyun",
                        "Hər addımı məşq edin",
                        "Səhvləri təhlükəsiz edin",
                        "Laboratoriyaya hazır daxil olun"
                    ],
                    now: "Bu gün",
                    next: "Növbəti",
                    t1: "Böyük dil modelləri geniş yayılır. İlk sınaqlar başlayır.",
                    t2: "Süni intellektlə kodlaşdırmanı tədrisdə tətbiq etmək üçün çoxsaylı sınaqlar və təkmilləşdirmələr.",
                    t3: "Virtual Laboratoriya virtuallab.az ünvanında istifadəyə verilir.",
                    t4: "{l} dildə {n} təcrübə və simulyasiya.",
                    t5: "Daha çox təcrübə, dərs planları və dillər.",
                    stack: "İstifadə olunan texnologiyalar",
                    langsNote: "Bütün saytın dilini dəyişmək üçün dil seçin.",
                    role: "Yaradıcı və aparıcı tərtibatçı",
                    runTitle: "Özünüz işə salın",
                    runNote: "Sadə HTML, CSS və JavaScript — qovluğu istənilən veb serverdə yerləşdirin.",
                    copy: "Kopyala",
                    copied: "Kopyalandı",
                    github: "GitHub-da baxın",
                    ekaNote: "Mendeleyevin boş xanaları kimi: gələcəyini bildiyimiz elementlər."
                }
            },
            labs: {
                latticeenergy: {
                    title: "Qəfəs Enerjisi Laboratoriyası",
                    description: "İon birləşmələrini yük və ion ölçüsünə görə müqayisə edin, ionlar arasındakı məsafəni dəyişin və daha güclü elektrostatik cazibənin niyə daha ekzotermik qəfəs əmələgəlmə enerjisi yaratdığını əyani görün.",
                    tags: ["Qəfəs enerjisi", "İon birləşmələri", "Elektrostatika", "Kimya"]
                }
            }
        },

        tr: {
            site: {
                meta: {
                    homeTitle: "Sanal Laboratuvar · Etkileşimli bilimsel deneyler ve simülasyonlar",
                    aboutTitle: "Hakkında · Sanal Laboratuvar"
                },
                skip: "İçeriğe geç",
                nav: { collection: "Koleksiyon", github: "GitHub" },
                theme: "Karanlık mod",
                langLabel: "Dil",
                hero: {
                    eyebrow: "Açık kaynaklı sanal bilim laboratuvarı",
                    pre: "Deneyden",
                    em: "önce",
                    post: "deneme.",
                    lead: "Gerçek bir deneyin her adımını tarayıcınızda prova edin — laboratuvar tezgâhı için bir uçuş simülatörü gibi. Hatalarınızı güvenle yapın, ardından laboratuvara hazır girin.",
                    cta: "Koleksiyonu keşfedin",
                    cta2: "Proje hakkında"
                },
                table: {
                    title: "Deneylerin Periyodik Tablosu",
                    hint: "Önizlemek için bir öğenin üzerine gelin · başlatmak için tıklayın",
                    hintTouch: "Başlatmak için bir öğeye dokunun",
                    go: "Başlatmak için tıklayın",
                    key: "Açıklama",
                    no: "No.",
                    symbol: "Sembol",
                    families: "Alanlar"
                },
                eka: {
                    name: "Yakında",
                    title: "Keşfedilmemiş element",
                    desc: "Mendeleyev henüz keşfedilmemiş elementler için boşluklar bırakmıştı. Biz de öyle yapıyoruz — yeni deneyler geliştiriliyor."
                },
                family: {
                    chem: "Kimya",
                    phys: "Fizikokimya",
                    life: "Yaşam Bilimleri",
                    safety: "Laboratuvar Güvenliği"
                },
                type: { lab: "Deney", simulation: "Simülasyon" },
                catalog: {
                    eyebrow: "Koleksiyon",
                    title: "Bir deney seçin. Provaya başlayın.",
                    all: "Tümü",
                    search: "Ad veya konuya göre arayın…",
                    empty: "Eşleşme bulunamadı. Başka bir kelime deneyin.",
                    clear: "Filtreleri temizle",
                    filters: "Filtreler"
                },
                buttons: { v2d: "2B sürüm", v3d: "3B sürüm" },
                band: {
                    quote: "Pilotlar uçmadan önce simülatörlerde eğitim alır. Öğrenciler de cam malzemelere dokunmadan önce deneyleri prova etmelidir.",
                    labs: "deney ve simülasyon",
                    langs: "dil",
                    installs: "kurulacak program",
                    license: "açık kaynak lisansı",
                    cta: "Hikâyeyi okuyun"
                },
                short: {
                    spectrophotometry: "Spektrofotometri",
                    dnamicroarray: "DNA Mikroarray",
                    copperinbrass: "Pirinçte bakır",
                    labstudio: "Laboratuvar stüdyosu",
                    elisaassay: "ELISA",
                    nuclearchemistry: "Nükleer kimya",
                    labsafety: "Lab güvenliği",
                    gaslaws: "Gaz yasaları",
                    moletycoon: "MoleTycoon",
                    thermodynamics: "Termodinamik",
                    solubilitycurves: "Çözünürlük eğrileri",
                    pharmacogenomics: "Farmakogenomik",
                    virusdefenselab: "Virüs savunması",
                    acidbasesolutions: "Asit–baz 3B",
                    latticeenergy: "Örgü enerjisi"
                },
                about: {
                    eyebrow: "Hakkında",
                    checklistTitle: "Laboratuvar öncesi kontrol listesi",
                    checklist: [
                        "Prosedürü okuyun",
                        "Her adımı prova edin",
                        "Hataları güvenle yapın",
                        "Laboratuvara hazır girin"
                    ],
                    now: "Bugün",
                    next: "Sırada",
                    t1: "Büyük dil modelleri yaygınlaşır. İlk denemeler başlar.",
                    t2: "Yapay zekâ destekli kodlamayı eğitimde kullanmak için sayısız deneme ve iyileştirme.",
                    t3: "Sanal Laboratuvar virtuallab.az adresinde yayına girer.",
                    t4: "{l} dilde {n} deney ve simülasyon.",
                    t5: "Daha fazla deney, ders planı ve dil.",
                    stack: "Kullanılan teknolojiler",
                    langsNote: "Tüm sitenin dilini değiştirmek için bir dil seçin.",
                    role: "Kurucu ve baş geliştirici",
                    runTitle: "Kendiniz çalıştırın",
                    runNote: "Sade HTML, CSS ve JavaScript — klasörü herhangi bir web sunucusunda barındırın.",
                    copy: "Kopyala",
                    copied: "Kopyalandı",
                    github: "GitHub'da görüntüle",
                    ekaNote: "Mendeleyev'in boşlukları gibi: geleceğini bildiğimiz elementler."
                }
            },
            labs: {
                latticeenergy: {
                    title: "Örgü Enerjisi Laboratuvarı",
                    description: "İyonik bileşikleri yük ve iyon boyutuna göre karşılaştırın, iyonlar arası mesafeyi değiştirin ve daha güçlü elektrostatik çekimin neden daha ekzotermik örgü oluşum enerjisi ürettiğini görselleştirin.",
                    tags: ["Örgü Enerjisi", "İyonik Bileşikler", "Elektrostatik", "Kimya"]
                }
            }
        },

        de: {
            site: {
                meta: {
                    homeTitle: "Virtuelles Labor · Interaktive naturwissenschaftliche Experimente & Simulationen",
                    aboutTitle: "Über · Virtuelles Labor"
                },
                skip: "Zum Inhalt springen",
                nav: { collection: "Sammlung", github: "GitHub" },
                theme: "Dunkelmodus",
                langLabel: "Sprache",
                hero: {
                    eyebrow: "Virtuelles Open-Source-Labor",
                    pre: "Das Labor",
                    em: "vor",
                    post: "dem Labor.",
                    lead: "Proben Sie jeden Schritt eines echten Experiments im Browser – wie ein Flugsimulator für den Labortisch. Machen Sie Fehler gefahrlos und betreten Sie das Labor gut vorbereitet.",
                    cta: "Sammlung entdecken",
                    cta2: "Über das Projekt"
                },
                table: {
                    title: "Periodensystem der Experimente",
                    hint: "Element überfahren für Vorschau · klicken zum Starten",
                    hintTouch: "Element antippen zum Starten",
                    go: "Zum Starten klicken",
                    key: "Legende",
                    no: "Nr.",
                    symbol: "Symbol",
                    families: "Bereiche"
                },
                eka: {
                    name: "Demnächst",
                    title: "Unentdecktes Element",
                    desc: "Mendelejew ließ Lücken für noch unentdeckte Elemente. Wir auch – neue Experimente sind in Entwicklung."
                },
                family: {
                    chem: "Chemie",
                    phys: "Physikalische Chemie",
                    life: "Biowissenschaften",
                    safety: "Laborsicherheit"
                },
                type: { lab: "Experiment", simulation: "Simulation" },
                catalog: {
                    eyebrow: "Die Sammlung",
                    title: "Experiment wählen. Proben beginnen.",
                    all: "Alle",
                    search: "Nach Name oder Thema suchen…",
                    empty: "Keine Treffer. Versuchen Sie ein anderes Wort.",
                    clear: "Filter zurücksetzen",
                    filters: "Filter"
                },
                buttons: { v2d: "2D-Version", v3d: "3D-Version" },
                band: {
                    quote: "Piloten trainieren im Simulator, bevor sie fliegen. Lernende sollten Experimente proben, bevor sie Laborglas berühren.",
                    labs: "Experimente & Simulationen",
                    langs: "Sprachen",
                    installs: "Installationen nötig",
                    license: "Open-Source-Lizenz",
                    cta: "Die Geschichte lesen"
                },
                short: {
                    spectrophotometry: "Spektrophotometrie",
                    dnamicroarray: "DNA-Mikroarray",
                    copperinbrass: "Kupfer in Messing",
                    labstudio: "Lab Studio",
                    elisaassay: "ELISA",
                    nuclearchemistry: "Kernchemie",
                    labsafety: "Laborsicherheit",
                    gaslaws: "Gasgesetze",
                    moletycoon: "MoleTycoon",
                    thermodynamics: "Thermodynamik",
                    solubilitycurves: "Löslichkeitskurven",
                    pharmacogenomics: "Pharmakogenomik",
                    virusdefenselab: "Virusabwehr",
                    acidbasesolutions: "Säure–Base 3D",
                    latticeenergy: "Gitterenergie"
                },
                about: {
                    eyebrow: "Über",
                    checklistTitle: "Checkliste vor dem Labor",
                    checklist: [
                        "Anleitung lesen",
                        "Jeden Schritt proben",
                        "Fehler gefahrlos machen",
                        "Vorbereitet ins Labor gehen"
                    ],
                    now: "Heute",
                    next: "Als Nächstes",
                    t1: "Große Sprachmodelle werden populär. Erste Versuche beginnen.",
                    t2: "Zahlreiche Versuche und Iterationen, um KI-gestütztes Programmieren für den Unterricht nutzbar zu machen.",
                    t3: "Das Virtuelle Labor geht unter virtuallab.az online.",
                    t4: "{n} Experimente und Simulationen in {l} Sprachen.",
                    t5: "Mehr Experimente, Unterrichtspläne und Sprachen.",
                    stack: "Gebaut mit",
                    langsNote: "Wählen Sie eine Sprache, um die ganze Website umzustellen.",
                    role: "Gründer & Hauptentwickler",
                    runTitle: "Selbst ausführen",
                    runNote: "Reines HTML, CSS und JavaScript – den Ordner auf einem beliebigen Webserver bereitstellen.",
                    copy: "Kopieren",
                    copied: "Kopiert",
                    github: "Auf GitHub ansehen",
                    ekaNote: "Wie Mendelejews Lücken: Elemente, von denen wir wissen, dass sie kommen."
                }
            },
            labs: {
                latticeenergy: {
                    title: "Gitterenergie-Labor",
                    description: "Vergleichen Sie Ionenverbindungen nach Ladung und Ionengröße, verändern Sie den Ionenabstand und veranschaulichen Sie, warum eine stärkere elektrostatische Anziehung eine exothermere Gitterbildungsenergie ergibt.",
                    tags: ["Gitterenergie", "Ionenverbindungen", "Elektrostatik", "Chemie"]
                }
            }
        }
    };

    function merge(target, source) {
        Object.keys(source).forEach(function (key) {
            const value = source[key];
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                if (!target[key] || typeof target[key] !== 'object') target[key] = {};
                merge(target[key], value);
            } else if (!(key in target)) {
                target[key] = value;
            }
        });
    }

    // translations.js declares `const translations`; if it failed to load, fall back to a global.
    const store = (typeof translations !== 'undefined') ? translations : (window.translations = window.translations || {});
    Object.keys(extra).forEach(function (lang) {
        if (!store[lang]) store[lang] = {};
        merge(store[lang], extra[lang]);
    });
})();
