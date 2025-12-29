// az.js - Azərbaycan dili tərcümələri
export default {
    // ==========================================
    // İNTERFEYS ETİKETLƏRİ
    // ==========================================
    ui: {
        // Səhifə başlığı
        pageTitle: "AP Kimya: Mis Analizi Təcrübəsi",

        // Yan panel
        labEquipment: "Laboratoriya Avadanlığı",

        // Addım izləyicisi
        stepOf: "Addım {current} / {total}",
        brassLab: "Tunc Təcrübəsi",
        undo: "Geri al (maks 10)",
        autoForward: "Avtomatik irəli",
        toggleList: "Siyahını aç/bağla",
        complete: "Tamamlandı!",

        // Dəftərxana
        labNotebook: "Laboratoriya Dəftəri",
        sampleData: "1. Nümunə Məlumatları",
        massBrass: "Tunc Kütləsi",
        condition: "Vəziyyət",
        spectrophotometry: "2. Spektrofotometriya",
        sample: "Nümunə",
        abs: "Abs",
        calibrationCurve: "Kalibrasiya Əyrisi (Abs vs Qat)",

        // Təmizlik yoxlama siyahısı
        cleanupChecklist: "Laboratoriya Təmizliyi Yoxlama Siyahısı:",
        cleanupItem1: "Bütün küvetlərdəki mayeni tullantı stəkanına boşaldın",
        cleanupItem2: "Küvetləri distillə edilmiş su ilə ən azı 3 dəfə yuyun",
        cleanupItem3: "Bütün pipetləri tullantı stəkanına atın",
        cleanupItem4: "Əllərinizi yuyun",
        completeCleanup: "Təmizliyi Tamamla",

        // Hesablama sahəsi
        calcMassPercent: "Cu Kütlə %-ni Hesabla:",
        showHint: "İpucu Göstər",
        hideHint: "İpucunu Gizlə",
        formulaTitle: "Formul:",
        formulaConc: "Qat = (Abs + 0.00538) / 2.426",
        formulaMass: "Cu Kütlə % = (Qat x 0.100L x 63.55) / tunc kütləsi x 100",
        check: "Yoxla",
        percentPlaceholder: "%"
    },

    // ==========================================
    // AVADANLIQ ETİKETLƏRİ (Rəf)
    // ==========================================
    equipment: {
        balance: "Tərəzi",
        brass: "Tunc Nümunəsi",
        pipette: "Pipet",
        waste: "Tullantı Stəkanı",
        beaker: "50 mL Kim. Stəkan",
        acid: "Qatı HNO₃",
        flask: "100 mL H. Kolba",
        water: "Dist. Su",
        spec: "Spec 20",
        rack: "Küvet Stendi",
        cuvette: "Küvet",
        std1: "0.1 M Std",
        std2: "0.2 M Std",
        std4: "0.4 M Std"
    },

    // ==========================================
    // TƏRKİB/MƏHLUL ETİKETLƏRİ
    // ==========================================
    content: {
        acid: "HNO₃",
        water: "H₂O",
        copper: "Cu²⁺",
        std01: "0.1M",
        std02: "0.2M",
        std04: "0.4M",
        unknown: "Naməl",
        blank: "Blank"
    },

    // ==========================================
    // QRAFİKA/SVG MƏTNLƏRİ
    // ==========================================
    graphics: {
        getCuvette: "KÜVET AL",
        waste: "TULLANTI",
        pipettes: "{count} pipet",
        lid: "QAPAQ",
        open: "AÇIQ",
        beakerLabel: "50ml"
    },

    // ==========================================
    // QRAFİK ETİKETLƏRİ
    // ==========================================
    graph: {
        concentration: "Qat (M)",
        absorbance: "Abs",
        unknown: "Naməl",
        standards: "Std",
        fit: "Uyğun"
    },

    // ==========================================
    // VƏZİYYƏTLƏR
    // ==========================================
    conditions: {
        solid: "Bərk",
        dissolved: "Həll olunmuş"
    },

    // ==========================================
    // GERİ BİLDİRİŞ MESAJLARI
    // ==========================================
    messages: {
        // Ümumi
        welcome: "Xoş gəlmisiniz! Təcrübəni tamamlamaq üçün təlimatlara əməl edin.",
        labComplete: "Təcrübə tamamlandı! Başqa addım yoxdur.",
        nothingToUndo: "Geri alınacaq heç nə yoxdur.",
        undoSuccessful: "Geri alma uğurlu oldu.",
        invalidInteraction: "Yanlış əməliyyat. Cari təlimatı yoxlayın.",
        enterNumeric: "Rəqəmsal dəyər daxil edin.",

        // Avadanlıq yerləşdirilməsi
        alreadyPlaced: "Bu avadanlıq artıq iş masasındadır.",
        equipmentPlaced: "{equipment} iş masasına yerləşdirildi.",
        wrongEquipment: "{expected} yerləşdirin, bu elementi yox.",

        // Tunc çəkmə
        dragBrassToBalance: "Tunc Nümunəsini Tərəziyə tərəf çəkin.",
        dropOnBalance: "Tuncu Tərəzinin üzərinə qoyun.",
        brassMassRecorded: "Tunc kütləsi: {mass} g qeyd edildi.",

        // Tunc köçürülməsi
        dragBrassSample: "Tunc Nümunəsini çəkin.",
        dropIntoBeaker: "Tuncu Stəkana yerləşdirin.",
        weighFirst: "Əvvəlcə tuncu çəkin!",
        brassTransferred: "Tunc stəkana köçürüldü.",

        // Pipet əməliyyatları
        usePipetteToFill: "Doldurmaq üçün Pipet istifadə edin.",
        sourceNotFound: "Mənbə qabı tapılmadı.",
        pipetteAlreadyFull: "Pipet artıq doludur. Əvvəlcə boşaldın.",
        fillFromBeaker: "Həll olunmuş tunc olan stəkandan doldurun.",
        fillFromFlask: "Həcm kolbasından doldurun.",
        usePipetteToDispense: "Boşaltmaq üçün Pipet istifadə edin.",
        pipetteEmpty: "Pipet boşdur. Əvvəlcə doldurun.",
        destNotFound: "Təyinat qabı tapılmadı.",
        solutionTransferred: "Məhlul köçürüldü.",
        selectPipetteToDispose: "Atılacaq pipeti seçin.",
        dropPipetteInWaste: "Pipeti Tullantı Stəkanına atın.",
        cannotDispenseBack: "Reaktiv şüşəsinə geri boşaltmaq olmaz.",
        fillPipetteFirst: "Əvvəlcə pipeti doldurun.",
        usePipetteForCuvette: "Küveti doldurmaq üçün pipet istifadə edin.",
        pipetteDisposed: "Pipet atıldı.",

        // Reaksiya
        reactionInProgress: "Reaksiya davam edir... tunc həll olur.",
        addAcidFirst: "Əvvəlcə tunclu stəkana turşu əlavə edin.",
        brassDissolvedReady: "Tunc həll oldu! Mis məhlulu hazırdır.",

        // Küvet əməliyyatları
        clickCuvetteRack: "Küvet Stendini klikləyin.",
        cuvetteReady: "{type} üçün küvet hazırdır.",
        dispenseToCuvette: "Küvetə boşaldın.",
        cuvetteAlreadyFilled: "Küvet artıq doludur.",
        cuvetteFilled: "Küvet pipetdən dolduruldu.",
        cuvetteEmptied: "Küvet tullantıya boşaldıldı.",

        // Spec 20 əməliyyatları
        openLidFirst: "Əvvəlcə Spec 20 qapağını açın.",
        removeCuvetteFirst: "Əvvəlcə cari küveti çıxarın.",
        dragCuvetteToSpec: "Küveti Spec 20-yə çəkin.",
        fillCuvetteFirst: "Əvvəlcə küveti doldurun.",
        cuvetteInserted: "Küvet Spec 20-yə daxil edildi.",
        noCuvetteToRemove: "Çıxarılacaq küvet yoxdur.",
        cuvetteRemoved: "Küvet çıxarıldı.",
        insertBlankFirst: "Əvvəlcə blank küveti daxil edin.",
        useBlankToCalibrate: "Kalibrasiya üçün blank küvet (distillə suyu) istifadə edin.",
        specCalibrated: "Spec 20 0.000 absorbansına kalibrasiya edildi.",
        calibrateFirst: "Əvvəlcə Spec 20-ni blank ilə kalibrasiya edin.",
        insertCuvetteFirst: "Əvvəlcə küvet daxil edin.",
        absorbanceReading: "Absorbans: {reading}",
        lidAlready: "Qapaq artıq {state}.",
        lidToggled: "Qapaq {state}.",
        closeLidToMeasure: "Ölçmək üçün qapağı bağlayın.",

        // Hesablama
        checking: "Yoxlanılır...",
        measureUnknownFirst: "Əvvəlcə naməlum nümunəni ölçün.",
        correct: "Düzdür! Cu Kütlə % = {percent}%",
        incorrect: "Yanlışdır. Gözlənilən ~{percent}%.",

        // Təmizlik
        completeCleanupFirst: "Davam etmədən əvvəl bütün təmizlik tapşırıqlarını tamamlayın.",
        cleanupComplete: "Laboratoriya təmizliyi tamamlandı! İndi nəticələrinizi hesablayın.",
        cuvettesRinsed: "Küvetlər distillə suyu ilə yuyuldu.",
        handsWashed: "Əllər yuyuldu. Yaxşı laboratoriya vərdişi!",
        noCuvettesToEmpty: "Boşaldılacaq küvet yoxdur.",
        emptyingCuvettes: "Küvetlər boşaldılır və yığılır...",
        noWasteBeaker: "Tullantı stəkanı tapılmadı.",
        noPipettesToDispose: "Atılacaq pipet yoxdur.",
        disposingPipettes: "Pipetlər atılır..."
    },

    // ==========================================
    // BÜTÜN 60 TƏLİMAT ADDIMI (0-59)
    // ==========================================
    instructions: [
        // MƏRHƏLƏ 1: NÜMUNƏ HAZIRLIĞI (0-4)
        "Tərəzini iş masasına yerləşdirin.",
        "Tunc Nümunəsini iş masasına yerləşdirin.",
        "Ağırlığı ölçmək üçün Tunc Nümunəsini Tərəzi qabına qoyun.",
        "50mL Stəkanı iş masasına çəkin.",
        "Çəkilmiş tuncu Kim. Stəkana köçürün.",

        // MƏRHƏLƏ 2: HƏLL ETMƏ (5-11)
        "Tullantı Stəkanını iş masasına yerləşdirin.",
        "Pipeti iş masasına çəkin (yalnız turşu üçün).",
        "Qatı HNO₃ şüşəsini iş masasına yerləşdirin.",
        "Pipeti HNO₃ şüşəsindən doldurun.",
        "Tuncu həll etmək üçün turşunu Stəkana boşaldın.",
        "Turşu pipetini Tullantı Stəkanına atın.",
        "Tuncun tamamilə həll olmasını gözləyin (reaksiyanı müşahidə edin).",

        // MƏRHƏLƏ 3: SEYRELTDİRMƏ (12-20)
        "100mL Həcm Kolbasını iş masasına yerləşdirin.",
        "Mis məhlulunu köçürmək üçün YENİ Pipet götürün.",
        "Pipeti həll olunmuş tunc məhlulundan doldurun.",
        "Mis məhlulunu Kolbaya köçürün.",
        "Mis pipetini Tullantı Stəkanına atın.",
        "Distillə suyu üçün YENİ Pipet götürün.",
        "Distillə Suyu şüşəsini iş masasına yerləşdirin.",
        "Pipeti distillə suyu ilə doldurun.",
        "Kolbanı 100mL işarəsinə qədər seyreltdin.",

        // MƏRHƏLƏ 4: SPEKTROFOTOMETRİYA QURAŞDIRMASI (21-28)
        "Spec 20-ni iş masasına yerləşdirin.",
        "Küvet Stendini iş masasına yerləşdirin.",
        "BLANK üçün küvet almaq üçün Stendi klikləyin.",
        "Su pipetini Distillə Suyu şüşəsindən doldurun.",
        "Suyu blank küvetə boşaldın.",
        "Spec 20 qapağını açın (QAPAQ-ı klikləyin).",
        "Blank küveti Spec 20-yə daxil edin.",
        "Qapağı bağlayın və kalibrasiya edin (0.00 düyməsini klikləyin).",

        // MƏRHƏLƏ 5: STANDARTLARIN ÖLÇÜLMƏSİ (29-49)
        // 0.1M Standart
        "Qapağı açın və blank küveti çıxarın.",
        "0.1M standart üçün küvet almaq üçün Stendi klikləyin.",
        "0.1M Standart şüşəsini iş masasına yerləşdirin.",
        "Pipeti 0.1M Standart şüşəsindən doldurun.",
        "0.1M küvetə boşaldın.",
        "0.1M küveti Spec 20-yə daxil edin.",
        "Qapağı bağlayın və absorbansı qeyd edin.",

        // 0.2M Standart
        "Qapağı açın və 0.1M küveti çıxarın.",
        "0.2M standart üçün küvet almaq üçün Stendi klikləyin.",
        "0.2M Standart şüşəsini iş masasına yerləşdirin.",
        "Pipeti 0.2M Standart şüşəsindən doldurun.",
        "0.2M küvetə boşaldın.",
        "0.2M küveti Spec 20-yə daxil edin.",
        "Qapağı bağlayın və absorbansı qeyd edin.",

        // 0.4M Standart
        "Qapağı açın və 0.2M küveti çıxarın.",
        "0.4M standart üçün küvet almaq üçün Stendi klikləyin.",
        "0.4M Standart şüşəsini iş masasına yerləşdirin.",
        "Pipeti 0.4M Standart şüşəsindən doldurun.",
        "0.4M küvetə boşaldın.",
        "0.4M küveti Spec 20-yə daxil edin.",
        "Qapağı bağlayın və absorbansı qeyd edin.",

        // MƏRHƏLƏ 6: NAMƏLUMUN ÖLÇÜLMƏSİ (50-59)
        "Qapağı açın və 0.4M küveti çıxarın.",
        "NAMƏLUM üçün küvet almaq üçün Stendi klikləyin.",
        "Naməlum məhlul üçün YENİ Pipet götürün.",
        "Pipeti Kolbadan (naməlum məhlul) doldurun.",
        "Naməlum küvetə boşaldın.",
        "Naməlum küveti Spec 20-yə daxil edin.",
        "Qapağı bağlayın və absorbansı qeyd edin.",
        "Qapağı açın və naməlum küveti çıxarın.",
        "Laboratoriya Dəftərindəki təmizlik yoxlama siyahısını tamamlayın (görmək üçün ölçüsünü dəyişdirin).",
        "Misin kütlə faizini hesablayın və cavabınızı təqdim edin."
    ]
};
