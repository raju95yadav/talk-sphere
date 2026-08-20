import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Monitor, Maximize2, Minimize2, User, VolumeX, Settings, X, ChevronRight, MicIcon, Camera } from 'lucide-react';
import { useCall } from '../context/CallContext';

const CallModal = () => {
  const {
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
    durationText,
    audioInputs,
    videoInputs,
    selectedAudioInput,
    selectedVideoInput,
    answerCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    toggleMinimize,
    switchAudioDevice,
    switchVideoDevice
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pipVideoRef = useRef(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const modalContainerRef = useRef(null);

  // Attach local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callStatus, isMinimized]);

  // Attach remote stream to remote video/audio elements
  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      if (pipVideoRef.current) pipVideoRef.current.srcObject = remoteStream;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callStatus, isMinimized]);

  const toggleFullscreenMode = () => {
    if (!modalContainerRef.current) return;
    if (!document.fullscreenElement) {
      modalContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => console.warn(err));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(err => console.warn(err));
    }
  };

  if (callStatus === 'idle') return null;

  const displayUser = isCaller ? targetUser : (incomingCallData ? {
    username: incomingCallData.callerName,
    avatar: incomingCallData.callerAvatar
  } : targetUser);

  const displayName = displayUser?.username || displayUser?.name || 'User';
  const displayAvatar = displayUser?.avatar;

  // Draggable Floating PiP View when Minimized
  if (isMinimized && callStatus === 'connected') {
    return (
      <motion.div 
        drag
        dragConstraints={{ left: -500, right: 20, top: -500, bottom: 20 }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="fixed bottom-6 right-6 z-[9999] w-72 h-44 bg-bg-card/95 backdrop-blur-2xl border border-white/20 rounded-3xl overflow-hidden shadow-2xl floating-pip-container flex flex-col justify-between cursor-grab active:cursor-grabbing"
      >
        <audio ref={remoteAudioRef} autoPlay />
        
        {/* Floating PiP Video or Avatar */}
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center">
          {callType === 'video' && !isPeerVideoOff ? (
            <video ref={pipVideoRef} autoPlay playsInline className="w-full h-full object-cover pointer-events-none" />
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-2">
              <div 
                className="w-14 h-14 rounded-full border-2 border-accent-primary/60 overflow-hidden bg-bg-card-secondary flex items-center justify-center transition-all duration-200"
                style={{ boxShadow: speakingVolume > 15 ? `0 0 ${speakingVolume / 2}px rgba(0, 240, 255, 0.8)` : 'none' }}
              >
                {displayAvatar ? <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" /> : <User size={24} className="text-accent-primary" />}
              </div>
              <span className="text-[10px] font-black uppercase text-white mt-1">{displayName}</span>
            </div>
          )}
        </div>

        {/* Floating Controls Overlay */}
        <div className="relative z-10 p-2 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent pointer-events-auto">
          <span className="text-[10px] font-bold text-white/80 uppercase font-mono px-2 py-0.5 rounded-full bg-black/40 border border-white/10">{durationText}</span>
          <button 
            onClick={toggleMinimize} 
            className="p-1.5 rounded-full bg-black/50 hover:bg-white/20 text-white transition-all"
            title="Expand Call Window"
          >
            <Maximize2 size={14} />
          </button>
        </div>

        <div className="relative z-10 p-2 flex items-center justify-center gap-3 bg-gradient-to-t from-black/80 to-transparent pointer-events-auto">
          <button onClick={toggleAudio} className={`p-2 rounded-full ${isMuted ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}>
            {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
          {callType === 'video' && (
            <button onClick={toggleVideo} className={`p-2 rounded-full ${isVideoOff ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}>
              {isVideoOff ? <VideoOff size={14} /> : <Video size={14} />}
            </button>
          )}
          <button onClick={() => endCall(true)} className="p-2 rounded-full bg-red-600 text-white hover:bg-red-500">
            <PhoneOff size={14} />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <div 
        ref={modalContainerRef}
        className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-300"
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-4xl h-[85vh] max-h-[750px] bg-bg-card/90 border border-border-main rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between"
        >
          {/* Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent-primary/10 blur-[120px] pointer-events-none rounded-full"></div>

          {/* Hidden Remote Audio Player */}
          <audio ref={remoteAudioRef} autoPlay />

          {/* Incoming / Outgoing Ringing State */}
          {(callStatus === 'ringing' || callStatus === 'calling') && (
            <div className="flex-1 flex flex-col items-center justify-center relative p-6 text-center z-10">
              {/* Ripple Animation behind Avatar */}
              <div className="relative mb-8 flex items-center justify-center">
                <div className="absolute w-36 h-36 rounded-full bg-accent-primary/20 animate-ring-ripple-1"></div>
                <div className="absolute w-36 h-36 rounded-full bg-accent-primary/20 animate-ring-ripple-2"></div>
                
                <div className="w-28 h-28 rounded-full border-2 border-accent-primary/50 overflow-hidden bg-bg-card-secondary shadow-2xl relative z-10 flex items-center justify-center">
                  {displayAvatar ? (
                    <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <User size={48} className="text-accent-primary" />
                  )}
                </div>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2 uppercase">
                {displayName}
              </h2>
              
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent-primary animate-pulse mb-8">
                {callStatus === 'calling' ? 'DIALING NEURAL LINK...' : `INCOMING ${callType.toUpperCase()} TRANSMISSION`}
              </p>

              {/* Action Buttons for Ringing/Calling */}
              <div className="flex items-center gap-6 mt-4">
                {callStatus === 'ringing' && !isCaller ? (
                  <>
                    <button 
                      onClick={rejectCall}
                      className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 hover:scale-110 active:scale-95 transition-all"
                      title="Decline Call"
                    >
                      <PhoneOff size={28} />
                    </button>
                    <button 
                      onClick={answerCall}
                      className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-110 active:scale-95 transition-all animate-bounce"
                      title="Accept Call"
                    >
                      {callType === 'video' ? <Video size={28} /> : <Phone size={28} />}
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => endCall(true)}
                    className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 hover:scale-110 active:scale-95 transition-all"
                    title="Cancel Call"
                  >
                    <PhoneOff size={28} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Connected Call State */}
          {callStatus === 'connected' && (
            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
              {/* Header Bar overlay */}
              <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-3 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 pointer-events-auto">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs font-black text-white tracking-wider uppercase">{displayName}</span>
                  <span className="text-[10px] text-white/60 font-mono pl-2 border-l border-white/20">{durationText}</span>
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                  <button 
                    onClick={() => setShowDeviceSettings(!showDeviceSettings)}
                    className="p-2.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white hover:bg-white/20 transition-all"
                    title="Hardware Settings"
                  >
                    <Settings size={16} />
                  </button>
                  <button 
                    onClick={toggleMinimize}
                    className="p-2.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white hover:bg-white/20 transition-all"
                    title="Minimize to PiP Floating Overlay"
                  >
                    <Minimize2 size={16} />
                  </button>
                  <button 
                    onClick={toggleFullscreenMode}
                    className="p-2.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white hover:bg-white/20 transition-all"
                    title="Toggle Fullscreen"
                  >
                    <Maximize2 size={16} />
                  </button>
                </div>
              </div>

              {/* Hardware Device Settings Switcher Panel */}
              {showDeviceSettings && (
                <div className="absolute top-16 right-4 z-30 w-72 bg-bg-card/95 backdrop-blur-2xl border border-border-main p-4 rounded-2xl shadow-2xl text-left">
                  <div className="flex items-center justify-between mb-3 border-b border-border-main pb-2">
                    <span className="text-xs font-black uppercase text-white tracking-wider">Media Devices</span>
                    <button onClick={() => setShowDeviceSettings(false)} className="text-text-muted hover:text-white"><X size={14} /></button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Microphone</label>
                      <select 
                        value={selectedAudioInput} 
                        onChange={(e) => switchAudioDevice(e.target.value)}
                        className="w-full bg-bg-card-secondary border border-border-main rounded-xl p-2 text-[10px] font-bold text-text-main outline-none"
                      >
                        {audioInputs.map(d => (
                          <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 5)}`}</option>
                        ))}
                      </select>
                    </div>

                    {callType === 'video' && (
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Camera</label>
                        <select 
                          value={selectedVideoInput} 
                          onChange={(e) => switchVideoDevice(e.target.value)}
                          className="w-full bg-bg-card-secondary border border-border-main rounded-xl p-2 text-[10px] font-bold text-text-main outline-none"
                        >
                          {videoInputs.map(d => (
                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Main Remote View (Video or Audio Visualizer) */}
              {callType === 'video' ? (
                <div className="w-full h-full relative flex items-center justify-center bg-zinc-950">
                  {isPeerVideoOff ? (
                    <div className="flex flex-col items-center justify-center text-center p-6">
                      <div 
                        className="w-24 h-24 rounded-full border-2 border-accent-primary/40 bg-bg-card-secondary flex items-center justify-center mb-4 overflow-hidden shadow-2xl transition-all duration-200"
                        style={{ boxShadow: speakingVolume > 15 ? `0 0 ${speakingVolume / 2}px rgba(0, 240, 255, 0.8)` : 'none' }}
                      >
                        {displayAvatar ? <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" /> : <User size={40} className="text-accent-primary" />}
                      </div>
                      <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Camera Turned Off</p>
                    </div>
                  ) : (
                    <video 
                      ref={remoteVideoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* Peer Audio Mute Badge */}
                  {isPeerMuted && (
                    <div className="absolute top-16 left-4 bg-red-500/80 backdrop-blur-md text-white text-[10px] font-black uppercase px-3 py-1 rounded-full flex items-center gap-1.5 z-20">
                      <VolumeX size={12} /> Mic Off
                    </div>
                  )}
                </div>
              ) : (
                /* Audio Only Call Visualizer */
                <div className="w-full h-full flex flex-col items-center justify-center relative p-6 bg-gradient-to-b from-bg-main to-bg-card">
                  <div 
                    className="w-32 h-32 rounded-full border-4 border-accent-primary/60 overflow-hidden bg-bg-card-secondary shadow-2xl mb-6 relative transition-all duration-150"
                    style={{ boxShadow: speakingVolume > 10 ? `0 0 ${speakingVolume}px rgba(0, 240, 255, 0.8)` : 'none' }}
                  >
                    {displayAvatar ? (
                      <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <User size={56} className="text-accent-primary" />
                    )}
                  </div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">{displayName}</h3>
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-6">AUDIO ENCRYPTED LINK</p>
                  
                  {/* Dynamic Sound Wave Bars */}
                  <div className="flex items-center gap-1.5 h-8">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div 
                        key={i} 
                        className="w-1.5 bg-accent-primary rounded-full animate-wave-bar"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      ></div>
                    ))}
                  </div>
                </div>
              )}

              {/* Local PiP Video Window (for video call) */}
              {callType === 'video' && (
                <div className="absolute bottom-20 right-4 sm:bottom-24 sm:right-6 w-32 sm:w-44 aspect-[3/4] bg-bg-card border-2 border-white/20 rounded-2xl overflow-hidden shadow-2xl z-20 group">
                  {isVideoOff ? (
                    <div className="w-full h-full bg-black/90 flex flex-col items-center justify-center p-2 text-center">
                      <VideoOff size={20} className="text-text-muted mb-1" />
                      <span className="text-[9px] text-text-muted uppercase font-bold">You</span>
                    </div>
                  ) : (
                    <video 
                      ref={localVideoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                  )}
                  {isMuted && (
                    <div className="absolute bottom-2 left-2 bg-red-600/90 text-white p-1 rounded-full">
                      <MicOff size={10} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Floating Control Bar for Active Call */}
          {callStatus === 'connected' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 sm:gap-4 bg-black/60 backdrop-blur-2xl p-3 px-6 rounded-full border border-white/15 shadow-2xl">
              {/* Mic Toggle */}
              <button 
                onClick={toggleAudio}
                className={`p-3 sm:p-3.5 rounded-full transition-all ${isMuted ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
              >
                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              {/* Video Toggle / Upgrade */}
              <button 
                onClick={toggleVideo}
                className={`p-3 sm:p-3.5 rounded-full transition-all ${isVideoOff ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
              >
                {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
              </button>

              {/* Screen Share Toggle */}
              {callType === 'video' && (
                <button 
                  onClick={toggleScreenShare}
                  className={`p-3 sm:p-3.5 rounded-full transition-all ${isScreenSharing ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/30' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                  title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
                >
                  <Monitor size={18} />
                </button>
              )}

              {/* End Call Button */}
              <button 
                onClick={() => endCall(true)}
                className="p-3.5 sm:p-4 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/40 hover:scale-105 active:scale-95 transition-all ml-2"
                title="End Call"
              >
                <PhoneOff size={20} />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CallModal;
