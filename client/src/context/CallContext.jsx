import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import useSocket from '../hooks/useSocket';
import toast from 'react-hot-toast';
import {
  getWebRTCConstraints,
  applyPeerConnectionBitrates,
  addWebrtcDataTransferred,
  loadStoragePrefs,
} from '../utils/storagePrefs';

const CallContext = createContext();

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
};

// Web Audio API Synthesizer for high quality ringtone cues
class RingtoneSynth {
  constructor() {
    this.audioCtx = null;
    this.intervalId = null;
  }

  init() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playIncoming() {
    this.stop();
    this.init();
    if (!this.audioCtx) return;

    const playChime = () => {
      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.4);
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        osc.start(now);
        osc.stop(now + 0.8);
      } catch (e) {
        console.warn('Ringtone synth error:', e);
      }
    };

    playChime();
    this.intervalId = setInterval(playChime, 1800);
  }

  playOutgoing() {
    this.stop();
    this.init();
    if (!this.audioCtx) return;

    const playTone = () => {
      try {
        const now = this.audioCtx.currentTime;
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);
        
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.2);
        osc2.stop(now + 1.2);
      } catch (e) {
        console.warn('Outgoing synth error:', e);
      }
    };

    playTone();
    this.intervalId = setInterval(playTone, 3000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

const ringtone = new RingtoneSynth();

export const CallProvider = ({ children }) => {
  const { user } = useAuth();
  const socket = useSocket();

  const [callStatus, setCallStatus] = useState('idle'); // 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'
  const [callType, setCallType] = useState('video'); // 'video' | 'audio'
  const [isCaller, setIsCaller] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  
  const [incomingCallData, setIncomingCallData] = useState(null);
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isPeerMuted, setIsPeerMuted] = useState(false);
  const [isPeerVideoOff, setIsPeerVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const [speakingVolume, setSpeakingVolume] = useState(0); // 0 - 100
  const [durationSec, setDurationSec] = useState(0);

  // Hardware devices
  const [audioInputs, setAudioInputs] = useState([]);
  const [videoInputs, setVideoInputs] = useState([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState('');
  const [selectedVideoInput, setSelectedVideoInput] = useState('');

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const durationTimerRef = useRef(null);
  const ringingTimeoutRef = useRef(null);
  const screenTrackRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const callLastBytesRef = useRef(0);
  const disconnectGraceTimeoutRef = useRef(null);

  // Audio Analyser refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  const currentUserId = user?._id || user?.id;

  // Enumerate hardware media devices
  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const aInputs = devices.filter(d => d.kind === 'audioinput');
      const vInputs = devices.filter(d => d.kind === 'videoinput');
      setAudioInputs(aInputs);
      setVideoInputs(vInputs);
      if (aInputs.length > 0 && !selectedAudioInput) setSelectedAudioInput(aInputs[0].deviceId);
      if (vInputs.length > 0 && !selectedVideoInput) setSelectedVideoInput(vInputs[0].deviceId);
    } catch (err) {
      console.warn('Device enumeration error:', err);
    }
  }, [selectedAudioInput, selectedVideoInput]);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  // Audio Volume Analyser Loop
  const startAudioAnalyser = (stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        setSpeakingVolume(Math.min(100, Math.round((average / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn('Audio analyser setup error:', e);
    }
  };

  const stopAudioAnalyser = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setSpeakingVolume(0);
  };

  // Cleanup helper
  const resetCallState = useCallback(() => {
    ringtone.stop();
    stopAudioAnalyser();
    
    if (disconnectGraceTimeoutRef.current) {
      clearTimeout(disconnectGraceTimeoutRef.current);
      disconnectGraceTimeoutRef.current = null;
    }

    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    callLastBytesRef.current = 0;

    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    setIncomingCallData(null);
    setTargetUser(null);
    setIsCaller(false);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsPeerMuted(false);
    setIsPeerVideoOff(false);
    setIsScreenSharing(false);
    setIsMinimized(false);
    setDurationSec(0);
    pendingCandidatesRef.current = [];

    // Notify other components that a call completed/ended for real-time history refresh
    window.dispatchEvent(new CustomEvent('talksphere:call_ended'));
  }, []);

  // End Ongoing Call
  const endCall = useCallback((notifyPeer = true) => {
    const peerId = targetUser?._id || targetUser?.id || incomingCallData?.from;
    if (notifyPeer && peerId && socket) {
      socket.emit('end_call', { to: peerId, from: currentUserId });
    }
    resetCallState();
    toast('Call ended');
  }, [targetUser, incomingCallData, socket, currentUserId, resetCallState]);

  // Format seconds -> 00:00
  const formattedDuration = useCallback(() => {
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }, [durationSec]);

  // Start call timer and real-time WebRTC data tracker when connected
  const startDurationTimer = useCallback(() => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    setDurationSec(0);
    callLastBytesRef.current = 0;

    durationTimerRef.current = setInterval(() => {
      setDurationSec(prev => prev + 1);
    }, 1000);

    // Periodically track WebRTC data transfer (bytes transferred)
    statsIntervalRef.current = setInterval(async () => {
      if (!pcRef.current) return;
      try {
        const statsReport = await pcRef.current.getStats();
        let currentTotal = 0;
        statsReport.forEach(report => {
          if (report.type === 'inbound-rtp' && typeof report.bytesReceived === 'number') {
            currentTotal += report.bytesReceived;
          }
          if (report.type === 'outbound-rtp' && typeof report.bytesSent === 'number') {
            currentTotal += report.bytesSent;
          }
        });
        if (currentTotal > 0) {
          if (callLastBytesRef.current > 0) {
            const delta = currentTotal - callLastBytesRef.current;
            if (delta > 0) {
              addWebrtcDataTransferred(delta);
            }
          }
          callLastBytesRef.current = currentTotal;
        }
      } catch (e) {
        // Ignore stats errors
      }
    }, 2000);
  }, []);

  // Initialize RTCPeerConnection instance
  const createPeerConnection = useCallback((peerUserId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket && peerUserId) {
        socket.emit('ice_candidate', {
          to: peerUserId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote stream track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state changed:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        if (disconnectGraceTimeoutRef.current) {
          clearTimeout(disconnectGraceTimeoutRef.current);
          disconnectGraceTimeoutRef.current = null;
        }
      } else if (pc.connectionState === 'disconnected') {
        // ICE may be transiently switching networks or renegotiating; allow a 6-second grace window before ending call
        if (!disconnectGraceTimeoutRef.current) {
          disconnectGraceTimeoutRef.current = setTimeout(() => {
            if (pcRef.current && (pcRef.current.connectionState === 'disconnected' || pcRef.current.connectionState === 'failed')) {
              toast('Call connection terminated');
              endCall(true);
            }
          }, 6000);
        }
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        if (disconnectGraceTimeoutRef.current) {
          clearTimeout(disconnectGraceTimeoutRef.current);
          disconnectGraceTimeoutRef.current = null;
        }
        toast('Call connection terminated');
        endCall(true);
      }
    };

    pcRef.current = pc;
    return pc;
  }, [socket, endCall]);

  // Handle incoming media stream with low-data constraints support
  const getMediaStream = async (audioOnly, audioDeviceId, videoDeviceId) => {
    try {
      const { audio, video } = getWebRTCConstraints(audioOnly, audioDeviceId, videoDeviceId);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio,
        video
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      startAudioAnalyser(stream);
      return stream;
    } catch (err) {
      console.error('[WebRTC] Media access error:', err);
      toast.error('Unable to access camera or microphone');
      throw err;
    }
  };

  // Switch Audio Hardware Device on the fly
  const switchAudioDevice = async (deviceId) => {
    setSelectedAudioInput(deviceId);
    if (!localStreamRef.current) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: callType === 'video'
      });
      const newAudioTrack = newStream.getAudioTracks()[0];
      
      const senders = pcRef.current?.getSenders();
      const audioSender = senders?.find(s => s.track && s.track.kind === 'audio');
      if (audioSender) {
        await audioSender.replaceTrack(newAudioTrack);
      }

      // Stop old audio track
      localStreamRef.current.getAudioTracks().forEach(t => t.stop());
      localStreamRef.current.addTrack(newAudioTrack);
      toast.success('Microphone device updated');
    } catch (err) {
      toast.error('Failed to switch microphone');
    }
  };

  // Switch Video Hardware Device on the fly
  const switchVideoDevice = async (deviceId) => {
    setSelectedVideoInput(deviceId);
    if (!localStreamRef.current || callType !== 'video') return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { deviceId: { exact: deviceId } }
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      
      const senders = pcRef.current?.getSenders();
      const videoSender = senders?.find(s => s.track && s.track.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(newVideoTrack);
      }

      // Stop old video track
      localStreamRef.current.getVideoTracks().forEach(t => t.stop());
      localStreamRef.current.addTrack(newVideoTrack);
      setLocalStream(new MediaStream([localStreamRef.current.getAudioTracks()[0], newVideoTrack]));
      toast.success('Camera device updated');
    } catch (err) {
      toast.error('Failed to switch camera');
    }
  };

  // Start Outgoing Call
  const startCall = async (userToCall, type = 'video') => {
    if (!socket) return toast.error('Socket connection unavailable');
    if (callStatus !== 'idle') return toast.error('You are already in a call');

    try {
      ringtone.playOutgoing();
      setCallType(type);
      setTargetUser(userToCall);
      setIsCaller(true);
      setCallStatus('calling');

      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
      }

      // 30-second ringing timeout for caller
      ringingTimeoutRef.current = setTimeout(() => {
        console.log('[WebRTC] Ringing timed out after 30s on caller side');
        toast.error('Call unanswered (Timed out)');
        endCall(true);
      }, 30000);

      const targetId = userToCall._id || userToCall.id;
      const stream = await getMediaStream(type === 'audio', selectedAudioInput, selectedVideoInput);
      const pc = createPeerConnection(targetId);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      await applyPeerConnectionBitrates(pc, loadStoragePrefs().useLessData);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call_user', {
        userToCall: targetId,
        signalData: offer,
        from: currentUserId,
        callerName: user?.username || user?.name || 'User',
        callerAvatar: user?.avatar,
        callType: type
      });
    } catch (err) {
      resetCallState();
    }
  };

  // Answer Incoming Call
  const answerCall = async () => {
    if (!incomingCallData || !socket) return;
    ringtone.stop();

    try {
      setCallStatus('connected');
      const type = incomingCallData.callType;
      setCallType(type);

      const peerId = incomingCallData.from;
      setTargetUser({
        _id: peerId,
        username: incomingCallData.callerName,
        avatar: incomingCallData.callerAvatar
      });

      const stream = await getMediaStream(type === 'audio', selectedAudioInput, selectedVideoInput);
      const pc = createPeerConnection(peerId);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      await applyPeerConnectionBitrates(pc, loadStoragePrefs().useLessData);

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCallData.signal));

      // Process queued ICE candidates
      while (pendingCandidatesRef.current.length > 0) {
        const candidate = pendingCandidatesRef.current.shift();
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('answer_call', {
        to: peerId,
        from: currentUserId,
        signal: answer
      });

      startDurationTimer();
    } catch (err) {
      console.error('[WebRTC] Answer call error:', err);
      toast.error('Failed to establish call connection');
      endCall(true);
    }
  };

  // Reject Call
  const rejectCall = () => {
    if (incomingCallData && socket) {
      socket.emit('reject_call', { to: incomingCallData.from, from: currentUserId });
    }
    resetCallState();
    toast('Call declined');
  };

  // Toggle Microphone
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMutedState = !audioTrack.enabled;
        setIsMuted(newMutedState);

        const peerId = targetUser?._id || targetUser?.id || incomingCallData?.from;
        if (socket && peerId) {
          socket.emit('toggle_media', { to: peerId, isMuted: newMutedState, isVideoOff });
        }
      }
    }
  };

  // Toggle Camera / Mid-Call Video Upgrade
  const toggleVideo = async () => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const newVideoOffState = !videoTrack.enabled;
      setIsVideoOff(newVideoOffState);

      const peerId = targetUser?._id || targetUser?.id || incomingCallData?.from;
      if (socket && peerId) {
        socket.emit('toggle_media', { to: peerId, isMuted, isVideoOff: newVideoOffState });
      }
    } else if (callType === 'audio') {
      // Upgrade from audio-only to video mid-call
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newVideoTrack = videoStream.getVideoTracks()[0];
        localStreamRef.current.addTrack(newVideoTrack);
        
        const pc = pcRef.current;
        if (pc) {
          pc.addTrack(newVideoTrack, localStreamRef.current);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const peerId = targetUser?._id || targetUser?.id || incomingCallData?.from;
          if (socket && peerId) {
            socket.emit('call_user', {
              userToCall: peerId,
              signalData: offer,
              from: currentUserId,
              callerName: user?.username || user?.name || 'User',
              callerAvatar: user?.avatar,
              callType: 'video'
            });
          }
        }
        setCallType('video');
        setIsVideoOff(false);
        toast.success('Video enabled');
      } catch (e) {
        toast.error('Could not enable camera');
      }
    }
  };

  // Screen Sharing Toggle
  const toggleScreenShare = async () => {
    if (!pcRef.current) return;

    if (isScreenSharing) {
      // Revert back to local camera track
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }
      const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
      const senders = pcRef.current.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      if (videoSender && cameraTrack) {
        await videoSender.replaceTrack(cameraTrack);
      }
      setIsScreenSharing(false);
      toast('Screen share stopped');
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;

        const senders = pcRef.current.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
        toast.success('Sharing screen');
      } catch (err) {
        console.warn('Screen share canceled or failed', err);
      }
    }
  };

  const toggleMinimize = () => {
    setIsMinimized(prev => !prev);
  };

  // Socket Event Listeners for Call Signaling
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data) => {
      console.log('[WebRTC] Incoming call received:', data);
      if (callStatus !== 'idle') {
        console.warn('[WebRTC] Ignoring incoming call because user is already busy or in a call');
        return;
      }
      setIncomingCallData(data);
      setCallStatus('ringing');
      setCallType(data.callType);
      ringtone.playIncoming();
    };

    const handleCallAccepted = async (data) => {
      console.log('[WebRTC] Call accepted by remote peer');
      ringtone.stop();

      // Immediately clear caller-side ringing timeout
      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
        ringingTimeoutRef.current = null;
        console.log('[WebRTC] Ringing timeout cleared on caller side');
      }

      setCallStatus('connected');
      
      if (pcRef.current) {
        // Guard against duplicate / wrong state
        if (pcRef.current.signalingState !== 'have-local-offer') {
          console.warn('[WebRTC] Skipping setRemoteDescription because signalingState is:', pcRef.current.signalingState);
          return;
        }
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.signal));
          while (pendingCandidatesRef.current.length > 0) {
            const candidate = pendingCandidatesRef.current.shift();
            if (candidate) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn(e));
            }
          }
        } catch (err) {
          console.error('[WebRTC] Failed to set remote description on call_accepted:', err);
        }
      }
      startDurationTimer();
    };

    const handleIceCandidate = async (data) => {
      if (!data?.candidate) return;
      if (pcRef.current && pcRef.current.remoteDescription) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      } else {
        pendingCandidatesRef.current.push(data.candidate);
      }
    };

    const handleCallRejected = () => {
      toast.error('Call declined by user');
      resetCallState();
    };

    const handleCallEnded = () => {
      toast('Call ended by peer');
      resetCallState();
    };

    const handleCallTimeout = () => {
      if (callStatus === 'connected') {
        console.warn('[WebRTC] Received call_timeout while call is already connected, ignoring');
        return;
      }
      toast.error('Call unanswered (Timed out)');
      resetCallState();
    };

    const handleUserBusy = (data) => {
      toast.error(data.message || 'User is on another call');
      resetCallState();
    };

    const handleDismissIncomingCall = () => {
      // Do not reset call state if this tab has already accepted or initiated the call
      if (callStatus === 'connected' || isCaller) return;
      console.log('[Multi-Tab] Incoming call answered/dismissed on another tab');
      resetCallState();
    };

    const handlePeerMediaToggle = (data) => {
      if (data.isMuted !== undefined) setIsPeerMuted(data.isMuted);
      if (data.isVideoOff !== undefined) setIsPeerVideoOff(data.isVideoOff);
    };

    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('ice_candidate', handleIceCandidate);
    socket.on('call_rejected', handleCallRejected);
    socket.on('call_ended', handleCallEnded);
    socket.on('call_timeout', handleCallTimeout);
    socket.on('user_busy', handleUserBusy);
    socket.on('dismiss_incoming_call', handleDismissIncomingCall);
    socket.on('peer_media_toggle', handlePeerMediaToggle);

    return () => {
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('ice_candidate', handleIceCandidate);
      socket.off('call_rejected', handleCallRejected);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_timeout', handleCallTimeout);
      socket.off('user_busy', handleUserBusy);
      socket.off('dismiss_incoming_call', handleDismissIncomingCall);
      socket.off('peer_media_toggle', handlePeerMediaToggle);
    };
  }, [socket, callStatus, isCaller, resetCallState, startDurationTimer]);

  // Dynamically update WebRTC bitrate constraints if low-data setting toggles during active call
  useEffect(() => {
    const handlePrefsChange = (e) => {
      const prefs = e?.detail || loadStoragePrefs();
      if (pcRef.current && callStatus === 'connected') {
        applyPeerConnectionBitrates(pcRef.current, Boolean(prefs.useLessData));
      }
    };
    window.addEventListener('ts_storage_prefs_changed', handlePrefsChange);
    return () => window.removeEventListener('ts_storage_prefs_changed', handlePrefsChange);
  }, [callStatus]);

  return (
    <CallContext.Provider value={{
      callStatus,
      callType,
      isCaller,
      targetUser,
      incomingCallData,
      localStream,
      remoteStream,
      isMuted,
      isVideoOff,
      isPeerMuted,
      isPeerVideoOff,
      isScreenSharing,
      isMinimized,
      speakingVolume,
      durationText: formattedDuration(),
      audioInputs,
      videoInputs,
      selectedAudioInput,
      selectedVideoInput,
      startCall,
      answerCall,
      rejectCall,
      endCall,
      toggleAudio,
      toggleVideo,
      toggleScreenShare,
      toggleMinimize,
      switchAudioDevice,
      switchVideoDevice
    }}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
