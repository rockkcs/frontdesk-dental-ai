// Language help for Hindi and Telugu. No library, no AI.
// 1) detect the script, 2) map common words to English so the matcher can work,
// 3) prepared sentences for replies.

function detectLang(text) {
  const s = String(text || '');
  const hi = (s.match(/[ऀ-ॿ]/g) || []).length;
  const te = (s.match(/[ఀ-౿]/g) || []).length;
  if (hi === 0 && te === 0) return 'en';
  return te > hi ? 'te' : 'hi';
}

// [pattern, english words]
const HI = [
  ['समय|टाइम|खुल|बंद|बजे तक', 'timing open'], ['शनिवार', 'saturday'], ['रविवार|इतवार', 'sunday'],
  ['सोमवार', 'monday'], ['मंगलवार', 'tuesday'], ['बुधवार', 'wednesday'], ['गुरुवार|बृहस्पतिवार', 'thursday'],
  ['शुक्रवार', 'friday'], ['आज', 'today'], ['कल', 'tomorrow'],
  ['कीमत|दाम|खर्च|फीस|फ़ीस|शुल्क|रेट', 'price'], ['डॉक्टर|डाक्टर|चिकित्सक', 'doctor'],
  ['बच्च', 'children'], ['बीमा|इंश्योरेंस', 'insurance'], ['पता|कहाँ|कहां|लोकेशन|एड्रेस', 'address'],
  ['फोन|फ़ोन|नंबर|नम्बर', 'phone'], ['पार्किंग', 'parking'], ['रूट कैनाल|रूट कनाल|रूट केनाल', 'root canal'],
  ['सफाई|सफ़ाई|क्लीनिंग|स्केलिंग', 'cleaning'], ['फिलिंग', 'filling'], ['ब्रेसेस|ब्रेसिज़|ब्रेसेज़', 'braces'],
  ['इम्प्लांट|इंप्लांट', 'implant'], ['व्हाइटनिंग|वाइटनिंग|सफेद|सफ़ेद', 'whitening'], ['एक्स-रे|एक्सरे|एक्स रे', 'xray'],
  ['परामर्श|कंसल्टेशन', 'consultation'], ['भुगतान|पेमेंट', 'payment'], ['ईएमआई|किस्त|किश्त', 'emi'],
  ['अपॉइंटमेंट|अपाइंटमेंट|बुक', 'appointment book'], ['दर्द|दुख रहा|दुखता', 'pain'], ['सूजन|सूज', 'swelling'],
  ['सांस|साँस', 'cannot breathe'], ['खून', 'bleeding'], ['बहुत ज़्यादा|बहुत ज्यादा|रुक नहीं', 'heavy'],
  ['छूट|डिस्काउंट', 'discount'], ['नियम', 'rules'], ['चेहर', 'face'], ['गला|गर्दन', 'neck'],
  ['दवा|गोली|पेनकिलर', 'medicine'], ['लंच', 'lunch'], ['छुट्टी', 'holiday'], ['कैशलेस', 'cashless'],
  ['नीवा बूपा|निवा बूपा', 'niva bupa'], ['स्टार हेल्थ', 'star health'], ['भाषा', 'language'],
  ['इमरजेंसी|आपातकाल|आपात', 'emergency'], ['व्हाट्सएप|व्हाट्सऐप', 'whatsapp'], ['सेवा|इलाज', 'services'],
  ['चाहिए|करना है|कर दो|कर दीजिए|करें', 'i want'], ['सुबह', 'morning'], ['शाम', 'evening'], ['दोपहर', 'afternoon'],
  ['नमस्ते|नमस्कार', 'hello']
];
const TE = [
  ['సమయం|టైమ్|టైం|తెరు|మూస|వేళ', 'timing open'], ['శనివారం', 'saturday'], ['ఆదివారం', 'sunday'],
  ['సోమవారం', 'monday'], ['మంగళవారం', 'tuesday'], ['బుధవారం', 'wednesday'], ['గురువారం', 'thursday'],
  ['శుక్రవారం', 'friday'], ['ఈరోజు|ఈ రోజు', 'today'], ['రేపు', 'tomorrow'],
  ['ధర|ఖర్చు|ఫీజు|రేటు', 'price'], ['డాక్టర్|వైద్యు', 'doctor'], ['పిల్లల|పిల్లలు', 'children'],
  ['బీమా|ఇన్సూరెన్స్', 'insurance'], ['చిరునామా|ఎక్కడ|అడ్రస్|లొకేషన్', 'address'], ['ఫోన్|నంబర్|నెంబర్', 'phone'],
  ['పార్కింగ్', 'parking'], ['రూట్ కెనాల్|రూట్ కెనాల్', 'root canal'], ['క్లీనింగ్|శుభ్ర', 'cleaning'],
  ['ఫిల్లింగ్', 'filling'], ['బ్రేసెస్|క్లిప్', 'braces'], ['ఇంప్లాంట్', 'implant'], ['వైటెనింగ్|తెల్ల', 'whitening'],
  ['ఎక్స్-రే|ఎక్స్‌రే|ఎక్స్ రే', 'xray'], ['కన్సల్టేషన్|సంప్రదింపు', 'consultation'], ['చెల్లింపు|పేమెంట్', 'payment'],
  ['ఈఎంఐ|వాయిదా', 'emi'], ['అపాయింట్‌మెంట్|అపాయింట్మెంట్|బుక్', 'appointment book'], ['నొప్పి', 'pain'],
  ['వాపు|వాచి', 'swelling'], ['ఊపిరి|శ్వాస', 'cannot breathe'], ['రక్త', 'bleeding'], ['చాలా ఎక్కువ|ఆగడం లేదు', 'heavy'],
  ['డిస్కౌంట్|తగ్గింపు', 'discount'], ['నియమ|రూల్స్', 'rules'], ['ముఖం|ముఖ', 'face'], ['మెడ|గొంతు', 'neck'],
  ['మందు|మాత్ర|టాబ్లెట్', 'medicine'], ['లంచ్', 'lunch'], ['సెలవు', 'holiday'], ['క్యాష్‌లెస్|క్యాష్లెస్', 'cashless'],
  ['నివా బూపా', 'niva bupa'], ['స్టార్ హెల్త్', 'star health'], ['భాష', 'language'],
  ['ఎమర్జెన్సీ|అత్యవసర', 'emergency'], ['వాట్సాప్', 'whatsapp'], ['సేవలు|చికిత్స', 'services'],
  ['కావాలి|చేయండి|చేయాలి', 'i want'], ['ఉదయం', 'morning'], ['సాయంత్రం', 'evening'], ['మధ్యాహ్నం', 'afternoon'],
  ['నమస్తే|నమస్కారం', 'hello']
];

