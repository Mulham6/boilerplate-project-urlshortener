require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const dns = require('dns');
const { URL } = require('url');
const Url = require('./models/Url');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use(bodyParser.urlencoded({ extended: true }));

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

// Keep track of the current short_url counter
let urlCounter = 1;

// Initialize the counter from the highest short_url in the database
(async () => {
  try {
    const doc = await Url.findOne().sort('-short_url');
    if (doc) {
      urlCounter = doc.short_url + 1;
    }
  } catch (err) {
    console.error('Error initializing URL counter:', err);
  }
})();

// POST /api/shorturl - create a short URL
app.post('/api/shorturl', async (req, res) => {
  const submittedUrl = req.body.url;

  let parsed;
  try {
    parsed = new URL(submittedUrl);
  } catch {
    return res.json({ error: 'invalid url' });
  }

  // Check domain validity via DNS
  dns.lookup(parsed.hostname, async (err) => {
    if (err) {
      return res.json({ error: 'invalid url' });
    }

    try {
      // Return existing entry if already stored
      const found = await Url.findOne({ original_url: submittedUrl });
      if (found) {
        return res.json({
          original_url: found.original_url,
          short_url: found.short_url,
        });
      }

      // Save new short URL
      const newUrl = new Url({
        original_url: submittedUrl,
        short_url: urlCounter++,
      });

      await newUrl.save();

      res.json({
        original_url: newUrl.original_url,
        short_url: newUrl.short_url,
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
});

// GET /api/shorturl/:short - redirect to original URL
app.get('/api/shorturl/:short', async (req, res) => {
  const shortId = parseInt(req.params.short);

  try {
    const record = await Url.findOne({ short_url: shortId });
    if (!record) {
      return res.status(404).json({ error: 'No short URL found for given input' });
    }

    res.redirect(301, record.original_url);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
