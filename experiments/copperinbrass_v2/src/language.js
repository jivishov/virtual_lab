import {
  t,
  getInstruction,
  getCurrentLang,
  setLanguage,
  initLanguage,
} from '../../copperinbrass/js/i18n/i18n.js';
import { samples } from './model.js';
export { getCurrentLang, setLanguage, initLanguage };
const languages = ['en', 'az', 'tr', 'de'];
const shared = {
  mass: 'ui.massBrass',
  condition: 'ui.condition',
  sample: 'ui.sample',
  hint: 'ui.showHint',
  confirmCleanup: 'ui.completeCleanup',
  check: 'ui.check',
  notebook: 'ui.labNotebook',
  gear: 'ui.labEquipment',
  sampleData: 'ui.sampleData',
  standards: 'graph.standards',
};
const words = {
  mass: ['Brass mass', 'Latunun kütləsi', 'Pirinç kütlesi', 'Messingmasse'],
  standards: ['Standards', 'Standartlar', 'Standartlar', 'Standards'],
  title: ['Copper in brass', 'Latunda mis', 'Pirinçte bakır', 'Kupfer in Messing'],
  method: ['Spectrophotometry', 'Spektrofotometriya', 'Spektrofotometri', 'Spektrophotometrie'],
  bench: ['Bench', 'Masa', 'Tezgâh', 'Labortisch'],
  prep: ['Preparation', 'Hazırlıq', 'Hazırlık', 'Vorbereitung'],
  instrument: ['Instrument', 'Cihaz', 'Cihaz', 'Messgerät'],
  focus: ['Focus step', 'Addımı göstər', 'Adıma odaklan', 'Schritt zeigen'],
  settings: ['Settings', 'Ayarlar', 'Ayarlar', 'Einstellungen'],
  language: ['Language', 'Dil', 'Dil', 'Sprache'],
  finish: ['Bench finish', 'Masa görünüşü', 'Tezgâh görünümü', 'Laboransicht'],
  quality: ['Graphics', 'Qrafika', 'Grafik kalitesi', 'Grafikqualität'],
  low: ['Low', 'Aşağı', 'Düşük', 'Niedrig'],
  balanced: ['Balanced', 'Balanslı', 'Dengeli', 'Ausgewogen'],
  high: ['High', 'Yüksək', 'Yüksek', 'Hoch'],
  undo: ['Undo step', 'Addımı geri al', 'Adımı geri al', 'Schritt zurück'],
  restart: ['Restart', 'Yenidən başla', 'Yeniden başlat', 'Neu starten'],
  restartMessage: [
    'Start again with a new brass sample? This clears the current notebook.',
    'Yeni latun nümunəsi ilə başlansın? Cari qeydlər silinəcək.',
    'Yeni bir pirinç numunesiyle başlansın mı? Mevcut kayıtlar silinir.',
    'Mit einer neuen Messingprobe beginnen? Das aktuelle Protokoll wird geleert.',
  ],
  cancel: ['Cancel', 'Ləğv et', 'Vazgeç', 'Abbrechen'],
  protocol: ['Protocol', 'Protokol', 'Protokol', 'Ablauf'],
  calibration: ['Calibration', 'Kalibrləmə', 'Kalibrasyon', 'Kalibrierung'],
  abs: ['Absorbance', 'Absorbans', 'Absorbans', 'Absorbanz'],
  readings: ['Measurements', 'Ölçmələr', 'Ölçümler', 'Messwerte'],
  reported: ['Reported Cu', 'Hesablanmış Cu', 'Bildirilen Cu', 'Angegebener Cu-Anteil'],
  finalVolume: ['Flask volume', 'Kolbanın həcmi', 'Balon hacmi', 'Kolbenvolumen'],
  reference: [
    'Worksheet equation',
    'İş vərəqinin tənliyi',
    'Çalışma kâğıdı denklemi',
    'Arbeitsblattgleichung',
  ],
  massPercent: [
    'Copper by mass (%)',
    'Misin kütlə payı (%)',
    'Kütlece bakır (%)',
    'Kupfer-Massenanteil (%)',
  ],
  export: ['Export CSV', 'CSV yüklə', 'CSV indir', 'CSV exportieren'],
  cleanup: ['Cleanup', 'Təmizlik', 'Temizlik', 'Aufräumen'],
  target: ['Show next target', 'Növbəti hədəfi göstər', 'Sonraki hedefi göster', 'Nächstes Ziel zeigen'],
  hands: [
    'Webcam hand control',
    'Kamera ilə əl idarəsi',
    'Kamerayla el kontrolü',
    'Handsteuerung per Kamera',
  ],
  person: [
    'Show me in the lab',
    'Məni laboratoriyada göstər',
    'Beni laboratuvarda göster',
    'Mich im Labor zeigen',
  ],
  version2d: ['2D experiment', '2D təcrübə', '2B deney', '2D-Versuch'],
  loading: [
    'Opening the laboratory…',
    'Laboratoriya açılır…',
    'Laboratuvar açılıyor…',
    'Labor wird geöffnet…',
  ],
  aim: [
    'Determine the mass percent of copper in your brass sample using a blank and three copper standards.',
    'Boş nümunə və üç mis standartı ilə latun nümunənizdə misin kütlə payını təyin edin.',
    'Bir kör numune ve üç bakır standardıyla pirinçteki bakırın kütle yüzdesini belirleyin.',
    'Bestimmen Sie den Kupfer-Massenanteil Ihrer Messingprobe mit einem Blindwert und drei Kupferstandards.',
  ],
  follow: ['Follow current step', 'Cari addımı izlə', 'Geçerli adımı izle', 'Aktuellem Schritt folgen'],
  navigation: [
    'Drag the background to orbit. Scroll or pinch to zoom. Shift-drag or drag with two fingers to pan. With hand control, point and pinch to select.',
    'Döndərmək üçün fonu sürüşdürün. Yaxınlaşdırmaq üçün çarxdan və ya iki barmaqdan istifadə edin. Sürüşdürmə üçün Shift düyməsini saxlayın. Əl rejimində göstərib iki barmağı birləşdirin.',
    'Döndürmek için arka planı sürükleyin. Yakınlaşmak için tekerleği veya iki parmağı kullanın. Kaydırmak için Shift ile sürükleyin. El modunda işaret edip parmakları birleştirin.',
    'Ziehen dreht die Ansicht. Mausrad oder zwei Finger zoomen. Umschalt-Ziehen oder zwei Finger verschieben die Kamera. Bei Handsteuerung zeigen und Finger zusammenführen.',
  ],
  quantTransfer: [
    'Transfer all of the dissolved sample and the beaker rinses to the 100 mL flask.',
    'Həll olmuş nümunəni və stəkanın yaxalama sularını 100 mL-lik kolbaya tam köçürün.',
    'Çözünmüş numunenin tamamını ve beherin durulama sularını 100 mL balona aktarın.',
    'Die gesamte gelöste Probe und die Spüllösungen in den 100-mL-Messkolben überführen.',
  ],
  fillMark: [
    'Make up to 100 mL with distilled water. Use the pipette for the final drops, then mix.',
    'Distillə suyu ilə həcmi 100 mL-ə çatdırın. Son damcıları pipetlə əlavə edin və qarışdırın.',
    'Saf suyla 100 mL’ye tamamlayın. Son damlaları pipetle ekleyip karıştırın.',
    'Mit destilliertem Wasser auf 100 mL auffüllen. Für die letzten Tropfen die Pipette verwenden, dann mischen.',
  ],
  hintPlace: [
    'Select the item to set it out, or drag it onto the bench.',
    'Əşyanı seçin və ya masaya sürükləyin.',
    'Nesneyi seçin veya tezgâha sürükleyin.',
    'Gerät anklicken oder auf den Tisch ziehen.',
  ],
  hintPair: [
    'Drag the tool onto its target, or select the two in order.',
    'Aləti hədəfə sürükləyin və ya əvvəl aləti, sonra hədəfi seçin.',
    'Aracı hedefe sürükleyin veya ikisini sırayla seçin.',
    'Werkzeug auf das Ziel ziehen oder beide nacheinander auswählen.',
  ],
  hintSingle: [
    'Select the marked item or use Equipment.',
    'İşarələnmiş əşyanı seçin və ya Avadanlıqları açın.',
    'İşaretli nesneyi seçin veya Ekipman bölümünü açın.',
    'Markiertes Objekt auswählen oder die Geräteliste öffnen.',
  ],
  selectTarget: ['Now select', 'İndi seçin', 'Şimdi seçin', 'Jetzt auswählen'],
  ready: ['Select', 'Seçin', 'Seçin', 'Auswählen'],
  formRetry: [
    'Check the units, your unknown absorbance and the measured brass mass.',
    'Vahidləri, naməlum nümunənin absorbansını və latunun ölçülmüş kütləsini yoxlayın.',
    'Birimleri, bilinmeyenin absorbansını ve ölçülen pirinç kütlesini kontrol edin.',
    'Einheiten, Absorbanz der unbekannten Probe und Messingmasse prüfen.',
  ],
  dilution: ['Dilution', 'Durulaşdırma', 'Seyreltme', 'Verdünnung'],
  weigh: ['Weighing', 'Çəkmə', 'Tartım', 'Einwiegen'],
  dissolve: ['Dissolution', 'Həllolma', 'Çözünme', 'Auflösen'],
  blanking: ['Blank reference', 'Boş nümunə', 'Kör referans', 'Blindwert'],
  unknown: ['Unknown', 'Naməlum', 'Bilinmeyen', 'Unbekannt'],
  standardsPhase: ['Standards', 'Standartlar', 'Standartlar', 'Standards'],
  report: ['Report', 'Hesabat', 'Rapor', 'Auswertung'],
  complete: ['Complete', 'Tamamlandı', 'Tamamlandı', 'Abgeschlossen'],
  reacting: ['Dissolving', 'Həll olur', 'Çözünüyor', 'Löst sich auf'],
  fit: ['Measured fit', 'Ölçülmüş uyğunlaşma', 'Ölçülen doğru', 'Messgerade'],
  lid: ['Chamber lid', 'Kamera qapağı', 'Hazne kapağı', 'Kammerdeckel'],
  chamber: ['Sample chamber', 'Nümunə kamerası', 'Numune haznesi', 'Probenkammer'],
  zero: ['Zero / blank', 'Sıfırla', 'Sıfırla', 'Nullabgleich'],
  read: ['Read absorbance', 'Absorbansı ölç', 'Absorbansı ölç', 'Absorbanz messen'],
  openNotebook: [
    'Open the notebook to finish this step.',
    'Bu addım üçün dəftəri açın.',
    'Bu adım için defteri açın.',
    'Für diesen Schritt das Laborbuch öffnen.',
  ],
  completed: [
    'Your notebook is ready to export.',
    'Dəftəri yükləyə bilərsiniz.',
    'Defter indirilmeye hazır.',
    'Das Laborbuch kann exportiert werden.',
  ],
  wait: [
    'Observe the beaker in the extraction hood.',
    'Sorucu şkafdakı stəkanı müşahidə edin.',
    'Çeker ocaktaki beheri gözlemleyin.',
    'Das Becherglas im Abzug beobachten.',
  ],
};
function fix(value) {
  return getCurrentLang() === 'az'
    ? value
        .replace(/Tunc/g, 'Latun')
        .replace(/tunc/g, 'latun')
        .replace(/Bürünc/g, 'Latun')
        .replace(/bürünc/g, 'latun')
    : value;
}
export function legacy(key, vars) {
  return fix(t(key, vars));
}
export function word(key) {
  const row = words[key];
  if (row) return row[Math.max(0, languages.indexOf(getCurrentLang()))];
  return legacy(shared[key] || key).replace(/^\d+\.\s*/, '');
}
export function instruction(index) {
  if (index === 15) return word('quantTransfer');
  if (index === 20) return word('fillMark');
  if (index === 58) return word('cleanup') + ' · ' + word('openNotebook');
  return fix(getInstruction(index));
}
export function label(id) {
  if (samples.includes(id))
    return id === 'blank'
      ? legacy('content.blank')
      : id === 'unknown'
        ? word('unknown')
        : id.slice(4) + ' M';
  if (['lid', 'zero', 'read', 'chamber', 'notebook'].includes(id)) return word(id);
  return legacy('equipment.' + id);
}
export function phase(index) {
  const thresholds = [
    [5, 'weigh'],
    [12, 'dissolve'],
    [21, 'dilution'],
    [29, 'blanking'],
    [50, 'standardsPhase'],
    [58, 'unknown'],
    [60, 'report'],
  ];
  return word(thresholds.find(([end]) => index < end)?.[1] || 'complete');
}
