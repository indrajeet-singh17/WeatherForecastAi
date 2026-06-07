// ==========================================================================
// Application State & Constants
// ==========================================================================
const BACKEND_URL = 'https://weatherforecastai.onrender.com/api/weather';
const DEFAULT_CITY = 'Agra, Uttar Pradesh, India';

let weatherData = null;
let currentUnit = 'C'; // 'C' for Celsius, 'F' for Fahrenheit

// DOM Elements
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const unitToggleBtn = document.getElementById('unitToggle');
const labelC = document.getElementById('labelC');
const labelF = document.getElementById('labelF');
const refreshBtn = document.getElementById('refreshBtn');

const loadingIndicator = document.getElementById('loadingIndicator');
const errorAlert = document.getElementById('errorAlert');
const errorMessage = document.getElementById('errorMessage');
const closeErrorBtn = document.getElementById('closeError');

const weatherContent = document.getElementById('weatherContent');
const appBackground = document.getElementById('appBackground');

// Weather detail fields
const cityNameHeader = document.getElementById('cityNameHeader');
const countryNameHeader = document.getElementById('countryNameHeader');
const timePill = document.getElementById('timePill');
const currentIcon = document.getElementById('currentIcon');
const currentTemp = document.getElementById('currentTemp');
const currentConditionText = document.getElementById('currentConditionText');
const currentConditionDesc = document.getElementById('currentConditionDesc');
const sunriseTime = document.getElementById('sunriseTime');
const sunsetTime = document.getElementById('sunsetTime');
const feelsLike = document.getElementById('feelsLike');

// Bottom Muted row metrics
const bottomPressure = document.getElementById('bottomPressure');
const bottomWindSpeed = document.getElementById('bottomWindSpeed');
const bottomUv = document.getElementById('bottomUv');

// Metrics Grid detail fields
const gridFeelsLike = document.getElementById('gridFeelsLike');
const gridHumidity = document.getElementById('gridHumidity');
const gridWindSpeed = document.getElementById('gridWindSpeed');
const gridVisibility = document.getElementById('gridVisibility');
const gridPressure = document.getElementById('gridPressure');
const gridUvIndex = document.getElementById('gridUvIndex');

// Advice elements
const feelsLikeAdvice = document.getElementById('feelsLikeAdvice');
const humidityAdvice = document.getElementById('humidityAdvice');
const windAdvice = document.getElementById('windAdvice');
const visAdvice = document.getElementById('visAdvice');
const pressureAdvice = document.getElementById('pressureAdvice');
const uvAdvice = document.getElementById('uvAdvice');

const hourlyContainer = document.getElementById('hourlyContainer');
const dailyContainer = document.getElementById('dailyContainer');

// ==========================================================================
// Initialization & Listeners
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Load default city immediately
  fetchWeather(DEFAULT_CITY);

  // Search submission
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const city = searchInput.value.trim();
    if (city) {
      fetchWeather(city);
    }
  });

  // Unit toggle clicked
  unitToggleBtn.addEventListener('click', () => {
    currentUnit = currentUnit === 'C' ? 'F' : 'C';
    updateUnitToggleUI();
    if (weatherData) {
      renderWeatherData(weatherData);
    }
  });

  // Refresh button clicked
  refreshBtn.addEventListener('click', () => {
    const currentCity = weatherData ? weatherData.city : DEFAULT_CITY;
    fetchWeather(currentCity);
  });

  // Close error alert
  closeErrorBtn.addEventListener('click', hideError);
});

