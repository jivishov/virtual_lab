import {
  t,
  getCurrentLang,
  setLanguage,
  initLanguage,
} from '../../copperinbrass/js/i18n/i18n.js';
import { samples, steps } from './protocol.js';
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
  weighBrass: [
    'Weigh the brass sample on the balance pan.',
    'Latun nümunəsini tərəzinin gözündə çəkin.',
    'Pirinç numunesini terazinin kefesinde tartın.',
    'Die Messingprobe auf der Waagschale wiegen.',
  ],
  transferBrass: [
    'Transfer the weighed brass to the 50 mL beaker in the fume hood.',
    'Çəkilmiş latunu sorucu şkafdakı 50 mL-lik stəkana köçürün.',
    'Tarttığınız pirinci çeker ocaktaki 50 mL’lik behere aktarın.',
    'Die gewogene Messingprobe in das 50-mL-Becherglas im Abzug geben.',
  ],
  drawAcid: [
    'Use the acid pipette to draw nitric acid from the HNO₃ bottle.',
    'Turşu üçün ayrılmış pipetlə HNO₃ şüşəsindən nitrat turşusu götürün.',
    'Asit pipetiyle HNO₃ şişesinden nitrik asit çekin.',
    'Mit der Säurepipette Salpetersäure aus der HNO₃-Flasche aufnehmen.',
  ],
  addAcid: [
    'Dispense the nitric acid into the beaker containing the brass.',
    'Nitrat turşusunu latun olan stəkana əlavə edin.',
    'Nitrik asidi pirincin bulunduğu behere ekleyin.',
    'Die Salpetersäure zur Messingprobe im Becherglas geben.',
  ],
  discardAcid: [
    'Discard the used acid pipette in the waste beaker.',
    'İstifadə olunmuş turşu pipetini tullantı stəkanına atın.',
    'Kullanılmış asit pipetini atık beherine bırakın.',
    'Die gebrauchte Säurepipette in das Abfallbecherglas geben.',
  ],
  observeBrass: [
    'Observe the brass in the fume hood until it dissolves.',
    'Latun tam həll olana qədər sorucu şkafdakı stəkanı müşahidə edin.',
    'Pirinç tamamen çözünene kadar çeker ocaktaki beheri gözlemleyin.',
    'Die Messingprobe im Abzug beobachten, bis sie sich vollständig aufgelöst hat.',
  ],
  drawDigest: [
    'Use a clean pipette to draw the dissolved sample from the beaker.',
    'Təmiz pipetlə stəkandan həll olmuş nümunə məhlulunu götürün.',
    'Temiz bir pipetle beherdeki numune çözeltisini çekin.',
    'Mit einer sauberen Pipette die Probenlösung aus dem Becherglas aufnehmen.',
  ],
  discardCopper: [
    'Discard the used sample pipette in the waste beaker.',
    'İstifadə olunmuş nümunə pipetini tullantı stəkanına atın.',
    'Kullanılmış numune pipetini atık beherine bırakın.',
    'Die gebrauchte Probenpipette in das Abfallbecherglas geben.',
  ],
  drawWater: [
    'Draw distilled water with the clean water pipette.',
    'Təmiz su pipeti ilə distillə suyu götürün.',
    'Temiz su pipetiyle distile su çekin.',
    'Mit der sauberen Wasserpipette destilliertes Wasser aufnehmen.',
  ],
  waterBlank: ['water blank', 'boş nümunə', 'kör numune', 'Wasserblindprobe'],
  unknownSample: ['unknown', 'naməlum nümunə', 'bilinmeyen numune', 'unbekannte Probe'],
  standardSample: ['{value} standard', '{value} standart', '{value} standart', '{value}-Standard'],
  takeCell: [
    'Take a clean cuvette from the rack for the {sample}.',
    'Ştativdən təmiz küvet götürün ({sample}).',
    'Raftan temiz bir küvet alın ({sample}).',
    'Eine saubere Küvette aus dem Ständer nehmen ({sample}).',
  ],
  drawBlank: [
    'Refill the water pipette with distilled water for the blank.',
    'Boş nümunə üçün su pipetini yenidən distillə suyu ilə doldurun.',
    'Kör numune için su pipetine yeniden distile su çekin.',
    'Die Wasserpipette für den Blindwert erneut mit destilliertem Wasser füllen.',
  ],
  drawStandard: [
    'Use a clean pipette to draw the {value} copper standard.',
    'Təmiz pipetlə {value} mis standart məhlulundan götürün.',
    'Temiz bir pipetle {value} bakır standart çözeltisinden çekin.',
    'Mit einer sauberen Pipette die Kupfer-Standardlösung ({value}) aufnehmen.',
  ],
  drawUnknown: [
    'Use a clean pipette to draw the diluted brass solution from the flask.',
    'Təmiz pipetlə kolbadan durulaşdırılmış latun məhlulu götürün.',
    'Temiz bir pipetle balondaki seyreltilmiş pirinç çözeltisinden çekin.',
    'Mit einer sauberen Pipette die verdünnte Messinglösung aus dem Messkolben aufnehmen.',
  ],
  fillCell: [
    'Dispense the solution into the {sample} cuvette.',
    'Pipetdəki mayeni {sample} işarəli küvetə köçürün.',
    'Pipetteki sıvıyı {sample} etiketli küvete aktarın.',
    'Den Pipetteninhalt in die mit „{sample}“ beschriftete Küvette geben.',
  ],
  openLid: [
    'Open the spectrophotometer’s sample chamber.',
    'Spektrofotometrin nümunə kamerasının qapağını açın.',
    'Spektrofotometrenin numune haznesinin kapağını açın.',
    'Den Deckel der Probenkammer am Spektrophotometer öffnen.',
  ],
  insertCell: [
    'Insert the {sample} cuvette into the sample chamber.',
    'Doldurulmuş küveti nümunə kamerasına daxil edin ({sample}).',
    'Dolu küveti numune haznesine yerleştirin ({sample}).',
    'Die gefüllte Küvette in die Probenkammer einsetzen ({sample}).',
  ],
  zeroBlank: [
    'Select ZERO to close the lid and set the water blank to 0.000 A.',
    'Qapağı bağlamaq və su ilə sıfır göstəricisini 0.000 A təyin etmək üçün ZERO düyməsini seçin.',
    'Kapağı kapatıp su körünü 0.000 A değerine ayarlamak için ZERO düğmesini seçin.',
    'Mit ZERO den Deckel schließen und den Wasserblindwert auf 0.000 A setzen.',
  ],
  readCell: [
    'Select READ to close the lid and record the absorbance of the {sample}.',
    'Qapağı bağlamaq və absorbansı qeyd etmək üçün READ düyməsini seçin ({sample}).',
    'Kapağı kapatıp absorbansı kaydetmek için READ düğmesini seçin ({sample}).',
    'Mit READ den Deckel schließen und die Absorbanz aufzeichnen ({sample}).',
  ],
  returnCell: [
    'Open the lid to return the {sample} cuvette to the rack.',
    'Küveti ştativə qaytarmaq üçün qapağı açın ({sample}).',
    'Küveti rafa geri almak için kapağı açın ({sample}).',
    'Den Deckel öffnen, damit die Küvette in den Ständer zurückkehrt ({sample}).',
  ],
  recordCleanup: [
    'Complete the cleanup checklist in the lab notebook.',
    'Laboratoriya dəftərində təmizlik siyahısını tamamlayın.',
    'Laboratuvar defterindeki temizlik listesini tamamlayın.',
    'Die Aufräum-Checkliste im Laborbuch abschließen.',
  ],
  reportCopper: [
    'Calculate the mass percent of copper in your brass sample and enter it in the notebook.',
    'Latun nümunəsində misin kütlə payını faizlə hesablayıb dəftərə yazın.',
    'Pirinç numunesinde kütlece bakır yüzdesini hesaplayıp deftere girin.',
    'Den Kupfer-Massenanteil der Messingprobe in Prozent berechnen und ins Laborbuch eintragen.',
  ],
  hintPair: [
    'Drag the marked item to its target, or select the item and then its target.',
    'İşarələnmiş əşyanı hədəfə sürükləyin və ya əvvəl əşyanı, sonra hədəfi seçin.',
    'İşaretli nesneyi hedefe sürükleyin ya da önce nesneyi, sonra hedefi seçin.',
    'Das markierte Objekt zum Ziel ziehen oder erst das Objekt und dann das Ziel auswählen.',
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
  const step = steps[index];
  if (!step) return word('completed');
  const prompt = word(step.prompt);
  if (!step.sample) return prompt;
  if (step.sample === 'blank') return prompt.replace('{sample}', word('waterBlank'));
  if (step.sample === 'unknown') return prompt.replace('{sample}', word('unknownSample'));
  const concentration = label(step.sample);
  const standard = word('standardSample').replace('{value}', concentration);
  return prompt.replace('{sample}', standard).replace('{value}', concentration);
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
  return word(steps[index]?.phase || 'complete');
}