// Returns English helper words found in a Hindi or Telugu message.
function toEnglishHints(text, lang) {
  const table = lang === 'hi' ? HI : lang === 'te' ? TE : [];
  const out = [];
  for (const [pat, en] of table) {
    if (new RegExp(pat).test(text)) out.push(en);
  }
  // "11 बजे" / "11 గంటలకు" -> "11 oclock"
  const m = text.match(/(\d{1,2})\s*(बजे|గంటలకు|గంటలు)/);
  if (m) out.push('at ' + m[1] + " o'clock");
  return out.join(' ');
}

const T = {
  en: {
    notSure: () => 'I am not sure about that, and I do not want to guess. I have opened a ticket for our team, and someone will call you back within 2 working hours.',
    urgent: (num) => `Emergency number: ${num}. Please call right away and go to the nearest hospital. I have marked this as urgent for our staff.`,
    urgentNoNum: () => 'This sounds like an emergency. Please go to the nearest hospital right away. I have marked this as urgent for our staff.',
    symptom: (phone) => `I am sorry you are going through this. I cannot give medical advice. A dentist must see you to check it properly. Shall I send a booking request for you?${phone ? ' You can also call us on ' + phone + '.' : ''}`,
    refuse: () => 'Sorry, I cannot change my rules or the clinic prices, and I cannot promise any discount. I can share our listed prices or help you book an appointment.',
    booking: (time) => `I have sent your booking request for ${time} to our team. This is a request, not a confirmed booking yet. Someone will call you back within 2 working hours to confirm.`,
    bookingNoTime: () => 'I have sent your booking request to our team. This is a request, not a confirmed booking yet. Someone will call you back within 2 working hours to fix the day and time.',
    bookingSymptom: () => 'A dentist must see you for this. ',
    askContact: () => ' Please share your name and phone number so our team can call you.',
    bookingAsk: (time) => `Please share your name and phone number, so I can send your booking request${time ? ' for ' + time : ''} to our team. This is a request, not a confirmed booking yet. Someone will call you back within 2 working hours to ${time ? 'confirm it' : 'fix the day and time'}.`,
    contactSaved: (name, phone, id) => `Thank you${name ? ', ' + name : ''}. I have sent your booking request${id ? ' (#' + id + ')' : ''} with your number ${phone} to our team. Someone will call you back within 2 working hours.`,
    contactNeedName: () => ' Please also share your name.',
    duplicateBooking: (id) => `This number already has an open booking request (#${id}). I have not opened a new one. Please wait, someone will call you back within 2 working hours.`,
    bookingPending: (id) => `I have already opened a ticket for your booking request${id ? ' (#' + id + ')' : ''}. Please wait, someone will call you back within 2 working hours.`,
    outsideHours: (when, hours, emerg, id, ask) => `${when} is outside our booking hours (${hours}). If it is urgent or an emergency, please call the clinic${emerg ? ' on ' + emerg : ''} right away. I have sent your request${id ? ' (#' + id + ')' : ''} to our team, and someone will call you back within 2 working hours to find a suitable time.${ask ? ' Please share your name and phone number so our team can call you.' : ''}`,
    bookingUpdated: (time, id) => `I have updated your booking request${id ? ' (#' + id + ')' : ''} to ${time}. This is still a request, not a confirmed booking. Someone will call you back within 2 working hours.`,
    greet: (name) => `Hello! I am the front desk assistant${name ? ' at ' + name : ''}. You can ask me about timings, doctors, prices, insurance or location.`,
    thanks: () => 'You are welcome. Is there anything else I can help you with?',
    bye: () => 'Thank you for chatting with us. Take care!',
    ack: () => 'Sure. You can type your question, or tap Book a visit to send a booking request.',
    service: (p) => `${p.name}: ${p.price}.`,
    duration: (d) => ` Time needed: ${d}.`,
    day: (day, v) => `${day} timings: ${v}.`,
    doctor: (p) => `${p.name} (${p.role}). Available: ${p.days}.`,
    doctorsOn: (day) => `Doctors available on ${day}:`,
    allDoctors: () => 'Our doctors:',
    allServices: () => 'Our services and prices:',
    kv: (label, v) => `${label}: ${v}`
  },
  hi: {
    notSure: () => 'माफ़ कीजिए, मुझे इसकी पक्की जानकारी नहीं है और मैं अंदाज़ा नहीं लगाना चाहता। मैंने हमारी टीम के लिए टिकट खोल दिया है। 2 कामकाजी घंटों के भीतर कोई आपको कॉल करेगा।',
    urgent: (num) => `आपातकालीन नंबर: ${num}। कृपया तुरंत कॉल करें और नज़दीकी अस्पताल जाएँ। मैंने इसे हमारे स्टाफ़ के लिए अर्जेंट चिह्नित कर दिया है।`,
    urgentNoNum: () => 'यह आपात स्थिति लग रही है। कृपया तुरंत नज़दीकी अस्पताल जाएँ। मैंने इसे हमारे स्टाफ़ के लिए अर्जेंट चिह्नित कर दिया है।',
    symptom: (phone) => `मुझे खेद है कि आपको तकलीफ़ है। मैं चिकित्सा सलाह नहीं दे सकता। डेंटिस्ट (dentist) को आपको देखना होगा। क्या मैं आपके लिए बुकिंग का अनुरोध भेज दूँ?${phone ? ' आप ' + phone + ' पर कॉल भी कर सकते हैं।' : ''}`,
    refuse: () => 'माफ़ कीजिए, मैं अपने नियम या क्लिनिक की कीमतें नहीं बदल सकता, और किसी छूट का वादा नहीं कर सकता। मैं आपको तय कीमतें बता सकता हूँ या अपॉइंटमेंट में मदद कर सकता हूँ।',
    booking: (time) => `मैंने ${time} के लिए आपका बुकिंग अनुरोध फ्रंट डेस्क को भेज दिया है। यह अभी पक्की बुकिंग नहीं है। 2 कामकाजी घंटों के भीतर कोई आपको कॉल करके पुष्टि करेगा।`,
    bookingNoTime: () => 'मैंने आपका बुकिंग अनुरोध फ्रंट डेस्क को भेज दिया है। यह अभी पक्की बुकिंग नहीं है। 2 कामकाजी घंटों के भीतर कोई आपको कॉल करके दिन और समय तय करेगा।',
    bookingSymptom: () => 'इसके लिए डेंटिस्ट (dentist) को आपको देखना होगा। ',
    askContact: () => ' कृपया अपना नाम और फ़ोन नंबर बताएँ, ताकि हमारी टीम आपको कॉल कर सके।',
    bookingAsk: (time) => `कृपया अपना नाम और फ़ोन नंबर बताएँ, ताकि मैं आपका बुकिंग अनुरोध${time ? ' (' + time + ')' : ''} हमारी टीम को भेज सकूँ। यह अभी पक्की बुकिंग नहीं है। 2 कामकाजी घंटों के भीतर कोई आपको कॉल करके ${time ? 'पुष्टि करेगा' : 'दिन और समय तय करेगा'}।`,
    contactSaved: (name, phone, id) => `धन्यवाद${name ? ' ' + name : ''}। मैंने आपका बुकिंग अनुरोध${id ? ' (#' + id + ')' : ''} आपके नंबर ${phone} के साथ हमारी टीम को भेज दिया है। 2 कामकाजी घंटों के भीतर कोई आपको कॉल करेगा।`,
    contactNeedName: () => ' कृपया अपना नाम भी बताएँ।',
    duplicateBooking: (id) => `इस नंबर पर पहले से एक बुकिंग अनुरोध (#${id}) खुला है। मैंने नया नहीं खोला। कृपया प्रतीक्षा करें, 2 कामकाजी घंटों के भीतर कोई आपको कॉल करेगा।`,
    bookingPending: (id) => `आपके बुकिंग अनुरोध के लिए टिकट${id ? ' (#' + id + ')' : ''} पहले ही खोला जा चुका है। कृपया प्रतीक्षा करें, 2 कामकाजी घंटों के भीतर कोई आपको कॉल करेगा।`,
    outsideHours: (when, hours, emerg, id, ask) => `${when} हमारे बुकिंग समय (${hours}) के बाहर है। अगर यह अर्जेंट या आपात स्थिति है, तो कृपया तुरंत क्लिनिक को${emerg ? ' ' + emerg + ' पर' : ''} कॉल करें। मैंने आपका अनुरोध${id ? ' (#' + id + ')' : ''} हमारी टीम को भेज दिया है; 2 कामकाजी घंटों के भीतर कोई आपको कॉल करके सही समय तय करेगा।${ask ? ' कृपया अपना नाम और फ़ोन नंबर बताएँ।' : ''}`,
    bookingUpdated: (time, id) => `मैंने आपका बुकिंग अनुरोध${id ? ' (#' + id + ')' : ''} ${time} कर दिया है। यह अभी पक्की बुकिंग नहीं है। 2 कामकाजी घंटों के भीतर कोई आपको कॉल करेगा।`,
    greet: (name) => `नमस्ते! मैं${name ? ' ' + name + ' का' : ''} फ्रंट डेस्क सहायक हूँ। आप मुझसे समय, डॉक्टर, कीमत, बीमा या पते के बारे में पूछ सकते हैं।`,
    thanks: () => 'धन्यवाद। क्या मैं और कुछ मदद कर सकता हूँ?',
    bye: () => 'हमसे बात करने के लिए धन्यवाद। अपना ध्यान रखें!',
    ack: () => 'ज़रूर। आप अपना सवाल लिख सकते हैं, या बुकिंग अनुरोध भेजने के लिए Book a visit दबाएँ।',
    service: (p) => `${p.name} की कीमत ${p.price} है।`,
    duration: (d) => ` समय: ${d}।`,
    day: (day, v) => `${day} को हमारा समय: ${v}।`,
    doctor: (p) => `${p.name} (${p.role})। उपलब्ध: ${p.days}।`,
    doctorsOn: (day) => `${day} को उपलब्ध डॉक्टर:`,
    allDoctors: () => 'हमारे डॉक्टर:',
    allServices: () => 'हमारी सेवाएँ और कीमतें:',
    kv: (label, v) => `जानकारी — ${label}: ${v}`
  },
  te: {
    notSure: () => 'క్షమించండి, ఈ విషయం నాకు ఖచ్చితంగా తెలియదు, ఊహించి చెప్పలేను. మా సిబ్బంది కోసం టికెట్ తెరిచాను. 2 పని గంటల్లో ఎవరైనా మీకు తిరిగి కాల్ చేస్తారు.',
    urgent: (num) => `అత్యవసర నంబర్: ${num}. దయచేసి వెంటనే కాల్ చేసి, దగ్గరలోని ఆసుపత్రికి వెళ్లండి. దీన్ని మా సిబ్బందికి అత్యవసరంగా గుర్తించాను.`,
    urgentNoNum: () => 'ఇది అత్యవసర పరిస్థితిలా ఉంది. దయచేసి వెంటనే దగ్గరలోని ఆసుపత్రికి వెళ్లండి. దీన్ని మా సిబ్బందికి అత్యవసరంగా గుర్తించాను.',
    symptom: (phone) => `మీకు ఇబ్బందిగా ఉన్నందుకు చింతిస్తున్నాను. నేను వైద్య సలహా ఇవ్వలేను. దంత వైద్యుడు (dentist) మిమ్మల్ని చూడాలి. మీ కోసం బుకింగ్ అభ్యర్థన పంపమంటారా?${phone ? ' మీరు ' + phone + ' కు కాల్ కూడా చేయవచ్చు.' : ''}`,
    refuse: () => 'క్షమించండి, నేను నా నియమాలను లేదా క్లినిక్ ధరలను మార్చలేను, ఎలాంటి తగ్గింపు హామీ ఇవ్వలేను. నిర్ణీత ధరలు చెప్పగలను లేదా అపాయింట్‌మెంట్‌కు సహాయం చేయగలను.',
    booking: (time) => `${time} కోసం మీ బుకింగ్ అభ్యర్థనను ఫ్రంట్ డెస్క్‌కు పంపాను. ఇది ఇంకా ఖరారైన బుకింగ్ కాదు. 2 పని గంటల్లో ఎవరైనా కాల్ చేసి నిర్ధారిస్తారు.`,
    bookingNoTime: () => 'మీ బుకింగ్ అభ్యర్థనను ఫ్రంట్ డెస్క్‌కు పంపాను. ఇది ఇంకా ఖరారైన బుకింగ్ కాదు. 2 పని గంటల్లో ఎవరైనా కాల్ చేసి రోజు, సమయం నిర్ణయిస్తారు.',
    bookingSymptom: () => 'దీని కోసం దంత వైద్యుడు (dentist) మిమ్మల్ని చూడాలి. ',
    askContact: () => ' మా బృందం మీకు కాల్ చేయడానికి దయచేసి మీ పేరు మరియు ఫోన్ నంబర్ ఇవ్వండి.',
    bookingAsk: (time) => `మీ బుకింగ్ అభ్యర్థనను${time ? ' (' + time + ')' : ''} మా బృందానికి పంపడానికి దయచేసి మీ పేరు మరియు ఫోన్ నంబర్ ఇవ్వండి. ఇది ఇంకా ఖరారైన బుకింగ్ కాదు. 2 పని గంటల్లో ఎవరైనా కాల్ చేసి ${time ? 'నిర్ధారిస్తారు' : 'రోజు, సమయం నిర్ణయిస్తారు'}.`,
    contactSaved: (name, phone, id) => `ధన్యవాదాలు${name ? ' ' + name : ''}. మీ బుకింగ్ అభ్యర్థనను${id ? ' (#' + id + ')' : ''} మీ నంబర్ ${phone} తో మా బృందానికి పంపాను. 2 పని గంటల్లో ఎవరైనా మీకు కాల్ చేస్తారు.`,
    contactNeedName: () => ' దయచేసి మీ పేరు కూడా ఇవ్వండి.',
    duplicateBooking: (id) => `ఈ నంబర్‌కు ఇప్పటికే బుకింగ్ అభ్యర్థన (#${id}) తెరిచి ఉంది. కొత్తది తెరవలేదు. దయచేసి వేచి ఉండండి, 2 పని గంటల్లో ఎవరైనా కాల్ చేస్తారు.`,
    bookingPending: (id) => `మీ బుకింగ్ అభ్యర్థన కోసం టికెట్${id ? ' (#' + id + ')' : ''} ఇప్పటికే తెరిచాను. దయచేసి వేచి ఉండండి, 2 పని గంటల్లో ఎవరైనా మీకు కాల్ చేస్తారు.`,
    outsideHours: (when, hours, emerg, id, ask) => `${when} మా బుకింగ్ సమయాలకు (${hours}) బయట ఉంది. అత్యవసరమైతే దయచేసి వెంటనే క్లినిక్‌కు${emerg ? ' ' + emerg + ' లో' : ''} కాల్ చేయండి. మీ అభ్యర్థనను${id ? ' (#' + id + ')' : ''} మా బృందానికి పంపాను; 2 పని గంటల్లో ఎవరైనా కాల్ చేసి సరైన సమయం నిర్ణయిస్తారు.${ask ? ' దయచేసి మీ పేరు మరియు ఫోన్ నంబర్ ఇవ్వండి.' : ''}`,
    bookingUpdated: (time, id) => `మీ బుకింగ్ అభ్యర్థనను${id ? ' (#' + id + ')' : ''} ${time} కు మార్చాను. ఇది ఇంకా ఖరారైన బుకింగ్ కాదు. 2 పని గంటల్లో ఎవరైనా కాల్ చేస్తారు.`,
    greet: (name) => `నమస్తే! నేను${name ? ' ' + name : ''} ఫ్రంట్ డెస్క్ సహాయకుడిని. సమయాలు, డాక్టర్లు, ధరలు, బీమా లేదా చిరునామా గురించి అడగవచ్చు.`,
    thanks: () => 'ధన్యవాదాలు. ఇంకేమైనా సహాయం కావాలా?',
    bye: () => 'మాతో మాట్లాడినందుకు ధన్యవాదాలు. జాగ్రత్తగా ఉండండి!',
    ack: () => 'సరే. మీ ప్రశ్న టైప్ చేయవచ్చు, లేదా బుకింగ్ అభ్యర్థన కోసం Book a visit నొక్కండి.',
    service: (p) => `${p.name} ధర ${p.price}.`,
    duration: (d) => ` సమయం: ${d}.`,
    day: (day, v) => `${day} రోజు మా సమయం: ${v}.`,
    doctor: (p) => `${p.name} (${p.role}). అందుబాటులో: ${p.days}.`,
    doctorsOn: (day) => `${day} రోజు అందుబాటులో ఉన్న డాక్టర్లు:`,
    allDoctors: () => 'మా డాక్టర్లు:',
    allServices: () => 'మా సేవలు మరియు ధరలు:',
    kv: (label, v) => `వివరాలు — ${label}: ${v}`
  }
};

module.exports = { detectLang, toEnglishHints, T };
