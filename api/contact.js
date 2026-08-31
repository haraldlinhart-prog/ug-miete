// api/contact.js — UG-Miete.de
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CONTACT_FROM = process.env.CONTACT_FROM || 'noreply@pan21.com';
const CONTACT_TO = process.env.CONTACT_TO || 'ugmiete@pan21.com';

function isGibberish(str) {
  if (!str) return false;
  var s = str.trim();
  var len = s.length;
  if (len < 6) return false;
  var vowels = (s.match(/[aeiouäöüAEIOUÄÖÜ]/g) || []).length;
  var letters = (s.match(/[a-zA-ZäöüÄÖÜß]/g) || []).length;
  if (letters === 0) return false;
  var vowelRatio = vowels / letters;
  var transitions = 0;
  for (var i = 1; i < s.length; i++) {
    var prevUpper = s[i-1] === s[i-1].toUpperCase() && /[a-zA-Z]/.test(s[i-1]);
    var curUpper = s[i] === s[i].toUpperCase() && /[a-zA-Z]/.test(s[i]);
    if (prevUpper !== curUpper) transitions++;
  }
  var transitionRatio = transitions / len;
  var vowelThreshold = len <= 10 ? 0.16 : (len <= 13 ? 0.22 : 0.28);
  return vowelRatio < vowelThreshold && transitionRatio > 0.3;
}

function looksHuman(str) {
  if (!str) return true;
  return str.replace(/\s/g, '').length <= 60;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

var DURATION_LABELS = {
  '1_2_monate': '1–2 Monate',
  '3_6_monate': '3–6 Monate',
  'ueber_6_monate': 'Über 6 Monate',
  'noch_offen': 'Noch offen / mit Verlängerungsoption'
};

var TIMELINE_LABELS = {
  sofort: 'So schnell wie möglich',
  wochen: 'Innerhalb weniger Wochen',
  offen: 'Zeitlich noch offen'
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    var body = req.body || {};
    var name = (body.name || '').toString().trim();
    var email = (body.email || '').toString().trim();
    var phone = (body.phone || '').toString().trim();
    var usage = (body.usage || '').toString().trim();
    var duration = (body.duration || '').toString().trim();
    var branch = (body.branch || '').toString().trim();
    var timeline = (body.timeline || '').toString().trim();
    var notes = (body.notes || '').toString().trim();
    var website = (body.website || '').toString();
    var elapsed = parseInt(body.elapsed, 10);
    var consent = !!body.consent;

    if (website) { res.status(200).json({ success: true }); return; }
    if (isNaN(elapsed) || elapsed < 3) { res.status(200).json({ success: true }); return; }
    if (!name || !email || !usage) { res.status(400).json({ error: 'Bitte füllen Sie alle Pflichtfelder aus.' }); return; }
    if (!consent) { res.status(400).json({ error: 'Bitte bestätigen Sie die Datenschutzerklärung.' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' }); return; }
    if (!looksHuman(name) || !looksHuman(usage) || isGibberish(name) || isGibberish(usage)) { res.status(200).json({ success: true }); return; }

    if (!RESEND_API_KEY) { res.status(500).json({ error: 'Konfigurationsfehler. Bitte kontaktieren Sie uns direkt per E-Mail.' }); return; }

    var html = '<h2>Neue Anfrage über ug-miete.de</h2>' +
      '<p><strong>Name:</strong> ' + escapeHtml(name) + '</p>' +
      '<p><strong>E-Mail:</strong> ' + escapeHtml(email) + '</p>' +
      (phone ? '<p><strong>Telefon:</strong> ' + escapeHtml(phone) + '</p>' : '') +
      '<p><strong>Geplantes Einsatzfeld:</strong><br>' + escapeHtml(usage).replace(/\n/g, '<br>') + '</p>' +
      (duration ? '<p><strong>Gewünschte Mietdauer:</strong> ' + escapeHtml(DURATION_LABELS[duration] || duration) + '</p>' : '') +
      (branch ? '<p><strong>Gewünschte Branche:</strong> ' + escapeHtml(branch) + '</p>' : '') +
      (timeline ? '<p><strong>Gewünschter Beginn:</strong> ' + escapeHtml(TIMELINE_LABELS[timeline] || timeline) + '</p>' : '') +
      (notes ? '<p><strong>Besondere Anforderungen:</strong><br>' + escapeHtml(notes).replace(/\n/g, '<br>') + '</p>' : '');

    var resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'UG-Miete.de <' + CONTACT_FROM + '>',
        to: [CONTACT_TO],
        reply_to: email,
        subject: 'Neue Anfrage: ' + name,
        html: html
      })
    });

    if (!resendRes.ok) { res.status(500).json({ error: 'Senden fehlgeschlagen.' }); return; }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: 'Ein unerwarteter Fehler ist aufgetreten.' });
  }
};