// ==========================================================================
// Weather Fetch Function (calls secure backend Express endpoint)
// ==========================================================================
async function fetchWeather(city) {
  showLoading();
  hideError();
  weatherContent.classList.add('fade-out');

  try {
    const response = await fetch(`${BACKEND_URL}?city=${encodeURIComponent(city)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch weather data.');
    }

    weatherData = data;
    renderWeatherData(data);
    updateBackground(data.current.condition.code);

    // Clear search box on success to keep UI tidy
    searchInput.value = '';
  } catch (error) {
    console.error('Fetch Error:', error);
    showError(error.message || 'Network error. Please check your connection and try again.');
  } finally {
    hideLoading();
    weatherContent.classList.remove('fade-out');
  }
}

// ==========================================================================
// Rendering Logic
// ==========================================================================
function renderWeatherData(data) {
  // 1. Current Location Info
  cityNameHeader.textContent = data.city;
  countryNameHeader.textContent = data.country;

  // Format local time nicely in time pill
  if (data.localTime) {
    const timePart = data.localTime.split(' ')[1];
    timePill.textContent = `${data.city} Time: ${formatTime12h(timePart)}`;
  } else {
    timePill.textContent = 'Local Time: --:-- PM';
  }

  // 2. Current Temperature and Condition
  const tempVal = currentUnit === 'C' ? Math.round(data.current.tempC) : Math.round(data.current.tempF);
  currentTemp.textContent = tempVal;
  document.querySelector('.temp-symbol').textContent = currentUnit === 'C' ? '°C' : '°F';

  currentConditionText.textContent = data.current.condition.text;
  currentConditionDesc.textContent = getConditionDesc(data);

  // Fix protocol relative icons from WeatherAPI
  let iconUrl = data.current.condition.icon;
  if (iconUrl.startsWith('//')) {
    iconUrl = 'https:' + iconUrl;
  }
  currentIcon.src = iconUrl;
  currentIcon.alt = data.current.condition.text;

  // 3. Astronomy Info
  sunriseTime.textContent = data.astronomy.sunrise;
  sunsetTime.textContent = data.astronomy.sunset;

  // 4. Main card feels like
  const feelsLikeVal = currentUnit === 'C' ? Math.round(data.current.feelsLikeC) : Math.round(data.current.feelsLikeF);
  feelsLike.textContent = feelsLikeVal;

  // 5. Main card bottom muted row
  bottomPressure.textContent = `${data.current.pressureMb} hPa`;
  bottomWindSpeed.textContent = `${data.current.windKph} km/h`;
  bottomUv.textContent = Math.round(data.current.uv);

  // 6. Metrics Grid Details
  gridFeelsLike.textContent = feelsLikeVal;
  gridHumidity.textContent = data.current.humidity;
  gridWindSpeed.textContent = data.current.windKph;
  gridVisibility.textContent = data.current.visibilityKm;
  gridPressure.textContent = data.current.pressureMb;

  // UV Index display (UV index score + category)
  const uvVal = data.current.uv;
  const uvCat = getUvCategory(uvVal);
  gridUvIndex.textContent = `${uvVal} ${uvCat}`;

  // Update SVG progress ring for Humidity
  updateHumidityProgress(data.current.humidity);

  // 7. Update Advices text dynamically
  feelsLikeAdvice.textContent = getFeelsLikeAdvice(feelsLikeVal, tempVal);
  humidityAdvice.textContent = getHumidityAdvice(data.current.humidity);
  windAdvice.textContent = getWindAdvice(data.current.windKph);
  visAdvice.textContent = getVisAdvice(data.current.visibilityKm);
  pressureAdvice.textContent = getPressureAdvice(data.current.pressureMb);
  uvAdvice.textContent = getUvAdvice(uvVal);

  // 8. Render Hourly Forecast
  hourlyContainer.innerHTML = '';
  if (data.hourlyForecast && data.hourlyForecast.length > 0) {
    data.hourlyForecast.forEach(hour => {
      const card = document.createElement('div');
      card.className = 'hourly-card';

      const timeLabel = formatHourLabel(hour.time);
      const hTemp = currentUnit === 'C' ? Math.round(hour.tempC) : Math.round(hour.tempF);
      let hIcon = hour.condition.icon;
      if (hIcon.startsWith('//')) {
        hIcon = 'https:' + hIcon;
      }

      const rainClass = hour.chanceOfRain > 0 ? 'has-rain' : '';
      const rainChanceHtml = `
        <span class="hourly-rain ${rainClass}">
          <i class="fa-solid fa-droplet"></i> ${hour.chanceOfRain}%
        </span>
      `;

      card.innerHTML = `
        <span class="hourly-time">${timeLabel}</span>
        <img src="${hIcon}" alt="${hour.condition.text}" title="${hour.condition.text}">
        <span class="hourly-temp">${hTemp}°</span>
        ${rainChanceHtml}
      `;
      hourlyContainer.appendChild(card);
    });
  } else {
    hourlyContainer.innerHTML = '<p class="text-muted">No hourly data available.</p>';
  }

  // 9. Render Daily Forecast (Redesigned as compact horizontal cards)
  dailyContainer.innerHTML = '';
  if (data.dailyForecast && data.dailyForecast.length > 0) {
    data.dailyForecast.forEach((day, index) => {
      const card = document.createElement('div');
      // Highlight the first card (today) with a distinct class
      card.className = `daily-forecast-card ${index === 0 ? 'active-today' : ''}`;

      const dayName = formatDayName(day.date, index === 0);
      const dMax = currentUnit === 'C' ? Math.round(day.maxTempC) : Math.round(day.maxTempF);
      const dMin = currentUnit === 'C' ? Math.round(day.minTempC) : Math.round(day.minTempF);

      let dIcon = day.condition.icon;
      if (dIcon.startsWith('//')) {
        dIcon = 'https:' + dIcon;
      }

      let rainChanceHtml = '';
      if (day.chanceOfRain > 0) {
        rainChanceHtml = `
          <span class="daily-rain-chance">
            <i class="fa-solid fa-droplet"></i> ${day.chanceOfRain}%
          </span>
        `;
      } else {
        rainChanceHtml = '<span class="daily-rain-chance empty"></span>';
      }

      card.innerHTML = `
        <span class="daily-day-label">${dayName}</span>
        <div class="daily-weather-art">
          <img src="${dIcon}" alt="${day.condition.text}" title="${day.condition.text}">
        </div>
        ${rainChanceHtml}
        <div class="daily-temp-range">
          <span>${dMax}°</span>
          <span class="temp-divider">/</span>
          <span class="min-temp">${dMin}°</span>
        </div>
      `;
      dailyContainer.appendChild(card);
    });
  } else {
    dailyContainer.innerHTML = '<p class="text-muted">No forecast data available.</p>';
  }

  // Unhide the dashboard container
  weatherContent.classList.remove('hidden');
}

// ==========================================================================
// Weather-Based Background Changer
// ==========================================================================
function updateBackground(conditionCode) {
  // Clear previous classes
  appBackground.className = 'app-background';

  // Sunny / Clear
  if (conditionCode === 1000) {
    appBackground.classList.add('bg-sunny');
    return;
  }

  // Thunderstorm
  const thunderstormCodes = [1087, 1273, 1276, 1279, 1282];
  if (thunderstormCodes.includes(conditionCode)) {
    appBackground.classList.add('bg-thunderstorm');
    return;
  }

  // Rain / Shower / Drizzle
  const rainCodes = [1063, 1150, 1153, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246];
  if (rainCodes.includes(conditionCode)) {
    appBackground.classList.add('bg-rain');
    return;
  }

  // Snow / Sleet / Ice
  const snowCodes = [
    1066, 1069, 1072, 1114, 1117, 1168, 1171, 1198, 1201, 1204, 1207,
    1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258,
    1261, 1264
  ];
  if (snowCodes.includes(conditionCode)) {
    appBackground.classList.add('bg-snow');
    return;
  }

  // Default: Cloudy / Mist / Fog (e.g. 1003, 1006, 1009, 1030, 1135, 1147)
  appBackground.classList.add('bg-cloudy');
}

// ==========================================================================
// Formatting & Text Generation Helpers
// ==========================================================================
function formatTime12h(timeStr) {
  // Format: "15:30" to "3:30 PM"
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${minutes} ${ampm}`;
}

function formatHourLabel(timeStr) {
  // Format: "2026-06-06 13:00" to "1 PM"
  if (!timeStr) return '';
  const hourPart = timeStr.split(' ')[1];
  if (!hourPart) return timeStr;
  const hour = parseInt(hourPart.split(':')[0], 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${ampm}`;
}

function formatDayName(dateStr, isToday) {
  if (isToday) return 'Today';

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  // Construct Date object using local time numbers to avoid TZ issues
  const localDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

  // Check if it matches today's actual date
  const today = new Date();
  if (localDate.toDateString() === today.toDateString()) {
    return 'Today';
  }

  return days[localDate.getDay()].slice(0, 3);
}

function updateUnitToggleUI() {
  if (currentUnit === 'C') {
    labelC.classList.add('active');
    labelF.classList.remove('active');
  } else {
    labelF.classList.add('active');
    labelC.classList.remove('active');
  }
}

// Generate dynamic condition descriptions based on the dataset
function getConditionDesc(data) {
  const condition = data.current.condition.text;
  const humidity = data.current.humidity;
  const windKph = data.current.windKph;
  const temp = data.current.tempC;

  if (condition.toLowerCase().includes('rain')) {
    return `Precipitation active, expect wind gusts up to ${windKph} km/h.`;
  }
  if (condition.toLowerCase().includes('snow')) {
    return `Freezing conditions and active snow, proceed with caution.`;
  }
  if (temp > 30) {
    return `Warm conditions active. Wear lightweight clothes.`;
  }
  if (temp < 10) {
    return `Cool temperatures active. Stay warm.`;
  }
  return `${condition} conditions, with humidity around ${humidity}%.`;
}

// SVG progress ring math
function updateHumidityProgress(percentage) {
  const circle = document.getElementById('humidityProgressCircle');
  if (circle) {
    const radius = 15;
    const circumference = 2 * Math.PI * radius;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    const offset = circumference - (percentage / 100) * circumference;
    circle.style.strokeDashoffset = offset;
  }
}

// UV category labels
function getUvCategory(uv) {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
}

// Advices for individual cards
function getUvAdvice(uv) {
  if (uv <= 2) return 'Low risk of harm. Safe to stay outside.';
  if (uv <= 5) return 'Moderate risk. Wear sunscreen and shades.';
  if (uv <= 7) return 'High risk. Protect skin and eyes.';
  return 'Limit exposure. Stay in shade.';
}

function getHumidityAdvice(h) {
  if (h <= 35) return 'Dry conditions. Hydrate regularly.';
  if (h <= 65) return 'Comfortable humidity level.';
  return 'Sticky/Humid atmosphere.';
}

function getWindAdvice(w) {
  if (w <= 10) return 'Calm breeze.';
  if (w <= 25) return 'Moderate winds active.';
  return 'Strong winds. Hold onto light items.';
}

function getFeelsLikeAdvice(feelsLike, actual) {
  const diff = feelsLike - actual;
  if (Math.abs(diff) < 1.5) return 'Similar to actual temperature.';
  if (diff > 0) return 'Feels warmer than actual temp.';
  return 'Feels cooler than actual temp.';
}

function getVisAdvice(vis) {
  if (vis >= 9) return 'Clear visual view.';
  if (vis >= 5) return 'Moderate visibility.';
  return 'Poor visibility. Take care.';
}

function getPressureAdvice(p) {
  if (p < 1010) return 'Low pressure system active.';
  if (p > 1020) return 'High pressure system active.';
  return 'Standard atmospheric pressure.';
}

// ==========================================================================
// Status Display Control
// ==========================================================================
function showLoading() {
  loadingIndicator.classList.remove('hidden');
}

function hideLoading() {
  loadingIndicator.classList.add('hidden');
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorAlert.classList.remove('hidden');
}

function hideError() {
  errorAlert.classList.add('hidden');
}
