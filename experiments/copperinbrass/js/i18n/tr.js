// tr.js - Türkçe çeviriler
export default {
    // ==========================================
    // ARAYÜZ ETİKETLERİ
    // ==========================================
    ui: {
        // Sayfa başlığı
        pageTitle: "AP Kimya: Bakır Analizi Laboratuvarı",

        // Yan panel
        labEquipment: "Laboratuvar Ekipmanları",

        // Adım izleyici
        stepOf: "Adım {current} / {total}",
        brassLab: "Pirinç Laboratuvarı",
        undo: "Geri al (maks 10)",
        autoForward: "Otomatik ileri",
        toggleList: "Listeyi aç/kapat",
        complete: "Tamamlandı!",

        // Defter
        labNotebook: "Laboratuvar Defteri",
        sampleData: "1. Numune Verileri",
        massBrass: "Pirinç Kütlesi",
        condition: "Durum",
        spectrophotometry: "2. Spektrofotometri",
        sample: "Numune",
        abs: "Abs",
        calibrationCurve: "Kalibrasyon Eğrisi (Abs vs Der)",

        // Temizlik kontrol listesi
        cleanupChecklist: "Laboratuvar Temizlik Kontrol Listesi:",
        cleanupItem1: "Tüm küvetlerdeki sıvıyı atık behere boşaltın",
        cleanupItem2: "Küvetleri distile su ile en az 3 kez yıkayın",
        cleanupItem3: "Tüm pipetleri atık behere atın",
        cleanupItem4: "Ellerinizi yıkayın",
        completeCleanup: "Temizliği Tamamla",

        // Hesaplama alanı
        calcMassPercent: "Cu Kütle %'si Hesapla:",
        showHint: "İpucu Göster",
        hideHint: "İpucunu Gizle",
        formulaTitle: "Formül:",
        formulaConc: "Der = (Abs + 0.00538) / 2.426",
        formulaMass: "Cu Kütle % = (Der x 0.100L x 63.55) / pirinç kütlesi x 100",
        check: "Kontrol Et",
        percentPlaceholder: "%"
    },

    // ==========================================
    // EKİPMAN ETİKETLERİ (Raf)
    // ==========================================
    equipment: {
        balance: "Terazi",
        brass: "Pirinç Numunesi",
        pipette: "Pipet",
        waste: "Atık Beher",
        beaker: "50 mL Beher",
        acid: "Der. HNO₃",
        flask: "100 mL Balon Joje",
        water: "Dist. Su",
        spec: "Spec 20",
        rack: "Küvet Standı",
        cuvette: "Küvet",
        std1: "0.1 M Std",
        std2: "0.2 M Std",
        std4: "0.4 M Std"
    },

    // ==========================================
    // İÇERİK/ÇÖZELTİ ETİKETLERİ
    // ==========================================
    content: {
        acid: "HNO₃",
        water: "H₂O",
        copper: "Cu²⁺",
        std01: "0.1M",
        std02: "0.2M",
        std04: "0.4M",
        unknown: "Bilinm",
        blank: "Blank"
    },

    // ==========================================
    // GRAFİK/SVG METİNLERİ
    // ==========================================
    graphics: {
        getCuvette: "KÜVET AL",
        waste: "ATIK",
        pipettes: "{count} pipet",
        lid: "KAPAK",
        open: "AÇIK",
        beakerLabel: "50ml"
    },

    // ==========================================
    // GRAFİK ETİKETLERİ
    // ==========================================
    graph: {
        concentration: "Der (M)",
        absorbance: "Abs",
        unknown: "Bilinm",
        standards: "Std",
        fit: "Uyum"
    },

    // ==========================================
    // DURUMLAR
    // ==========================================
    conditions: {
        solid: "Katı",
        dissolved: "Çözünmüş"
    },

    // ==========================================
    // GERİ BİLDİRİM MESAJLARI
    // ==========================================
    messages: {
        // Genel
        welcome: "Hoş geldiniz! Laboratuvarı tamamlamak için talimatları izleyin.",
        labComplete: "Laboratuvar tamamlandı! Başka adım yok.",
        nothingToUndo: "Geri alınacak bir şey yok.",
        undoSuccessful: "Geri alma başarılı.",
        invalidInteraction: "Geçersiz işlem. Mevcut talimatı kontrol edin.",
        enterNumeric: "Sayısal bir değer girin.",

        // Ekipman yerleştirme
        alreadyPlaced: "Bu ekipman zaten çalışma tezgahında.",
        equipmentPlaced: "{equipment} çalışma tezgahına yerleştirildi.",
        wrongEquipment: "{expected} yerleştirin, bu öğeyi değil.",

        // Pirinç tartma
        dragBrassToBalance: "Pirinç Numunesini Teraziye sürükleyin.",
        dropOnBalance: "Pirinci Terazinin üzerine bırakın.",
        brassMassRecorded: "Pirinç kütlesi: {mass} g kaydedildi.",

        // Pirinç transferi
        dragBrassSample: "Pirinç Numunesini sürükleyin.",
        dropIntoBeaker: "Pirinci Behere bırakın.",
        weighFirst: "Önce pirinci tartın!",
        brassTransferred: "Pirinç behere aktarıldı.",

        // Pipet işlemleri
        usePipetteToFill: "Doldurmak için Pipet kullanın.",
        sourceNotFound: "Kaynak kap bulunamadı.",
        pipetteAlreadyFull: "Pipet zaten dolu. Önce boşaltın.",
        fillFromBeaker: "Çözünmüş pirinç olan beherden doldurun.",
        fillFromFlask: "Balon jojeden doldurun.",
        usePipetteToDispense: "Boşaltmak için Pipet kullanın.",
        pipetteEmpty: "Pipet boş. Önce doldurun.",
        destNotFound: "Hedef kap bulunamadı.",
        solutionTransferred: "Çözelti aktarıldı.",
        selectPipetteToDispose: "Atılacak pipeti seçin.",
        dropPipetteInWaste: "Pipeti Atık Behere bırakın.",
        cannotDispenseBack: "Reaktif şişesine geri boşaltılamaz.",
        fillPipetteFirst: "Önce pipeti doldurun.",
        usePipetteForCuvette: "Küveti doldurmak için pipet kullanın.",
        pipetteDisposed: "Pipet atıldı.",

        // Reaksiyon
        reactionInProgress: "Reaksiyon devam ediyor... pirinç çözünüyor.",
        addAcidFirst: "Önce pirinçli behere asit ekleyin.",
        brassDissolvedReady: "Pirinç çözündü! Bakır çözeltisi hazır.",

        // Küvet işlemleri
        clickCuvetteRack: "Küvet Standını tıklayın.",
        cuvetteReady: "{type} için küvet hazır.",
        dispenseToCuvette: "Küvete boşaltın.",
        cuvetteAlreadyFilled: "Küvet zaten dolu.",
        cuvetteFilled: "Küvet pipetten dolduruldu.",
        cuvetteEmptied: "Küvet atığa boşaltıldı.",

        // Spec 20 işlemleri
        openLidFirst: "Önce Spec 20 kapağını açın.",
        removeCuvetteFirst: "Önce mevcut küveti çıkarın.",
        dragCuvetteToSpec: "Küveti Spec 20'ye sürükleyin.",
        fillCuvetteFirst: "Önce küveti doldurun.",
        cuvetteInserted: "Küvet Spec 20'ye yerleştirildi.",
        noCuvetteToRemove: "Çıkarılacak küvet yok.",
        cuvetteRemoved: "Küvet çıkarıldı.",
        insertBlankFirst: "Önce blank küveti yerleştirin.",
        useBlankToCalibrate: "Kalibrasyon için blank küvet (distile su) kullanın.",
        specCalibrated: "Spec 20, 0.000 absorbansa kalibre edildi.",
        calibrateFirst: "Önce Spec 20'yi blank ile kalibre edin.",
        insertCuvetteFirst: "Önce küvet yerleştirin.",
        absorbanceReading: "Absorbans: {reading}",
        lidAlready: "Kapak zaten {state}.",
        lidToggled: "Kapak {state}.",
        closeLidToMeasure: "Ölçmek için kapağı kapatın.",

        // Hesaplama
        checking: "Kontrol ediliyor...",
        measureUnknownFirst: "Önce bilinmeyen numuneyi ölçün.",
        correct: "Doğru! Cu Kütle % = {percent}%",
        incorrect: "Yanlış. Beklenen ~{percent}%.",

        // Temizlik
        completeCleanupFirst: "Devam etmeden önce tüm temizlik görevlerini tamamlayın.",
        cleanupComplete: "Laboratuvar temizliği tamamlandı! Şimdi sonuçlarınızı hesaplayın.",
        cuvettesRinsed: "Küvetler distile su ile yıkandı.",
        handsWashed: "Eller yıkandı. İyi laboratuvar uygulaması!",
        noCuvettesToEmpty: "Boşaltılacak küvet yok.",
        emptyingCuvettes: "Küvetler boşaltılıyor ve istiflenyor...",
        noWasteBeaker: "Atık beher bulunamadı.",
        noPipettesToDispose: "Atılacak pipet yok.",
        disposingPipettes: "Pipetler atılıyor..."
    },

    // ==========================================
    // TÜM 60 TALİMAT ADIMI (0-59)
    // ==========================================
    instructions: [
        // AŞAMA 1: NUMUNE HAZIRLAMA (0-4)
        "Teraziyi çalışma tezgahına sürükleyin.",
        "Pirinç Numunesini çalışma tezgahına sürükleyin.",
        "Tartmak için Pirinç Numunesini Terazi kefesine koyun.",
        "50mL Beheri çalışma tezgahına sürükleyin.",
        "Tartılmış pirinci Behere aktarın.",

        // AŞAMA 2: ÇÖZME (5-11)
        "Atık Beheri çalışma tezgahına sürükleyin.",
        "Pipeti çalışma tezgahına sürükleyin (sadece asit için).",
        "Derişik HNO₃ şişesini çalışma tezgahına sürükleyin.",
        "Pipeti HNO₃ şişesinden doldurun.",
        "Pirinci çözmek için asidi Behere boşaltın.",
        "Asit pipetini Atık Behere atın.",
        "Pirincin tamamen çözünmesini bekleyin (reaksiyonu gözlemleyin).",

        // AŞAMA 3: SEYRELTİM (12-20)
        "100mL balon jojeyi çalışma tezgahına sürükleyin.",
        "Bakır çözeltisini aktarmak için YENİ Pipet sürükleyin.",
        "Pipeti çözünmüş pirinç çözeltisinden doldurun.",
        "Bakır çözeltisini balon jojeye aktarın.",
        "Bakır pipetini Atık Behere atın.",
        "Distile su için YENİ Pipet sürükleyin.",
        "Distile Su şişesini çalışma tezgahına sürükleyin.",
        "Pipeti distile su ile doldurun.",
        "Balon jojeyi 100mL işaretine kadar seyreltin.",

        // AŞAMA 4: SPEKTROFOTOMETRİ KURULUMU (21-28)
        "Spec 20'yi çalışma tezgahına sürükleyin.",
        "Küvet Standını çalışma tezgahına sürükleyin.",
        "BLANK için küvet almak üzere Standı tıklayın.",
        "Su pipetini Distile Su şişesinden doldurun.",
        "Suyu blank küvete boşaltın.",
        "Spec 20 kapağını açın (KAPAK'ı tıklayın).",
        "Blank küveti Spec 20'ye yerleştirin.",
        "Kapağı kapatın ve kalibre edin (0.00 düğmesini tıklayın).",

        // AŞAMA 5: STANDARTLARIN ÖLÇÜLMESİ (29-49)
        // 0.1M Standart
        "Kapağı açın ve blank küveti çıkarın.",
        "0.1M standart için küvet almak üzere Standı tıklayın.",
        "0.1M Standart şişesini çalışma tezgahına sürükleyin.",
        "Pipeti 0.1M Standart şişesinden doldurun.",
        "0.1M küvete boşaltın.",
        "0.1M küveti Spec 20'ye yerleştirin.",
        "Kapağı kapatın ve absorbansı kaydedin.",

        // 0.2M Standart
        "Kapağı açın ve 0.1M küveti çıkarın.",
        "0.2M standart için küvet almak üzere Standı tıklayın.",
        "0.2M Standart şişesini çalışma tezgahına sürükleyin.",
        "Pipeti 0.2M Standart şişesinden doldurun.",
        "0.2M küvete boşaltın.",
        "0.2M küveti Spec 20'ye yerleştirin.",
        "Kapağı kapatın ve absorbansı kaydedin.",

        // 0.4M Standart
        "Kapağı açın ve 0.2M küveti çıkarın.",
        "0.4M standart için küvet almak üzere Standı tıklayın.",
        "0.4M Standart şişesini çalışma tezgahına sürükleyin.",
        "Pipeti 0.4M Standart şişesinden doldurun.",
        "0.4M küvete boşaltın.",
        "0.4M küveti Spec 20'ye yerleştirin.",
        "Kapağı kapatın ve absorbansı kaydedin.",

        // AŞAMA 6: BİLİNMEYENİN ÖLÇÜLMESİ (50-59)
        "Kapağı açın ve 0.4M küveti çıkarın.",
        "BİLİNMEYEN için küvet almak üzere Standı tıklayın.",
        "Bilinmeyen çözelti için YENİ Pipet sürükleyin.",
        "Pipeti balon jojeden (bilinmeyen çözelti) doldurun.",
        "Bilinmeyen küvete boşaltın.",
        "Bilinmeyen küveti Spec 20'ye yerleştirin.",
        "Kapağı kapatın ve absorbansı kaydedin.",
        "Kapağı açın ve bilinmeyen küveti çıkarın.",
        "Laboratuvar Defterindeki temizlik kontrol listesini tamamlayın (görmek için yeniden boyutlandırın).",
        "Bakırın kütle yüzdesini hesaplayın ve cevabınızı gönderin."
    ]
};
