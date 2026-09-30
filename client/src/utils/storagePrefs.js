/**
 * Storage and Data preferences & WebRTC network monitoring utilities
 */

export const STORAGE_PREFS_KEY = 'ts_storage_prefs';
export const WEBRTC_DATA_KEY = 'ts_webrtc_data_usage';
export const NETWORK_STATS_RESET_KEY = 'ts_network_stats_reset_time';

export const DEFAULT_STORAGE_PREFS = {
  // Mobile data auto-download
  mobilePhotos: true,
  mobileAudio: false,
  mobileVideos: false,
  mobileDocs: true,

  // Wi-Fi auto-download (All media / None)
  wifiAll: true,
  wifiPhotos: true,
  wifiAudio: true,
  wifiVideos: true,
  wifiDocs: true,

  // Call quality
  useLessData: false,
};

/**
 * Load saved storage & network preferences from localStorage
 */
export const loadStoragePrefs = () => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFS_KEY);
    if (!raw) return { ...DEFAULT_STORAGE_PREFS };
    return { ...DEFAULT_STORAGE_PREFS, ...JSON.parse(raw) };
  } catch (err) {
    console.warn('Failed to load storage prefs:', err);
    return { ...DEFAULT_STORAGE_PREFS };
  }
};

/**
 * Persist preferences and notify listeners
 */
export const saveStoragePrefs = (prefs) => {
  try {
    localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent('ts_storage_prefs_changed', { detail: prefs }));
  } catch (err) {
    console.warn('Failed to save storage prefs:', err);
  }
};

/**
 * Retrieve total WebRTC data transferred (in bytes)
 */
export const getWebrtcDataTransferred = () => {
  try {
    const raw = localStorage.getItem(WEBRTC_DATA_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
};

/**
 * Add transferred bytes from WebRTC RTP streams
 */
export const addWebrtcDataTransferred = (bytes) => {
  if (!bytes || bytes <= 0) return;
  try {
    const current = getWebrtcDataTransferred();
    const updated = current + bytes;
    localStorage.setItem(WEBRTC_DATA_KEY, String(updated));
    window.dispatchEvent(new CustomEvent('ts_webrtc_stats_updated', { detail: { totalBytes: updated } }));
  } catch (err) {
    console.warn('Failed to update WebRTC data transfer:', err);
  }
};

/**
 * Reset local network stats
 */
export const resetNetworkUsageStats = () => {
  try {
    localStorage.setItem(WEBRTC_DATA_KEY, '0');
    localStorage.setItem(NETWORK_STATS_RESET_KEY, new Date().toISOString());
    window.dispatchEvent(new CustomEvent('ts_webrtc_stats_updated', { detail: { totalBytes: 0 } }));
  } catch (err) {
    console.warn('Failed to reset network usage stats:', err);
  }
};

/**
 * Generate WebRTC getUserMedia media constraints based on "useLessData"
 */
export const getWebRTCConstraints = (audioOnly, audioDeviceId, videoDeviceId) => {
  const prefs = loadStoragePrefs();
  const isLowData = Boolean(prefs.useLessData);

  const audioConstraint = audioDeviceId
    ? { deviceId: { exact: audioDeviceId } }
    : (isLowData
        ? {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000,
            channelCount: 1,
          }
        : true);

  const videoConstraint = !audioOnly
    ? (videoDeviceId
        ? { deviceId: { exact: videoDeviceId } }
        : (isLowData
            ? {
                width: { ideal: 480, max: 640 },
                height: { ideal: 360, max: 480 },
                frameRate: { ideal: 15, max: 15 },
              }
            : {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30, max: 30 },
              }))
    : false;

  return { audio: audioConstraint, video: videoConstraint, isLowData };
};

/**
 * Apply WebRTC sender bitrate constraints for lower data usage
 */
export const applyPeerConnectionBitrates = async (pc, isLowData) => {
  if (!pc) return;
  try {
    const senders = pc.getSenders ? pc.getSenders() : [];
    for (const sender of senders) {
      if (!sender.track) continue;
      const params = sender.getParameters ? sender.getParameters() : null;
      if (!params) continue;

      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }

      if (sender.track.kind === 'video') {
        params.encodings[0].maxBitrate = isLowData ? 250000 : 1500000; // 250 kbps vs 1.5 Mbps
        if (isLowData) {
          params.encodings[0].scaleResolutionDownBy = 2;
        } else {
          delete params.encodings[0].scaleResolutionDownBy;
        }
      } else if (sender.track.kind === 'audio') {
        params.encodings[0].maxBitrate = isLowData ? 24000 : 64000; // 24 kbps vs 64 kbps
      }

      if (sender.setParameters) {
        await sender.setParameters(params).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[WebRTC] applyPeerConnectionBitrates warning:', err);
  }
};
