import { useState, useRef, useCallback } from "react";

export function useWebRTC() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const connect = useCallback(async (initialUrl: string) => {
    disconnect();
    setError(null);

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });
      pcRef.current = pc;

      // Add transceiver to indicate we want to receive video/audio
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (event) => {
        if (videoRef.current) {
          if (event.streams && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
          } else {
            let stream = videoRef.current.srcObject as MediaStream;
            if (!stream) {
              stream = new MediaStream();
              videoRef.current.srcObject = stream;
            }
            stream.addTrack(event.track);
          }
        }
      };

      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);
        setIsConnected(pc.connectionState === "connected");
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete to ensure SDP has candidates
      await new Promise<void>((resolve) => {
        if ((pc.signalingState as string) === "closed" || pc.iceGatheringState === "complete") {
          resolve();
        } else {
          const checkState = () => {
            if ((pc.signalingState as string) === "closed" || pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", checkState);
              resolve();
            }
          };
          pc.addEventListener("icegatheringstatechange", checkState);
          // Fallback timeout
          setTimeout(resolve, 1500);
        }
      });

      if ((pc.signalingState as string) === "closed") return;

      // Try the original URL first
      let whepUrl = initialUrl;
      let response = await fetch(whepUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription?.sdp,
      });

      // If 404, fallback to /webrtc endpoint (for older MediaMTX versions)
      if (response.status === 404 && whepUrl.endsWith("/whep")) {
        console.warn("WHEP endpoint returned 404, trying /webrtc fallback...");
        whepUrl = initialUrl.replace("/whep", "/webrtc");
        response = await fetch(whepUrl, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: pc.localDescription?.sdp,
        });
      }

      if (!response.ok) {
        throw new Error(`WHEP connection failed (${response.status}): ${response.statusText}`);
      }

      const answerSdp = await response.text();
      
      if ((pc.signalingState as string) === "closed") return;

      const answer = new RTCSessionDescription({
        type: "answer",
        sdp: answerSdp,
      });

      await pc.setRemoteDescription(answer);

    } catch (err: any) {
      console.error("WebRTC Error:", err);
      setError(err.message || "Failed to establish WebRTC connection");
      disconnect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setConnectionState("closed");
    setIsConnected(false);
  }, []);

  return {
    videoRef,
    connectionState,
    isConnected,
    error,
    connect,
    disconnect,
  };
}
