const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

// Check if API key is loaded
if (!WEATHER_API_KEY) {
  console.error('CRITICAL ERROR: WEATHER_API_KEY is not defined in the environment variables!');
  process.exit(1);
}

// Enable CORS for frontend requests
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Implement rate limiting: max 60 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per windowMs
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Weather Proxy Endpoint
app.get('/api/weather', async (req, res) => {
  try {
    const { city } = req.query;

    // Validation: check if city is provided and is a valid format
    if (!city || typeof city !== 'string' || city.trim() === '') {
      return res.status(400).json({ error: 'City name is required.' });
    }

    const cleanCity = city.trim();
    
    // Check for obvious malicious input or purely symbolic inputs
    if (/^[!@#$%^&*(),.?":{}|<>+=\-_;`~[\]]+$/.test(cleanCity)) {
      return res.status(400).json({ error: 'Invalid city name format.' });
    }

    // Call WeatherAPI.com forecast endpoint (asking for 7 days)
    const apiUrl = `http://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(cleanCity)}&days=7&aqi=no&alerts=no`;
    
    const apiResponse = await fetch(apiUrl);
    const data = await apiResponse.json();

    // Handle WeatherAPI specific error responses
    if (!apiResponse.ok || data.error) {
      if (data.error && (data.error.code === 1006 || data.error.code === 1003)) {
        return res.status(404).json({ error: 'City not found. Please verify the name and try again.' });
      }
      console.error('WeatherAPI Error:', data.error || `HTTP Status ${apiResponse.status}`);
      return res.status(502).json({ error: 'Failed to fetch data from Weather provider.' });
    }

    // Process and shape only the required weather data
    const location = data.location;
    const current = data.current;
    const forecastDays = data.forecast.forecastday;

    // Sunrise and Sunset come from today's astronomy info
    const todayAstro = forecastDays[0]?.astro || {};
    const sunrise = todayAstro.sunrise || 'N/A';
    const sunset = todayAstro.sunset || 'N/A';

    // 24-hour Hourly Forecast starting from current hour of location
    const allHours = forecastDays.flatMap(day => day.hour || []);
    const currentLocalTime = location.localtime; // Format: "YYYY-MM-DD HH:MM"
    
    let startIndex = -1;
    if (currentLocalTime) {
      const parts = currentLocalTime.split(' ');
      if (parts.length === 2) {
        const dateStr = parts[0];
        const hourStr = parts[1].split(':')[0];
        const currentHourTimeStr = `${dateStr} ${hourStr.padStart(2, '0')}:00`;
        startIndex = allHours.findIndex(h => h.time === currentHourTimeStr);
      }
    }

    // Fallback if index matches failed or timezone misalignment
    if (startIndex === -1 && location.localtime_epoch) {
      startIndex = allHours.findIndex(h => h.time_epoch >= location.localtime_epoch);
    }
    if (startIndex === -1) {
      startIndex = 0;
    }

    // Get the next 24 hours
    const hourlyForecast = allHours.slice(startIndex, startIndex + 24).map(h => ({
      time: h.time,
      timeEpoch: h.time_epoch,
      tempC: h.temp_c,
      tempF: h.temp_f,
      condition: {
        text: h.condition.text,
        icon: h.condition.icon,
        code: h.condition.code
      },
      chanceOfRain: h.chance_of_rain || 0
    }));

    // Next 7-day forecast mapping (or whatever the API returns, e.g. 3 days on free plan)
    const dailyForecast = forecastDays.map(day => ({
      date: day.date,
      dateEpoch: day.date_epoch,
      maxTempC: day.day.maxtemp_c,
      maxTempF: day.day.maxtemp_f,
      minTempC: day.day.mintemp_c,
      minTempF: day.day.mintemp_f,
      condition: {
        text: day.day.condition.text,
        icon: day.day.condition.icon,
        code: day.day.condition.code
      },
      chanceOfRain: day.day.daily_chance_of_rain || 0
    }));

    // Build unified response payload
    const responsePayload = {
      city: location.name,
      region: location.region,
      country: location.country,
      localTime: location.localtime,
      current: {
        tempC: current.temp_c,
        tempF: current.temp_f,
        condition: {
          text: current.condition.text,
          icon: current.condition.icon,
          code: current.condition.code
        },
        feelsLikeC: current.feelslike_c,
        feelsLikeF: current.feelslike_f,
        humidity: current.humidity,
        windKph: current.wind_kph,
        visibilityKm: current.vis_km,
        pressureMb: current.pressure_mb,
        uv: current.uv
      },
      astronomy: {
        sunrise,
        sunset
      },
      hourlyForecast,
      dailyForecast
    };

    res.json(responsePayload);
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: 'Internal server error occurred while retrieving weather data.' });
  }
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Fallback to index.html for other requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start Express App
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
