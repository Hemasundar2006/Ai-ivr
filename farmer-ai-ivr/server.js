// server.js

require('dotenv').config();
const express = require('express');
const twilio = require('twilio');

const app = express();
const port = process.env.PORT || 3000;

// ట్విలియో సర్వీస్ కోసం environment variables నుండి credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const farmerMobileNumber = process.env.FARMER_MOBILE_NUMBER;

// Validate required environment variables
if (!accountSid || !authToken || !twilioPhoneNumber) {
  console.error('Missing required Twilio environment variables');
  process.exit(1);
}

const client = twilio(accountSid, authToken);

app.use(express.json());

app.post('/webhook', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  // IVR మెనూ సెట్ చేయండి
  twiml.say('Welcome to the Farmer AI service. Press 1 for Telugu, Press 2 for English, Press 3 for SMS updates.');

  // అనుసరించిన ఎంపిక ప్రకారం చర్యలు
  const gather = twiml.gather({
    numDigits: 1,
    action: '/gather',
    timeout: 10
  });

  // If no input is received, repeat the menu
  twiml.say('I did not receive any input. Please try again.');
  twiml.redirect('/webhook');

  res.type('text/xml');
  res.send(twiml.toString());
});

// Handle user input from IVR menu
app.post('/gather', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const digit = req.body.Digits;
  const callerNumber = req.body.From;

  console.log(`User pressed: ${digit}, Caller: ${callerNumber}`);

  switch (digit) {
    case '1':
      twiml.say('మీరు తెలుగు ఎంచుకున్నారు. వ్యవసాయ సమాచారం కోసం మేము మీకు SMS పంపుతాము.');
      // Send SMS in Telugu
      sendSMS(farmerMobileNumber || callerNumber, 'వ్యవసాయ సమాచారం: ఈ వారం వాతావరణం మంచిది. పంటలకు నీరు ఇవ్వండి.');
      break;
    case '2':
      twiml.say('You have selected English. We will send you farming information via SMS.');
      // Send SMS in English
      sendSMS(farmerMobileNumber || callerNumber, 'Farming Update: Weather is good this week. Water your crops regularly.');
      break;
    case '3':
      twiml.say('You will receive SMS updates on your mobile number.');
      // Send confirmation SMS
      sendSMS(farmerMobileNumber || callerNumber, 'You have subscribed to SMS updates from Farmer AI service.');
      break;
    default:
      twiml.say('Invalid selection. Please try again.');
      twiml.redirect('/webhook');
      break;
  }

  twiml.say('Thank you for using Farmer AI service. Have a great day!');
  twiml.hangup();

  res.type('text/xml');
  res.send(twiml.toString());
});

// SMS sending function
async function sendSMS(to, message) {
  try {
    const sms = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: to
    });
    console.log(`SMS sent successfully: ${sms.sid}`);
    return sms;
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
}

// Make outbound call function
async function makeOutboundCall(to, message) {
  try {
    const call = await client.calls.create({
      twiml: `<Response><Say>${message}</Say></Response>`,
      from: twilioPhoneNumber,
      to: to
    });
    console.log(`Call initiated successfully: ${call.sid}`);
    return call;
  } catch (error) {
    console.error('Error making outbound call:', error);
    throw error;
  }
}

// API endpoint to send SMS manually
app.post('/send-sms', async (req, res) => {
  try {
    const { message, to } = req.body;
    const targetNumber = to || farmerMobileNumber;
    
    if (!targetNumber) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    const sms = await sendSMS(targetNumber, message);
    res.json({ success: true, messageSid: sms.sid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to make outbound call
app.post('/make-call', async (req, res) => {
  try {
    const { message, to } = req.body;
    const targetNumber = to || farmerMobileNumber;
    
    if (!targetNumber) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    const call = await makeOutboundCall(targetNumber, message);
    res.json({ success: true, callSid: call.sid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    farmerMobileConfigured: !!farmerMobileNumber
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Farmer mobile number configured: ${farmerMobileNumber ? 'Yes' : 'No'}`);
});
