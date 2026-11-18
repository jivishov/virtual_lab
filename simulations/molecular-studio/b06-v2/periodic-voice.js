// The browser owns microphone permission and its speech recognition service.
// Listen during hand mode, including while the periodic table is open.
const cameraCommands=new Map([
  ['move','move'],['rotate','orbit'],['pan','pan'],
  ['fit','home'],['zoom out','out'],['zoom in','in']
]);

export function voiceCommand(transcript, mode) {
 const words=String(transcript).toLowerCase().replace(/[.!?,]/g,'').trim().replace(/\s+/g,' ');
 const camera=cameraCommands.get(words);
 if(camera)return {type:'camera',action:camera};
 if(mode!=='builder')return null;
 if(/^(?:open (?:the )?)?periodic table$/.test(words))return {type:'table',action:'open'};
 if(/^close (?:the )?periodic table$/.test(words))return {type:'table',action:'close'};
 return null;
}

export function createPeriodicVoice(main,openTable,closeTable) {
  const button=main.querySelector('.hand-bar [data-voice]');
  const Recognition=globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  let enabled=Boolean(Recognition),active=false,recognizer=null,retryTimer=0,failures=0;

  function show(state,text,title) {
    button.dataset.voiceState=state;
    button.title=title;
    button.setAttribute('aria-label',text);
    button.setAttribute('aria-pressed',String(enabled));
  }
  function halt() {
    clearTimeout(retryTimer);
    const previous=recognizer;
    recognizer=null;
    previous?.abort();
  }
  function fail(message) {
    enabled=false;
    halt();
    show('error','Voice retry',message+' Select to retry voice commands.');
  }
  function listen() {
    clearTimeout(retryTimer);
    if (!active || !enabled || recognizer) return;
    const mode=main.dataset.mode==='builder'?'builder':'guided';
    const current=new Recognition();
    recognizer=current;
    current.lang='en-US';
    current.continuous=true;
    current.interimResults=false;
    current.maxAlternatives=1;
    show('starting','Voice starting','Starting microphone for hand-mode voice commands.');
    current.onstart=() => {
      if (recognizer!==current) return;
      show('listening','Voice on','Say Move, Rotate, Pan, Fit, Zoom out or Zoom in.'+(mode==='builder'?' Open periodic table and Close periodic table are also available. Spoken close discards selections.':' Fit model-kit pieces manually.')+' Select to turn voice off.');
    };
    current.onresult=event => {
      if (recognizer!==current || !active || !enabled) return;
      for (let i=event.resultIndex;i<event.results.length;i++) {
        const result=event.results[i];
        if (!result.isFinal) continue;
        failures=0;
        if((main.dataset.mode==='builder'?'builder':'guided')!==mode || !main.classList.contains('hands-on'))return;
        const command=voiceCommand(result[0].transcript,mode);
        if(command?.type==='camera') {
          const control=main.querySelector('.lab-camera [data-camera="'+command.action+'"]:not(:disabled)');
          if(control && !control.closest('[hidden],[inert]'))control.click();
          break;
        }
        if(command?.type==='table') {
          if(command.action==='open')openTable();else closeTable();
          break;
        }
      }
    };
    current.onerror=event => {
      if (recognizer!==current) return;
      if (event.error==='no-speech' || event.error==='aborted') return;
      if (event.error==='network' && ++failures<3) return;
      const messages={
        'not-allowed':'Microphone permission was denied. Allow it in the browser.',
        'service-not-allowed':'This browser cannot connect to its speech recognition service.',
        'audio-capture':'The microphone is unavailable.',
        'network':'The speech recognition service could not connect.',
        'language-not-supported':'English speech recognition is unavailable in this browser.'
      };
      fail(messages[event.error] || 'Voice recognition stopped.');
    };
    current.onend=() => {
      if (recognizer!==current) return;
      recognizer=null;
      if (active && enabled) {
        show('starting','Voice starting','Reconnecting voice commands.');
        retryTimer=setTimeout(listen,500*(failures+1));
      }
    };
    try { current.start(); }
    catch { fail('Voice recognition could not start.'); }
  }
  button.onclick=() => {
    enabled=!enabled;
    failures=0;
    if (!enabled) {
      halt();
      show('off','Voice off','Voice commands are off. Select to enable the microphone.');
    } else if (active) listen();
    else show('paused','Voice ready','Voice commands resume when hand mode is ready.');
  };
  if (!Recognition) {
    button.disabled=true;
    show('unsupported','Voice unavailable','This browser does not support speech recognition. Open the page in a browser with voice recognition, such as Google Chrome.');
  } else show('paused','Voice ready','Voice commands control the view. Fit pieces manually.');

  return {
    resume() {
      active=true;
      listen();
    },
    pause() {
      active=false;
      halt();
      if (enabled) show('paused','Voice ready','Voice commands resume when hand mode is ready.');
    }
  };
}
