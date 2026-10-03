/**
 * Smart User-Agent and Device Model Parser
 * Extracts browser, OS, device type, and phone/computer model
 */
const parseDeviceInfo = (ua = '', clientModel = '') => {
  let browser = 'Browser';
  let os = 'Unknown OS';
  let deviceType = 'desktop';
  let deviceName = '';

  // 1. Browser Detection
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Edg/i.test(ua) && !/OPR/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua) && !/Android/i.test(ua)) browser = 'Safari';
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera';

  // 2. OS & Device Type Detection
  if (/Android/i.test(ua)) {
    os = 'Android';
    deviceType = /Tablet|Nexus (7|9|10)|SM-T/i.test(ua) ? 'tablet' : 'mobile';
  } else if (/iPhone/i.test(ua)) {
    os = 'iOS';
    deviceType = 'mobile';
    deviceName = 'Apple iPhone';
  } else if (/iPad/i.test(ua)) {
    os = 'iPadOS';
    deviceType = 'tablet';
    deviceName = 'Apple iPad';
  } else if (/Windows NT 10.0/i.test(ua)) {
    os = 'Windows';
    deviceType = 'desktop';
    deviceName = 'Windows PC';
  } else if (/Windows/i.test(ua)) {
    os = 'Windows';
    deviceType = 'desktop';
    deviceName = 'Windows PC';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'macOS';
    deviceType = 'desktop';
    deviceName = 'Apple Mac';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
    deviceType = 'desktop';
    deviceName = 'Linux PC';
  }

  // 3. Phone Model Extraction
  if (clientModel && clientModel.trim()) {
    deviceName = clientModel.trim();
  } else if (os === 'Android') {
    // Check for common Android phone models in user-agent
    // e.g. "Android 13; SM-S908B Build/..." or "Android 14; Pixel 7 Pro"
    const match = ua.match(/Android[^;]+;\s*([^;)]+)\s*(?:Build|[;)])/i);
    if (match && match[1]) {
      let rawModel = match[1].trim().replace(/^[a-z]{2}-[a-z]{2};\s*/i, '');
      if (/^SM-[A-Z0-9]+/i.test(rawModel)) {
        deviceName = `Samsung Galaxy (${rawModel})`;
      } else if (/Pixel/i.test(rawModel)) {
        deviceName = `Google ${rawModel}`;
      } else if (/OnePlus|CPH[0-9]|IN20/i.test(rawModel)) {
        deviceName = `OnePlus (${rawModel})`;
      } else if (/Redmi|POCO|Xiaomi|2201|2109|2203|2304/i.test(rawModel)) {
        deviceName = `Xiaomi / Redmi (${rawModel})`;
      } else if (/Moto|motorola/i.test(rawModel)) {
        deviceName = `Motorola (${rawModel})`;
      } else if (/Vivo|V2[0-9]{3}/i.test(rawModel)) {
        deviceName = `Vivo (${rawModel})`;
      } else if (/Realme|RMX/i.test(rawModel)) {
        deviceName = `Realme (${rawModel})`;
      } else if (rawModel && rawModel !== 'K' && rawModel !== 'wv' && rawModel.length > 2) {
        deviceName = `${rawModel} (Android)`;
      } else {
        deviceName = 'Android Phone';
      }
    } else {
      deviceName = 'Android Phone';
    }
  }

  if (!deviceName) {
    deviceName = `${browser} on ${os}`;
  }

  return { browser, os, deviceType, deviceName };
};

module.exports = { parseDeviceInfo };
