const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "edgeflow_verify_2026";

const PAIR = 'EUR/USD';
const RISK_DISCLAIMER = "⚠️ DEMO — Not financial advice";

let autoMode = false;
let autoInterval = null;
let currentInterval = 60000; // default 1 minute

// Webhook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook Verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Receive messages
app.post('/webhook', (req, res) => {
  const body = req.body;
  if (body.object === 'page') {
    body.entry.forEach(entry => {
      const event = entry.messaging[0];
      if (event.message && event.message.text) {
        handleMessage(event.sender.id, event.message.text);
      }
    });
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Send message
async function sendMessage(id, text) {
  await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
    recipient: { id },
    message: { text }
  }).catch(e => console.log('Error:', e.response?.data || e.message));
}

// Get signal
async function getSignal() {
  try {
    const res = await axios.get('https://api.exchangerate-api.com/v4/latest/EUR');
    const price = res.data.rates.USD;
    const change = ((Math.random() - 0.5) * 0.02).toFixed(4);
    const direction = parseFloat(change) > 0 ? '🟢 BUY' : '🔴 SELL';
    return `
📊 EdgeFlow — ${PAIR}
💰 Price: ${price.toFixed(5)}
${direction}
📈 Change: ${change}%
⏱️ 1-Minute

${RISK_DISCLAIMER}
    `.trim();
  } catch {
    return "❌ Try again later";
  }
}

// Handle commands
async function handleMessage(senderId, text) {
  const msg = text.trim().toLowerCase();

  if (msg === 'start' || msg === 'help' || msg === 'menu') {
    sendMessage(senderId, `
⚡ EdgeFlow — ${PAIR} Signals

Commands:
• signal → Get 1 signal
• 30s → Auto every 30 seconds
• 1m → Auto every 1 minute
• stop → Stop auto signals

${RISK_DISCLAIMER}
    `.trim());
  }

  else if (msg === 'signal') {
    sendMessage(senderId, "🔍 Analyzing...");
    sendMessage(senderId, await getSignal());
  }

  else if (msg === '30s') {
    if (autoMode) clearInterval(autoInterval);
    autoMode = true;
    currentInterval = 30000;
    sendMessage(senderId, "⚡ Auto every 30 seconds — send 'stop' to end");
    autoInterval = setInterval(async () => {
      sendMessage(senderId, "🔔 " + await getSignal());
    }, currentInterval);
  }

  else if (msg === '1m' || msg === '1min') {
    if (autoMode) clearInterval(autoInterval);
    autoMode = true;
    currentInterval = 60000;
    sendMessage(senderId, "⚡ Auto every 1 minute — send 'stop' to end");
    autoInterval = setInterval(async () => {
      sendMessage(senderId, "🔔 " + await getSignal());
    }, currentInterval);
  }

  else if (msg === 'stop' || msg === 'off') {
    if (autoInterval) clearInterval(autoInterval);
    autoMode = false;
    sendMessage(senderId, "⏹️ Auto stopped. Send 'signal' anytime.");
  }

  else {
    sendMessage(senderId, "👋 Send 'start' for commands");
  }
}

app.get('/', (req, res) => {
  res.send(`⚡ EdgeFlow — ${PAIR} Bot Online | Auto: ${autoMode ? 'ON' : 'OFF'}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`⚡ EdgeFlow running on port ${PORT}`));
